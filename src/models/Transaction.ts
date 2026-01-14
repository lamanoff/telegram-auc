import mongoose, { Schema, Types } from "mongoose";
import type {
  Currency,
  TransactionStatus,
  TransactionType,
  WalletProvider,
} from "../types/domain";

export interface ITransaction {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: TransactionType;
  currency: Currency;
  amount: string;
  status: TransactionStatus;
  refId?: string;
  provider?: WalletProvider;
  externalId?: string;
  meta?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    currency: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, required: true, default: "completed" },
    refId: { type: String },
    provider: { type: String },
    externalId: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ provider: 1, externalId: 1 }, { unique: true, sparse: true });

export const Transaction = mongoose.model<ITransaction>("Transaction", TransactionSchema);
