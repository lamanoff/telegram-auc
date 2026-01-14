import axios from "axios";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || "100", 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || "1000", 10);
const AUCTION_ID = process.env.AUCTION_ID || "";

interface TestResult {
  success: number;
  failed: number;
  errors: string[];
  timings: number[];
}

async function makeBidRequest(userToken: string, auctionId: string, amount: string): Promise<{ success: boolean; time: number }> {
  const start = Date.now();
  try {
    await axios.post(
      `${API_BASE}/api/auctions/${auctionId}/bid`,
      { amount },
      {
        headers: { Authorization: `Bearer ${userToken}` },
        timeout: 5000,
      }
    );
    return { success: true, time: Date.now() - start };
  } catch (error: any) {
    return {
      success: false,
      time: Date.now() - start,
    };
  }
}

async function createTestUser(index: number): Promise<{ token: string; id: string }> {
  const username = `stress_${index}_${Date.now()}`;
  const password = `password_${index}`;
  
  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      username,
      password,
    });
    return {
      token: response.data.token,
      id: response.data.user.id,
    };
  } catch (error: any) {
    if (error.response?.status === 409) {
      const loginResponse = await axios.post(`${API_BASE}/api/login`, {
        username,
        password,
      });
      return {
        token: loginResponse.data.token,
        id: loginResponse.data.user.id,
      };
    }
    throw error;
  }
}

async function runStressTest() {
  if (!AUCTION_ID) {
    console.error("Please set AUCTION_ID environment variable");
    process.exit(1);
  }
  
  console.log(`Stress Test Configuration:`);
  console.log(`- API Base: ${API_BASE}`);
  console.log(`- Auction ID: ${AUCTION_ID}`);
  console.log(`- Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`- Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`\nCreating test users...`);
  
  const users: Array<{ token: string; id: string }> = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const user = await createTestUser(i);
    users.push(user);
    if ((i + 1) % 10 === 0) {
      console.log(`Created ${i + 1}/${CONCURRENT_REQUESTS} users`);
    }
  }
  
  console.log(`\nStarting stress test...`);
  
  const result: TestResult = {
    success: 0,
    failed: 0,
    errors: [],
    timings: [],
  };
  
  let completed = 0;
  const startTime = Date.now();
  
  const makeRequest = async (userIndex: number, requestIndex: number) => {
    const user = users[userIndex % users.length];
    const amount = (10 + Math.random() * 100).toFixed(9);
    
    const response = await makeBidRequest(user.token, AUCTION_ID, amount);
    
    if (response.success) {
      result.success++;
    } else {
      result.failed++;
    }
    result.timings.push(response.time);
    
    completed++;
    if (completed % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rps = completed / elapsed;
      console.log(`Progress: ${completed}/${TOTAL_REQUESTS} (${rps.toFixed(2)} req/s)`);
    }
  };
  
  const promises: Promise<void>[] = [];
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const userIndex = i % CONCURRENT_REQUESTS;
    promises.push(makeRequest(userIndex, i));
    
    if (promises.length >= CONCURRENT_REQUESTS) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  const avgTime = result.timings.reduce((a, b) => a + b, 0) / result.timings.length;
  const minTime = Math.min(...result.timings);
  const maxTime = Math.max(...result.timings);
  const p95Time = result.timings.sort((a, b) => a - b)[Math.floor(result.timings.length * 0.95)];
  const p99Time = result.timings.sort((a, b) => a - b)[Math.floor(result.timings.length * 0.99)];
  
  console.log(`\n=== Stress Test Results ===`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Successful: ${result.success}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Success Rate: ${((result.success / TOTAL_REQUESTS) * 100).toFixed(2)}%`);
  console.log(`Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`Requests/sec: ${(TOTAL_REQUESTS / totalTime).toFixed(2)}`);
  console.log(`\nResponse Times:`);
  console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min: ${minTime}ms`);
  console.log(`  Max: ${maxTime}ms`);
  console.log(`  P95: ${p95Time}ms`);
  console.log(`  P99: ${p99Time}ms`);
}

runStressTest().catch((error) => {
  console.error("Stress test failed:", error);
  process.exit(1);
});
