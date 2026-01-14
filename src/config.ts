import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing env var: ${name}`);
  }
  return value || '';
}

function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!secret || secret === "change_me") {
    if (isProduction) {
      throw new Error("JWT_SECRET must be set in production");
    }
    console.warn("WARNING: Using default JWT_SECRET. Set JWT_SECRET in production!");
    return "change_me_default_secret_for_dev!";
  }
  
  if (secret.length < 32) {
    if (isProduction) {
      throw new Error("JWT_SECRET must be at least 32 characters long");
    }
    console.warn("WARNING: JWT_SECRET should be at least 32 characters long");
  }
  
  return secret;
}

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  mongoUri: process.env.MONGO_URI ?? "mongodb://mongo:27017/auction",
  jwtSecret: validateJwtSecret(),
  tokenExpiresIn: process.env.TOKEN_EXPIRES_IN ?? "12h",
  antiSnipingWindowSec: Number(process.env.ANTI_SNIPING_WINDOW_SEC ?? "30"),
  antiSnipingExtendSec: Number(process.env.ANTI_SNIPING_EXTEND_SEC ?? "30"),
  cryptoBotApiBase: process.env.CRYPTOBOT_API_BASE ?? "https://pay.crypt.bot/api",
  cryptoBotToken: process.env.CRYPTOBOT_TOKEN ?? "",
  cryptoBotWebhookSecret: process.env.CRYPTOBOT_WEBHOOK_SECRET ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
};
