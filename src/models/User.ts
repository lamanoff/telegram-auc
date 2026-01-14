import mongoose, { Schema, Types } from "mongoose";
import type { Currency, UserRole } from "../types/domain";

export interface Balance {
  total: string;
  locked: string;
}

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  role: UserRole;
  telegramId?: string;
  telegramUsername?: string;
  balances: Record<Currency, Balance>;
}

const BalanceSchema = new Schema<Balance>(
  {
    total: { type: String, required: true, default: "0" },
    locked: { type: String, required: true, default: "0" },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: "user" },
    telegramId: { type: String, index: true, sparse: true, unique: true },
    telegramUsername: { type: String },
    balances: {
      TON: { type: BalanceSchema, required: true, default: () => ({}) },
      USDT: { type: BalanceSchema, required: true, default: () => ({}) },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
