import Redis from "ioredis";
import { config } from "../config";

const redisOptions = {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

export const redis = new Redis(config.redisUrl, {
  ...redisOptions,
  maxRetriesPerRequest: 3,
});

export const bullmqConnection = new Redis(config.redisUrl, {
  ...redisOptions,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error("Redis error:", err.message);
  }
});

redis.on("connect", () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log("Redis connected");
  }
});

bullmqConnection.on("error", (err) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error("BullMQ Redis error:", err.message);
  }
});

export async function getRedisKey(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Redis get error");
    }
    return null;
  }
}

export async function setRedisKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Redis set error");
    }
  }
}

export async function incrementRedisKey(key: string, ttlSeconds?: number): Promise<number> {
  try {
    const result = await redis.incr(key);
    if (ttlSeconds && result === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Redis increment error");
    }
    return 0;
  }
}

export async function deleteRedisKey(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Redis delete error");
    }
  }
}
