export type Currency = "TON" | "USDT";
export type UserRole = "admin" | "user";
export type AuctionStatus = "scheduled" | "active" | "completed" | "cancelled";
export type BidStatus = "active" | "won" | "lost" | "refunded" | "cancelled";
export type TransactionType =
  | "deposit"
  | "bid_lock"
  | "bid_refund"
  | "withdrawal"
  | "payout"
  | "admin_credit";
export type TransactionStatus = "pending" | "completed" | "failed";
export type WalletProvider = "cryptobot";
