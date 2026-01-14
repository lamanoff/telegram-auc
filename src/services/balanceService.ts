import type { Balance, IUser } from "../models/User";
import type { Currency } from "../types/domain";
import { unitsFromString, unitsToString } from "../utils/amount";

export function getAvailable(balance: Balance): bigint {
  const total = unitsFromString(balance.total);
  const locked = unitsFromString(balance.locked);
  return total - locked;
}

export function applyBalanceDelta(
  user: IUser,
  currency: Currency,
  deltaTotal: bigint,
  deltaLocked: bigint
): void {
  const balance = user.balances[currency];
  const total = unitsFromString(balance.total) + deltaTotal;
  const locked = unitsFromString(balance.locked) + deltaLocked;
  if (total < 0n || locked < 0n) {
    throw new Error("Balance cannot be negative");
  }
  if (locked > total) {
    throw new Error("Locked balance cannot exceed total");
  }
  balance.total = unitsToString(total);
  balance.locked = unitsToString(locked);
}
