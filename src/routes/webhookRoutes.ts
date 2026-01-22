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
    const rawBody = req.body as Buffer;
    
    // Логирование для диагностики
    const signature = req.headers["crypto-pay-api-signature"] as string | undefined;
    const hasSignature = !!signature;
    
    // Проверяем, что rawBody действительно Buffer
    if (!Buffer.isBuffer(rawBody)) {
      console.error(`[Webhook] Body is not a Buffer`, { 
        isBuffer: Buffer.isBuffer(rawBody),
        bodyType: typeof rawBody,
        bodyConstructor: rawBody?.constructor?.name,
        hasRawBody: !!(req as any).rawBody,
        rawBodyValue: rawBody,
        reqBodyType: typeof req.body,
        reqBody: req.body
      });
      throw badRequest("Invalid request body format");
    }
    
    const bodyLength = rawBody.length;
    const bodyString = rawBody.toString('utf8');
    const bodyPreview = bodyString.substring(0, 200);
    
    console.log(`[Webhook] Received request: bodyLength=${bodyLength}, hasSignature=${hasSignature}`, {
      bodyPreview,
      firstChars: bodyString.substring(0, 50),
      isBuffer: Buffer.isBuffer(rawBody),
      bodyStringType: typeof bodyString,
      bodyStringLength: bodyString.length
    });
    
    if (rawBody.length > 100000) {
      console.error(`[Webhook] Payload too large: ${rawBody.length} bytes`);
      throw badRequest("Payload too large");
    }
    
    if (!bodyString || bodyString === '[object Object]' || bodyString.trim().length === 0) {
      console.error(`[Webhook] Invalid body string`, {
        bodyString,
        bodyStringType: typeof bodyString,
        bodyStringLength: bodyString?.length,
        rawBodyLength: rawBody.length,
        rawBodyType: typeof rawBody
      });
      throw badRequest("Invalid request body");
    }
    
    // Парсим JSON перед проверкой подписи (нужен для правильной сериализации)
    let payload;
    try {
      payload = JSON.parse(bodyString);
    } catch (e) {
      console.error(`[Webhook] Invalid JSON`, {
        error: e instanceof Error ? e.message : String(e),
        bodyPreview,
        bodyLength,
        bodyString: bodyString.substring(0, 500),
        bodyStringType: typeof bodyString
      });
      throw badRequest("Invalid JSON");
    }
    
    // Проверяем подпись используя распарсенный payload (CryptoBot использует JSON.stringify для подписи)
    if (!verifyWebhookSignature(payload, signature)) {
      console.error(`[Webhook] Invalid signature: hasSignature=${hasSignature}, bodyLength=${bodyLength}`);
      throw badRequest("Invalid signature");
    }
    
    const event = payload.payload ?? payload;
    if (!event?.invoice_id) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Webhook] No invoice_id in event, ignoring`);
      }
      res.json({ ok: true });
      return;
    }
    
    if (event.asset !== "TON" && event.asset !== "USDT") {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Webhook] Unsupported asset: ${event.asset}, ignoring`);
      }
      res.json({ ok: true });
      return;
    }
    
    if (event.status && event.status !== "paid" && event.status !== "completed") {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Webhook] Status not paid/completed: ${event.status}, ignoring`);
      }
      res.json({ ok: true });
      return;
    }
    
    try {
      await handleInvoicePaid({
        invoice_id: event.invoice_id,
        asset: event.asset,
        amount: event.amount,
        status: event.status,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error(`[Webhook] Error handling invoice: ${e instanceof Error ? e.message : 'Unknown error'}`, {
        invoice_id: event.invoice_id,
        asset: event.asset,
        amount: event.amount,
        status: event.status,
      });
      throw e;
    }
  })
);

export { router as webhookRoutes };
