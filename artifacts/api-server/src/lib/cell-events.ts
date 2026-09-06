import type { Response } from "express";

export type PublicCellStatus = "available" | "reserved" | "paid";

export type CellUpdateEvent = {
  type: "cell.updated";
  cellId: number;
  status: PublicCellStatus;
  emoji?: string;
  backgroundColor?: string;
  expiresAt?: string | null;
  revealedBy?: string | null;
  revealedAt?: string | null;
  prizeValueCents?: number;
  prizeLabel?: string | null;
};

const clients = new Map<Response, NodeJS.Timeout>();

function removeClient(response: Response) {
  const heartbeat = clients.get(response);
  if (heartbeat) clearInterval(heartbeat);
  clients.delete(response);
}

export function subscribeToCellEvents(response: Response) {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
  response.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    response.write(": heartbeat\n\n");
  }, 25_000);
  clients.set(response, heartbeat);

  const cleanup = () => removeClient(response);
  response.on("close", cleanup);
  response.on("error", cleanup);
}

export function broadcastCellUpdate(event: CellUpdateEvent) {
  const message = `event: cell.updated\ndata: ${JSON.stringify(event)}\n\n`;
  for (const response of clients.keys()) {
    try {
      response.write(message);
    } catch {
      removeClient(response);
    }
  }
}