import crypto from "crypto";
import mongoose from "mongoose";
import { config } from "../config";
import type { Currency } from "../types/domain";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { applyBalanceDelta } from "./balanceService";
import { parseAmountToUnits, unitsToString } from "../utils/amount";
import { badRequest, notFound } from "../utils/errors";
import { logEvent } from "./eventService";

interface CryptoBotInvoiceResponse {
  ok: boolean;
  result: {
    invoice_id: number;
    status: string;
    pay_url: string;
  };
}

interface CryptoBotTransferResponse {
  ok: boolean;
  result: {
    transfer_id: number;
    status: string;
  };
}

export async function createInvoice(params: {
  userId: string;
  currency: Currency;
  amount: string;
}) {
  if (!config.cryptoBotToken || config.cryptoBotToken.trim() === "") {
    throw badRequest("CryptoBot token not configured. Please set CRYPTOBOT_TOKEN in environment variables.");
  }
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    throw badRequest("Invalid user ID");
  }
  
  const amountUnits = parseAmountToUnits(params.amount, params.currency);
  if (amountUnits <= 0n) {
    throw badRequest("Amount must be positive");
  }
  
  // Max 10000 TON or 10000 USDT (in smallest units: nanoTON and microUSDT)
  const maxAmount = params.currency === "TON" ? 10000000000000n : 10000000000n;
  if (amountUnits > maxAmount) {
    throw badRequest("Amount exceeds maximum limit");
  }

  const apiUrl = `${config.cryptoBotApiBase}/createInvoice`;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[CryptoBot] Creating invoice via ${config.cryptoBotApiBase}`);
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": config.cryptoBotToken,
    },
    body: JSON.stringify({
      asset: params.currency,
      amount: params.amount,
      payload: params.userId,
    }),
  });

  const data = (await response.json()) as CryptoBotInvoiceResponse;
  if (!data.ok) {
    const errorCode = (data as any).error?.code;
    const errorName = (data as any).error?.name || (data as any).error?.message || "Failed to create invoice";
    console.error(`[CryptoBot API Error] ${errorName}`, { 
      status: response.status, 
      response: data,
      params: { currency: params.currency, amount: params.amount }
    });
    
    // Более понятные сообщения для распространенных ошибок
    if (errorCode === 401 || errorName === "UNAUTHORIZED") {
      throw badRequest("Invalid CryptoBot token. Please check your CRYPTOBOT_TOKEN in environment variables.");
    }
    
    throw badRequest(`Failed to create invoice: ${errorName}`);
  }

  await Transaction.create({
    userId: params.userId,
    type: "deposit",
    currency: params.currency,
    amount: unitsToString(amountUnits),
    status: "pending",
    provider: "cryptobot",
    externalId: data.result.invoice_id.toString(),
    meta: {
      payUrl: data.result.pay_url,
    },
  });

  return {
    invoiceId: data.result.invoice_id,
    payUrl: data.result.pay_url,
  };
}

export function verifyWebhookSignature(body: any, signature?: string) {
  // Если токен не установлен, пропускаем проверку (для разработки)
  if (!config.cryptoBotToken) {
    return true;
  }
  
  if (!signature) {
    return false;
  }
  
  // Алгоритм проверки подписи CryptoBot:
  // 1. Секрет = SHA256(токен)
  // 2. Сериализуем тело через JSON.stringify
  // 3. HMAC-SHA256(секрет, сериализованное_тело) в hex
  // 4. Сравниваем с заголовком crypto-pay-api-signature
  
  const secret = crypto
    .createHash("sha256")
    .update(config.cryptoBotToken)
    .digest();
  
  const checkString = JSON.stringify(body);
  
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(checkString)
    .digest("hex");
  
  const cleanSignature = signature.trim();
  return hmac === cleanSignature;
}

export async function handleInvoicePaid(payload: {
  invoice_id: number;
  asset: Currency;
  amount: string;
  status: string;
  payload?: string;
}) {
  if (!payload.invoice_id || typeof payload.invoice_id !== 'number') {
    throw badRequest("Invalid invoice ID");
  }
  
  const invoiceId = payload.invoice_id.toString();
  let transaction = await Transaction.findOne({
    provider: "cryptobot",
    externalId: invoiceId,
  });
  
  if (!transaction && payload.payload) {
    if (!mongoose.Types.ObjectId.isValid(payload.payload)) {
      throw badRequest("Invalid user ID in payload");
    }
    transaction = await Transaction.create({
      userId: payload.payload,
      type: "deposit",
      currency: payload.asset,
      amount: "0",
      status: "pending",
      provider: "cryptobot",
      externalId: invoiceId,
    });
  }
  if (!transaction) {
    throw notFound("Invoice not found");
  }
  if (transaction.status === "completed") {
    return transaction;
  }

  const user = await User.findById(transaction.userId);
  if (!user) {
    throw notFound("User not found");
  }

  const units = parseAmountToUnits(payload.amount, payload.asset);
  applyBalanceDelta(user, payload.asset, units, 0n);
  transaction.status = "completed";
  transaction.amount = unitsToString(units);
  await user.save();
  await transaction.save();
  await logEvent({
    type: "deposit.completed",
    userId: user._id.toString(),
    payload: { provider: "cryptobot", amount: payload.amount, currency: payload.asset },
  });
  return transaction;
}

export async function transfer(params: {
  userId: string;
  currency: Currency;
  amount: string;
  recipient: string;
}) {
  if (!config.cryptoBotToken) {
    throw badRequest("CryptoBot token not configured");
  }
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    throw badRequest("Invalid user ID");
  }
  if (!params.recipient || params.recipient.length > 200) {
    throw badRequest("Invalid recipient address");
  }
  const amountUnits = parseAmountToUnits(params.amount, params.currency);
  if (amountUnits <= 0n) {
    throw badRequest("Amount must be positive");
  }
  
  // Max 10000 TON or 10000 USDT (in smallest units: nanoTON and microUSDT)
  const maxAmount = params.currency === "TON" ? 10000000000000n : 10000000000n;
  if (amountUnits > maxAmount) {
    throw badRequest("Amount exceeds maximum limit");
  }

  const response = await fetch(`${config.cryptoBotApiBase}/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": config.cryptoBotToken,
    },
    body: JSON.stringify({
      asset: params.currency,
      amount: params.amount,
      user_id: params.recipient,
      spend_id: crypto.randomUUID(),
    }),
  });
  const data = (await response.json()) as CryptoBotTransferResponse;
  if (!data.ok) {
    throw badRequest("Transfer failed");
  }

  // Транзакция создаётся и управляется в роуте /withdraw
  await logEvent({
    type: "withdrawal.completed",
    userId: params.userId,
    payload: { provider: "cryptobot", amount: params.amount, currency: params.currency },
  });

  return data.result;
}
