import { Router } from "express";
import express from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { handleInvoicePaid, verifyWebhookSignature } from "../services/cryptobotService";
import { badRequest } from "../utils/errors";

const router = Router();

// GET endpoint для проверки доступности вебхука (CryptoBot проверяет доступность перед настройкой)
router.get("/webhook/cryptobot", (_req, res) => {
  res.json({ ok: true, message: "Webhook endpoint is available" });
});

router.post(
  "/webhook/cryptobot",
  express.raw({ type: "application/json", limit: "100kb" }),
  asyncHandler(async (req, res) => {
    const rawBody = req.body as Buffer;
    if (rawBody.length > 100000) {
      throw badRequest("Payload too large");
    }
    const signature = req.headers["crypto-pay-api-signature"] as string | undefined;
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw badRequest("Invalid signature");
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      throw badRequest("Invalid JSON");
    }
    const event = payload.payload ?? payload;
    if (!event?.invoice_id) {
      res.json({ ok: true });
      return;
    }
    if (event.asset !== "TON" && event.asset !== "USDT") {
      res.json({ ok: true });
      return;
    }
    if (event.status && event.status !== "paid" && event.status !== "completed") {
      res.json({ ok: true });
      return;
    }
    await handleInvoicePaid({
      invoice_id: event.invoice_id,
      asset: event.asset,
      amount: event.amount,
      status: event.status,
    });
    res.json({ ok: true });
  })
);

export { router as webhookRoutes };
