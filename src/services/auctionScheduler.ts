import { AuctionHub } from "../ws/auctionHub";
import { finalizeDueRounds, getAuctionDetails, startScheduledAuctions } from "./auctionService";
import { RoundResult } from "../models/RoundResult";
import { unitsFromString, unitsToAmount } from "../utils/amount";

export function startAuctionScheduler(hub: AuctionHub) {
  console.log("Auction scheduler started");
  let running = false;
  setInterval(async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const started = await startScheduledAuctions();
      for (const auctionId of started) {
        const snapshot = await getAuctionDetails(auctionId);
        hub.broadcast(auctionId, { type: "auction.started", data: snapshot });
      }

      const finalized = await finalizeDueRounds();
      for (const entry of finalized) {
        const snapshot = await getAuctionDetails(entry.auctionId);
        const roundResult = await RoundResult.findOne({
          auctionId: entry.auctionId,
          roundNumber: entry.roundNumber,
        }).lean();
        const currency = snapshot.currency as "TON" | "USDT";
        hub.broadcast(entry.auctionId, {
          type: "round.closed",
          data: {
            snapshot,
            roundNumber: entry.roundNumber,
            winners:
              roundResult?.winners.map((winner) => ({
                userId: winner.userId.toString(),
                bidId: winner.bidId.toString(),
                amount: unitsToAmount(unitsFromString(winner.amount), currency),
              })) ?? [],
            lowestWinningBid: roundResult?.lowestWinningBid
              ? unitsToAmount(unitsFromString(roundResult.lowestWinningBid), currency)
              : null,
          },
        });
      }

    } catch (error) {
      console.error("Scheduler error:", error instanceof Error ? error.stack || error.message : "Unknown error");
    } finally {
      running = false;
    }
  }, 1000);
}
