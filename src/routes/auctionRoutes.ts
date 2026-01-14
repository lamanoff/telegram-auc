import { Router } from "express";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { Auction } from "../models/Auction";
import { Bid } from "../models/Bid";
import { BidHistory } from "../models/BidHistory";
import { Item } from "../models/Item";
import { ChatMessage } from "../models/ChatMessage";
import { RoundResult } from "../models/RoundResult";
import { asyncHandler } from "../utils/asyncHandler";
import {
  cancelAuction,
  createAuction,
  getAuctionDetails,
  listAuctions,
  placeBid,
  updateAuction,
} from "../services/auctionService";
import { AuctionHub } from "../ws/auctionHub";
import { badRequest, notFound } from "../utils/errors";
import { unitsFromString, unitsToAmount } from "../utils/amount";
import type { Currency } from "../types/domain";
import { checkBidRateLimit } from "../utils/rateLimit";
import { addBidToQueue } from "../services/bidQueue";
import { logEvent } from "../services/eventService";
import { isValidObjectId } from "../utils/validation";
import { sanitizeHtml } from "../utils/validation";

const amountField = z.union([z.string(), z.number()]).transform((val) => String(val)).pipe(z.string().max(50));

const createAuctionSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  currency: z.enum(["TON", "USDT"]),
  totalItems: z.number().int().positive().max(10000).optional(),
  roundsCount: z.number().int().positive().max(1000),
  itemsPerRound: z.number().int().positive().max(1000),
  startTime: z.string().datetime(),
  firstRoundDurationSec: z.number().int().positive().max(86400),
  roundDurationSec: z.number().int().positive().max(86400),
  minIncrement: amountField,
  startingPrice: amountField,
  reservePrice: amountField.optional(),
});

const updateAuctionSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  roundsCount: z.number().int().positive().optional(),
  itemsPerRound: z.number().int().positive().optional(),
  totalItems: z.number().int().positive().optional(),
  startTime: z.string().datetime().optional(),
  firstRoundDurationSec: z.number().int().positive().optional(),
  roundDurationSec: z.number().int().positive().optional(),
  minIncrement: amountField.optional(),
  startingPrice: amountField.optional(),
  reservePrice: amountField.optional(),
});

const bidSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)).pipe(z.string().max(50)),
});

const chatSchema = z.object({
  message: z.string().min(1).max(500),
});

export function createAuctionRoutes(hub: AuctionHub) {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const auctions = await listAuctions();
      res.json(auctions);
    })
  );

  router.get(
    "/:id",
    optionalAuth,
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const details = await getAuctionDetails(req.params.id, req.user?.id);
      res.json(details);
    })
  );

  router.post(
    "/",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = createAuctionSchema.parse(req.body);
      const auction = await createAuction(req.user!.id, {
        title: data.title,
        description: data.description,
        currency: data.currency,
        totalItems: data.totalItems,
        roundsCount: data.roundsCount,
        itemsPerRound: data.itemsPerRound,
        startTime: new Date(data.startTime),
        firstRoundDurationSec: data.firstRoundDurationSec,
        roundDurationSec: data.roundDurationSec,
        minIncrement: data.minIncrement,
        startingPrice: data.startingPrice,
        reservePrice: data.reservePrice,
      });
      res.status(201).json({ id: auction._id.toString() });
    })
  );

  router.put(
    "/:id",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const data = updateAuctionSchema.parse(req.body);
      const auction = await updateAuction(req.params.id, {
        title: data.title,
        description: data.description,
        roundsCount: data.roundsCount,
        itemsPerRound: data.itemsPerRound,
        totalItems: data.totalItems,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        firstRoundDurationSec: data.firstRoundDurationSec,
        roundDurationSec: data.roundDurationSec,
        minIncrement: data.minIncrement,
        startingPrice: data.startingPrice,
        reservePrice: data.reservePrice,
      });
      res.json({ id: auction._id.toString() });
    })
  );

  router.post(
    "/:id/bid",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const data = bidSchema.parse(req.body);
      const rateLimitKey = `${req.params.id}:${req.user!.id}`;
      if (!(await checkBidRateLimit(rateLimitKey))) {
        throw badRequest("Too many bid attempts");
      }
      const job = await addBidToQueue({
        auctionId: req.params.id,
        userId: req.user!.id,
        amount: data.amount,
      });
      res.json({ jobId: job.id, status: "queued" });
    })
  );

  router.get(
    "/:id/mybid",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const details = await getAuctionDetails(req.params.id, req.user!.id);
      res.json(details.userBid ?? null);
    })
  );

  router.get(
    "/:id/bids",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const auction = await Auction.findById(req.params.id).lean();
      if (!auction) {
        throw notFound("Auction not found");
      }
      const currency = auction.currency as Currency;
      const bids = await Bid.find({ auctionId: req.params.id })
        .sort({ amountSort: -1, lastBidAt: 1 })
        .lean();
      res.json(
        bids.map((bid) => ({
          id: bid._id.toString(),
          userId: bid.userId.toString(),
          amount: unitsToAmount(unitsFromString(bid.amount), currency),
          status: bid.status,
          lastBidAt: bid.lastBidAt,
          wonRound: bid.wonRound ?? null,
        }))
      );
    })
  );

  router.post(
    "/:id/cancel",
    requireAuth,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      await cancelAuction(req.params.id);
      hub.broadcast(req.params.id, { type: "auction.cancelled", data: { id: req.params.id } });
      res.json({ status: "cancelled" });
    })
  );

  router.get(
    "/:id/history",
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const auction = await Auction.findById(req.params.id).lean();
      if (!auction) {
        throw notFound("Auction not found");
      }
      const currency = auction.currency as Currency;
      const results = await RoundResult.find({ auctionId: req.params.id })
        .sort({ roundNumber: 1 })
        .lean();
      res.json(
        results.map((result) => ({
          round: result.roundNumber,
          winners: result.winners.map((winner) => ({
            userId: winner.userId.toString(),
            bidId: winner.bidId.toString(),
            amount: unitsToAmount(unitsFromString(winner.amount), currency),
          })),
          lowestWinningBid: result.lowestWinningBid
            ? unitsToAmount(unitsFromString(result.lowestWinningBid), currency)
            : null,
        }))
      );
    })
  );

  router.get(
    "/:id/items",
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const auction = await Auction.findById(req.params.id).lean();
      if (!auction) {
        throw notFound("Auction not found");
      }
      const currency = auction.currency as Currency;
      const items = await Item.find({ auctionId: req.params.id })
        .sort({ serialNumber: 1 })
        .lean();
      res.json(
        items.map((item) => ({
          id: item._id.toString(),
          winnerUserId: item.winnerUserId.toString(),
          bidId: item.bidId.toString(),
          roundNumber: item.roundNumber,
          serialNumber: item.serialNumber,
          pricePaid: unitsToAmount(unitsFromString(item.pricePaid), currency),
        }))
      );
    })
  );

  router.get(
    "/:id/chat",
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const messages = await ChatMessage.find({ auctionId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json(
        messages.map((message) => ({
          id: message._id.toString(),
          userId: message.userId.toString(),
          message: sanitizeHtml(message.message),
          createdAt: message.createdAt,
        }))
      );
    })
  );

  router.post(
    "/:id/chat",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const data = chatSchema.parse(req.body);
      const sanitizedMessage = sanitizeHtml(data.message);
      const chat = await ChatMessage.create({
        auctionId: req.params.id,
        userId: req.user!.id,
        message: sanitizedMessage,
      });
      const payload = {
        id: chat._id.toString(),
        userId: req.user!.id,
        message: chat.message,
        createdAt: chat.createdAt,
      };
      await logEvent({
        type: "chat.message",
        userId: req.user!.id,
        auctionId: req.params.id,
        payload: { message: chat.message },
      });
      hub.broadcast(req.params.id, { type: "chat.message", data: payload });
      res.status(201).json(payload);
    })
  );

  router.get(
    "/:id/bid-history",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!isValidObjectId(req.params.id)) {
        throw badRequest("Invalid auction ID");
      }
      const isAdmin = req.user?.role === "admin";
      const auction = await Auction.findById(req.params.id).lean();
      if (!auction) {
        throw notFound("Auction not found");
      }
      const filter: Record<string, unknown> = { auctionId: req.params.id };
      if (!isAdmin) {
        filter.userId = req.user?.id;
      } else if (req.query.userId) {
        const userId = req.query.userId as string;
        if (!isValidObjectId(userId)) {
          throw badRequest("Invalid user ID");
        }
        filter.userId = userId;
      }
      const history = await BidHistory.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      const currency = auction.currency as Currency;
      res.json(
        history.map((entry) => ({
          id: entry._id.toString(),
          userId: entry.userId.toString(),
          bidId: entry.bidId.toString(),
          previousAmount: entry.previousAmount
            ? unitsToAmount(unitsFromString(entry.previousAmount), currency)
            : null,
          newAmount: unitsToAmount(unitsFromString(entry.newAmount), currency),
          createdAt: entry.createdAt,
        }))
      );
    })
  );

  return router;
}
