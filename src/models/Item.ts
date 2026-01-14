import mongoose, { Schema, Types } from "mongoose";

export interface IItem {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  winnerUserId: Types.ObjectId;
  bidId: Types.ObjectId;
  roundNumber: number;
  serialNumber: number;
  pricePaid: string;
}

const ItemSchema = new Schema<IItem>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bidId: { type: Schema.Types.ObjectId, ref: "Bid", required: true },
    roundNumber: { type: Number, required: true },
    serialNumber: { type: Number, required: true },
    pricePaid: { type: String, required: true },
  },
  { timestamps: true }
);

ItemSchema.index({ auctionId: 1, serialNumber: 1 }, { unique: true });
ItemSchema.index({ auctionId: 1, roundNumber: 1 });
ItemSchema.index({ winnerUserId: 1 });
ItemSchema.index({ bidId: 1 });

export const Item = mongoose.model<IItem>("Item", ItemSchema);
