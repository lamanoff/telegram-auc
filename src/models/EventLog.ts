import mongoose, { Schema, Types } from "mongoose";

export interface IEventLog {
  _id: Types.ObjectId;
  type: string;
  userId?: Types.ObjectId;
  auctionId?: Types.ObjectId;
  payload?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const EventLogSchema = new Schema<IEventLog>(
  {
    type: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction" },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

EventLogSchema.index({ type: 1, createdAt: -1 });
EventLogSchema.index({ auctionId: 1, createdAt: -1 });
EventLogSchema.index({ userId: 1, createdAt: -1 });

export const EventLog = mongoose.model<IEventLog>("EventLog", EventLogSchema);
