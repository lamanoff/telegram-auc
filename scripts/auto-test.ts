import axios from "axios";
import WebSocket from "ws";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const WS_BASE = process.env.WS_BASE || "ws://localhost:3000";

// Threshold for considering test successful
const SUCCESS_THRESHOLD = 0.9; // 90%
const RESPONSE_TIME_THRESHOLD = 2000; // 2 seconds

interface SystemLimits {
  maxConcurrentUsers: number;
  maxWebSocketConnections: number;
  maxRequestsPerSecond: number;
  maxConcurrentBidders: number;
  sustainedRPS: number;
  avgResponseTimeAtLimit: number;
  p95ResponseTimeAtLimit: number;
}

interface User {
  id: string;
  token: string;
  username: string;
}

interface TestResult {
  level: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  rps: number;
  errors: number;
}

// MongoDB connection helper
let mongoClient: any = null;

async function getMongoClient() {
  if (!mongoClient) {
    const { MongoClient } = await import("mongodb");
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/auction?replicaSet=rs0&directConnection=true";
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
  }
  return mongoClient;
}

async function closeMongoClient() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }
}

async function waitForService(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(url, { timeout: 2000 });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function createAdminUser(): Promise<User> {
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (adminToken) {
    try {
      const userResponse = await axios.get(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      
      if (userResponse.data.role === "admin") {
        return {
          id: userResponse.data.id,
          token: adminToken,
          username: userResponse.data.username,
        };
      }
    } catch {
      // Token invalid, will create new admin
    }
  }
  
  const username = `admin_test_${Date.now()}`;
  const password = "admin_test_password_123";
  
  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      username,
      password,
    });
    
    const userId = response.data.user.id;
    
    const client = await getMongoClient();
    const { ObjectId } = await import("mongodb");
    const db = client.db();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: "admin" } }
    );
    
    console.log("✅ Роль администратора назначена");
    
    // Re-login to get a new token with admin role
    const loginResponse = await axios.post(`${API_BASE}/api/login`, {
      username,
      password,
    });
    
    return {
      id: loginResponse.data.user.id,
      token: loginResponse.data.token,
      username,
    };
  } catch (error: any) {
    if (error.response?.status === 409) {
      const loginResponse = await axios.post(`${API_BASE}/api/login`, {
        username,
        password,
      });
      return {
        id: loginResponse.data.user.id,
        token: loginResponse.data.token,
        username,
      };
    }
    throw error;
  }
}

async function createTestAuction(adminToken: string): Promise<string> {
  const startTime = new Date(Date.now() + 3000).toISOString();
  
  const response = await axios.post(
    `${API_BASE}/api/auctions`,
    {
      title: `Limit Test Auction ${Date.now()}`,
      description: "Finding system limits",
      currency: "TON",
      roundsCount: 100,
      itemsPerRound: 100,
      totalItems: 10000,
      startTime,
      firstRoundDurationSec: 600,
      roundDurationSec: 600,
      minIncrement: "0.001",
      startingPrice: "0.01",
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  
  return response.data.id;
}

async function waitForAuctionStart(auctionId: string, maxWait = 30): Promise<boolean> {
  for (let i = 0; i < maxWait; i++) {
    try {
      const response = await axios.get(`${API_BASE}/api/auctions/${auctionId}`);
      if (response.data.status === "active") {
        return true;
      }
    } catch {
      // Ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

const userCache: Map<number, User> = new Map();

async function getOrCreateUser(index: number): Promise<User> {
  if (userCache.has(index)) {
    return userCache.get(index)!;
  }
  
  const username = `limit_bot_${index}_${Date.now()}`;
  const password = `password_${index}`;
  
  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      username,
      password,
    });
    
    const user = {
      id: response.data.user.id,
      token: response.data.token,
      username,
    };
    
    // Set balance - ensure the full balance structure exists
    const client = await getMongoClient();
    const { ObjectId } = await import("mongodb");
    const db = client.db();
    await db.collection("users").updateOne(
      { _id: new ObjectId(user.id) },
      {
        $set: {
          balances: {
            TON: { total: "100000000000000", locked: "0" },  // 100000 TON
            USDT: { total: "100000000000", locked: "0" },    // 100000 USDT
          }
        }
      }
    );
    
    userCache.set(index, user);
    return user;
  } catch (error: any) {
    if (error.response?.status === 409) {
      const loginResponse = await axios.post(`${API_BASE}/api/login`, {
        username,
        password,
      });
      const user = {
        id: loginResponse.data.user.id,
        token: loginResponse.data.token,
        username,
      };
      
      // Also update balance for existing users
      const client = await getMongoClient();
      const { ObjectId } = await import("mongodb");
      const db = client.db();
      await db.collection("users").updateOne(
        { _id: new ObjectId(user.id) },
        {
          $set: {
            balances: {
              TON: { total: "100000000000000", locked: "0" },
              USDT: { total: "100000000000", locked: "0" },
            }
          }
        }
      );
      
      userCache.set(index, user);
      return user;
    }
    throw error;
  }
}

// Test WebSocket connections limit
async function testWebSocketLimit(): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n🔌 Поиск предела WebSocket подключений...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000];
  
  for (const level of levels) {
    console.log(`  Тестируем ${level} подключений...`);
    
    const connections: WebSocket[] = [];
    let connected = 0;
    let failed = 0;
    
    const connectPromises = [];
    
    for (let i = 0; i < level; i++) {
      const promise = new Promise<void>((resolve) => {
        try {
          const ws = new WebSocket(`${WS_BASE}/ws?auctionId=000000000000000000000000&token=test_${i}`);
          
          const timeout = setTimeout(() => {
            failed++;
            ws.terminate();
            resolve();
          }, 5000);
          
          ws.on("open", () => {
            clearTimeout(timeout);
            connected++;
            connections.push(ws);
            resolve();
          });
          
          ws.on("error", () => {
            clearTimeout(timeout);
            failed++;
            resolve();
          });
        } catch {
          failed++;
          resolve();
        }
      });
      
      connectPromises.push(promise);
    }
    
    await Promise.all(connectPromises);
    
    const successRate = connected / level;
    results.push({
      level,
      successRate,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      rps: 0,
      errors: failed,
    });
    
    console.log(`    Подключено: ${connected}/${level} (${(successRate * 100).toFixed(1)}%)`);
    
    // Close all connections
    connections.forEach((ws) => {
      try {
        ws.close();
      } catch {}
    });
    
    if (successRate >= SUCCESS_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} подключениях`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return { limit: currentLimit, results };
}

// Test concurrent users creating/registering
async function testConcurrentUsersLimit(): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n👥 Поиск предела одновременной регистрации...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [5, 10, 20, 30, 50, 75, 100, 150, 200];
  
  for (const level of levels) {
    console.log(`  Тестируем ${level} одновременных регистраций...`);
    
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const responseTimes: number[] = [];
    
    const promises = [];
    const baseIndex = Date.now();
    
    for (let i = 0; i < level; i++) {
      const promise = (async () => {
        const reqStart = Date.now();
        try {
          await axios.post(`${API_BASE}/api/register`, {
            username: `concurrent_${baseIndex}_${i}`,
            password: `password_${i}`,
          }, { timeout: 10000 });
          successful++;
          responseTimes.push(Date.now() - reqStart);
        } catch {
          failed++;
          responseTimes.push(Date.now() - reqStart);
        }
      })();
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const successRate = successful / level;
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    results.push({
      level,
      successRate,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      rps: level / totalTime,
      errors: failed,
    });
    
    console.log(`    Успешно: ${successful}/${level} (${(successRate * 100).toFixed(1)}%), Avg: ${avgTime.toFixed(0)}ms, RPS: ${(level / totalTime).toFixed(1)}`);
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} пользователях`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  
  return { limit: currentLimit, results };
}

// Test RPS with pre-created users
async function testRPSLimitWithUsers(auctionId: string, users: User[]): Promise<{ limit: number; sustainedRPS: number; results: TestResult[] }> {
  console.log("\n⚡ Поиск предела RPS (запросов в секунду)...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  let sustainedRPS = 0;
  
  if (users.length < 10) {
    console.log("  ❌ Недостаточно пользователей для теста RPS");
    return { limit: 0, sustainedRPS: 0, results: [] };
  }
  
  console.log(`  Используется ${users.length} предварительно созданных пользователей`);
  
  // Test single bid first
  console.log("  Проверка одиночной ставки...");
  const testUser = users[0];
  try {
    await axios.post(
      `${API_BASE}/api/auctions/${auctionId}/bid`,
      { amount: "1.0" },
      {
        headers: { Authorization: `Bearer ${testUser.token}` },
        timeout: 10000,
      }
    );
    console.log(`  ✅ Тестовая ставка успешна`);
  } catch (error: any) {
    const errMsg = error.response?.data?.error || error.message;
    console.log(`  ❌ Тестовая ставка не прошла: ${errMsg}`);
    
    try {
      const auctionInfo = await axios.get(`${API_BASE}/api/auctions/${auctionId}`);
      console.log(`     Аукцион: статус=${auctionInfo.data.status}, мин.ставка=${auctionInfo.data.currentMinBid}, валюта=${auctionInfo.data.currency}`);
    } catch {}
    
    return { limit: 0, sustainedRPS: 0, results: [] };
  }
  
  const targetRPS = [10, 25, 50, 100, 150, 200, 300, 500];
  
  for (const rps of targetRPS) {
    console.log(`  Тестируем ${rps} RPS...`);
    
    const testDuration = 5;
    const totalRequests = rps * testDuration;
    
    let successful = 0;
    let failed = 0;
    let firstError = "";
    const responseTimes: number[] = [];
    const startTime = Date.now();
    
    const promises: Promise<void>[] = [];
    let bidAmount = 1.0 + Math.random() * 100;
    
    for (let i = 0; i < totalRequests; i++) {
      const user = users[i % users.length];
      bidAmount += 0.01 + Math.random() * 0.01;
      const amount = bidAmount.toFixed(4);
      
      const promise = (async () => {
        const reqStart = Date.now();
        try {
          await axios.post(
            `${API_BASE}/api/auctions/${auctionId}/bid`,
            { amount },
            {
              headers: { Authorization: `Bearer ${user.token}` },
              timeout: 5000,
            }
          );
          successful++;
        } catch (error: any) {
          failed++;
          if (!firstError) {
            firstError = error.response?.data?.error || error.message;
          }
        }
        responseTimes.push(Date.now() - reqStart);
      })();
      
      promises.push(promise);
      
      if (i > 0 && i % rps === 0) {
        await Promise.all(promises);
        promises.length = 0;
        
        const elapsed = Date.now() - startTime;
        const targetElapsed = (i / rps) * 1000;
        if (targetElapsed > elapsed) {
          await new Promise((resolve) => setTimeout(resolve, targetElapsed - elapsed));
        }
      }
    }
    
    await Promise.all(promises);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const actualRPS = (successful + failed) / totalTime;
    const successRate = successful / (successful + failed);
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    results.push({
      level: rps,
      successRate,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      rps: actualRPS,
      errors: failed,
    });
    
    console.log(`    Успешно: ${successful}/${successful + failed} (${(successRate * 100).toFixed(1)}%), Actual RPS: ${actualRPS.toFixed(1)}, Avg: ${avgTime.toFixed(0)}ms`);
    if (firstError && successRate < SUCCESS_THRESHOLD) {
      console.log(`    Первая ошибка: ${firstError}`);
    }
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = rps;
      sustainedRPS = actualRPS;
    } else {
      console.log(`    ⚠️ Предел RPS достигнут при ${rps}`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return { limit: currentLimit, sustainedRPS, results };
}

// Test concurrent bidders with pre-created users
async function testConcurrentBiddersLimitWithUsers(auctionId: string, users: User[]): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n🎯 Поиск предела одновременно делающих ставки...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  
  for (const level of levels) {
    if (users.length < level) {
      console.log(`  ⚠️ Недостаточно пользователей для теста ${level} ставок (есть ${users.length})`);
      break;
    }
    
    console.log(`  Тестируем ${level} одновременных ставок...`);
    
    const testUsers = users.slice(0, level);
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let firstError = "";
    const responseTimes: number[] = [];
    
    const baseBid = 200 + Math.random() * 100 + level * 10;
    
    const promises = testUsers.map(async (user, index) => {
      const bidAmount = baseBid + index * 0.1 + Math.random() * 0.05;
      const reqStart = Date.now();
      try {
        await axios.post(
          `${API_BASE}/api/auctions/${auctionId}/bid`,
          { amount: bidAmount.toFixed(4) },
          {
            headers: { Authorization: `Bearer ${user.token}` },
            timeout: 10000,
          }
        );
        successful++;
        responseTimes.push(Date.now() - reqStart);
      } catch (error: any) {
        failed++;
        responseTimes.push(Date.now() - reqStart);
        if (!firstError) {
          firstError = error.response?.data?.error || error.message;
        }
      }
    });
    
    await Promise.all(promises);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const successRate = successful / testUsers.length;
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    results.push({
      level,
      successRate,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      rps: testUsers.length / totalTime,
      errors: failed,
    });
    
    console.log(`    Успешно: ${successful}/${testUsers.length} (${(successRate * 100).toFixed(1)}%), Avg: ${avgTime.toFixed(0)}ms`);
    if (firstError && successRate < SUCCESS_THRESHOLD) {
      console.log(`    Первая ошибка: ${firstError}`);
    }
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} одновременных ставках`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return { limit: currentLimit, results };
}

// Test RPS (requests per second) limit - old version
async function testRPSLimit(auctionId: string): Promise<{ limit: number; sustainedRPS: number; results: TestResult[] }> {
  console.log("\n⚡ Поиск предела RPS (запросов в секунду)...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  let sustainedRPS = 0;
  
  // Create users for testing
  console.log("  Подготовка пользователей...");
  const users: User[] = [];
  for (let i = 0; i < 100; i++) {
    try {
      const user = await getOrCreateUser(i + 50000);
      users.push(user);
    } catch {
      // Ignore
    }
  }
  console.log(`  Создано ${users.length} пользователей`);
  
  // Verify balance was set
  if (users.length > 0) {
    try {
      const client = await getMongoClient();
      const { ObjectId } = await import("mongodb");
      const db = client.db();
      const dbUser = await db.collection("users").findOne({ _id: new ObjectId(users[0].id) });
      if (dbUser?.balances?.TON?.total) {
        console.log(`  Баланс пользователя: ${dbUser.balances.TON.total} (nanoTON)`);
      } else {
        console.log(`  ⚠️ Баланс не установлен! Структура: ${JSON.stringify(dbUser?.balances)}`);
      }
    } catch (e: any) {
      console.log(`  ⚠️ Ошибка проверки баланса: ${e.message}`);
    }
  }
  
  // Test single bid first to check if it works
  console.log("  Проверка одиночной ставки...");
  const testUser = users[0];
  try {
    const testResponse = await axios.post(
      `${API_BASE}/api/auctions/${auctionId}/bid`,
      { amount: "1.0" },
      {
        headers: { Authorization: `Bearer ${testUser.token}` },
        timeout: 10000,
      }
    );
    console.log(`  ✅ Тестовая ставка успешна`);
  } catch (error: any) {
    const errMsg = error.response?.data?.error || error.message;
    console.log(`  ❌ Тестовая ставка не прошла: ${errMsg}`);
    console.log(`     Проверьте баланс пользователя и настройки аукциона`);
    
    // Try to get more info
    try {
      const auctionInfo = await axios.get(`${API_BASE}/api/auctions/${auctionId}`);
      console.log(`     Аукцион: статус=${auctionInfo.data.status}, мин.ставка=${auctionInfo.data.currentMinBid}, валюта=${auctionInfo.data.currency}`);
    } catch {}
    
    return { limit: 0, sustainedRPS: 0, results: [] };
  }
  
  const targetRPS = [10, 25, 50, 100, 150, 200, 300, 500, 750, 1000];
  
  for (const rps of targetRPS) {
    console.log(`  Тестируем ${rps} RPS...`);
    
    const testDuration = 5; // seconds
    const totalRequests = rps * testDuration;
    
    let successful = 0;
    let failed = 0;
    let firstError = "";
    const responseTimes: number[] = [];
    const startTime = Date.now();
    
    const promises: Promise<void>[] = [];
    let bidAmount = 1.0 + Math.random() * 10;
    
    for (let i = 0; i < totalRequests; i++) {
      const user = users[i % users.length];
      bidAmount += 0.01 + Math.random() * 0.01;
      const amount = bidAmount.toFixed(4);
      
      const promise = (async () => {
        const reqStart = Date.now();
        try {
          await axios.post(
            `${API_BASE}/api/auctions/${auctionId}/bid`,
            { amount },
            {
              headers: { Authorization: `Bearer ${user.token}` },
              timeout: 5000,
            }
          );
          successful++;
        } catch (error: any) {
          failed++;
          if (!firstError) {
            firstError = error.response?.data?.error || error.message;
          }
        }
        responseTimes.push(Date.now() - reqStart);
      })();
      
      promises.push(promise);
      
      // Control rate
      if (i > 0 && i % rps === 0) {
        await Promise.all(promises);
        promises.length = 0;
        
        const elapsed = Date.now() - startTime;
        const targetElapsed = (i / rps) * 1000;
        if (targetElapsed > elapsed) {
          await new Promise((resolve) => setTimeout(resolve, targetElapsed - elapsed));
        }
      }
    }
    
    await Promise.all(promises);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const actualRPS = (successful + failed) / totalTime;
    const successRate = successful / (successful + failed);
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    results.push({
      level: rps,
      successRate,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      rps: actualRPS,
      errors: failed,
    });
    
    console.log(`    Успешно: ${successful}/${successful + failed} (${(successRate * 100).toFixed(1)}%), Actual RPS: ${actualRPS.toFixed(1)}, Avg: ${avgTime.toFixed(0)}ms`);
    if (firstError && successRate < SUCCESS_THRESHOLD) {
      console.log(`    Первая ошибка: ${firstError}`);
    }
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = rps;
      sustainedRPS = actualRPS;
    } else {
      console.log(`    ⚠️ Предел RPS достигнут при ${rps}`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return { limit: currentLimit, sustainedRPS, results };
}

// Test concurrent bidders limit
async function testConcurrentBiddersLimit(auctionId: string): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n🎯 Поиск предела одновременно делающих ставки...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  
  for (const level of levels) {
    console.log(`  Тестируем ${level} одновременных ставок...`);
    
    // Create users
    const users: User[] = [];
    for (let i = 0; i < level; i++) {
      try {
        const user = await getOrCreateUser(i + 100000 + level * 1000);
        users.push(user);
      } catch {
        // Ignore
      }
    }
    
    if (users.length < level * 0.8) {
      console.log(`    ⚠️ Не удалось создать достаточно пользователей`);
      break;
    }
    
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let firstError = "";
    const responseTimes: number[] = [];
    
    // Use higher base bid to ensure uniqueness
    const baseBid = 100 + Math.random() * 100;
    
    const promises = users.map(async (user, index) => {
      const bidAmount = baseBid + index * 0.1 + Math.random() * 0.05;
      const reqStart = Date.now();
      try {
        await axios.post(
          `${API_BASE}/api/auctions/${auctionId}/bid`,
          { amount: bidAmount.toFixed(4) },
          {
            headers: { Authorization: `Bearer ${user.token}` },
            timeout: 10000,
          }
        );
        successful++;
        responseTimes.push(Date.now() - reqStart);
      } catch (error: any) {
        failed++;
        responseTimes.push(Date.now() - reqStart);
        if (!firstError) {
          firstError = error.response?.data?.error || error.message;
        }
      }
    });
    
    await Promise.all(promises);
    
    const totalTime = (Date.now() - startTime) / 1000;
    const successRate = successful / users.length;
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    results.push({
      level,
      successRate,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      rps: users.length / totalTime,
      errors: failed,
    });
    
    console.log(`    Успешно: ${successful}/${users.length} (${(successRate * 100).toFixed(1)}%), Avg: ${avgTime.toFixed(0)}ms`);
    if (firstError && successRate < SUCCESS_THRESHOLD) {
      console.log(`    Первая ошибка: ${firstError}`);
    }
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} одновременных ставках`);
      break;
    }
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return { limit: currentLimit, results };
}

function printLimitsReport(limits: SystemLimits, testResults: {
  wsResults: TestResult[];
  userResults: TestResult[];
  rpsResults: TestResult[];
  bidderResults: TestResult[];
}) {
  console.log("\n" + "═".repeat(80));
  console.log("                    🏆 ОТЧЁТ О ПРЕДЕЛАХ СИСТЕМЫ 🏆");
  console.log("═".repeat(80));
  
  console.log("\n┌────────────────────────────────────────────────────────────────────────────┐");
  console.log("│                           НАЙДЕННЫЕ ПРЕДЕЛЫ                               │");
  console.log("├────────────────────────────────────────────────────────────────────────────┤");
  console.log(`│  🔌 WebSocket подключений:          ${String(limits.maxWebSocketConnections).padStart(6)}                               │`);
  console.log(`│  👥 Одновременных регистраций:      ${String(limits.maxConcurrentUsers).padStart(6)}                               │`);
  console.log(`│  🎯 Одновременных ставок:           ${String(limits.maxConcurrentBidders).padStart(6)}                               │`);
  console.log(`│  ⚡ Максимум RPS (целевой):          ${String(limits.maxRequestsPerSecond).padStart(6)}                               │`);
  console.log(`│  📈 Фактический устойчивый RPS:     ${limits.sustainedRPS.toFixed(1).padStart(6)}                               │`);
  console.log("└────────────────────────────────────────────────────────────────────────────┘");
  
  console.log("\n┌────────────────────────────────────────────────────────────────────────────┐");
  console.log("│                       ВРЕМЯ ОТКЛИКА НА ПРЕДЕЛЕ                            │");
  console.log("├────────────────────────────────────────────────────────────────────────────┤");
  console.log(`│  Среднее время ответа:              ${limits.avgResponseTimeAtLimit.toFixed(0).padStart(6)} ms                            │`);
  console.log(`│  P95 время ответа:                  ${limits.p95ResponseTimeAtLimit.toFixed(0).padStart(6)} ms                            │`);
  console.log("└────────────────────────────────────────────────────────────────────────────┘");
  
  // Detailed results for each test
  console.log("\n📊 ДЕТАЛЬНЫЕ РЕЗУЛЬТАТЫ ТЕСТОВ:");
  
  console.log("\n  WebSocket подключения:");
  console.log("  ┌─────────┬────────────┬─────────┐");
  console.log("  │ Уровень │ Успешность │  Ошибки │");
  console.log("  ├─────────┼────────────┼─────────┤");
  for (const r of testResults.wsResults) {
    console.log(`  │ ${String(r.level).padStart(7)} │ ${(r.successRate * 100).toFixed(1).padStart(9)}% │ ${String(r.errors).padStart(7)} │`);
  }
  console.log("  └─────────┴────────────┴─────────┘");
  
  console.log("\n  RPS тест:");
  console.log("  ┌─────────┬────────────┬────────────┬──────────┐");
  console.log("  │   RPS   │ Успешность │  Avg (ms)  │ P95 (ms) │");
  console.log("  ├─────────┼────────────┼────────────┼──────────┤");
  for (const r of testResults.rpsResults) {
    console.log(`  │ ${String(r.level).padStart(7)} │ ${(r.successRate * 100).toFixed(1).padStart(9)}% │ ${r.avgResponseTime.toFixed(0).padStart(10)} │ ${r.p95ResponseTime.toFixed(0).padStart(8)} │`);
  }
  console.log("  └─────────┴────────────┴────────────┴──────────┘");
  
  console.log("\n  Одновременные ставки:");
  console.log("  ┌─────────┬────────────┬────────────┬──────────┐");
  console.log("  │ Ставки  │ Успешность │  Avg (ms)  │ P95 (ms) │");
  console.log("  ├─────────┼────────────┼────────────┼──────────┤");
  for (const r of testResults.bidderResults) {
    console.log(`  │ ${String(r.level).padStart(7)} │ ${(r.successRate * 100).toFixed(1).padStart(9)}% │ ${r.avgResponseTime.toFixed(0).padStart(10)} │ ${r.p95ResponseTime.toFixed(0).padStart(8)} │`);
  }
  console.log("  └─────────┴────────────┴────────────┴──────────┘");
  
  // Recommendations
  console.log("\n💡 РЕКОМЕНДАЦИИ:");
  
  if (limits.maxWebSocketConnections >= 500) {
    console.log("  ✅ WebSocket: Отличная масштабируемость (500+ подключений)");
  } else if (limits.maxWebSocketConnections >= 100) {
    console.log("  ⚠️  WebSocket: Средняя масштабируемость, рассмотрите использование Redis PubSub");
  } else {
    console.log("  ❌ WebSocket: Низкая масштабируемость, требуется оптимизация");
  }
  
  if (limits.sustainedRPS >= 100) {
    console.log("  ✅ RPS: Высокая пропускная способность (100+ RPS)");
  } else if (limits.sustainedRPS >= 50) {
    console.log("  ⚠️  RPS: Средняя пропускная способность, рассмотрите кэширование");
  } else {
    console.log("  ❌ RPS: Низкая пропускная способность, требуется оптимизация БД");
  }
  
  if (limits.maxConcurrentBidders >= 100) {
    console.log("  ✅ Ставки: Система выдерживает высокую конкуренцию");
  } else if (limits.maxConcurrentBidders >= 50) {
    console.log("  ⚠️  Ставки: Умеренная конкурентоспособность");
  } else {
    console.log("  ❌ Ставки: Низкая конкурентоспособность, проверьте блокировки БД");
  }
  
  if (limits.p95ResponseTimeAtLimit <= 500) {
    console.log("  ✅ Латентность: Отличное время отклика");
  } else if (limits.p95ResponseTimeAtLimit <= 1000) {
    console.log("  ⚠️  Латентность: Приемлемое время отклика");
  } else {
    console.log("  ❌ Латентность: Высокое время отклика, требуется оптимизация");
  }
  
  console.log("\n" + "═".repeat(80));
  console.log(`  Тестирование завершено: ${new Date().toLocaleString()}`);
  console.log("═".repeat(80) + "\n");
}

async function main() {
  console.log("═".repeat(80));
  console.log("       🚀 АВТОМАТИЧЕСКИЙ ПОИСК ПРЕДЕЛОВ СИСТЕМЫ 🚀");
  console.log("═".repeat(80));
  console.log(`\n  Порог успешности: ${SUCCESS_THRESHOLD * 100}%`);
  console.log(`  Порог времени ответа: ${RESPONSE_TIME_THRESHOLD}ms`);
  
  console.log("\n1️⃣  Проверка доступности сервисов...");
  const apiAvailable = await waitForService(`${API_BASE}/health`);
  if (!apiAvailable) {
    console.error("❌ API недоступен. Запустите docker-compose up -d");
    process.exit(1);
  }
  console.log("   ✅ API доступен");
  
  console.log("\n2️⃣  Создание администратора...");
  const admin = await createAdminUser();
  console.log(`   ✅ Администратор: ${admin.username}`);
  
  console.log("\n3️⃣  Создание тестового аукциона...");
  const auctionId = await createTestAuction(admin.token);
  console.log(`   ✅ Аукцион создан: ${auctionId}`);
  
  console.log("\n4️⃣  Ожидание старта аукциона...");
  const auctionStarted = await waitForAuctionStart(auctionId, 30);
  if (!auctionStarted) {
    console.error("❌ Аукцион не запустился");
    process.exit(1);
  }
  console.log("   ✅ Аукцион активен");
  
  // Pre-create users for bid tests BEFORE registration stress test
  console.log("\n5️⃣  Предварительное создание пользователей для тестов ставок...");
  const preCreatedUsers: User[] = [];
  for (let i = 0; i < 300; i++) {
    try {
      const user = await getOrCreateUser(i);
      preCreatedUsers.push(user);
      if ((i + 1) % 50 === 0) {
        console.log(`   Создано ${i + 1}/300 пользователей`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Ошибка создания пользователя ${i}: ${error.message}`);
      break;
    }
  }
  console.log(`   ✅ Создано ${preCreatedUsers.length} пользователей для тестов`);
  
  // Run limit tests
  console.log("\n" + "─".repeat(80));
  console.log("                    НАЧАЛО ПОИСКА ПРЕДЕЛОВ СИСТЕМЫ");
  console.log("─".repeat(80));
  
  const wsTest = await testWebSocketLimit();
  const userTest = await testConcurrentUsersLimit();
  const rpsTest = await testRPSLimitWithUsers(auctionId, preCreatedUsers);
  const bidderTest = await testConcurrentBiddersLimitWithUsers(auctionId, preCreatedUsers);
  
  // Find response times at limit
  const rpsAtLimit = rpsTest.results.find(r => r.level === rpsTest.limit) || rpsTest.results[rpsTest.results.length - 1];
  
  const limits: SystemLimits = {
    maxConcurrentUsers: userTest.limit,
    maxWebSocketConnections: wsTest.limit,
    maxRequestsPerSecond: rpsTest.limit,
    maxConcurrentBidders: bidderTest.limit,
    sustainedRPS: rpsTest.sustainedRPS,
    avgResponseTimeAtLimit: rpsAtLimit?.avgResponseTime || 0,
    p95ResponseTimeAtLimit: rpsAtLimit?.p95ResponseTime || 0,
  };
  
  printLimitsReport(limits, {
    wsResults: wsTest.results,
    userResults: userTest.results,
    rpsResults: rpsTest.results,
    bidderResults: bidderTest.results,
  });
  
  await closeMongoClient();
}

main().catch(async (error) => {
  console.error("❌ Критическая ошибка:", error.message);
  if (error.response) {
    console.error("   Ответ сервера:", error.response.data);
  }
  await closeMongoClient();
  process.exit(1);
});
