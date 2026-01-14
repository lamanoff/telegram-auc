import mongoose, { Schema, Types } from "mongoose";

export interface RoundWinner {
  userId: Types.ObjectId;
  bidId: Types.ObjectId;
  amount: string;
}

export interface IRoundResult {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  roundNumber: number;
  winners: RoundWinner[];
  lowestWinningBid?: string;
}

const RoundWinnerSchema = new Schema<RoundWinner>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bidId: { type: Schema.Types.ObjectId, ref: "Bid", required: true },
    amount: { type: String, required: true },
  },
  { _id: false }
);

const RoundResultSchema = new Schema<IRoundResult>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true },
    roundNumber: { type: Number, required: true },
    winners: { type: [RoundWinnerSchema], required: true },
    lowestWinningBid: { type: String },
  },
  { timestamps: true }
);

RoundResultSchema.index({ auctionId: 1, roundNumber: 1 }, { unique: true });

export const RoundResult = mongoose.model<IRoundResult>(
  "RoundResult",
  RoundResultSchema
);
