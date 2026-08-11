import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const MAX_BODY_BYTES = 65_536;
const ALLOWED_EVENTS = new Set([
  "SALE_APPROVED",
  "SALE_REJECTED",
  "VOID_APPROVED",
  "VOID_REJECTED",
]);

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const webhookSecret = Deno.env.get("BOLD_WEBHOOK_SECRET") ?? "";
const expectedMerchantId = Deno.env.get("BOLD_MERCHANT_ID") ?? "";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "casa-smoke-bold-wallet-webhook/1.0" } },
});

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function expectedSignature(rawBody: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(bytesToBase64(rawBody)),
  );
  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function requiredString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

function requiredAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) {
    throw new Error("Invalid payment amount");
  }
  return Math.round(amount * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return json(200, { ok: true, service: "bold-wallet-webhook", version: 1 });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !expectedMerchantId) {
    console.error("bold_wallet_webhook_missing_configuration");
    return json(503, { ok: false, error: "Service unavailable" });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "Payload too large" });
  }

  const rawBody = new Uint8Array(await req.arrayBuffer());
  if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_BODY_BYTES) {
    return json(400, { ok: false, error: "Invalid payload" });
  }

  const receivedSignature = (req.headers.get("x-bold-signature") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(receivedSignature)) {
    return json(401, { ok: false, error: "Invalid signature" });
  }

  const calculatedSignature = await expectedSignature(rawBody);
  if (!constantTimeEqual(calculatedSignature, receivedSignature)) {
    console.warn("bold_wallet_webhook_signature_rejected");
    return json(401, { ok: false, error: "Invalid signature" });
  }

  let event: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(rawBody));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("JSON object expected");
    }
    event = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  try {
    const notificationId = requiredString(event.id, "id", 120);
    const eventType = requiredString(event.type, "type", 40);
    if (!ALLOWED_EVENTS.has(eventType)) {
      return json(200, { ok: true, ignored: true, reason: "unsupported_event" });
    }

    const data = event.data;
    if (!data || Array.isArray(data) || typeof data !== "object") {
      throw new Error("data is required");
    }
    const payment = data as Record<string, unknown>;
    const paymentId = requiredString(payment.payment_id, "payment_id", 160);
    const merchantId = requiredString(payment.merchant_id, "merchant_id", 160);

    if (!constantTimeEqual(merchantId, expectedMerchantId)) {
      console.warn("bold_wallet_webhook_merchant_rejected", notificationId);
      return json(401, { ok: false, error: "Invalid merchant" });
    }

    const metadata = payment.metadata;
    const metadataObject = metadata && !Array.isArray(metadata) && typeof metadata === "object"
      ? metadata as Record<string, unknown>
      : {};
    const orderReference = requiredString(metadataObject.reference, "metadata.reference", 60);

    const amountValue = payment.amount;
    if (!amountValue || Array.isArray(amountValue) || typeof amountValue !== "object") {
      throw new Error("amount is required");
    }
    const amountObject = amountValue as Record<string, unknown>;
    const amount = requiredAmount(amountObject.total);
    const currency = requiredString(amountObject.currency, "amount.currency", 3).toUpperCase();
    if (currency !== "COP") throw new Error("Only COP is supported");

    const paymentMethod = typeof payment.payment_method === "string"
      ? payment.payment_method.slice(0, 40)
      : null;
    const integration = typeof payment.integration === "string"
      ? payment.integration.slice(0, 40)
      : null;
    const createdAt = typeof payment.created_at === "string" ? payment.created_at : null;
    const payloadSha256 = await sha256Hex(rawBody);

    const { data: result, error } = await admin.rpc("wallet_process_bold_event", {
      p_notification_id: notificationId,
      p_event_type: eventType,
      p_payment_id: paymentId,
      p_merchant_id: merchantId,
      p_order_reference: orderReference,
      p_amount: amount,
      p_currency: currency,
      p_payload_sha256: payloadSha256,
      p_event_created_at: createdAt,
      p_provider_summary: { payment_method: paymentMethod, integration },
    });

    if (error) {
      console.error("bold_wallet_webhook_processing_failed", error.code);
      return json(500, { ok: false, error: "Temporary processing failure" });
    }

    return json(200, { ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid event";
    console.warn("bold_wallet_webhook_validation_failed", message);
    return json(400, { ok: false, error: "Invalid event" });
  }
});
