import type { Currency } from "../types/domain";

const DECIMALS: Record<Currency, number> = {
  TON: 9,
  USDT: 6,
};

export function parseAmountToUnits(amount: string, currency: Currency): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount format");
  }
  const [whole, fractionRaw = ""] = trimmed.split(".");
  const decimals = DECIMALS[currency];
  if (fractionRaw.length > decimals) {
    throw new Error("Amount has too many decimal places");
  }
  const fraction = fractionRaw.padEnd(decimals, "0");
  const combined = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined.length ? combined : "0");
}

export function unitsToAmount(units: bigint, currency: Currency): string {
  const decimals = DECIMALS[currency];
  const raw = units.toString();
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function unitsFromString(value: string): bigint {
  return BigInt(value);
}

export function unitsToString(value: bigint): string {
  return value.toString();
}
