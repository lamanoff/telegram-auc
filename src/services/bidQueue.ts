import { Queue, Worker, QueueEvents } from "bullmq";
import { bullmqConnection } from "./redis";
import { placeBid } from "./auctionService";
import { AuctionHub } from "../ws/auctionHub";

export interface BidJobData {
  auctionId: string;
  userId: string;
  amount: string;
}

const bidQueue = new Queue<BidJobData>("bid-processing", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 100,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

const queueEvents = new QueueEvents("bid-processing", {
  connection: bullmqConnection,
});

let hub: AuctionHub | null = null;

export function setBidQueueHub(auctionHub: AuctionHub) {
  hub = auctionHub;
}

export function createBidWorker() {
  const worker = new Worker<BidJobData>(
    "bid-processing",
    async (job) => {
      const { auctionId, userId, amount } = job.data;
      const result = await placeBid({ auctionId, userId, amount });
      return result;
    },
    {
      connection: bullmqConnection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on("completed", async (job, result) => {
    if (result && hub) {
      hub.broadcast(job.data.auctionId, { type: "bid.updated", data: result });
      if (result.outbidUserIds && result.outbidUserIds.length > 0) {
        hub.broadcast(job.data.auctionId, {
          type: "bid.outbid",
          data: { userIds: result.outbidUserIds },
        });
      }
    }
  });

  worker.on("failed", (job, err) => {
    // Always log bid failures for debugging
    console.error(`[BID_FAILED] Job ${job?.id}:`, err instanceof Error ? err.message : 'Unknown error');
    if (err instanceof Error && err.stack) {
      console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    }
    if (job && hub) {
      hub.broadcast(job.data.auctionId, {
        type: "bid.failed",
        data: { userId: job.data.userId, error: "Bid processing failed" },
      });
    }
  });

  return worker;
}

export async function addBidToQueue(data: BidJobData) {
  try {
    // BullMQ doesn't allow ":" in jobId, use "_" instead
    return await bidQueue.add("process-bid", data, {
      jobId: `${data.auctionId}_${data.userId}_${Date.now()}`,
    });
  } catch (error) {
    console.error("[BID_QUEUE] Failed to add bid:", error instanceof Error ? error.message : error);
    throw error;
  }
}

export async function getBidQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    bidQueue.getWaitingCount(),
    bidQueue.getActiveCount(),
    bidQueue.getCompletedCount(),
    bidQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
