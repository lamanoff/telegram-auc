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
  if (!config.cryptoBotToken) {
    throw badRequest("CryptoBot token not configured");
  }
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    throw badRequest("Invalid user ID");
  }
  
  const amountUnits = parseAmountToUnits(params.amount, params.currency);
  if (amountUnits <= 0n) {
    throw badRequest("Amount must be positive");
  }
  
  const maxAmount = params.currency === "TON" ? 1000000n : 1000000000000n;
  if (amountUnits > maxAmount) {
    throw badRequest("Amount exceeds maximum limit");
  }

  const response = await fetch(`${config.cryptoBotApiBase}/createInvoice`, {
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
    throw badRequest("Failed to create invoice");
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
    return true;
  }
  if (!signature) {
    return false;
  }
  const digest = crypto
    .createHmac("sha256", config.cryptoBotWebhookSecret)
    .update(rawBody)
    .digest("hex");
  const expected = Buffer.from(digest);
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
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
  
  const maxAmount = params.currency === "TON" ? 1000000n : 1000000000000n;
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
