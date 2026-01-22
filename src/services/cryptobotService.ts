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

export function verifyWebhookSignature(rawBody: Buffer, signature?: string) {
  if (!config.cryptoBotWebhookSecret) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Webhook] CRYPTOBOT_WEBHOOK_SECRET not set, skipping signature verification`);
    }
    return true;
  }
  if (!signature) {
    console.error(`[Webhook] No signature header provided, but CRYPTOBOT_WEBHOOK_SECRET is set`);
    return false;
  }
  
  // Вычисляем ожидаемую подпись в hex формате
  const digestHex = crypto
    .createHmac("sha256", config.cryptoBotWebhookSecret)
    .update(rawBody)
    .digest("hex");
  
  // Вычисляем ожидаемую подпись в base64 формате (на случай, если CryptoBot отправляет в base64)
  const digestBase64 = crypto
    .createHmac("sha256", config.cryptoBotWebhookSecret)
    .update(rawBody)
    .digest("base64");
  
  // Убираем пробелы и переносы строк из подписи
  const cleanSignature = signature.trim();
  
  // Проверяем hex формат (64 символа для SHA256)
  let isValidHex = false;
  if (cleanSignature.length === digestHex.length) {
    isValidHex = crypto.timingSafeEqual(
      Buffer.from(digestHex),
      Buffer.from(cleanSignature)
    );
  }
  
  // Проверяем base64 формат (44 символа для SHA256)
  let isValidBase64 = false;
  if (cleanSignature.length === digestBase64.length) {
    isValidBase64 = crypto.timingSafeEqual(
      Buffer.from(digestBase64),
      Buffer.from(cleanSignature)
    );
  }
  
  const isValid = isValidHex || isValidBase64;
  
  if (!isValid) {
    console.error(`[Webhook] Signature verification failed`, {
      signatureLength: cleanSignature.length,
      expectedHexLength: digestHex.length,
      expectedBase64Length: digestBase64.length,
      signaturePreview: cleanSignature.substring(0, 20),
      expectedHexPreview: digestHex.substring(0, 20),
      expectedBase64Preview: digestBase64.substring(0, 20),
    });
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`[Webhook] Signature verified successfully (format: ${isValidHex ? 'hex' : 'base64'})`);
  }
  
  return isValid;
}

export async function handleInvoicePaid(payload: {
  invoice_id: number;
  asset: Currency;
  amount: string;
  status: string;
  payload?: string;
}) {
  if (!payload.invoice_id || typeof payload.invoice_id !== 'number') {
    console.error(`[Webhook] Invalid invoice ID: ${payload.invoice_id}, type: ${typeof payload.invoice_id}`);
    throw badRequest("Invalid invoice ID");
  }
  
  const invoiceId = payload.invoice_id.toString();
  let transaction = await Transaction.findOne({
    provider: "cryptobot",
    externalId: invoiceId,
  });
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Webhook] Processing invoice: ${invoiceId}, transaction found: ${!!transaction}, has payload: ${!!payload.payload}`);
  }
  
  if (!transaction && payload.payload) {
    if (!mongoose.Types.ObjectId.isValid(payload.payload)) {
      console.error(`[Webhook] Invalid user ID in payload: ${payload.payload}`);
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
    console.error(`[Webhook] Invoice not found: ${invoiceId}`);
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
