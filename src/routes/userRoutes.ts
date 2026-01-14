import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { Transaction } from "../models/Transaction";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, notFound } from "../utils/errors";
import type { Currency } from "../types/domain";
import {
  parseAmountToUnits,
  unitsFromString,
  unitsToAmount,
  unitsToString,
} from "../utils/amount";
import { applyBalanceDelta, getAvailable } from "../services/balanceService";
import { createInvoice, transfer } from "../services/cryptobotService";

const router = Router();

const depositSchema = z.object({
  provider: z.enum(["cryptobot"]),
  currency: z.enum(["TON", "USDT"]),
  amount: z.string().max(50).regex(/^\d+(\.\d+)?$/),
});

const withdrawSchema = z.object({
  provider: z.enum(["cryptobot"]),
  currency: z.enum(["TON", "USDT"]),
  amount: z.string(),
  destination: z.string().min(1).max(200),
});

router.get(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?.id).lean();
    if (!user) {
      throw notFound("User not found");
    }
    const formatCurrency = (currency: Currency) => {
      const total = unitsFromString(user.balances[currency].total);
      const locked = unitsFromString(user.balances[currency].locked);
      return {
        total: unitsToAmount(total, currency),
        locked: unitsToAmount(locked, currency),
        available: unitsToAmount(total - locked, currency),
      };
    };
    res.json({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      balances: {
        TON: formatCurrency("TON"),
        USDT: formatCurrency("USDT"),
      },
    });
  })
);

router.post(
  "/deposit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = depositSchema.parse(req.body);
    const user = await User.findById(req.user?.id);
    if (!user) {
      throw notFound("User not found");
    }

    if (!data.amount) {
      throw badRequest("Amount required");
    }
    const invoice = await createInvoice({
      userId: user._id.toString(),
      currency: data.currency,
      amount: data.amount,
    });
    res.json({ provider: "cryptobot", invoice });
  })
);

router.post(
  "/withdraw",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = withdrawSchema.parse(req.body);
    const user = await User.findById(req.user?.id);
    if (!user) {
      throw notFound("User not found");
    }
    const units = parseAmountToUnits(data.amount, data.currency);
    if (units <= 0n) {
      throw badRequest("Amount must be positive");
    }
    const available = getAvailable(user.balances[data.currency]);
    if (available < units) {
      throw badRequest("Insufficient balance");
    }

    // Списываем баланс
    applyBalanceDelta(user, data.currency, -units, 0n);
    await user.save();

    // Создаём pending транзакцию
    const tx = await Transaction.create({
      userId: user._id,
      type: "withdrawal",
      currency: data.currency,
      amount: unitsToString(units),
      status: "pending",
      provider: "cryptobot",
      meta: { recipient: data.destination },
    });

    try {
      const transferResult = await transfer({
        userId: user._id.toString(),
        currency: data.currency,
        amount: data.amount,
        recipient: data.destination,
      });

      // Успех — обновляем транзакцию
      tx.status = "completed";
      tx.externalId = transferResult.transfer_id.toString();
      await tx.save();

      res.json({ status: "withdrawn", provider: "cryptobot", transfer: transferResult });
    } catch (error) {
      // Ошибка — откатываем баланс
      applyBalanceDelta(user, data.currency, units, 0n);
      await user.save();

      // Помечаем транзакцию как failed
      tx.status = "failed";
      await tx.save();

      throw error;
    }
  })
);

router.get(
  "/transactions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ userId: req.user?.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      transactions.map((tx) => ({
        id: tx._id.toString(),
        type: tx.type,
        currency: tx.currency,
        amount: unitsToAmount(unitsFromString(tx.amount), tx.currency as Currency),
        status: tx.status,
        provider: tx.provider ?? null,
        externalId: tx.externalId ?? null,
        createdAt: tx.createdAt,
      }))
    );
  })
);

export { router as userRoutes };
