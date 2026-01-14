import axios, { AxiosInstance } from "axios";
import WebSocket from "ws";
import * as readline from "readline";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Test thresholds
const SUCCESS_THRESHOLD = 0.9; // 90%
const RESPONSE_TIME_THRESHOLD = 2000; // 2 seconds

// Configuration (will be set interactively or from env/args)
let API_BASE = "";
let WS_BASE = "";
let ADMIN_USERNAME = "";
let ADMIN_PASSWORD = "";
let ANTI_SNIPE_WINDOW_SEC = 30;
let ANTI_SNIPE_EXTEND_SEC = 30;

// ============================================================================
// INTERACTIVE INPUT
// ============================================================================

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionHidden(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    // For password input, we'll use a simple approach
    // Note: This won't hide the password on all terminals
    process.stdout.write(prompt);
    
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    
    let password = "";
    
    const onData = (char: Buffer) => {
      const c = char.toString("utf8");
      
      switch (c) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          if (stdin.isTTY) {
            stdin.setRawMode(wasRaw ?? false);
          }
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          process.exit(1);
          break;
        case "\u007F": // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + "*".repeat(password.length));
          }
          break;
        default:
          password += c;
          process.stdout.write("*");
          break;
      }
    };
    
    stdin.on("data", onData);
  });
}

// Remove trailing slash from URL
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function promptForConfiguration(): Promise<void> {
  // Check if all config is provided via environment or arguments
  const envApiBase = process.env.API_BASE || process.argv[2];
  const envWsBase = process.env.WS_BASE || process.argv[3];
  const envUsername = process.env.ADMIN_USERNAME || process.argv[4];
  const envPassword = process.env.ADMIN_PASSWORD || process.argv[5];
  
  // If all required params are provided, use them
  if (envApiBase && envUsername && envPassword) {
    API_BASE = normalizeUrl(envApiBase);
    WS_BASE = normalizeUrl(envWsBase || envApiBase.replace(/^http/, "ws"));
    ADMIN_USERNAME = envUsername;
    ADMIN_PASSWORD = envPassword;
    ANTI_SNIPE_WINDOW_SEC = Number(process.env.ANTI_SNIPE_WINDOW_SEC || "30");
    ANTI_SNIPE_EXTEND_SEC = Number(process.env.ANTI_SNIPE_EXTEND_SEC || "30");
    return;
  }
  
  console.log("═".repeat(80));
  console.log("       🚀 НАСТРОЙКА ТЕСТИРОВАНИЯ АУКЦИОННОЙ СИСТЕМЫ");
  console.log("═".repeat(80));
  console.log("\n  Введите параметры подключения к серверу.\n");
  console.log("  💡 Совет: Нажмите Enter для значения по умолчанию (в скобках)\n");
  
  const rl = createReadlineInterface();
  
  try {
    // API URL
    const defaultApiBase = envApiBase || "http://localhost:3000";
    const apiBaseInput = await question(rl, `  🌐 URL сервера API [${defaultApiBase}]: `);
    API_BASE = normalizeUrl(apiBaseInput || defaultApiBase);
    
    // WebSocket URL (auto-derived from API URL)
    const defaultWsBase = API_BASE.replace(/^http/, "ws");
    WS_BASE = normalizeUrl(defaultWsBase);
    console.log(`  📡 WebSocket URL: ${WS_BASE}`);
    
    // Admin username
    const defaultUsername = envUsername || "admin";
    const usernameInput = await question(rl, `\n  👤 Логин администратора [${defaultUsername}]: `);
    ADMIN_USERNAME = usernameInput || defaultUsername;
    
    // Admin password
    const defaultPassword = envPassword || "admin123";
    console.log(`  🔑 Пароль администратора [${defaultPassword.replace(/./g, "*")}]: `);
    
    // Use simple question for password (hidden input can be problematic in some terminals)
    const passwordInput = await question(rl, `     (введите новый или нажмите Enter для значения по умолчанию): `);
    ADMIN_PASSWORD = passwordInput || defaultPassword;
    
    // Anti-snipe settings
    console.log("\n  ⚙️  Настройки Anti-Snipe (защита от снайпинга):");
    
    const defaultWindow = process.env.ANTI_SNIPE_WINDOW_SEC || "30";
    const windowInput = await question(rl, `     Окно anti-snipe в секундах [${defaultWindow}]: `);
    ANTI_SNIPE_WINDOW_SEC = Number(windowInput || defaultWindow);
    
    const defaultExtend = process.env.ANTI_SNIPE_EXTEND_SEC || "30";
    const extendInput = await question(rl, `     Продление раунда в секундах [${defaultExtend}]: `);
    ANTI_SNIPE_EXTEND_SEC = Number(extendInput || defaultExtend);
    
  } finally {
    rl.close();
  }
  
  console.log("");
}

function printConfiguration(): void {
  console.log("═".repeat(80));
  console.log("  🔧 КОНФИГУРАЦИЯ ТЕСТОВ");
  console.log("═".repeat(80));
  console.log(`  API_BASE: ${API_BASE}`);
  console.log(`  WS_BASE: ${WS_BASE}`);
  console.log(`  ADMIN_USERNAME: ${ADMIN_USERNAME}`);
  console.log(`  ADMIN_PASSWORD: ${"*".repeat(ADMIN_PASSWORD.length)}`);
  console.log(`  ANTI_SNIPE_WINDOW_SEC: ${ANTI_SNIPE_WINDOW_SEC}`);
  console.log(`  ANTI_SNIPE_EXTEND_SEC: ${ANTI_SNIPE_EXTEND_SEC}`);
  console.log("═".repeat(80));
}

// ============================================================================
// TYPES
// ============================================================================

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

interface AntiSnipeTestResult {
  testName: string;
  passed: boolean;
  details: string;
  originalEndTime?: Date;
  newEndTime?: Date;
  extensionSec?: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

function createApiClient(token?: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function waitForService(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${url}/health`, { timeout: 2000 });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function loginAdmin(): Promise<User> {
  console.log(`\n🔐 Вход под администратором: ${ADMIN_USERNAME}...`);
  
  try {
    const response = await axios.post(`${API_BASE}/api/login`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    
    if (response.data.user.role !== "admin") {
      throw new Error(`Пользователь ${ADMIN_USERNAME} не является администратором (роль: ${response.data.user.role})`);
    }
    
    console.log(`   ✅ Успешный вход как администратор`);
    return {
      id: response.data.user.id,
      token: response.data.token,
      username: response.data.user.username,
    };
  } catch (error: any) {
    if (error.response?.status === 400) {
      throw new Error(`Неверные учётные данные администратора: ${ADMIN_USERNAME}`);
    }
    throw error;
  }
}

async function createTestUser(adminToken: string, index: number): Promise<User> {
  const username = `test_bot_${Date.now()}_${index}`;
  const password = `test_password_${index}`;
  
  try {
    // Register user
    const registerResponse = await axios.post(`${API_BASE}/api/register`, {
      username,
      password,
    });
    
    const user: User = {
      id: registerResponse.data.user.id,
      token: registerResponse.data.token,
      username,
    };
    
    // Set balance via admin API
    await axios.post(
      `${API_BASE}/api/admin/users/${user.id}/balance`,
      { currency: "TON", amount: "100000" },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    
    await axios.post(
      `${API_BASE}/api/admin/users/${user.id}/balance`,
      { currency: "USDT", amount: "100000" },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    
    return user;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes("already taken")) {
      // User exists, try to login
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

// ============================================================================
// AUCTION MANAGEMENT
// ============================================================================

async function createTestAuction(
  adminToken: string, 
  options: {
    roundDurationSec?: number;
    firstRoundDurationSec?: number;
    startDelayMs?: number;
  } = {}
): Promise<string> {
  const {
    roundDurationSec = 600,
    firstRoundDurationSec = 600,
    startDelayMs = 3000,
  } = options;
  
  const startTime = new Date(Date.now() + startDelayMs).toISOString();
  
  const response = await axios.post(
    `${API_BASE}/api/auctions`,
    {
      title: `Test Auction ${Date.now()}`,
      description: "Automated test auction",
      currency: "TON",
      roundsCount: 100,
      itemsPerRound: 100,
      totalItems: 10000,
      startTime,
      firstRoundDurationSec,
      roundDurationSec,
      minIncrement: "0.001",
      startingPrice: "0.01",
    },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  
  return response.data.id;
}

async function getAuctionDetails(auctionId: string, token?: string): Promise<any> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await axios.get(`${API_BASE}/api/auctions/${auctionId}`, { headers });
  return response.data;
}

async function waitForAuctionStart(auctionId: string, maxWait = 30): Promise<boolean> {
  for (let i = 0; i < maxWait; i++) {
    try {
      const details = await getAuctionDetails(auctionId);
      if (details.status === "active") {
        return true;
      }
    } catch {
      // Ignore
    }
    await sleep(1000);
  }
  return false;
}

async function placeBid(auctionId: string, userToken: string, amount: string): Promise<any> {
  const response = await axios.post(
    `${API_BASE}/api/auctions/${auctionId}/bid`,
    { amount },
    { headers: { Authorization: `Bearer ${userToken}` }, timeout: 10000 }
  );
  return response.data;
}

// ============================================================================
// ANTI-SNIPE TESTS
// ============================================================================

async function testAntiSnipeBasic(adminToken: string): Promise<AntiSnipeTestResult> {
  console.log("\n🛡️  Тест: Базовая защита от снайпинга");
  console.log("   Проверяем, что ставка в последние секунды продлевает раунд...");
  
  try {
    // Create a short auction for testing
    const auctionId = await createTestAuction(adminToken, {
      firstRoundDurationSec: ANTI_SNIPE_WINDOW_SEC + 5, // Just enough time to test
      roundDurationSec: ANTI_SNIPE_WINDOW_SEC + 5,
      startDelayMs: 2000,
    });
    
    console.log(`   Создан тестовый аукцион: ${auctionId}`);
    
    // Create test user
    const testUser = await createTestUser(adminToken, 99999);
    console.log(`   Создан тестовый пользователь: ${testUser.username}`);
    
    // Wait for auction to start
    const started = await waitForAuctionStart(auctionId, 10);
    if (!started) {
      return {
        testName: "Anti-Snipe Basic",
        passed: false,
        details: "Аукцион не запустился",
      };
    }
    
    // Get initial auction state
    let auction = await getAuctionDetails(auctionId);
    const originalRoundEndsAt = new Date(auction.roundEndsAt);
    console.log(`   Раунд заканчивается: ${originalRoundEndsAt.toISOString()}`);
    
    // Calculate how long to wait to be in the anti-snipe window
    const now = Date.now();
    const roundEndTime = originalRoundEndsAt.getTime();
    const timeToWait = roundEndTime - now - (ANTI_SNIPE_WINDOW_SEC * 1000) + 2000; // Enter window 2 seconds in
    
    if (timeToWait > 0) {
      console.log(`   Ожидание ${(timeToWait / 1000).toFixed(1)}с до входа в окно anti-snipe...`);
      await sleep(timeToWait);
    }
    
    // Get time remaining before bid
    const timeBeforeBid = originalRoundEndsAt.getTime() - Date.now();
    console.log(`   Осталось до конца раунда: ${(timeBeforeBid / 1000).toFixed(1)}с`);
    
    // Place a bid in the anti-snipe window
    console.log(`   Делаем ставку в окне anti-snipe...`);
    await placeBid(auctionId, testUser.token, "1.0");
    
    // Wait a bit for the bid to be processed
    await sleep(500);
    
    // Check if round was extended
    auction = await getAuctionDetails(auctionId);
    const newRoundEndsAt = new Date(auction.roundEndsAt);
    
    const extensionMs = newRoundEndsAt.getTime() - originalRoundEndsAt.getTime();
    const extensionSec = Math.round(extensionMs / 1000);
    
    console.log(`   Новое время окончания: ${newRoundEndsAt.toISOString()}`);
    console.log(`   Продление: ${extensionSec}с (ожидалось: ${ANTI_SNIPE_EXTEND_SEC}с)`);
    
    // Allow some tolerance (±2 seconds)
    const passed = extensionSec >= ANTI_SNIPE_EXTEND_SEC - 2 && extensionSec <= ANTI_SNIPE_EXTEND_SEC + 2;
    
    return {
      testName: "Anti-Snipe Basic",
      passed,
      details: passed 
        ? `Раунд продлён на ${extensionSec}с как ожидалось` 
        : `Ожидалось продление на ${ANTI_SNIPE_EXTEND_SEC}с, получено ${extensionSec}с`,
      originalEndTime: originalRoundEndsAt,
      newEndTime: newRoundEndsAt,
      extensionSec,
    };
  } catch (error: any) {
    return {
      testName: "Anti-Snipe Basic",
      passed: false,
      details: `Ошибка: ${error.response?.data?.error || error.message}`,
    };
  }
}

async function testAntiSnipeMultipleBids(adminToken: string): Promise<AntiSnipeTestResult> {
  console.log("\n🛡️  Тест: Множественные ставки в окне anti-snipe");
  console.log("   Проверяем последовательное продление при ставках в окне...");
  
  try {
    // Create a short auction for testing
    const auctionId = await createTestAuction(adminToken, {
      firstRoundDurationSec: ANTI_SNIPE_WINDOW_SEC + 10,
      roundDurationSec: ANTI_SNIPE_WINDOW_SEC + 10,
      startDelayMs: 2000,
    });
    
    // Create test users
    const testUser1 = await createTestUser(adminToken, 88881);
    const testUser2 = await createTestUser(adminToken, 88882);
    
    // Wait for auction to start
    const started = await waitForAuctionStart(auctionId, 10);
    if (!started) {
      return {
        testName: "Anti-Snipe Multiple Bids",
        passed: false,
        details: "Аукцион не запустился",
      };
    }
    
    // Get initial state
    let auction = await getAuctionDetails(auctionId);
    const originalRoundEndsAt = new Date(auction.roundEndsAt);
    
    // Wait to enter anti-snipe window
    const now = Date.now();
    const roundEndTime = originalRoundEndsAt.getTime();
    const timeToWait = roundEndTime - now - (ANTI_SNIPE_WINDOW_SEC * 1000) + 2000;
    
    if (timeToWait > 0) {
      console.log(`   Ожидание ${(timeToWait / 1000).toFixed(1)}с до окна anti-snipe...`);
      await sleep(timeToWait);
    }
    
    // First bid - should extend
    console.log(`   Первая ставка в окне anti-snipe...`);
    await placeBid(auctionId, testUser1.token, "1.0");
    await sleep(500);
    
    auction = await getAuctionDetails(auctionId);
    const afterFirstBid = new Date(auction.roundEndsAt);
    const firstExtension = Math.round((afterFirstBid.getTime() - originalRoundEndsAt.getTime()) / 1000);
    console.log(`   Первое продление: ${firstExtension}с`);
    
    // After extension, we're now OUTSIDE the anti-snipe window again
    // (because roundEndsAt moved forward by ANTI_SNIPE_EXTEND_SEC)
    // This is EXPECTED behavior - the second bid will NOT extend because
    // time remaining is now > ANTI_SNIPE_WINDOW_SEC
    
    // Wait until we're back in the anti-snipe window
    auction = await getAuctionDetails(auctionId);
    const newRoundEndTime = new Date(auction.roundEndsAt).getTime();
    const timeToSecondWindow = newRoundEndTime - Date.now() - (ANTI_SNIPE_WINDOW_SEC * 1000) + 2000;
    
    if (timeToSecondWindow > 0 && timeToSecondWindow < 60000) {
      console.log(`   Ожидание ${(timeToSecondWindow / 1000).toFixed(1)}с до повторного входа в окно...`);
      await sleep(timeToSecondWindow);
    }
    
    console.log(`   Вторая ставка в окне anti-snipe...`);
    await placeBid(auctionId, testUser2.token, "2.0");
    await sleep(500);
    
    auction = await getAuctionDetails(auctionId);
    const afterSecondBid = new Date(auction.roundEndsAt);
    
    const secondExtension = Math.round((afterSecondBid.getTime() - afterFirstBid.getTime()) / 1000);
    const totalExtension = Math.round((afterSecondBid.getTime() - originalRoundEndsAt.getTime()) / 1000);
    
    console.log(`   Второе продление: ${secondExtension}с`);
    console.log(`   Общее продление: ${totalExtension}с`);
    
    // First bid should have extended, second bid should also extend if we waited
    const firstOk = firstExtension >= ANTI_SNIPE_EXTEND_SEC - 2;
    const secondOk = secondExtension >= ANTI_SNIPE_EXTEND_SEC - 2;
    const passed = firstOk && secondOk;
    
    return {
      testName: "Anti-Snipe Multiple Bids",
      passed,
      details: passed 
        ? `Каждая ставка в окне продлила раунд. Общее продление: ${totalExtension}с`
        : `Продления: ${firstExtension}с и ${secondExtension}с (ожидалось ~${ANTI_SNIPE_EXTEND_SEC}с каждое)`,
      extensionSec: totalExtension,
    };
  } catch (error: any) {
    return {
      testName: "Anti-Snipe Multiple Bids",
      passed: false,
      details: `Ошибка: ${error.response?.data?.error || error.message}`,
    };
  }
}

async function testAntiSnipeOutsideWindow(adminToken: string): Promise<AntiSnipeTestResult> {
  console.log("\n🛡️  Тест: Ставка вне окна anti-snipe");
  console.log("   Проверяем, что ставка ВНЕ окна не продлевает раунд...");
  
  try {
    // Create auction with longer duration
    const auctionId = await createTestAuction(adminToken, {
      firstRoundDurationSec: ANTI_SNIPE_WINDOW_SEC + 60, // 60 seconds before anti-snipe window
      roundDurationSec: ANTI_SNIPE_WINDOW_SEC + 60,
      startDelayMs: 2000,
    });
    
    const testUser = await createTestUser(adminToken, 77777);
    
    const started = await waitForAuctionStart(auctionId, 10);
    if (!started) {
      return {
        testName: "Anti-Snipe Outside Window",
        passed: false,
        details: "Аукцион не запустился",
      };
    }
    
    // Get initial state - we're well outside the anti-snipe window
    let auction = await getAuctionDetails(auctionId);
    const originalRoundEndsAt = new Date(auction.roundEndsAt);
    
    const timeRemaining = (originalRoundEndsAt.getTime() - Date.now()) / 1000;
    console.log(`   Осталось до конца раунда: ${timeRemaining.toFixed(1)}с (окно anti-snipe: ${ANTI_SNIPE_WINDOW_SEC}с)`);
    
    // Place a bid outside the anti-snipe window
    console.log(`   Делаем ставку ВНЕ окна anti-snipe...`);
    await placeBid(auctionId, testUser.token, "1.0");
    await sleep(500);
    
    // Check that round was NOT extended
    auction = await getAuctionDetails(auctionId);
    const newRoundEndsAt = new Date(auction.roundEndsAt);
    
    const extensionMs = newRoundEndsAt.getTime() - originalRoundEndsAt.getTime();
    const extensionSec = Math.round(extensionMs / 1000);
    
    console.log(`   Продление: ${extensionSec}с (ожидалось: 0с)`);
    
    const passed = Math.abs(extensionSec) <= 1; // Allow 1 second tolerance for timing
    
    return {
      testName: "Anti-Snipe Outside Window",
      passed,
      details: passed 
        ? "Раунд не продлён, как и ожидалось"
        : `Неожиданное продление на ${extensionSec}с`,
      extensionSec,
    };
  } catch (error: any) {
    return {
      testName: "Anti-Snipe Outside Window",
      passed: false,
      details: `Ошибка: ${error.response?.data?.error || error.message}`,
    };
  }
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

async function testWebSocketLimit(auctionId: string): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n🔌 Поиск предела WebSocket подключений...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [10, 25, 50, 100, 150, 200, 300, 500];
  
  for (const level of levels) {
    console.log(`  Тестируем ${level} подключений...`);
    
    const connections: WebSocket[] = [];
    let connected = 0;
    let failed = 0;
    
    const connectPromises = [];
    
    for (let i = 0; i < level; i++) {
      const promise = new Promise<void>((resolve) => {
        try {
          const ws = new WebSocket(`${WS_BASE}/ws?auctionId=${auctionId}&token=test_${i}`);
          
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
      try { ws.close(); } catch {}
    });
    
    if (successRate >= SUCCESS_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} подключениях`);
      break;
    }
    
    await sleep(1000);
  }
  
  return { limit: currentLimit, results };
}

async function testConcurrentUsersLimit(): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n👥 Поиск предела одновременной регистрации...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [5, 10, 20, 30, 50, 75, 100];
  
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
            password: `password_${i}_secure`,
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
    
    console.log(`    Успешно: ${successful}/${level} (${(successRate * 100).toFixed(1)}%), Avg: ${avgTime.toFixed(0)}ms`);
    
    if (successRate >= SUCCESS_THRESHOLD && p95Time < RESPONSE_TIME_THRESHOLD) {
      currentLimit = level;
    } else {
      console.log(`    ⚠️ Предел достигнут при ${level} пользователях`);
      break;
    }
    
    await sleep(500);
  }
  
  return { limit: currentLimit, results };
}

async function testRPSLimit(auctionId: string, users: User[]): Promise<{ limit: number; sustainedRPS: number; results: TestResult[] }> {
  console.log("\n⚡ Поиск предела RPS (запросов в секунду)...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  let sustainedRPS = 0;
  
  if (users.length < 10) {
    console.log("  ❌ Недостаточно пользователей для теста RPS");
    return { limit: 0, sustainedRPS: 0, results: [] };
  }
  
  // Test single bid first
  console.log("  Проверка одиночной ставки...");
  try {
    await placeBid(auctionId, users[0].token, "1.0");
    console.log(`  ✅ Тестовая ставка успешна`);
  } catch (error: any) {
    console.log(`  ❌ Тестовая ставка не прошла: ${error.response?.data?.error || error.message}`);
    return { limit: 0, sustainedRPS: 0, results: [] };
  }
  
  const targetRPS = [10, 25, 50, 100, 150, 200];
  
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
          await placeBid(auctionId, user.token, amount);
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
          await sleep(targetElapsed - elapsed);
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
    
    await sleep(1000);
  }
  
  return { limit: currentLimit, sustainedRPS, results };
}

async function testConcurrentBiddersLimit(auctionId: string, users: User[]): Promise<{ limit: number; results: TestResult[] }> {
  console.log("\n🎯 Поиск предела одновременно делающих ставки...");
  
  const results: TestResult[] = [];
  let currentLimit = 0;
  const levels = [5, 10, 20, 30, 50, 75, 100];
  
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
        await placeBid(auctionId, user.token, bidAmount.toFixed(4));
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
    
    await sleep(1000);
  }
  
  return { limit: currentLimit, results };
}

// ============================================================================
// REPORTS
// ============================================================================

function printAntiSnipeReport(results: AntiSnipeTestResult[]) {
  console.log("\n" + "═".repeat(80));
  console.log("                    🛡️ ОТЧЁТ О ТЕСТАХ ANTI-SNIPE 🛡️");
  console.log("═".repeat(80));
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`\n  ${icon} ${result.testName}`);
    console.log(`     ${result.details}`);
    if (result.extensionSec !== undefined) {
      console.log(`     Продление раунда: ${result.extensionSec}с`);
    }
    if (result.passed) passed++; else failed++;
  }
  
  console.log("\n" + "─".repeat(80));
  console.log(`  Итого: ${passed} пройдено, ${failed} провалено`);
  console.log("═".repeat(80));
}

function printPerformanceReport(limits: SystemLimits, testResults: {
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
  
  console.log("\n📊 ДЕТАЛЬНЫЕ РЕЗУЛЬТАТЫ:");
  
  if (testResults.wsResults.length > 0) {
    console.log("\n  WebSocket подключения:");
    console.log("  ┌─────────┬────────────┬─────────┐");
    console.log("  │ Уровень │ Успешность │  Ошибки │");
    console.log("  ├─────────┼────────────┼─────────┤");
    for (const r of testResults.wsResults) {
      console.log(`  │ ${String(r.level).padStart(7)} │ ${(r.successRate * 100).toFixed(1).padStart(9)}% │ ${String(r.errors).padStart(7)} │`);
    }
    console.log("  └─────────┴────────────┴─────────┘");
  }
  
  if (testResults.rpsResults.length > 0) {
    console.log("\n  RPS тест:");
    console.log("  ┌─────────┬────────────┬────────────┬──────────┐");
    console.log("  │   RPS   │ Успешность │  Avg (ms)  │ P95 (ms) │");
    console.log("  ├─────────┼────────────┼────────────┼──────────┤");
    for (const r of testResults.rpsResults) {
      console.log(`  │ ${String(r.level).padStart(7)} │ ${(r.successRate * 100).toFixed(1).padStart(9)}% │ ${r.avgResponseTime.toFixed(0).padStart(10)} │ ${r.p95ResponseTime.toFixed(0).padStart(8)} │`);
    }
    console.log("  └─────────┴────────────┴────────────┴──────────┘");
  }
  
  console.log("\n💡 РЕКОМЕНДАЦИИ:");
  
  if (limits.maxWebSocketConnections >= 500) {
    console.log("  ✅ WebSocket: Отличная масштабируемость (500+ подключений)");
  } else if (limits.maxWebSocketConnections >= 100) {
    console.log("  ⚠️  WebSocket: Средняя масштабируемость");
  } else {
    console.log("  ❌ WebSocket: Низкая масштабируемость");
  }
  
  if (limits.sustainedRPS >= 100) {
    console.log("  ✅ RPS: Высокая пропускная способность");
  } else if (limits.sustainedRPS >= 50) {
    console.log("  ⚠️  RPS: Средняя пропускная способность");
  } else {
    console.log("  ❌ RPS: Низкая пропускная способность");
  }
  
  console.log("\n" + "═".repeat(80));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Interactive configuration
  await promptForConfiguration();
  printConfiguration();
  
  console.log("\n" + "═".repeat(80));
  console.log("       🚀 АВТОМАТИЧЕСКОЕ ТЕСТИРОВАНИЕ АУКЦИОННОЙ СИСТЕМЫ 🚀");
  console.log("═".repeat(80));
  console.log(`\n  Порог успешности: ${SUCCESS_THRESHOLD * 100}%`);
  console.log(`  Порог времени ответа: ${RESPONSE_TIME_THRESHOLD}ms`);
  
  // Step 1: Check service availability
  console.log("\n1️⃣  Проверка доступности сервисов...");
  const apiAvailable = await waitForService(API_BASE);
  if (!apiAvailable) {
    console.error(`❌ API недоступен по адресу ${API_BASE}`);
    process.exit(1);
  }
  console.log("   ✅ API доступен");
  
  // Step 2: Login as admin
  console.log("\n2️⃣  Авторизация...");
  let admin: User;
  try {
    admin = await loginAdmin();
  } catch (error: any) {
    console.error(`❌ Ошибка авторизации: ${error.message}`);
    process.exit(1);
  }
  
  // Step 3: Run Anti-Snipe tests
  console.log("\n" + "─".repeat(80));
  console.log("                    ТЕСТЫ ЗАЩИТЫ ОТ СНАЙПИНГА (ANTI-SNIPE)");
  console.log("─".repeat(80));
  
  const antiSnipeResults: AntiSnipeTestResult[] = [];
  
  antiSnipeResults.push(await testAntiSnipeBasic(admin.token));
  antiSnipeResults.push(await testAntiSnipeMultipleBids(admin.token));
  antiSnipeResults.push(await testAntiSnipeOutsideWindow(admin.token));
  
  printAntiSnipeReport(antiSnipeResults);
  
  // Step 4: Create test auction for performance tests
  console.log("\n" + "─".repeat(80));
  console.log("                    ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ");
  console.log("─".repeat(80));
  
  console.log("\n3️⃣  Создание тестового аукциона для тестов производительности...");
  const perfAuctionId = await createTestAuction(admin.token, {
    firstRoundDurationSec: 600,
    roundDurationSec: 600,
  });
  console.log(`   ✅ Аукцион создан: ${perfAuctionId}`);
  
  console.log("\n4️⃣  Ожидание старта аукциона...");
  const auctionStarted = await waitForAuctionStart(perfAuctionId, 30);
  if (!auctionStarted) {
    console.error("❌ Аукцион не запустился");
    process.exit(1);
  }
  console.log("   ✅ Аукцион активен");
  
  // Step 5: Create test users
  console.log("\n5️⃣  Создание тестовых пользователей...");
  const testUsers: User[] = [];
  const targetUsers = 100;
  
  for (let i = 0; i < targetUsers; i++) {
    try {
      const user = await createTestUser(admin.token, i);
      testUsers.push(user);
      if ((i + 1) % 20 === 0) {
        console.log(`   Создано ${i + 1}/${targetUsers} пользователей`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Ошибка создания пользователя ${i}: ${error.message}`);
      break;
    }
  }
  console.log(`   ✅ Создано ${testUsers.length} пользователей`);
  
  // Step 6: Run performance tests
  const wsTest = await testWebSocketLimit(perfAuctionId);
  const userTest = await testConcurrentUsersLimit();
  const rpsTest = await testRPSLimit(perfAuctionId, testUsers);
  const bidderTest = await testConcurrentBiddersLimit(perfAuctionId, testUsers);
  
  // Calculate limits
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
  
  printPerformanceReport(limits, {
    wsResults: wsTest.results,
    userResults: userTest.results,
    rpsResults: rpsTest.results,
    bidderResults: bidderTest.results,
  });
  
  // Final summary
  console.log("\n" + "═".repeat(80));
  console.log("                    📋 ИТОГОВЫЙ ОТЧЁТ");
  console.log("═".repeat(80));
  
  const antiSnipePassed = antiSnipeResults.filter(r => r.passed).length;
  const antiSnipeTotal = antiSnipeResults.length;
  
  console.log(`\n  🛡️ Anti-Snipe тесты: ${antiSnipePassed}/${antiSnipeTotal} пройдено`);
  console.log(`  🔌 WebSocket: до ${limits.maxWebSocketConnections} подключений`);
  console.log(`  ⚡ RPS: до ${limits.sustainedRPS.toFixed(1)} запросов/сек`);
  console.log(`  🎯 Одновременных ставок: до ${limits.maxConcurrentBidders}`);
  
  console.log("\n" + "═".repeat(80));
  console.log(`  Тестирование завершено: ${new Date().toLocaleString()}`);
  console.log("═".repeat(80) + "\n");
  
  // Exit with error if anti-snipe tests failed
  if (antiSnipePassed < antiSnipeTotal) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error("❌ Критическая ошибка:", error.message);
  if (error.response) {
    console.error("   Ответ сервера:", error.response.data);
  }
  process.exit(1);
});
