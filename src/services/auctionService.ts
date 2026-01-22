import mongoose from "mongoose";
import { Auction } from "../models/Auction";
import { Bid } from "../models/Bid";
import { BidHistory } from "../models/BidHistory";
import { RoundResult } from "../models/RoundResult";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { Item } from "../models/Item";
import { logEvent } from "./eventService";
import { config } from "../config";
import type { Currency } from "../types/domain";
import { applyBalanceDelta, getAvailable } from "./balanceService";
import {
  parseAmountToUnits,
  unitsFromString,
  unitsToAmount,
  unitsToString,
} from "../utils/amount";
import { badRequest, notFound } from "../utils/errors";

function decimal128FromUnits(units: bigint) {
  return mongoose.Types.Decimal128.fromString(units.toString());
}

export async function listAuctions() {
  const auctions = await Auction.find().sort({ startTime: -1 }).lean();
  return auctions.map((auction) => ({
    id: auction._id.toString(),
    title: auction.title,
    currency: auction.currency,
    status: auction.status,
    startTime: auction.startTime,
    currentRound: auction.currentRound,
    totalRounds: auction.roundsCount,
    itemsPerRound: auction.itemsPerRound,
    totalItems: auction.totalItems,
    itemsSold: auction.itemsSold,
  }));
}

export async function getAuctionDetails(auctionId: string, userId?: string) {
  if (!mongoose.Types.ObjectId.isValid(auctionId)) {
    throw badRequest("Invalid auction ID");
  }
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("Invalid user ID");
  }
  
  const auction = await Auction.findById(auctionId).lean();
  if (!auction) {
    throw notFound("Auction not found");
  }
  
  // Для завершенных аукционов показываем победителей, для активных - текущие ставки
  const isCompleted = auction.status === "completed";
  const bidStatus = isCompleted ? "won" : "active";
  
  const remainingItems = Math.max(auction.totalItems - auction.itemsSold, 0);
  const limit = Math.min(auction.itemsPerRound, remainingItems || auction.itemsPerRound);
  
  // Для завершенных аукционов показываем все победившие ставки, отсортированные по раунду и сумме
  const topBids = isCompleted
    ? await Bid.find({ auctionId, status: "won" })
        .sort({ wonRound: 1, amountSort: -1, lastBidAt: 1 })
        .populate("userId", "username")
        .lean()
    : await Bid.find({ auctionId, status: "active" })
        .sort({ amountSort: -1, lastBidAt: 1 })
        .limit(limit)
        .populate("userId", "username")
        .lean();

  // Для завершенных аукционов не вычисляем минимальную ставку
  let currentMinBid: string | null = null;
  let nextRoundMinBid: string | null = null;
  
  if (!isCompleted) {
    const minUnits = computeMinRequiredUnits(
      { 
        startingPrice: auction.startingPrice, 
        minIncrement: auction.minIncrement,
        currentRound: auction.currentRound 
      },
      topBids,
      limit
    );

    currentMinBid = unitsToAmount(minUnits, auction.currency as Currency);
    
    // Вычисляем прогноз минимальной ставки для следующего раунда
    const nextRoundMinUnits = computeNextRoundMinPrice({
      startingPrice: auction.startingPrice,
      minIncrement: auction.minIncrement,
      currentRound: auction.currentRound,
      roundsCount: auction.roundsCount
    });
    nextRoundMinBid = nextRoundMinUnits 
      ? unitsToAmount(nextRoundMinUnits, auction.currency as Currency)
      : null;
  }

  let userBid;
  if (userId) {
    // Для завершенных аукционов ищем ставку со статусом "won" или "lost"
    const bidStatusFilter = isCompleted ? { $in: ["won", "lost"] } : "active";
    const bid = await Bid.findOne({ auctionId, userId, status: bidStatusFilter }).lean();
    if (bid) {
      if (isCompleted) {
        // Для завершенных аукционов показываем статус ставки
        const wonBids = await Bid.find({ auctionId, status: "won" })
          .sort({ wonRound: 1, amountSort: -1, lastBidAt: 1 })
          .lean();
        const rank = wonBids.findIndex(b => b._id.toString() === bid._id.toString()) + 1;
        userBid = {
          amount: unitsToAmount(unitsFromString(bid.amount), auction.currency as Currency),
          rank: bid.status === "won" ? rank : null,
          status: bid.status,
        };
      } else {
        // Для активных аукционов считаем ранг среди активных ставок
        const higherCount = await Bid.countDocuments({
          auctionId,
          status: "active",
          $or: [
            { amountSort: { $gt: bid.amountSort } },
            {
              amountSort: bid.amountSort,
              lastBidAt: { $lt: bid.lastBidAt },
            },
          ],
        });
        userBid = {
          amount: unitsToAmount(unitsFromString(bid.amount), auction.currency as Currency),
          rank: higherCount + 1,
          status: bid.status,
        };
      }
    }
  }

  const formattedTopBids = topBids.map((bid, index) => {
    const user = bid.userId as { _id: mongoose.Types.ObjectId; username?: string };
    return {
      rank: index + 1,
      amount: unitsToAmount(unitsFromString(bid.amount), auction.currency as Currency),
      user: user?.username ?? user?._id.toString(),
      userId: user?._id.toString(),
    };
  });

  return {
    auctionId: auction._id.toString(),
    title: auction.title,
    description: auction.description,
    currency: auction.currency,
    status: auction.status,
    startTime: auction.startTime,
    currentRound: auction.currentRound,
    totalRounds: auction.roundsCount,
    roundEndsAt: auction.roundEndsAt,
    itemsPerRound: auction.itemsPerRound,
    itemsInCurrentRound: limit,
    totalItems: auction.totalItems,
    itemsSold: auction.itemsSold,
    currentMinBid,
    nextRoundMinBid,
    minIncrement: unitsToAmount(
      unitsFromString(auction.minIncrement),
      auction.currency as Currency
    ),
    reservePrice: auction.reservePrice
      ? unitsToAmount(unitsFromString(auction.reservePrice), auction.currency as Currency)
      : null,
    userBid,
    topBids: formattedTopBids,
  };
}

export async function createAuction(
  creatorId: string,
  input: {
    title: string;
    description?: string;
    currency: Currency;
    totalItems?: number;
    roundsCount: number;
    itemsPerRound: number;
    startTime: Date;
    firstRoundDurationSec: number;
    roundDurationSec: number;
    minIncrement: string;
    startingPrice: string;
    reservePrice?: string;
  }
) {
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    throw badRequest("Invalid creator ID");
  }
  
  const totalItems =
    input.totalItems ?? input.roundsCount * input.itemsPerRound;
  if (totalItems <= 0 || totalItems > 10000) {
    throw badRequest("totalItems must be between 1 and 10000");
  }
  if (totalItems > input.roundsCount * input.itemsPerRound) {
    throw badRequest("totalItems exceeds total round capacity");
  }
  
  if (input.roundsCount > 1000 || input.itemsPerRound > 1000) {
    throw badRequest("Too many rounds or items per round");
  }

  const minIncrementUnits = parseAmountToUnits(input.minIncrement, input.currency);
  const startingPriceUnits = parseAmountToUnits(
    input.startingPrice,
    input.currency
  );
  const reservePriceUnits = input.reservePrice
    ? parseAmountToUnits(input.reservePrice, input.currency)
    : undefined;
  if (minIncrementUnits <= 0n) {
    throw badRequest("minIncrement must be positive");
  }
  if (startingPriceUnits <= 0n) {
    throw badRequest("startingPrice must be positive");
  }
  if (reservePriceUnits && reservePriceUnits < startingPriceUnits) {
    throw badRequest("reservePrice cannot be below startingPrice");
  }

  const auction = await Auction.create({
    title: input.title,
    description: input.description,
    currency: input.currency,
    totalItems,
    roundsCount: input.roundsCount,
    itemsPerRound: input.itemsPerRound,
    startTime: input.startTime,
    firstRoundDurationSec: input.firstRoundDurationSec,
    roundDurationSec: input.roundDurationSec,
    minIncrement: unitsToString(minIncrementUnits),
    startingPrice: unitsToString(startingPriceUnits),
    reservePrice: reservePriceUnits ? unitsToString(reservePriceUnits) : undefined,
    status: "scheduled",
    currentRound: 0,
    itemsSold: 0,
    createdBy: creatorId,
  });

  await logEvent({
    type: "auction.created",
    userId: creatorId,
    auctionId: auction._id.toString(),
  });

  return auction;
}

export async function updateAuction(
  auctionId: string,
  input: Partial<{
    title: string;
    description?: string;
    currency: Currency;
    totalItems?: number;
    roundsCount: number;
    itemsPerRound: number;
    startTime: Date;
    firstRoundDurationSec: number;
    roundDurationSec: number;
    minIncrement: string;
    startingPrice: string;
    reservePrice?: string;
  }>
) {
  if (!mongoose.Types.ObjectId.isValid(auctionId)) {
    throw badRequest("Invalid auction ID");
  }
  
  const auction = await Auction.findById(auctionId);
  if (!auction) {
    throw notFound("Auction not found");
  }
  if (auction.status !== "scheduled" || auction.currentRound > 0) {
    throw badRequest("Only scheduled auctions can be updated");
  }
  if (input.currency && input.currency !== auction.currency) {
    throw badRequest("Currency cannot be changed");
  }

  if (input.title !== undefined) {
    auction.title = input.title;
  }
  if (input.description !== undefined) {
    auction.description = input.description;
  }
  if (input.startTime !== undefined) {
    auction.startTime = input.startTime;
  }
  if (input.firstRoundDurationSec !== undefined) {
    auction.firstRoundDurationSec = input.firstRoundDurationSec;
  }
  if (input.roundDurationSec !== undefined) {
    auction.roundDurationSec = input.roundDurationSec;
  }

  const roundsCount = input.roundsCount ?? auction.roundsCount;
  const itemsPerRound = input.itemsPerRound ?? auction.itemsPerRound;
  if (roundsCount <= 0 || itemsPerRound <= 0) {
    throw badRequest("roundsCount and itemsPerRound must be positive");
  }
  auction.roundsCount = roundsCount;
  auction.itemsPerRound = itemsPerRound;

  const totalItems =
    input.totalItems ?? roundsCount * itemsPerRound;
  if (totalItems <= 0) {
    throw badRequest("totalItems must be positive");
  }
  if (totalItems > roundsCount * itemsPerRound) {
    throw badRequest("totalItems exceeds total round capacity");
  }
  auction.totalItems = totalItems;

  const currency = auction.currency as Currency;
  if (input.minIncrement !== undefined) {
    const minIncrementUnits = parseAmountToUnits(input.minIncrement, currency);
    if (minIncrementUnits <= 0n) {
      throw badRequest("minIncrement must be positive");
    }
    auction.minIncrement = unitsToString(minIncrementUnits);
  }
  if (input.startingPrice !== undefined) {
    const startingPriceUnits = parseAmountToUnits(input.startingPrice, currency);
    if (startingPriceUnits <= 0n) {
      throw badRequest("startingPrice must be positive");
    }
    auction.startingPrice = unitsToString(startingPriceUnits);
  }
  if (input.reservePrice !== undefined) {
    if (input.reservePrice === null || input.reservePrice === "") {
      auction.reservePrice = undefined;
    } else {
      const reservePriceUnits = parseAmountToUnits(input.reservePrice, currency);
      const startingPriceUnits = unitsFromString(auction.startingPrice);
      if (reservePriceUnits < startingPriceUnits) {
        throw badRequest("reservePrice cannot be below startingPrice");
      }
      auction.reservePrice = unitsToString(reservePriceUnits);
    }
  }

  await auction.save();
  await logEvent({
    type: "auction.updated",
    auctionId: auction._id.toString(),
  });
  return auction;
}

function computeMinRequiredUnits(
  auction: { startingPrice: string; minIncrement: string; currentRound: number },
  currentTopBids: { amount: string }[],
  cutoffSize: number
): bigint {
  const startingPriceUnits = unitsFromString(auction.startingPrice);
  const minIncrementUnits = unitsFromString(auction.minIncrement);
  
  // Автоматический рост минимальной ставки между раундами
  // Для раунда 1: startingPrice, для раунда 2: startingPrice + minIncrement, и т.д.
  const roundMultiplier = Math.max(0, auction.currentRound - 1);
  const dynamicMinPrice = startingPriceUnits + (minIncrementUnits * BigInt(roundMultiplier));
  
  // Если все слоты заполнены, минимальная ставка = последнее место + minIncrement
  if (currentTopBids.length >= cutoffSize) {
    const lowest = currentTopBids[currentTopBids.length - 1];
    const competitiveMinPrice = unitsFromString(lowest.amount) + minIncrementUnits;
    // Возвращаем максимум из динамической минимальной цены и конкурентной
    return competitiveMinPrice > dynamicMinPrice ? competitiveMinPrice : dynamicMinPrice;
  }
  
  // Если слотов свободно, используем динамическую минимальную цену
  return dynamicMinPrice;
}

function computeNextRoundMinPrice(
  auction: { startingPrice: string; minIncrement: string; currentRound: number; roundsCount: number }
): bigint | null {
  // Если это последний раунд, следующего раунда нет
  if (auction.currentRound >= auction.roundsCount) {
    return null;
  }
  
  const startingPriceUnits = unitsFromString(auction.startingPrice);
  const minIncrementUnits = unitsFromString(auction.minIncrement);
  
  // Для следующего раунда минимальная ставка будет: startingPrice + (minIncrement * currentRound)
  const nextRoundMultiplier = auction.currentRound;
  return startingPriceUnits + (minIncrementUnits * BigInt(nextRoundMultiplier));
}

export async function placeBid(params: {
  auctionId: string;
  userId: string;
  amount: string;
}): Promise<{ 
  auctionId: string; 
  userId: string; 
  amount: string; 
  currentMinBid: string; 
  roundEndsAt?: Date; 
  outbidUserIds?: string[];
  topBids: Array<{ rank: number; userId: string; amount: string; user: string }>;
} | null> {
  if (!mongoose.Types.ObjectId.isValid(params.auctionId) || !mongoose.Types.ObjectId.isValid(params.userId)) {
    throw badRequest("Invalid ID format");
  }
  
  const session = await mongoose.startSession();
  let payload: { 
    auctionId: string; 
    userId: string; 
    amount: string; 
    currentMinBid: string; 
    roundEndsAt?: Date; 
    outbidUserIds?: string[];
    topBids: Array<{ rank: number; userId: string; amount: string }>;
  } | null = null;

  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findById(params.auctionId).session(session);
      console.log(`[placeBid] Processing bid for auction ${params.auctionId}, user ${params.userId}, amount ${params.amount}`);
      if (!auction) {
        throw notFound("Auction not found");
      }
      if (auction.status !== "active") {
        throw badRequest("Auction is not active");
      }
      if (!auction.roundEndsAt || auction.roundEndsAt.getTime() <= Date.now()) {
        throw badRequest("Round has ended");
      }

      const amountUnits = parseAmountToUnits(params.amount, auction.currency as Currency);
      if (amountUnits <= 0n) {
        throw badRequest("Bid amount must be positive");
      }

      const remainingItems = Math.max(auction.totalItems - auction.itemsSold, 0);
      if (remainingItems === 0) {
        throw badRequest("Auction is sold out");
      }
      const cutoffSize = Math.min(auction.itemsPerRound, remainingItems || auction.itemsPerRound);
      const topBids = await Bid.find({ auctionId: auction._id, status: "active" })
        .sort({ amountSort: -1, lastBidAt: 1 })
        .limit(cutoffSize)
        .session(session)
        .lean();

      const previousTopUserIds = topBids.map((bid) => bid.userId.toString());
      const minRequiredUnits = computeMinRequiredUnits(
        { 
          startingPrice: auction.startingPrice, 
          minIncrement: auction.minIncrement,
          currentRound: auction.currentRound 
        },
        topBids,
        cutoffSize
      );

      const existingBid = await Bid.findOne({
        auctionId: auction._id,
        userId: params.userId,
        status: "active",
      }).session(session);

      if (existingBid) {
        const currentUnits = unitsFromString(existingBid.amount);
        if (amountUnits <= currentUnits) {
          throw badRequest("Bid must be higher than current bid");
        }
        const delta = amountUnits - currentUnits;
        if (delta < unitsFromString(auction.minIncrement)) {
          throw badRequest("Bid increment is too small");
        }
        if (amountUnits < minRequiredUnits) {
          throw badRequest("Bid is below current minimum to win");
        }

        const user = await User.findById(params.userId).session(session);
        if (!user) {
          throw notFound("User not found");
        }
        const available = getAvailable(user.balances[auction.currency as Currency]);
        if (available < delta) {
          throw badRequest("Insufficient balance");
        }

        applyBalanceDelta(user, auction.currency as Currency, 0n, delta);
        const previousAmount = existingBid.amount;
        existingBid.amount = unitsToString(amountUnits);
        existingBid.amountSort = decimal128FromUnits(amountUnits);
        existingBid.lastBidAt = new Date();
        await user.save({ session });
        await existingBid.save({ session });

        await BidHistory.create([{
          auctionId: auction._id,
          bidId: existingBid._id,
          userId: user._id,
          previousAmount,
          newAmount: existingBid.amount,
        }], { session });

        await Transaction.create([{
          userId: user._id,
          type: "bid_lock",
          currency: auction.currency,
          amount: unitsToString(delta),
          refId: existingBid._id.toString(),
          status: "completed",
        }], { session });
      } else {
        if (amountUnits < minRequiredUnits) {
          throw badRequest("Bid is below current minimum to win");
        }
        if (amountUnits < unitsFromString(auction.startingPrice)) {
          throw badRequest("Bid is below starting price");
        }

        const user = await User.findById(params.userId).session(session);
        if (!user) {
          throw notFound("User not found");
        }
        const available = getAvailable(user.balances[auction.currency as Currency]);
        if (available < amountUnits) {
          throw badRequest("Insufficient balance");
        }

        applyBalanceDelta(user, auction.currency as Currency, 0n, amountUnits);
        
        const [bid] = await Bid.create([{
          auctionId: auction._id,
          userId: user._id,
          amount: unitsToString(amountUnits),
          amountSort: decimal128FromUnits(amountUnits),
          status: "active",
          lastBidAt: new Date(),
        }], { session });

        await user.save({ session });
        await BidHistory.create([{
          auctionId: auction._id,
          bidId: bid._id,
          userId: user._id,
          newAmount: bid.amount,
        }], { session });
        await Transaction.create([{
          userId: user._id,
          type: "bid_lock",
          currency: auction.currency,
          amount: unitsToString(amountUnits),
          refId: bid._id.toString(),
          status: "completed",
        }], { session });
      }

      const timeLeftMs = auction.roundEndsAt.getTime() - Date.now();
      if (timeLeftMs <= config.antiSnipingWindowSec * 1000) {
        auction.roundEndsAt = new Date(auction.roundEndsAt.getTime() + config.antiSnipingExtendSec * 1000);
        await auction.save({ session });
      }

      const refreshedTopBids = await Bid.find({ auctionId: auction._id, status: "active" })
        .sort({ amountSort: -1, lastBidAt: 1 })
        .limit(cutoffSize)
        .populate("userId", "username")
        .session(session)
        .lean();
      const refreshedTopUserIds = refreshedTopBids.map((bid) => {
        const user = bid.userId as { _id: mongoose.Types.ObjectId; username?: string } | mongoose.Types.ObjectId | string;
        if (typeof user === 'string') {
          return user;
        }
        if (user && typeof user === 'object' && '_id' in user) {
          return user._id.toString();
        }
        return (user as mongoose.Types.ObjectId).toString();
      });
      const outbidUserIds = previousTopUserIds.filter((userId) => !refreshedTopUserIds.includes(userId));
      const refreshedMinUnits = computeMinRequiredUnits(
        { 
          startingPrice: auction.startingPrice, 
          minIncrement: auction.minIncrement,
          currentRound: auction.currentRound 
        },
        refreshedTopBids,
        cutoffSize
      );

      payload = {
        auctionId: auction._id.toString(),
        userId: params.userId,
        amount: unitsToAmount(amountUnits, auction.currency as Currency),
        currentMinBid: unitsToAmount(refreshedMinUnits, auction.currency as Currency),
        roundEndsAt: auction.roundEndsAt ?? undefined,
        outbidUserIds,
        topBids: refreshedTopBids.map((bid, index) => {
          const userRaw: unknown = bid.userId;
          let userId: string;
          let username: string;
          
          // Проверяем тип после populate
          if (typeof userRaw === 'string') {
            userId = userRaw;
            username = `user_${userRaw.slice(-8)}`;
          } else if (userRaw && typeof userRaw === 'object' && userRaw !== null && '_id' in userRaw) {
            const user = userRaw as { _id: mongoose.Types.ObjectId; username?: string };
            userId = user._id.toString();
            username = user.username ?? userId;
          } else {
            const objId = userRaw as mongoose.Types.ObjectId;
            userId = objId.toString();
            username = `user_${userId.slice(-8)}`;
          }
          
          return {
            rank: index + 1,
            userId,
            amount: unitsToAmount(unitsFromString(bid.amount), auction.currency as Currency),
            user: username,
          };
        }),
      };
    });
  } catch (error) {
    console.error(`[placeBid] Transaction failed:`, error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    throw error;
  } finally {
    session.endSession();
  }

  type BidPayload = { 
    auctionId: string; 
    userId: string; 
    amount: string; 
    currentMinBid: string; 
    roundEndsAt?: Date; 
    outbidUserIds?: string[];
    topBids: Array<{ rank: number; userId: string; amount: string; user: string }>;
  };
  
  const result = payload as BidPayload | null;
  
  if (result) {
    await logEvent({
      type: "bid.updated",
      userId: params.userId,
      auctionId: params.auctionId,
      payload: {
        amount: result.amount,
        currentMinBid: result.currentMinBid,
      },
    });
  }
  
  return result;
}

export async function startScheduledAuctions(now = new Date()) {
  const auctions = await Auction.find({
    status: "scheduled",
    startTime: { $lte: now },
  });

  for (const auction of auctions) {
    auction.status = "active";
    auction.currentRound = 1;
    auction.roundEndsAt = new Date(
      now.getTime() + auction.firstRoundDurationSec * 1000
    );
    await auction.save();
    await logEvent({
      type: "auction.started",
      auctionId: auction._id.toString(),
    });
  }

  return auctions.map((auction) => auction._id.toString());
}

export async function finalizeDueRounds(now = new Date()) {
  const auctions = await Auction.find({
    status: "active",
    roundEndsAt: { $lte: now },
  });

  if (auctions.length > 0) {
    console.log(`FinalizeDueRounds: Found ${auctions.length} auctions with ended rounds`);
  }

  const finalized: { auctionId: string; roundNumber: number }[] = [];
  for (const auction of auctions) {
    const roundNumber = await finalizeRound(auction._id.toString());
    if (roundNumber > 0) {
      finalized.push({ auctionId: auction._id.toString(), roundNumber });
    }
  }

  return finalized;
}

export async function finalizeRound(auctionId: string) {
  if (!mongoose.Types.ObjectId.isValid(auctionId)) {
    return 0;
  }
  
  const session = await mongoose.startSession();
  let closedRound = 0;
  
  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findById(auctionId).session(session);
      if (!auction || auction.status !== "active") {
        return;
      }
      if (!auction.roundEndsAt || auction.roundEndsAt.getTime() > Date.now()) {
        return;
      }
      
      console.log(`FinalizeRound: Processing round ${auction.currentRound} for auction ${auctionId}`);

      const remainingItems = Math.max(auction.totalItems - auction.itemsSold, 0);
      const limit = Math.min(auction.itemsPerRound, remainingItems);
      const topBids = limit > 0
        ? await Bid.find({ auctionId, status: "active" })
            .sort({ amountSort: -1, lastBidAt: 1 })
            .limit(limit)
            .session(session)
        : [];

      const reserveUnits = auction.reservePrice
        ? unitsFromString(auction.reservePrice)
        : null;

      const eligibleBids = reserveUnits
        ? topBids.filter((bid) => unitsFromString(bid.amount) >= reserveUnits)
        : topBids;

      const winners: { userId: mongoose.Types.ObjectId; bidId: mongoose.Types.ObjectId; amount: string }[] = [];
      let serialNumber = auction.itemsSold + 1;
      
      for (const bid of eligibleBids) {
        const user = await User.findById(bid.userId).session(session);
        if (!user) continue;
        
        const amountUnits = unitsFromString(bid.amount);
        applyBalanceDelta(user, auction.currency as Currency, -amountUnits, -amountUnits);
        bid.status = "won";
        bid.wonRound = auction.currentRound;
        
        await user.save({ session });
        await bid.save({ session });
        
        await Transaction.create([{
          userId: user._id,
          type: "payout",
          currency: auction.currency,
          amount: bid.amount,
          refId: bid._id.toString(),
          status: "completed",
        }], { session });
        
        await Item.create([{
          auctionId: auction._id,
          winnerUserId: user._id,
          bidId: bid._id,
          roundNumber: auction.currentRound,
          serialNumber,
          pricePaid: bid.amount,
        }], { session });
        
        winners.push({ userId: user._id, bidId: bid._id, amount: bid.amount });
        serialNumber += 1;
      }

      const lowestWinningBid = winners.length > 0 ? winners[winners.length - 1].amount : undefined;

      await RoundResult.create([{
        auctionId: auction._id,
        roundNumber: auction.currentRound,
        winners,
        lowestWinningBid,
      }], { session });
      
      closedRound = auction.currentRound;
      auction.itemsSold += winners.length;

      const roundComplete =
        auction.currentRound >= auction.roundsCount ||
        auction.itemsSold >= auction.totalItems;

      if (roundComplete) {
        const remaining = await Bid.find({ auctionId, status: "active" }).session(session);
        for (const bid of remaining) {
          const user = await User.findById(bid.userId).session(session);
          if (!user) continue;
          
          const amountUnits = unitsFromString(bid.amount);
          applyBalanceDelta(user, auction.currency as Currency, 0n, -amountUnits);
          bid.status = "lost";
          
          await user.save({ session });
          await bid.save({ session });
          
          await Transaction.create([{
            userId: user._id,
            type: "bid_refund",
            currency: auction.currency,
            amount: bid.amount,
            refId: bid._id.toString(),
            status: "completed",
          }], { session });
        }
        auction.status = "completed";
        auction.roundEndsAt = undefined;
      } else {
        auction.currentRound += 1;
        auction.roundEndsAt = new Date(Date.now() + auction.roundDurationSec * 1000);
      }

      await auction.save({ session });
      console.log(`FinalizeRound: Successfully finalized round ${closedRound} for auction ${auctionId}`);
    });
  } catch (error) {
    console.error(`FinalizeRound error for ${auctionId}:`, error instanceof Error ? error.stack || error.message : error);
  } finally {
    session.endSession();
  }
  
  if (closedRound > 0) {
    await logEvent({
      type: "round.closed",
      auctionId,
      payload: { roundNumber: closedRound },
    });
  }
  return closedRound;
}

export async function cancelAuction(auctionId: string) {
  if (!mongoose.Types.ObjectId.isValid(auctionId)) {
    throw badRequest("Invalid auction ID");
  }
  
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findById(auctionId).session(session);
      if (!auction) {
        throw notFound("Auction not found");
      }
      if (auction.status === "completed" || auction.status === "cancelled") {
        throw badRequest("Auction cannot be cancelled");
      }

      const remaining = await Bid.find({ auctionId, status: "active" }).session(session);
      for (const bid of remaining) {
        const user = await User.findById(bid.userId).session(session);
        if (!user) continue;
        
        const amountUnits = unitsFromString(bid.amount);
        applyBalanceDelta(user, auction.currency as Currency, 0n, -amountUnits);
        bid.status = "refunded";
        await user.save({ session });
        await bid.save({ session });
        await Transaction.create([{
          userId: user._id,
          type: "bid_refund",
          currency: auction.currency,
          amount: bid.amount,
          refId: bid._id.toString(),
          status: "completed",
        }], { session });
      }

      auction.status = "cancelled";
      await auction.save({ session });
    });
  } finally {
    session.endSession();
  }
  await logEvent({ type: "auction.cancelled", auctionId });
}
