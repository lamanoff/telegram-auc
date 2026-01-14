import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { User } from "./models/User";

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await seedAdmin();
}

async function seedAdmin(): Promise<void> {
  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  await User.create({
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash,
    role: "admin",
  });

  console.log(`[SEED] Admin user created: ${DEFAULT_ADMIN_USERNAME}`);
}
