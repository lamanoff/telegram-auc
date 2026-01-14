import { getRedisKey, setRedisKey } from "../services/redis";

// Minimum time between bids per user per auction (ms)
// Can be set via env var for testing, default 50ms for high-throughput testing
const BID_RATE_LIMIT_MS = parseInt(process.env.BID_RATE_LIMIT_MS || "50", 10);

export async function checkBidRateLimit(key: string): Promise<boolean> {
  // If rate limit is 0 or negative, disable it
  if (BID_RATE_LIMIT_MS <= 0) {
    return true;
  }
  
  const redisKey = `bid_rate_limit:${key}`;
  const now = Date.now();
  
  try {
    const lastBidStr = await getRedisKey(redisKey);
    if (lastBidStr) {
      const lastBid = parseInt(lastBidStr, 10);
      if (now - lastBid < BID_RATE_LIMIT_MS) {
        return false;
      }
    }
    await setRedisKey(redisKey, now.toString(), Math.ceil(BID_RATE_LIMIT_MS / 1000) + 1);
    return true;
  } catch (error) {
    console.error("[RATE_LIMIT] Check error:", error instanceof Error ? error.message : error);
    return true; // Allow on error
  }
}
