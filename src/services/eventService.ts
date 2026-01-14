import { EventLog } from "../models/EventLog";

export async function logEvent(params: {
  type: string;
  userId?: string;
  auctionId?: string;
  payload?: Record<string, unknown>;
}) {
  await EventLog.create({
    type: params.type,
    userId: params.userId,
    auctionId: params.auctionId,
    payload: params.payload,
  });
}
