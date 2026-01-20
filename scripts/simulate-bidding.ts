/**
 * Скрипт для симуляции реалистичного пользовательского поведения на аукционах
 * 
 * Использование:
 *   npm run simulate-bidding
 * 
 * Переменные окружения:
 *   API_BASE - базовый URL API (по умолчанию: http://localhost:3000)
 *   WS_BASE - базовый URL WebSocket (по умолчанию: ws://localhost:3000)
 *   NUM_USERS - количество симулируемых пользователей (по умолчанию: 100)
 *   AUCTION_ID - ID аукциона для торгов (если не указан, будет найден активный)
 *   ADMIN_USERNAME - имя пользователя администратора (по умолчанию: admin)
 *   ADMIN_PASSWORD - пароль администратора (по умолчанию: admin123)
 *   CREATE_AUCTION_DELAY_SEC - задержка перед началом созданного аукциона в секундах (по умолчанию: 10)
 * 
 * Стратегии пользователей:
 *   - aggressive: Агрессивные ставки, быстрые интервалы (2-5 сек)
 *   - conservative: Консервативные ставки, медленные интервалы (8-20 сек)
 *   - moderate: Умеренные ставки, средние интервалы (5-13 сек)
 *   - sniper: Минимальные ставки, очень медленные интервалы (15-35 сек)
 * 
 * Скрипт автоматически:
 *   1. Входит как администратор
 *   2. Находит активный аукцион (или ждет начала запланированного)
 *   3. Если аукционов нет - создает новый с реалистичными параметрами
 *   4. Создает пользователей с разными стратегиями
 *   5. Устанавливает им балансы
 *   6. Начинает симуляцию торгов в реальном времени
 */

import axios from "axios";
import WebSocket from "ws";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const WS_BASE = process.env.WS_BASE || "ws://localhost:3000";
const NUM_USERS = parseInt(process.env.NUM_USERS || "100", 10) || 100;
const AUCTION_ID = process.env.AUCTION_ID || "";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const CREATE_AUCTION_DELAY_SEC = parseInt(process.env.CREATE_AUCTION_DELAY_SEC || "10", 10) || 10;

interface User {
  id: string;
  token: string;
  username: string;
  strategy: "aggressive" | "conservative" | "moderate" | "sniper";
}

interface AuctionDetails {
  auctionId: string;
  status: string;
  currentMinBid: string;
  minIncrement: string;
  currency: "TON" | "USDT";
  roundEndsAt?: string;
  currentRound: number;
  totalRounds: number;
  title?: string;
  topBids?: Array<{ rank: number; userId: string; amount: string }>;
  userBid?: {
    amount: string;
    rank: number | null;
    status: string;
  };
}

interface AuctionListItem {
  id: string;
  title: string;
  currency: "TON" | "USDT";
  status: string;
  currentRound: number;
  totalRounds: number;
  itemsPerRound: number;
  totalItems: number;
  itemsSold: number;
  startTime: string;
}

// Цвета для консоли
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function loginAsAdmin(): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE}/api/login`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    // Проверяем, что пользователь является админом
    const profileResponse = await axios.get(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${response.data.token}` },
    });
    if (profileResponse.data.role !== "admin") {
      throw new Error(
        `Пользователь ${ADMIN_USERNAME} существует, но не является администратором. ` +
        `Установите роль администратора через другого админа или базу данных.`
      );
    }
    return response.data.token;
  } catch (error: any) {
    if (error.response?.status === 400 || error.response?.status === 401) {
      throw new Error(
        `Не удалось войти как администратор. ` +
        `Убедитесь, что пользователь ${ADMIN_USERNAME} существует и имеет роль "admin". ` +
        `Или создайте администратора вручную через интерфейс или базу данных.`
      );
    }
    throw error;
  }
}

async function registerUser(index: number): Promise<User> {
  const strategies: Array<"aggressive" | "conservative" | "moderate" | "sniper"> = [
    "aggressive",
    "conservative",
    "moderate",
    "sniper",
  ];
  const strategy = strategies[index % strategies.length];
  
  const username = `sim_user_${index}_${Date.now()}`;
  const password = `password_${index}`;
  
  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      username,
      password,
    });
    return {
      id: response.data.user.id,
      token: response.data.token,
      username,
      strategy,
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
        strategy,
      };
    }
    throw error;
  }
}

async function setUserBalance(
  adminToken: string,
  userId: string,
  currency: "TON" | "USDT",
  amount: string
): Promise<void> {
  await axios.post(
    `${API_BASE}/api/admin/users/${userId}/balance`,
    { currency, amount },
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
}

// Реалистичные названия аукционов
const AUCTION_TITLES = [
  "NFT Коллекция #1",
  "Редкие цифровые артефакты",
  "Эксклюзивные токены",
  "Коллекционные предметы",
  "Премиум NFT серия",
  "Ограниченная коллекция",
  "Цифровое искусство",
  "Редкие артефакты",
  "Эксклюзивные лоты",
  "Коллекция мастеров",
];

// Реалистичные описания
const AUCTION_DESCRIPTIONS = [
  "Уникальная коллекция цифровых предметов. Каждый лот прошел проверку подлинности.",
  "Редкие артефакты из закрытой коллекции. Ограниченный тираж.",
  "Эксклюзивные токены с особыми привилегиями для владельцев.",
  "Премиум коллекция от известных авторов. Гарантия подлинности.",
  "Ограниченная серия с уникальными характеристиками каждого предмета.",
  "",
  "Коллекционные предметы высокого качества. Редкая возможность приобретения.",
];

// Варианты конфигураций аукционов (реалистичные)
const AUCTION_CONFIGS = [
  {
    currency: "TON" as const,
    roundsCount: 5,
    itemsPerRound: 10,
    firstRoundDurationSec: 300, // 5 минут
    roundDurationSec: 300, // 5 минут
    startingPrice: "1",
    minIncrement: "0.1",
    reservePrice: undefined,
  },
  {
    currency: "TON" as const,
    roundsCount: 10,
    itemsPerRound: 5,
    firstRoundDurationSec: 600, // 10 минут
    roundDurationSec: 600, // 10 минут
    startingPrice: "0.5",
    minIncrement: "0.05",
    reservePrice: undefined,
  },
  {
    currency: "USDT" as const,
    roundsCount: 8,
    itemsPerRound: 15,
    firstRoundDurationSec: 450, // 7.5 минут
    roundDurationSec: 450,
    startingPrice: "10",
    minIncrement: "1",
    reservePrice: "15",
  },
  {
    currency: "TON" as const,
    roundsCount: 3,
    itemsPerRound: 20,
    firstRoundDurationSec: 180, // 3 минуты
    roundDurationSec: 180,
    startingPrice: "2",
    minIncrement: "0.2",
    reservePrice: undefined,
  },
  {
    currency: "USDT" as const,
    roundsCount: 6,
    itemsPerRound: 8,
    firstRoundDurationSec: 360, // 6 минут
    roundDurationSec: 360,
    startingPrice: "5",
    minIncrement: "0.5",
    reservePrice: "8",
  },
];

interface CreatedAuction {
  id: string;
  startingPrice: string;
  minIncrement: string;
  currency: "TON" | "USDT";
}

// Хранилище для сохранения данных созданных аукционов
const createdAuctions = new Map<string, CreatedAuction>();

async function createRealisticAuction(
  adminToken: string,
  startDelaySec: number = 10
): Promise<{ id: string; startingPrice: string; minIncrement: string; currency: "TON" | "USDT" }> {
  // Имитация реального поведения админа - небольшая задержка перед созданием
  log("Администратор создает новый аукцион...", "blue");
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const config = AUCTION_CONFIGS[Math.floor(Math.random() * AUCTION_CONFIGS.length)];
  const title = AUCTION_TITLES[Math.floor(Math.random() * AUCTION_TITLES.length)];
  const description = AUCTION_DESCRIPTIONS[Math.floor(Math.random() * AUCTION_DESCRIPTIONS.length)];
  
  // Время начала - через startDelaySec секунд
  const startTime = new Date(Date.now() + startDelaySec * 1000).toISOString();
  
  // Случайно добавляем totalItems (не всегда)
  const totalItems = Math.random() > 0.3 
    ? config.roundsCount * config.itemsPerRound 
    : undefined;
  
  const auctionData: any = {
    title,
    currency: config.currency,
    roundsCount: config.roundsCount,
    itemsPerRound: config.itemsPerRound,
    startTime,
    firstRoundDurationSec: config.firstRoundDurationSec,
    roundDurationSec: config.roundDurationSec,
    minIncrement: config.minIncrement,
    startingPrice: config.startingPrice,
  };
  
  if (description) {
    auctionData.description = description;
  }
  
  if (totalItems) {
    auctionData.totalItems = totalItems;
  }
  
  if (config.reservePrice) {
    auctionData.reservePrice = config.reservePrice;
  }
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/auctions`,
      auctionData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    
    const auctionId = response.data.id;
    
    // Сохраняем данные аукциона для последующего использования
    createdAuctions.set(auctionId, {
      id: auctionId,
      startingPrice: config.startingPrice,
      minIncrement: config.minIncrement,
      currency: config.currency,
    });
    
    log(`✅ Аукцион создан: "${title}" (ID: ${auctionId})`, "green");
    log(`   Валюта: ${config.currency}, Раундов: ${config.roundsCount}, Лотов в раунде: ${config.itemsPerRound}`, "cyan");
    log(`   Стартовая цена: ${config.startingPrice} ${config.currency}`, "cyan");
    log(`   Начало через ${startDelaySec} секунд`, "yellow");
    
    return {
      id: auctionId,
      startingPrice: config.startingPrice,
      minIncrement: config.minIncrement,
      currency: config.currency,
    };
  } catch (error: any) {
    log(`❌ Ошибка создания аукциона: ${error.response?.data?.error || error.message}`, "red");
    throw error;
  }
}

async function getAuctionDetails(auctionId: string, userToken?: string): Promise<AuctionDetails> {
  const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
  const response = await axios.get(`${API_BASE}/api/auctions/${auctionId}`, { headers });
  return response.data;
}


// Счетчик ошибок 500 для ограничения логов
let error500Count = 0;
const MAX_500_ERRORS_TO_LOG = 5;

async function placeBidWithDetails(
  user: User,
  auctionId: string,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE}/api/auctions/${auctionId}/bid`,
      { amount },
      {
        headers: { Authorization: `Bearer ${user.token}` },
        validateStatus: (status) => status < 500, // Не выбрасывать ошибку для 4xx
      }
    );
    
    if (response.status === 200 || response.status === 201) {
      log(`${user.username} (${user.strategy}) сделал ставку: ${amount}`, "green");
      return { success: true };
    }
    
    // Обработка 4xx ошибок
    const errorMsg = response.data?.error || response.data?.message || "Unknown error";
    if (!errorMsg.includes("Too many bid attempts") && !errorMsg.includes("below current minimum")) {
      log(`${user.username} не смог сделать ставку (${response.status}): ${errorMsg}`, "yellow");
    }
    return { success: false, error: errorMsg };
  } catch (error: any) {
    // Обработка 5xx ошибок и сетевых ошибок
    if (error.response?.status === 500) {
      error500Count++;
      const errorDetails = error.response?.data?.error || error.response?.data?.message || error.message;
      
      // Логируем первые несколько ошибок 500 с деталями
      if (error500Count <= MAX_500_ERRORS_TO_LOG) {
        log(`❌ Ошибка 500 при ставке ${amount} от ${user.username}: ${errorDetails}`, "red");
        if (error.response?.data?.stack) {
          console.error(`Stack trace:`, error.response.data.stack.substring(0, 300));
        }
        // Выводим полный ответ для отладки
        console.error(`Full error response:`, JSON.stringify(error.response?.data, null, 2));
      } else if (error500Count === MAX_500_ERRORS_TO_LOG + 1) {
        log(`⚠️  Слишком много ошибок 500 (${error500Count}+). Проверьте логи сервера.`, "red");
      }
      return { success: false, error: errorDetails };
    }
    
    // Для других ошибок
    const errorMsg = error.response?.data?.error || error.message || "Unknown error";
    if (error.response?.status) {
      log(`${user.username} ошибка ${error.response.status} при ставке: ${errorMsg}`, "red");
    } else {
      log(`${user.username} сетевой ошибка при ставке: ${errorMsg}`, "red");
    }
    return { success: false, error: errorMsg };
  }
}

// Обратная совместимость
async function placeBid(user: User, auctionId: string, amount: string): Promise<boolean> {
  const result = await placeBidWithDetails(user, auctionId, amount);
  return result.success;
}

function createWebSocketConnection(user: User, auctionId: string): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws?auctionId=${auctionId}&token=${user.token}`);
  
  ws.on("open", () => {
    log(`${user.username} подключился к WebSocket`, "cyan");
  });
  
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "bid.updated") {
        // Можно логировать обновления, но не слишком часто
      } else if (message.type === "bid.outbid") {
        log(`${user.username} был перебит!`, "yellow");
      } else if (message.type === "round.closed") {
        log(`${user.username}: Раунд ${message.data.roundNumber} завершен`, "magenta");
      }
    } catch (error) {
      // Игнорируем ошибки парсинга
    }
  });
  
  ws.on("error", (error) => {
    // Тихие ошибки WebSocket
  });
  
  return ws;
}

function calculateBidAmount(
  strategy: User["strategy"],
  currentMinBid: number,
  minIncrement: number,
  startingPrice: number
): number {
  switch (strategy) {
    case "aggressive":
      // Агрессивные пользователи делают ставки выше минимума на 2-5 инкрементов
      return currentMinBid + minIncrement * (2 + Math.random() * 3);
    
    case "conservative":
      // Консервативные делают минимальную ставку или чуть выше
      return currentMinBid + minIncrement * (0.1 + Math.random() * 0.5);
    
    case "moderate":
      // Умеренные делают ставки выше минимума на 1-2 инкремента
      return currentMinBid + minIncrement * (1 + Math.random() * 1);
    
    case "sniper":
      // Снайперы ждут до последнего и делают минимальную ставку
      return currentMinBid + minIncrement * (0.05 + Math.random() * 0.2);
    
    default:
      return currentMinBid + minIncrement;
  }
}

function getBidInterval(strategy: User["strategy"]): number {
  // Интервалы в миллисекундах
  switch (strategy) {
    case "aggressive":
      return 2000 + Math.random() * 3000; // 2-5 секунд
    case "conservative":
      return 8000 + Math.random() * 12000; // 8-20 секунд
    case "moderate":
      return 5000 + Math.random() * 8000; // 5-13 секунд
    case "sniper":
      return 15000 + Math.random() * 20000; // 15-35 секунд
    default:
      return 5000 + Math.random() * 5000;
  }
}

async function userBiddingLoop(
  user: User,
  auctionId: string,
  startingPrice: number,
  minIncrement: number,
  currency: "TON" | "USDT",
  adminToken: string
): Promise<{ interval: NodeJS.Timeout; ws: WebSocket }> {
  const ws = createWebSocketConnection(user, auctionId);
  let lastBidAmount = 0;
  let consecutiveFailures = 0;
  
  const makeBid = async () => {
    try {
      const auction = await getAuctionDetails(auctionId, user.token);
      
      if (auction.status !== "active") {
        log(`${user.username}: Аукцион завершен или не активен`, "yellow");
        return false;
      }
      
      const currentMinBid = parseFloat(auction.currentMinBid);
      if (isNaN(currentMinBid)) {
        log(`${user.username}: Не удалось получить минимальную ставку`, "red");
        return true; // Пропускаем этот цикл
      }
      
      // Получаем текущую ставку пользователя, если она есть
      const userCurrentBid = auction.userBid ? parseFloat(auction.userBid.amount) : null;
      
      // Рассчитываем новую ставку
      let bidAmount: number;
      
      if (userCurrentBid !== null && !isNaN(userCurrentBid)) {
        // Если у пользователя уже есть ставка, новая должна быть минимум на minIncrement выше
        // И также выше currentMinBid
        const minBidFromCurrent = userCurrentBid + minIncrement;
        const targetBid = calculateBidAmount(user.strategy, currentMinBid, minIncrement, startingPrice);
        
        // Берем максимум из: (текущая + инкремент) и целевой ставки по стратегии
        bidAmount = Math.max(minBidFromCurrent, targetBid);
        
        // Убеждаемся, что ставка выше currentMinBid
        if (bidAmount < currentMinBid) {
          bidAmount = currentMinBid + minIncrement;
        }
      } else {
        // Если у пользователя нет ставки, рассчитываем от currentMinBid
        bidAmount = calculateBidAmount(user.strategy, currentMinBid, minIncrement, startingPrice);
      }
      
      // Проверяем, что ставка выше предыдущей (для отслеживания)
      if (bidAmount <= lastBidAmount) {
        // Обновляем lastBidAmount, чтобы не застрять
        lastBidAmount = userCurrentBid ?? currentMinBid;
        return true; // Пропускаем этот цикл
      }
      
      // Форматируем сумму с правильным количеством знаков после запятой
      // TON: 9 знаков, USDT: 6 знаков
      const decimals = currency === "TON" ? 9 : 6;
      const formattedAmount = bidAmount.toFixed(decimals);
      const bidResult = await placeBidWithDetails(user, auctionId, formattedAmount);
      
      if (bidResult.success) {
        lastBidAmount = bidAmount;
        consecutiveFailures = 0;
      } else {
        // Обработка различных ошибок
        if (bidResult.error?.includes("Insufficient balance") && consecutiveFailures < 3) {
          // Если ошибка "Insufficient balance", пополняем баланс
          try {
            const auctionDetails = await getAuctionDetails(auctionId, user.token);
            const currentMinBid = parseFloat(auctionDetails.currentMinBid);
            if (!isNaN(currentMinBid)) {
              // Пополняем баланс до 300x текущей минимальной ставки
              const newBalance = (currentMinBid * 300).toString();
              await setUserBalance(adminToken, user.id, currency, newBalance);
              log(`${user.username}: Баланс пополнен до ${newBalance} ${currency}`, "cyan");
              consecutiveFailures = 0; // Сбрасываем счетчик после пополнения
              return true; // Продолжаем попытки после пополнения
            }
          } catch (balanceError) {
            // Игнорируем ошибки пополнения
          }
        } else if (bidResult.error?.includes("Bid increment is too small") || bidResult.error?.includes("Bid must be higher")) {
          // Если ошибка "Bid increment is too small", обновляем lastBidAmount и попробуем снова
          const auctionDetails = await getAuctionDetails(auctionId, user.token);
          if (auctionDetails.userBid) {
            lastBidAmount = parseFloat(auctionDetails.userBid.amount);
            // Сбрасываем счетчик, так как это ожидаемая ошибка при быстрых обновлениях
            consecutiveFailures = Math.max(0, consecutiveFailures - 1);
          }
          return true; // Продолжаем попытки
        }
        
        consecutiveFailures++;
        
        // Если много неудач подряд, увеличиваем интервал
        if (consecutiveFailures > 5) {
          log(`${user.username}: Много неудачных попыток (${consecutiveFailures}), делаю паузу`, "yellow");
          return false;
        }
      }
      
      return true;
    } catch (error: any) {
      log(`${user.username} ошибка в цикле ставок: ${error.message}`, "red");
      consecutiveFailures++;
      return consecutiveFailures < 10; // Продолжаем до 10 ошибок подряд
    }
  };
  
  // Первая ставка через случайный интервал
  const initialDelay = Math.random() * 5000;
  setTimeout(() => {
    makeBid();
  }, initialDelay);
  
  const interval = setInterval(async () => {
    const shouldContinue = await makeBid();
    if (!shouldContinue) {
      clearInterval(interval);
      ws.close();
    }
  }, getBidInterval(user.strategy));
  
  return { interval, ws };
}

async function findOrWaitForActiveAuction(adminToken: string): Promise<{ id: string; startingPrice: string; minIncrement: string; currency: "TON" | "USDT" }> {
  if (AUCTION_ID) {
    log(`Используется указанный аукцион: ${AUCTION_ID}`, "blue");
    // Получаем детали существующего аукциона
    const details = await getAuctionDetails(AUCTION_ID);
    // Для существующего аукциона используем currentMinBid как приближение к startingPrice
    // или пытаемся получить из сохраненных данных
    const saved = createdAuctions.get(AUCTION_ID);
    return {
      id: AUCTION_ID,
      startingPrice: saved?.startingPrice || details.currentMinBid || "1",
      minIncrement: saved?.minIncrement || details.minIncrement || "0.1",
      currency: saved?.currency || details.currency,
    };
  }
  
  // Ищем активные аукционы
  try {
    const response = await axios.get(`${API_BASE}/api/auctions`);
    const auctions = response.data;
    const activeAuction = auctions.find((a: any) => a.status === "active");
    
    if (activeAuction) {
      log(`Найден активный аукцион: ${activeAuction.id} - ${activeAuction.title}`, "green");
      const details = await getAuctionDetails(activeAuction.id);
      const saved = createdAuctions.get(activeAuction.id);
      return {
        id: activeAuction.id,
        startingPrice: saved?.startingPrice || details.currentMinBid || "1",
        minIncrement: saved?.minIncrement || details.minIncrement || "0.1",
        currency: saved?.currency || details.currency,
      };
    }
    
    // Ищем запланированные аукционы
    const scheduledAuction = auctions.find((a: any) => a.status === "scheduled");
    if (scheduledAuction) {
      log(`Найден запланированный аукцион: ${scheduledAuction.id}. Ожидание начала...`, "yellow");
      // Ждем начала аукциона
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const details = await getAuctionDetails(scheduledAuction.id);
        if (details.status === "active") {
          log(`Аукцион начался!`, "green");
          const saved = createdAuctions.get(scheduledAuction.id);
          return {
            id: scheduledAuction.id,
            startingPrice: saved?.startingPrice || details.currentMinBid || "1",
            minIncrement: saved?.minIncrement || details.minIncrement || "0.1",
            currency: saved?.currency || details.currency,
          };
        }
      }
    }
    
    // Если не найдено активных или запланированных аукционов, создаем новый
    log("Активных или запланированных аукционов не найдено", "yellow");
    
    // Создаем аукцион с задержкой (реалистичная задержка для админа)
    // Если CREATE_AUCTION_DELAY_SEC = 0, аукцион начнется сразу (для тестирования)
    const startDelaySec = CREATE_AUCTION_DELAY_SEC > 0 
      ? CREATE_AUCTION_DELAY_SEC + Math.floor(Math.random() * 10)
      : 0;
    const auctionInfo = await createRealisticAuction(adminToken, startDelaySec);
    
    // Ждем начала аукциона
    if (startDelaySec > 0) {
      log(`Ожидание начала аукциона (через ${startDelaySec} секунд)...`, "yellow");
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const details = await getAuctionDetails(auctionInfo.id);
        if (details.status === "active") {
          log(`✅ Аукцион начался!`, "green");
          break;
        }
      }
    }
    
    return auctionInfo;
  } catch (error: any) {
    throw new Error(`Ошибка при поиске/создании аукциона: ${error.message}`);
  }
}

async function main() {
  log("=== Симулятор торгов на аукционах ===", "bright");
  log(`API: ${API_BASE}`, "cyan");
  log(`Количество пользователей: ${NUM_USERS}`, "cyan");
  log("⚠️  Если видите ошибки 500, проверьте логи сервера: docker-compose logs backend", "yellow");
  
  try {
    // Вход как админ
    log("Вход как администратор...", "blue");
    const adminToken = await loginAsAdmin();
    log("Успешно вошли как администратор", "green");
    
    // Поиск или ожидание активного аукциона (создание нового, если нужно)
    const auctionInfo = await findOrWaitForActiveAuction(adminToken);
    const auctionId = auctionInfo.id;
    const startingPrice = parseFloat(auctionInfo.startingPrice);
    const minIncrement = parseFloat(auctionInfo.minIncrement);
    const currency = auctionInfo.currency;
    
    // Получение деталей аукциона для отображения
    log("Получение деталей аукциона...", "blue");
    const auctionDetails = await getAuctionDetails(auctionId);
    
    log(`Аукцион: ${auctionDetails.auctionId}`, "cyan");
    log(`Валюта: ${currency}`, "cyan");
    log(`Стартовая цена: ${startingPrice} ${currency}`, "cyan");
    log(`Минимальный инкремент: ${minIncrement} ${currency}`, "cyan");
    log(`Текущий раунд: ${auctionDetails.currentRound}/${auctionDetails.totalRounds}`, "cyan");
    
    // Регистрация пользователей
    if (isNaN(NUM_USERS) || NUM_USERS <= 0) {
      throw new Error(`Неверное количество пользователей: ${NUM_USERS}. Установите NUM_USERS через переменную окружения.`);
    }
    log(`Регистрация ${NUM_USERS} пользователей...`, "blue");
    const users: User[] = [];
    for (let i = 0; i < NUM_USERS; i++) {
      const user = await registerUser(i);
      users.push(user);
      if ((i + 1) % 5 === 0) {
        log(`Зарегистрировано ${i + 1}/${NUM_USERS} пользователей`, "cyan");
      }
    }
    log(`Все ${users.length} пользователей зарегистрированы`, "green");
    
    // Установка балансов
    log("Установка балансов пользователям...", "blue");
    // Вычисляем баланс: достаточно для активной торговли
    // Используем большой множитель, чтобы хватило на несколько ставок даже при росте цены
    // 200x стартовая цена должно быть достаточно для активной торговли
    const balanceMultiplier = 200;
    const balanceAmount = (startingPrice * balanceMultiplier).toString();
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        await setUserBalance(adminToken, user.id, currency, balanceAmount);
        if ((i + 1) % 5 === 0) {
          log(`Балансы установлены для ${i + 1}/${users.length} пользователей`, "cyan");
        }
      } catch (error: any) {
        log(`Ошибка установки баланса для ${user.username}: ${error.response?.data?.error || error.message}`, "red");
        // Продолжаем для остальных пользователей
      }
    }
    log(`Балансы установлены: ${balanceAmount} ${currency} на пользователя`, "green");
    
    // Запуск симуляции
    log("Запуск симуляции торгов...", "bright");
    log("Откройте интерфейс системы, чтобы видеть торги в реальном времени", "yellow");
    log("Нажмите Ctrl+C для остановки", "yellow");
    
    const bots: Array<{ interval: NodeJS.Timeout; ws: WebSocket }> = [];
    
    if (users.length === 0) {
      log("⚠️  Нет пользователей для торговли!", "red");
      process.exit(1);
    }
    
    log(`Запуск торгов для ${users.length} пользователей...`, "blue");
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      log(`Запуск пользователя ${i + 1}/${users.length}: ${user.username} (${user.strategy})`, "cyan");
      const bot = await userBiddingLoop(user, auctionId, startingPrice, minIncrement, currency, adminToken);
      bots.push(bot);
      // Небольшая задержка между запусками
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
    }
    
    log(`✅ Все ${users.length} пользователей начали торги`, "green");
    
    // Периодический вывод статистики
    let lastBidCount = 0;
    const statsInterval = setInterval(async () => {
      try {
        const details = await getAuctionDetails(auctionId);
        const topBidsCount = details.topBids?.length || 0;
        const bidsInfo = topBidsCount > 0 ? `, Топ ставок: ${topBidsCount}` : "";
        const activityInfo = topBidsCount > lastBidCount ? " ⬆️ Активность!" : "";
        lastBidCount = topBidsCount;
        
        log(
          `📊 Статистика: Раунд ${details.currentRound}/${details.totalRounds}, ` +
          `Мин. ставка: ${details.currentMinBid} ${currency}${bidsInfo}${activityInfo}`,
          "blue"
        );
      } catch (error) {
        // Игнорируем ошибки статистики
      }
    }, 30000); // Каждые 30 секунд
    
    // Обработка завершения
    process.on("SIGINT", () => {
      log("\nОстановка симуляции...", "yellow");
      bots.forEach((bot) => {
        clearInterval(bot.interval);
        bot.ws.close();
      });
      clearInterval(statsInterval);
      log("Симуляция остановлена", "green");
      process.exit(0);
    });
  } catch (error: any) {
    log(`Ошибка: ${error.message}`, "red");
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
