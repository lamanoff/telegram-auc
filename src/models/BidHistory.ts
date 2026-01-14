import mongoose, { Schema, Types } from "mongoose";

export interface IBidHistory {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  bidId: Types.ObjectId;
  userId: Types.ObjectId;
  previousAmount?: string;
  newAmount: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const BidHistorySchema = new Schema<IBidHistory>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true },
    bidId: { type: Schema.Types.ObjectId, ref: "Bid", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    previousAmount: { type: String },
    newAmount: { type: String, required: true },
  },
  { timestamps: true }
);

BidHistorySchema.index({ auctionId: 1, createdAt: -1 });
BidHistorySchema.index({ bidId: 1, createdAt: -1 });
BidHistorySchema.index({ userId: 1, createdAt: -1 });

export const BidHistory = mongoose.model<IBidHistory>(
  "BidHistory",
  BidHistorySchema
);
