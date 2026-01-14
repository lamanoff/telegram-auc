import axios from "axios";
import WebSocket from "ws";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const WS_BASE = process.env.WS_BASE || "ws://localhost:3000";
const NUM_BOTS = parseInt(process.env.NUM_BOTS || "50", 10);
const AUCTION_ID = process.env.AUCTION_ID || "";
const BID_INTERVAL_MS = parseInt(process.env.BID_INTERVAL_MS || "500", 10);

interface User {
  id: string;
  token: string;
  username: string;
}

async function registerUser(index: number): Promise<User> {
  const username = `bot_${index}_${Date.now()}`;
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

async function depositFunds(user: User, currency: "TON" | "USDT" = "TON"): Promise<void> {
  try {
    await axios.post(
      `${API_BASE}/api/deposit`,
      {
        provider: "cryptobot",
        currency,
        amount: "1000",
      },
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
  } catch (error) {
    console.error(`Failed to deposit for ${user.username}:`, error);
  }
}

async function placeBid(user: User, auctionId: string, amount: string): Promise<boolean> {
  try {
    await axios.post(
      `${API_BASE}/api/auctions/${auctionId}/bid`,
      { amount },
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );
    return true;
  } catch (error: any) {
    if (error.response?.status === 400) {
      return false;
    }
    console.error(`Bid failed for ${user.username}:`, error.response?.data || error.message);
    return false;
  }
}

function createWebSocketConnection(user: User, auctionId: string): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws?auctionId=${auctionId}&token=${user.token}`);
  
  ws.on("open", () => {
    console.log(`[${user.username}] WebSocket connected`);
  });
  
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "bid.updated") {
        console.log(`[${user.username}] Bid updated:`, message.data.currentMinBid);
      } else if (message.type === "bid.outbid") {
        console.log(`[${user.username}] Outbid!`);
      } else if (message.type === "round.closed") {
        console.log(`[${user.username}] Round closed, winners:`, message.data.winners.length);
      }
    } catch (error) {
      // Ignore parse errors
    }
  });
  
  ws.on("error", (error) => {
    console.error(`[${user.username}] WebSocket error:`, error.message);
  });
  
  return ws;
}

async function botLoop(user: User, auctionId: string, startingPrice: number, minIncrement: number) {
  let currentBid = startingPrice;
  const ws = createWebSocketConnection(user, auctionId);
  
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/auctions/${auctionId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      const auction = response.data;
      if (auction.status !== "active") {
        clearInterval(interval);
        ws.close();
        return;
      }
      
      const minBid = parseFloat(auction.currentMinBid);
      if (minBid > currentBid) {
        currentBid = minBid + minIncrement * (0.5 + Math.random());
        const success = await placeBid(user, auctionId, currentBid.toFixed(9));
        if (success) {
          console.log(`[${user.username}] Placed bid: ${currentBid.toFixed(9)}`);
        }
      } else {
        currentBid = minBid + minIncrement * (0.1 + Math.random() * 0.5);
        const success = await placeBid(user, auctionId, currentBid.toFixed(9));
        if (success) {
          console.log(`[${user.username}] Placed bid: ${currentBid.toFixed(9)}`);
        }
      }
    } catch (error: any) {
      console.error(`[${user.username}] Error in bot loop:`, error.message);
    }
  }, BID_INTERVAL_MS + Math.random() * BID_INTERVAL_MS);
  
  return { interval, ws };
}

async function main() {
  if (!AUCTION_ID) {
    console.error("Please set AUCTION_ID environment variable");
    process.exit(1);
  }
  
  console.log(`Starting load test with ${NUM_BOTS} bots`);
  console.log(`API: ${API_BASE}, Auction ID: ${AUCTION_ID}`);
  
  const users: User[] = [];
  const bots: Array<{ interval: NodeJS.Timeout; ws: WebSocket }> = [];
  
  try {
    console.log("Registering users...");
    for (let i = 0; i < NUM_BOTS; i++) {
      const user = await registerUser(i);
      users.push(user);
      if ((i + 1) % 10 === 0) {
        console.log(`Registered ${i + 1}/${NUM_BOTS} users`);
      }
    }
    
    console.log("Depositing funds...");
    for (const user of users) {
      await depositFunds(user);
    }
    
    console.log("Getting auction details...");
    const auctionResponse = await axios.get(`${API_BASE}/api/auctions/${AUCTION_ID}`);
    const auction = auctionResponse.data;
    const startingPrice = parseFloat(auction.startingPrice);
    const minIncrement = parseFloat(auction.minIncrement);
    
    console.log(`Starting price: ${startingPrice}, Min increment: ${minIncrement}`);
    console.log("Starting bots...");
    
    for (const user of users) {
      const bot = await botLoop(user, AUCTION_ID, startingPrice, minIncrement);
      bots.push(bot);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    console.log(`All ${NUM_BOTS} bots are running. Press Ctrl+C to stop.`);
    
    process.on("SIGINT", () => {
      console.log("\nStopping bots...");
      bots.forEach((bot) => {
        clearInterval(bot.interval);
        bot.ws.close();
      });
      process.exit(0);
    });
  } catch (error: any) {
    console.error("Load test error:", error.message);
    process.exit(1);
  }
}

main();
