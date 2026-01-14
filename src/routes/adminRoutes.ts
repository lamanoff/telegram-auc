import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { Bid } from "../models/Bid";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { z } from "zod";
import { unitsFromString, unitsToAmount } from "../utils/amount";
import type { Currency } from "../types/domain";
import { EventLog } from "../models/EventLog";
import { Auction } from "../models/Auction";
import { badRequest, notFound } from "../utils/errors";
import { isValidObjectId } from "../utils/validation";

const router = Router();

function decimalToUnits(value: unknown) {
  const raw = value ? value.toString() : "0";
  const normalized = raw.split(".")[0];
  return unitsFromString(normalized);
}

router.get(
  "/admin/logs",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const [users, auctions, bids, transactions] = await Promise.all([
      User.countDocuments(),
      Auction.countDocuments(),
      Bid.countDocuments(),
      Transaction.countDocuments(),
    ]);
    res.json({
      users,
      auctions,
      bids,
      transactions,
    });
  })
);

router.get(
  "/admin/transactions",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json(
      transactions.map((tx) => ({
        id: tx._id.toString(),
        userId: tx.userId.toString(),
        type: tx.type,
        currency: tx.currency,
        amount: unitsToAmount(unitsFromString(tx.amount), tx.currency as Currency),
        status: tx.status,
        provider: tx.provider,
        externalId: tx.externalId,
        createdAt: tx.createdAt,
      }))
    );
  })
);

router.get(
  "/admin/analytics",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const [auctionStats, volumeStats] = await Promise.all([
      Bid.aggregate([
        {
          $group: {
            _id: "$auctionId",
            participants: { $addToSet: "$userId" },
            maxAmount: { $max: { $toDecimal: "$amount" } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { type: "payout", status: "completed" } },
        { $group: { _id: "$currency", total: { $sum: { $toDecimal: "$amount" } } } },
      ]),
    ]);

    const auctions = await Auction.find().lean();
    const auctionMap = new Map(
      auctions.map((auction) => [auction._id.toString(), auction])
    );

    const auctionSummary = auctionStats.map((stat) => {
      const auction = auctionMap.get(stat._id.toString());
      const currency = auction?.currency as Currency;
      return {
        auctionId: stat._id.toString(),
        title: auction?.title ?? "",
        status: auction?.status ?? "unknown",
        participants: stat.participants.length,
        highestBid: currency
          ? unitsToAmount(decimalToUnits(stat.maxAmount), currency)
          : "0",
      };
    });

    const volume = volumeStats.map((stat) => ({
      currency: stat._id,
      total: unitsToAmount(decimalToUnits(stat.total), stat._id as Currency),
    }));

    res.json({ auctions: auctionSummary, volume });
  })
);

router.get(
  "/admin/events",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (req.query.type) {
      const type = req.query.type as string;
      if (type.length > 100) {
        throw badRequest("Invalid type parameter");
      }
      filter.type = type;
    }
    if (req.query.auctionId) {
      const auctionId = req.query.auctionId as string;
      if (!isValidObjectId(auctionId)) {
        throw badRequest("Invalid auction ID");
      }
      filter.auctionId = auctionId;
    }
    const events = await EventLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json(
      events.map((event) => ({
        id: event._id.toString(),
        type: event.type,
        userId: event.userId ? event.userId.toString() : null,
        auctionId: event.auctionId ? event.auctionId.toString() : null,
        payload: event.payload ?? null,
        createdAt: event.createdAt,
      }))
    );
  })
);

const completeWithdrawalSchema = z.object({
  txHash: z.string().min(3),
});

router.post(
  "/admin/withdrawals/:id/complete",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      throw badRequest("Invalid transaction ID");
    }
    const data = completeWithdrawalSchema.parse(req.body);
    const tx = await Transaction.findById(req.params.id);
    if (!tx) {
      throw notFound("Transaction not found");
    }
    if (tx.provider !== "cryptobot") {
      throw badRequest("Only cryptobot withdrawals can be completed manually");
    }
    tx.status = "completed";
    tx.externalId = data.txHash;
    await tx.save();
    res.json({ status: tx.status, externalId: tx.externalId });
  })
);

export { router as adminRoutes };
