import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { handleInvoicePaid, verifyWebhookSignature } from "../services/cryptobotService";
import { badRequest } from "../utils/errors";

const router = Router();

// Middleware для чтения raw body
function rawBodyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') {
    return next();
  }
  
  const maxSize = 100 * 1024; // 100KB
  let totalSize = 0;
  const chunks: Buffer[] = [];
  
  req.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      req.destroy();
      return next(badRequest("Payload too large"));
    }
    chunks.push(chunk);
  });
  
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });
  
  req.on('error', (err) => {
    next(err);
  });
}

// GET endpoint для проверки доступности вебхука (CryptoBot проверяет доступность перед настройкой)
router.get("/webhook/cryptobot", (_req, res) => {
  res.json({ ok: true, message: "Webhook endpoint is available" });
});

router.post(
  "/webhook/cryptobot",
  rawBodyMiddleware,
  asyncHandler(async (req, res) => {
    const rawBody = (req as any).rawBody as Buffer;
    
    // Проверяем, что rawBody действительно Buffer
    if (!Buffer.isBuffer(rawBody)) {
      console.error(`[Webhook] Body is not a Buffer, got: ${typeof rawBody}`, { 
        isBuffer: Buffer.isBuffer(rawBody),
        bodyType: typeof rawBody,
        bodyConstructor: rawBody?.constructor?.name,
        hasRawBody: !!(req as any).rawBody
      });
      throw badRequest("Invalid request body format");
    }
    
    // Логирование для диагностики
    const signature = req.headers["crypto-pay-api-signature"] as string | undefined;
    const hasSignature = !!signature;
    const bodyLength = rawBody.length;
    const bodyString = rawBody.toString('utf8');
    const bodyPreview = bodyString.substring(0, 200);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Webhook] Received request: bodyLength=${bodyLength}, hasSignature=${hasSignature}, preview=${bodyPreview}`);
    }
    
    if (rawBody.length > 100000) {
      console.error(`[Webhook] Payload too large: ${rawBody.length} bytes`);
      throw badRequest("Payload too large");
    }
    
    // Парсим JSON перед проверкой подписи (нужен для правильной сериализации)
    let payload;
    try {
      payload = JSON.parse(bodyString);
    } catch (e) {
      console.error(`[Webhook] Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`, {
        bodyPreview,
        bodyLength,
        error: e instanceof Error ? e.message : String(e)
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
