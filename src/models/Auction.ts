import mongoose, { Schema, Types } from "mongoose";
import type { AuctionStatus, Currency } from "../types/domain";

export interface IAuction {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  currency: Currency;
  totalItems: number;
  itemsSold: number;
  roundsCount: number;
  itemsPerRound: number;
  startTime: Date;
  firstRoundDurationSec: number;
  roundDurationSec: number;
  minIncrement: string;
  startingPrice: string;
  reservePrice?: string;
  status: AuctionStatus;
  currentRound: number;
  roundEndsAt?: Date;
  createdBy: Types.ObjectId;
}

const AuctionSchema = new Schema<IAuction>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    currency: { type: String, required: true },
    totalItems: { type: Number, required: true },
    itemsSold: { type: Number, required: true, default: 0 },
    roundsCount: { type: Number, required: true },
    itemsPerRound: { type: Number, required: true },
    startTime: { type: Date, required: true },
    firstRoundDurationSec: { type: Number, required: true },
    roundDurationSec: { type: Number, required: true },
    minIncrement: { type: String, required: true },
    startingPrice: { type: String, required: true },
    reservePrice: { type: String },
    status: { type: String, required: true, default: "scheduled" },
    currentRound: { type: Number, required: true, default: 0 },
    roundEndsAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

AuctionSchema.index({ status: 1, startTime: 1 });
AuctionSchema.index({ status: 1, roundEndsAt: 1 });
AuctionSchema.index({ createdBy: 1 });

export const Auction = mongoose.model<IAuction>("Auction", AuctionSchema);
