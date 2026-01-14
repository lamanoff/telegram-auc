import mongoose, { Schema, Types } from "mongoose";
import type { BidStatus } from "../types/domain";

export interface IBid {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: string;
  amountSort: mongoose.Types.Decimal128;
  status: BidStatus;
  lastBidAt: Date;
  wonRound?: number;
}

const BidSchema = new Schema<IBid>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: String, required: true },
    amountSort: { type: Schema.Types.Decimal128, required: true },
    status: { type: String, required: true, default: "active" },
    lastBidAt: { type: Date, required: true, default: () => new Date() },
    wonRound: { type: Number },
  },
  { timestamps: true }
);

BidSchema.index(
  { auctionId: 1, userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
BidSchema.index({ auctionId: 1, amountSort: -1, lastBidAt: 1 });
BidSchema.index({ auctionId: 1, status: 1 });
BidSchema.index({ userId: 1, status: 1 });
BidSchema.index({ status: 1, wonRound: 1 });

export const Bid = mongoose.model<IBid>("Bid", BidSchema);
