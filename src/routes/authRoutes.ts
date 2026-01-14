import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User";
import { config } from "../config";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest } from "../utils/errors";

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_@.\-]+$/),
  password: z.string().min(6).max(200),
});

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
});

const telegramSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => value.toString()),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]).transform((value) => value.toString()),
  hash: z.string(),
});

function signToken(userId: string, role: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign({ sub: userId, role }, config.jwtSecret, { expiresIn: config.tokenExpiresIn } as any);
}

async function ensureUniqueUsername(base: string) {
  let candidate = base;
  let attempts = 0;
  while (attempts < 5) {
    const existing = await User.findOne({ username: candidate });
    if (!existing) {
      return candidate;
    }
    candidate = `${base}_${Math.floor(Math.random() * 10000)}`;
    attempts += 1;
  }
  return `${base}_${crypto.randomUUID().slice(0, 6)}`;
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await User.findOne({ username: data.username });
    if (existing) {
      throw badRequest("Username already taken");
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      username: data.username,
      passwordHash,
      role: "user",
    });
    const token = signToken(user._id.toString(), user.role);
    res.json({ token, user: { id: user._id.toString(), username: user.username, role: user.role } });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ username: data.username });
    
    const hashToCompare = user?.passwordHash || "$2a$10$dummyhashfordummycomparison";
    await bcrypt.compare(data.password, hashToCompare);
    
    if (!user) {
      throw badRequest("Invalid credentials");
    }
    
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      throw badRequest("Invalid credentials");
    }
    
    const token = signToken(user._id.toString(), user.role);
    res.json({ token, user: { id: user._id.toString(), username: user.username, role: user.role } });
  })
);

router.post(
  "/telegramAuth",
  asyncHandler(async (req, res) => {
    if (!config.telegramBotToken) {
      throw badRequest("Telegram bot token not configured");
    }
    const data = telegramSchema.parse(req.body);
    const entries = Object.entries(data)
      .filter(([key]) => key !== "hash")
      .map(([key, value]) => `${key}=${value}`)
      .sort();
    const checkString = entries.join("\n");
    const secretKey = crypto.createHash("sha256").update(config.telegramBotToken).digest();
    const digest = crypto
      .createHmac("sha256", secretKey)
      .update(checkString)
      .digest("hex");
    if (digest !== data.hash) {
      throw badRequest("Invalid Telegram auth");
    }
    const authDate = Number(data.auth_date);
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > 86400) {
      throw badRequest("Telegram auth expired");
    }

    let user = await User.findOne({ telegramId: data.id });
    if (!user) {
      const username = await ensureUniqueUsername(data.username ?? `tg_${data.id}`);
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await User.create({
        username,
        passwordHash,
        role: "user",
        telegramId: data.id,
        telegramUsername: data.username,
      });
    } else {
      user.telegramUsername = data.username ?? user.telegramUsername;
      await user.save();
    }

    const token = signToken(user._id.toString(), user.role);
    res.json({ token, user: { id: user._id.toString(), username: user.username, role: user.role } });
  })
);

export { router as authRoutes };
