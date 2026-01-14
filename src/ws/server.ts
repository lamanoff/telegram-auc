import type http from "http";
import jwt from "jsonwebtoken";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "../config";
import { getAuctionDetails, placeBid } from "../services/auctionService";
import { AuctionHub } from "./auctionHub";
import { checkBidRateLimit } from "../utils/rateLimit";
import { checkWebSocketRateLimit } from "../utils/wsRateLimit";
import { isValidObjectId } from "../utils/validation";

interface AuthPayload {
  sub: string;
}

function parseQuery(url: string | undefined) {
  if (!url) {
    return null;
  }
  const parsed = new URL(url, "http://localhost");
  return Object.fromEntries(parsed.searchParams.entries());
}

function send(ws: WebSocket, type: string, data: unknown) {
  ws.send(JSON.stringify({ type, data }));
}

export function attachWebSocket(server: http.Server, hub: AuctionHub) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if ((client as WebSocket & { isAlive?: boolean }).isAlive === false) {
        client.terminate();
        continue;
      }
      (client as WebSocket & { isAlive?: boolean }).isAlive = false;
      client.ping();
    }
  }, 30000);

  wss.on("connection", async (ws, req) => {
    const clientIp = req.socket.remoteAddress || "unknown";
    
    const allowed = await checkWebSocketRateLimit(clientIp);
    if (!allowed) {
      ws.close(1008, "Too many connections");
      return;
    }
    
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on("pong", () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
    const query = parseQuery(req.url);
    const auctionId = query?.auctionId;
    const token = query?.token;
    if (!auctionId || !token) {
      ws.close(1008, "Missing auctionId or token");
      return;
    }
    if (!isValidObjectId(auctionId)) {
      ws.close(1008, "Invalid auction ID");
      return;
    }

    let userId: string;
    try {
      if (token.length > 1000) {
        ws.close(1008, "Invalid token");
        return;
      }
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      if (!payload.sub || typeof payload.sub !== 'string') {
        ws.close(1008, "Invalid token");
        return;
      }
      userId = payload.sub;
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }

    hub.addClient(auctionId, ws);
    hub.broadcast(auctionId, {
      type: "viewer.count",
      data: { count: hub.getViewerCount(auctionId) },
    });

    try {
      const snapshot = await getAuctionDetails(auctionId, userId);
      send(ws, "snapshot", snapshot);
    } catch (error) {
      ws.close(1008, "Auction not found");
      return;
    }

    ws.on("close", () => {
      hub.removeClient(auctionId, ws);
      hub.broadcast(auctionId, {
        type: "viewer.count",
        data: { count: hub.getViewerCount(auctionId) },
      });
    });

    ws.on("message", async (raw) => {
      try {
        const rawStr = raw.toString();
        if (rawStr.length > 10000) {
          send(ws, "error", { message: "Message too large" });
          return;
        }
        const message = JSON.parse(rawStr);
        if (message?.action === "placeBid") {
          if (!(await checkBidRateLimit(`${auctionId}:${userId}`))) {
            send(ws, "error", { message: "Too many bid attempts" });
            return;
          }
          if (typeof message.amount !== "string" || !/^\d+(\.\d+)?$/.test(message.amount)) {
            send(ws, "error", { message: "Invalid amount format" });
            return;
          }
          const update = await placeBid({
            auctionId,
            userId,
            amount: message.amount,
          });
          if (update) {
            hub.broadcast(auctionId, { type: "bid.updated", data: update });
            if (update.outbidUserIds && update.outbidUserIds.length > 0) {
              hub.broadcast(auctionId, {
                type: "bid.outbid",
                data: { userIds: update.outbidUserIds },
              });
            }
          }
        } else {
          send(ws, "error", { message: "Unknown action" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid message";
        send(ws, "error", { message });
      }
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
  });
}
