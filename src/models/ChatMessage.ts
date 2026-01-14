import mongoose, { Schema, Types } from "mongoose";

export interface IChatMessage {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  userId: Types.ObjectId;
  message: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ auctionId: 1, createdAt: -1 });
ChatMessageSchema.index({ userId: 1 });

export const ChatMessage = mongoose.model<IChatMessage>(
  "ChatMessage",
  ChatMessageSchema
);
