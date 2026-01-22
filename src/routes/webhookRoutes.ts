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
  asyncHandler(async (req, res) => {
    const rawBody = req.body as Buffer | unknown;
    const signature = req.headers["crypto-pay-api-signature"] as string | undefined;
    
    // Проверяем, что rawBody действительно Buffer
    if (!Buffer.isBuffer(rawBody)) {
      throw badRequest("Invalid request body format");
    }
    
    if (rawBody.length > 100000) {
      throw badRequest("Payload too large");
    }
    
    const bodyString = rawBody.toString('utf8');
    if (!bodyString || bodyString.trim().length === 0) {
      throw badRequest("Invalid request body");
    }
    
    // Парсим JSON перед проверкой подписи (нужен для правильной сериализации)
    let payload;
    try {
      payload = JSON.parse(bodyString);
    } catch (e) {
      throw badRequest("Invalid JSON");
    }
    
    // Проверяем подпись используя распарсенный payload (CryptoBot использует JSON.stringify для подписи)
    if (!verifyWebhookSignature(payload, signature)) {
      throw badRequest("Invalid signature");
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
