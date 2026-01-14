import { incrementRedisKey } from "../services/redis";

const WS_RATE_LIMIT = {
  max: 10,
  window: 60,
};

export async function checkWebSocketRateLimit(ip: string): Promise<boolean> {
  const key = `ws_rate_limit:${ip}`;
  const count = await incrementRedisKey(key, WS_RATE_LIMIT.window);
  return count <= WS_RATE_LIMIT.max;
}
