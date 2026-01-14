import type WebSocket from "ws";

type Message = {
  type: string;
  data: unknown;
};

export class AuctionHub {
  private rooms = new Map<string, Set<WebSocket>>();

  addClient(auctionId: string, ws: WebSocket) {
    const set = this.rooms.get(auctionId) ?? new Set<WebSocket>();
    set.add(ws);
    this.rooms.set(auctionId, set);
  }

  removeClient(auctionId: string, ws: WebSocket) {
    const set = this.rooms.get(auctionId);
    if (!set) {
      return;
    }
    set.delete(ws);
    if (set.size === 0) {
      this.rooms.delete(auctionId);
    }
  }

  getViewerCount(auctionId: string) {
    return this.rooms.get(auctionId)?.size ?? 0;
  }

  broadcast(auctionId: string, message: Message) {
    const set = this.rooms.get(auctionId);
    if (!set) {
      return;
    }
    const payload = JSON.stringify(message);
    for (const client of set) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }
}
