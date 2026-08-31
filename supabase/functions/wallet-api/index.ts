/// <reference lib="deno.ns" />
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

type ActorType = "operator" | "client";

type WalletSession = {
  id: string;
  actor_type: ActorType;
  user_id: string | null;
  client_id: string | null;
  actor_role: string;
  expires_at: string;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const MAX_BODY_BYTES = 32_768;
const DATA_TABLES = new Set([
  "business_config",
  "users",
  "clients",
  "products",
  "invoices",
  "expenses",
  "shifts",
  "stock_adjustments",
  "stock_transfers",
  "chat_messages",
  "client_requests",
  "discounts",
  "flash_messages",
  "payroll_entries",
]);
const ADMIN_WRITE_TABLES = new Set([
  "business_config",
  "discounts",
  "users",
  "payroll_entries",
]);
const SESSION_HOURS_OPERATOR = 12;
const SESSION_HOURS_CLIENT = 24 * 7;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_IDENTIFIER_LIMIT = 8;
const LOGIN_IP_LIMIT = 20;
const BOLD_MIN_AMOUNT_COP = 1_000;
const BOLD_MAX_AMOUNT_COP = 50_000_000;
const BOLD_INTENT_HOURS = 24;
const RESTRICTED_PRODUCT_TERMS = [
  "tabaco",
  "nicotina",
  "cigarr",
  "vape",
  "vaporiz",
  "bong",
  "pipa",
  "cannabis",
  "marihuana",
  "weed",
  "blunt",
  "papel fumar",
  "encendedor",
  "tatuaje",
  "tattoo",
  "piercing",
  "aguja",
  "tinta tatuar",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sessionPepper = Deno.env.get("WALLET_SESSION_PEPPER") ?? "";
const nfcPepper = Deno.env.get("WALLET_NFC_PEPPER") ?? "";
const boldIdentityKey = Deno.env.get("BOLD_IDENTITY_KEY") ?? "";
const boldSecretKey = Deno.env.get("BOLD_WEBHOOK_SECRET") ?? "";
const boldRedirectUrl = Deno.env.get("WALLET_BOLD_REDIRECT_URL") ?? "";
const allowedOrigins = new Set(
  (Deno.env.get("WALLET_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "casa-smoke-wallet-api/1.0" } },
});

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    "Access-Control-Allow-Headers": "authorization, content-type, x-requested-with",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function response(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function isOriginAllowed(origin: string | null): boolean {
  // Requests made by server tools do not include Origin. Browser origins must
  // always be explicitly allowlisted.
  return origin === null || allowedOrigins.has(origin);
}

function normalizeRoute(pathname: string): string {
  const marker = "/wallet-api";
  const index = pathname.indexOf(marker);
  const route = index >= 0 ? pathname.slice(index + marker.length) : pathname;
  return route === "" ? "/" : route.replace(/\/$/, "") || "/";
}

function requiredString(
  value: unknown,
  field: string,
  maxLength = 200,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${field} is too long`);
  }

  return normalized;
}

function optionalString(value: unknown, maxLength = 200): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Invalid text value");
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error("Text value is too long");
  return normalized || null;
}

function requiredDataTable(value: unknown): string {
  const table = requiredString(value, "table", 80);
  if (!DATA_TABLES.has(table)) throw new Error("Unsupported data table");
  return table;
}

function requiredDataRecord(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("record must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireDataWriteAccess(session: WalletSession, table: string): void {
  requireOperator(session);
  if (ADMIN_WRITE_TABLES.has(table)) requireAdministrator(session);
}

type ActiveWebPromotion = {
  id: string;
  name: string;
  amount: number;
};

function bogotaDateParts(now = new Date()): {
  date: string;
  time: string;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
    day: weekdayMap[value("weekday")] ?? now.getUTCDay(),
  };
}

async function activeWebPromotion(
  clientId: string,
  subtotal: number,
): Promise<ActiveWebPromotion | null> {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return null;

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("special_discount_percentage")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (Number(client?.special_discount_percentage ?? 0) > 0) return null;

  const { data: promotions, error } = await admin
    .from("discounts")
    .select("id,name,type,value,start_date,end_date,start_time,end_time,active_days,applies_to")
    .eq("active", true)
    .in("applies_to", ["todos", "compras_web"]);
  if (error) throw error;

  const bogota = bogotaDateParts();
  const eligible = (promotions ?? [])
    .filter((promotion) => {
      if (promotion.start_date && bogota.date < promotion.start_date) return false;
      if (promotion.end_date && bogota.date > promotion.end_date) return false;
      if (promotion.start_time && bogota.time < promotion.start_time) return false;
      if (promotion.end_time && bogota.time > promotion.end_time) return false;
      if (
        Array.isArray(promotion.active_days) &&
        promotion.active_days.length > 0 &&
        !promotion.active_days.includes(bogota.day)
      ) return false;
      return true;
    })
    .map((promotion) => {
      const rawAmount = promotion.type === "porcentaje"
        ? subtotal * Number(promotion.value ?? 0) / 100
        : Number(promotion.value ?? 0);
      return {
        id: String(promotion.id),
        name: String(promotion.name),
        amount: Math.min(subtotal, Math.max(0, Math.round(rawAmount))),
      };
    })
    .filter((promotion) => promotion.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return eligible[0] ?? null;
}

async function applyWebPromotionToResult(
  rawResult: Record<string, unknown>,
  clientId: string,
  updateBoldIntent = false,
): Promise<Record<string, unknown>> {
  const invoiceValue = rawResult.invoice;
  const invoice = typeof invoiceValue === "object" && invoiceValue !== null
    ? invoiceValue as Record<string, unknown>
    : null;
  if (!invoice || Number(invoice.discount ?? 0) > 0) return rawResult;

  const invoiceId = requiredString(invoice.id, "invoice_id", 120);
  const subtotal = Number(invoice.subtotal ?? 0);
  const promotion = await activeWebPromotion(clientId, subtotal);
  if (!promotion) return rawResult;

  const deliveryFee = Number(invoice.delivery_fee ?? 0);
  const walletPaidAmount = Number(invoice.wallet_paid_amount ?? 0);
  const total = Math.max(0, Math.round(subtotal - promotion.amount + deliveryFee));
  const amountDue = Math.max(0, Math.round(total - walletPaidAmount));
  const paymentStatus = amountDue <= 0 ? "Pagado" : "Pendiente";

  const { data: updatedInvoice, error: invoiceError } = await admin
    .from("invoices")
    .update({
      discount: promotion.amount,
      total,
      amount_due: amountDue,
      payment_status: paymentStatus,
    })
    .eq("id", invoiceId)
    .select()
    .single();
  if (invoiceError) throw invoiceError;

  let updatedIntent = rawResult.intent;
  if (updateBoldIntent) {
    const intentValue = rawResult.intent;
    const intent = typeof intentValue === "object" && intentValue !== null
      ? intentValue as Record<string, unknown>
      : null;
    if (!intent) throw new Error("Direct Bold payment intent was not returned");
    const intentId = requiredString(intent.id, "intent_id", 120);
    const { data: savedIntent, error: intentError } = await admin
      .from("web_bold_payment_intents")
      .update({ amount: total })
      .eq("id", intentId)
      .select()
      .single();
    if (intentError) throw intentError;
    updatedIntent = savedIntent;
  }

  return {
    ...rawResult,
    invoice: updatedInvoice,
    intent: updatedIntent,
    promotion: {
      id: promotion.id,
      name: promotion.name,
      amount: promotion.amount,
    },
  };
}

function normalizeUid(value: string): string {
  const normalized = value.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (normalized.length < 8 || normalized.length > 64) {
    throw new Error("Invalid NFC UID");
  }
  return normalized;
}

function normalizedProductText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isAutomaticallyRestrictedProduct(product: {
  name?: unknown;
  category?: unknown;
}): boolean {
  const text = normalizedProductText(`${product.name ?? ""} ${product.category ?? ""}`);
  return RESTRICTED_PRODUCT_TERMS.some((term) => text.includes(term));
}

function requiredPositiveAmount(value: unknown, field: string): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return Math.round(amount * 100) / 100;
}

function requiredBoldAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new Error("amount must be a whole number of COP");
  }
  if (amount < BOLD_MIN_AMOUNT_COP || amount > BOLD_MAX_AMOUNT_COP) {
    throw new Error("amount is outside the Bold wallet range");
  }
  return amount;
}

function boldConfigurationReady(): boolean {
  if (!boldIdentityKey || boldSecretKey.length < 16 || !boldRedirectUrl) return false;
  try {
    const redirect = new URL(boldRedirectUrl);
    return redirect.protocol === "https:" && allowedOrigins.has(redirect.origin);
  } catch {
    return false;
  }
}

function walletOrderReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = bytesToHex(crypto.getRandomValues(new Uint8Array(8))).toUpperCase();
  return `WAL-${timestamp}-${random}`;
}

function webBoldOrderReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = bytesToHex(
    crypto.getRandomValues(new Uint8Array(8))
  ).toUpperCase();

  return `WEB-${timestamp}-${random}`;
}

async function parseJson(req: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request body is too large");

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large");
  }

  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("JSON object expected");
  }
  return parsed as Record<string, unknown>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

async function recordAuthEvent(event: Record<string, unknown>): Promise<void> {
  const { error } = await admin.from("wallet_auth_events").insert(event);
  if (error) console.error("wallet_auth_event_failed", error.code);
}

async function failureCount(
  column: "identifier_hash" | "ip_hash",
  hash: string,
  since: string,
): Promise<number> {
  const { count, error } = await admin
    .from("wallet_auth_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "login_failure")
    .eq(column, hash)
    .gte("created_at", since);

  if (error) throw error;
  return count ?? 0;
}

async function login(
  req: Request,
  origin: string | null,
  actorType: ActorType,
): Promise<Response> {
  const body = await parseJson(req);
  const password = requiredString(body.password, "password", 256);
  const identifier = requiredString(
    actorType === "operator" ? body.username : body.code,
    actorType === "operator" ? "username" : "code",
    120,
  );

  const normalizedIdentifier = identifier.toLowerCase();
  const identifierHash = await sha256Hex(`${normalizedIdentifier}:${sessionPepper}`);
  const ipHash = await sha256Hex(`${clientIp(req)}:${sessionPepper}`);
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const [identifierFailures, ipFailures] = await Promise.all([
    failureCount("identifier_hash", identifierHash, since),
    failureCount("ip_hash", ipHash, since),
  ]);

  if (identifierFailures >= LOGIN_IDENTIFIER_LIMIT || ipFailures >= LOGIN_IP_LIMIT) {
    await recordAuthEvent({
      event_type: "rate_limited",
      actor_type: actorType,
      identifier_hash: identifierHash,
      ip_hash: ipHash,
    });
    return response(origin, 429, { ok: false, error: "Intenta nuevamente más tarde." });
  }

  const functionName = actorType === "operator"
    ? "wallet_verify_operator_credentials"
    : "wallet_verify_client_credentials";
  const params = actorType === "operator"
    ? { p_username: identifier, p_password: password }
    : { p_code: identifier, p_password: password };
  const { data, error } = await admin.rpc(functionName, params);
  if (error) throw error;

  const actor = Array.isArray(data) ? data[0] : null;
  if (!actor) {
    await recordAuthEvent({
      event_type: "login_failure",
      actor_type: actorType,
      identifier_hash: identifierHash,
      ip_hash: ipHash,
    });
    return response(origin, 401, { ok: false, error: "Credenciales incorrectas." });
  }

  let clientProfile: Record<string, unknown> | null = null;
  let requiresPasswordChange = false;
  if (actorType === "client") {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .select(
        "id,name,document_type,rut,email,phone,address,credit_limit,outstanding_balance,created_at,assigned_agent_id,assigned_agent_name,code,has_credit,credit_terms_days,credit_conditions,is_employee,special_discount_percentage,discounted_product_ids,chat_sound_tone,notif_sound_tone,password",
      )
      .eq("id", actor.actor_id)
      .single();
    if (clientError) throw clientError;
    if (!client) throw new Error("Client profile not found");
    const { password: legacyPassword, ...safeClient } = client;
    requiresPasswordChange = !String(legacyPassword ?? "").trim() ||
      String(legacyPassword).trim() === "1234";
    clientProfile = safeClient;
  }

  const rawToken = randomToken();
  const tokenHash = await sha256Hex(`${rawToken}:${sessionPepper}`);
  const sessionHours = actorType === "operator"
    ? SESSION_HOURS_OPERATOR
    : SESSION_HOURS_CLIENT;
  const expiresAt = new Date(Date.now() + sessionHours * 3_600_000).toISOString();
  const sessionRecord = {
    token_hash: tokenHash,
    actor_type: actorType,
    user_id: actorType === "operator" ? actor.actor_id : null,
    client_id: actorType === "client" ? actor.actor_id : null,
    actor_role: actor.actor_role,
    expires_at: expiresAt,
    metadata: {
      user_agent: (req.headers.get("user-agent") ?? "unknown").slice(0, 300),
    },
  };

  const { data: session, error: sessionError } = await admin
    .from("wallet_auth_sessions")
    .insert(sessionRecord)
    .select("id")
    .single();
  if (sessionError) throw sessionError;

  await recordAuthEvent({
    event_type: "login_success",
    actor_type: actorType,
    actor_id: actor.actor_id,
    identifier_hash: identifierHash,
    ip_hash: ipHash,
    session_id: session.id,
  });

  return response(origin, 200, {
    ok: true,
    token: rawToken,
    expires_at: expiresAt,
    actor: {
      id: actor.actor_id,
      name: actor.actor_name,
      role: actor.actor_role,
      type: actorType,
    },
    ...(actorType === "client"
      ? {
        client: clientProfile,
        requires_password_change: requiresPasswordChange,
      }
      : {}),
  });
}

async function requireSession(req: Request): Promise<WalletSession> {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([0-9a-f]{64})$/i);
  if (!match) throw new Error("UNAUTHORIZED");

  const tokenHash = await sha256Hex(`${match[1].toLowerCase()}:${sessionPepper}`);
  const { data, error } = await admin
    .from("wallet_auth_sessions")
    .select("id,actor_type,user_id,client_id,actor_role,expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("UNAUTHORIZED");

  const { error: touchError } = await admin
    .from("wallet_auth_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  if (touchError) console.error("wallet_session_touch_failed", touchError.code);

  return data as WalletSession;
}

function clientIdForRequest(session: WalletSession, url: URL): string {
  if (session.actor_type === "client") return requiredString(session.client_id, "client_id");
  return requiredString(url.searchParams.get("client_id"), "client_id", 120);
}

function requireOperator(session: WalletSession): void {
  if (session.actor_type !== "operator" || !session.user_id) {
    throw new Error("FORBIDDEN");
  }
}

function requireAdministrator(session: WalletSession): void {
  requireOperator(session);
  if (session.actor_role.trim().toLowerCase() !== "administrador") {
    throw new Error("FORBIDDEN");
  }
}

async function activeShiftForOperator(session: WalletSession): Promise<{
  id: string;
  user: string;
  start_time: string | null;
}> {
  requireOperator(session);

  const { data: operator, error: operatorError } = await admin
    .from("users")
    .select("id,full_name,status")
    .eq("id", session.user_id)
    .maybeSingle();
  if (operatorError) throw operatorError;
  if (!operator || operator.status !== "Activo") throw new Error("FORBIDDEN");

  const { data: openShifts, error: shiftError } = await admin
    .from("shifts")
    .select("id,user,start_time")
    .eq("status", "Abierta")
    .order("start_time", { ascending: false });
  if (shiftError) throw shiftError;

  const operatorName = operator.full_name.trim().toLowerCase();
  const matches = (openShifts ?? []).filter(
    (shift) => typeof shift.user === "string" && shift.user.trim().toLowerCase() === operatorName,
  );

  if (matches.length === 0) throw new Error("OPEN_SHIFT_REQUIRED");
  if (matches.length > 1) throw new Error("MULTIPLE_OPEN_SHIFTS");
  return matches[0];
}

async function getActor(session: WalletSession): Promise<Record<string, unknown> | null> {
  if (session.actor_type === "operator") {
    const { data, error } = await admin
      .from("users")
      .select("id,full_name,username,role,status")
      .eq("id", session.user_id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("clients")
    .select("id,name,code,email,phone")
    .eq("id", session.client_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function walletSummary(clientId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("wallet_account_summary")
    .select(
      "wallet_account_id,client_id,client_name,balance,currency,status,savings_goal_name,savings_goal_amount,updated_at",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function handleAuthenticated(
  req: Request,
  origin: string | null,
  route: string,
  url: URL,
): Promise<Response> {
  const session = await requireSession(req);

  if (req.method === "POST" && route === "/logout") {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("wallet_auth_sessions")
      .update({ revoked_at: now, revoked_reason: "logout" })
      .eq("id", session.id);
    if (error) throw error;
    await recordAuthEvent({
      event_type: "logout",
      actor_type: session.actor_type,
      actor_id: session.user_id ?? session.client_id,
      session_id: session.id,
    });
    return response(origin, 200, { ok: true });
  }

  if (req.method === "GET" && route === "/me") {
    return response(origin, 200, {
      ok: true,
      actor_type: session.actor_type,
      actor_role: session.actor_role,
      actor: await getActor(session),
      expires_at: session.expires_at,
    });
  }

  if (req.method === "PATCH" && route === "/client/password") {
    if (session.actor_type !== "client" || !session.client_id) {
      throw new Error("FORBIDDEN");
    }
    const body = await parseJson(req);
    const newPassword = requiredString(body.new_password, "new_password", 256);
    if (newPassword === "1234") {
      throw new Error("La contraseña nueva no puede ser la clave temporal.");
    }

    const { error } = await admin
      .from("clients")
      .update({ password: newPassword })
      .eq("id", session.client_id);
    if (error) throw error;
    return response(origin, 200, { ok: true });
  }

  if (req.method === "GET" && route === "/data") {
    requireOperator(session);
    const table = requiredDataTable(url.searchParams.get("table"));
    let query = admin.from(table).select("*");

    if (table === "chat_messages") {
      query = query.order("timestamp", { ascending: false }).limit(50);
    } else if (table === "invoices") {
      query = query.order("created_at", { ascending: false }).limit(1000);
    } else if (table === "stock_adjustments") {
      query = query.order("created_at", { ascending: false }).limit(50);
    } else if (table === "expenses") {
      query = query.order("created_at", { ascending: false }).limit(500);
    } else if (table === "shifts") {
      query = query.order("start_time", { ascending: false }).limit(30);
    } else if (table === "payroll_entries") {
      query = query.order("created_at", { ascending: false }).limit(30);
    } else if (table === "stock_transfers") {
      query = query.order("created_at", { ascending: false }).limit(30);
    }

    const { data, error } = await query;
    if (error) throw error;
    return response(origin, 200, { ok: true, data: data ?? [] });
  }

  if (req.method === "POST" && route === "/data/upsert") {
    const body = await parseJson(req);
    const table = requiredDataTable(body.table);
    requireDataWriteAccess(session, table);
    const record = requiredDataRecord(body.record);
    const { data, error } = await admin
      .from(table)
      .upsert(record)
      .select()
      .maybeSingle();
    if (error) throw error;
    return response(origin, 200, { ok: true, data });
  }

  if (req.method === "POST" && route === "/data/delete") {
    const body = await parseJson(req);
    const table = requiredDataTable(body.table);
    requireDataWriteAccess(session, table);
    const id = requiredString(body.id, "id", 160);
    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) throw error;
    return response(origin, 200, { ok: true });
  }

  if (req.method === "POST" && route === "/data/delete-by-field") {
    const body = await parseJson(req);
    const table = requiredDataTable(body.table);
    requireDataWriteAccess(session, table);
    const field = requiredString(body.field, "field", 80);
    if (!/^[a-z][a-z0-9_]*$/.test(field)) throw new Error("Invalid field name");
    const value = body.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error("Invalid field value");
    }
    const { error } = await admin.from(table).delete().eq(field, value);
    if (error) throw error;
    return response(origin, 200, { ok: true });
  }

  if (req.method === "GET" && route === "/products/wallet-eligibility") {
    requireAdministrator(session);
    const { data, error } = await admin
      .from("products")
      .select(
        "id,code,name,category,wallet_eligible,wallet_eligibility_status,wallet_eligibility_note,wallet_eligibility_reviewed_at",
      )
      .order("name", { ascending: true });
    if (error) throw error;
    const products = (data ?? []).map((product) => ({
      ...product,
      automatically_restricted: isAutomaticallyRestrictedProduct(product),
    }));
    return response(origin, 200, { ok: true, products });
  }

  if (req.method === "PATCH" && route === "/products/wallet-eligibility") {
    requireAdministrator(session);
    const body = await parseJson(req);
    const productId = requiredString(body.product_id, "product_id", 120);
    if (typeof body.eligible !== "boolean") {
      throw new Error("eligible must be boolean");
    }
    const eligible = body.eligible;
    const reviewNote = requiredString(body.review_note, "review_note", 500);
    if (reviewNote.length < 10) {
      throw new Error("review_note must contain at least 10 characters");
    }

    const { data: currentProduct, error: fetchError } = await admin
      .from("products")
      .select("id,code,name,category,wallet_eligible")
      .eq("id", productId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!currentProduct) {
      return response(origin, 404, { ok: false, error: "Producto no encontrado." });
    }
    const automaticallyRestricted = isAutomaticallyRestrictedProduct(currentProduct);
    if (eligible && automaticallyRestricted) {
      return response(origin, 409, {
        ok: false,
        error: "Este producto fue identificado como restringido y no puede habilitarse para pagos con Bolsillo.",
      });
    }

    const { data: updatedProduct, error: updateError } = await admin.rpc(
      "set_wallet_product_eligibility",
      {
        p_product_id: productId,
        p_eligible: eligible,
        p_review_note: reviewNote,
        p_reviewed_by_user_id: session.user_id,
        p_metadata: {
          automatically_restricted: automaticallyRestricted,
          api_version: 5,
        },
      },
    );
    if (updateError) throw updateError;

    return response(origin, 200, {
      ok: true,
      product: {
        ...updatedProduct,
        automatically_restricted: automaticallyRestricted,
      },
    });
  }

  if (req.method === "GET" && route === "/products/dispatch-review") {
    requireAdministrator(session);

    const { data, error } = await admin
      .from("products")
      .select(
        "id,code,name,category,dispatch_eligibility_status,dispatch_reviewed_at,dispatch_reviewed_by,dispatch_review_requested_at,dispatch_review_requested_by",
      )
      .order("name", { ascending: true });

    if (error) throw error;

    const products = (data ?? []).map((product) => ({
      ...product,
      automatically_restricted:
        isAutomaticallyRestrictedProduct(product),
    }));

    return response(origin, 200, { ok: true, products });
  }

  if (req.method === "PATCH" && route === "/products/dispatch-review") {
    requireAdministrator(session);

    const body = await parseJson(req);
    const productId = requiredString(
      body.product_id,
      "product_id",
      120,
    );
    const status = requiredString(body.status, "status", 20);
    const reviewNote = requiredString(
      body.review_note,
      "review_note",
      500,
    );

    if (!["allowed", "restricted"].includes(status)) {
      throw new Error("status must be allowed or restricted");
    }

    if (reviewNote.length < 10) {
      throw new Error(
        "review_note must contain at least 10 characters",
      );
    }

    const { data: currentProduct, error: fetchError } =
      await admin
        .from("products")
        .select("id,code,name,category")
        .eq("id", productId)
        .maybeSingle();

    if (fetchError) throw fetchError;

    if (!currentProduct) {
      return response(origin, 404, {
        ok: false,
        error: "Producto no encontrado.",
      });
    }

    const automaticallyRestricted =
      isAutomaticallyRestrictedProduct(currentProduct);

    if (status === "allowed" && automaticallyRestricted) {
      return response(origin, 409, {
        ok: false,
        error:
          "Este producto requiere control especial y no puede autorizarse automáticamente para despacho.",
      });
    }

    const reviewedAt = new Date().toISOString();

    const { data: updatedProduct, error: updateError } =
      await admin
        .from("products")
        .update({
          dispatch_eligibility_status: status,
          dispatch_reviewed_at: reviewedAt,
          dispatch_reviewed_by: session.user_id,
          dispatch_review_requested_at: null,
          dispatch_review_requested_by: null,
        })
        .eq("id", productId)
        .select(
          "id,code,name,category,dispatch_eligibility_status,dispatch_reviewed_at,dispatch_reviewed_by,dispatch_review_requested_at,dispatch_review_requested_by",
        )
        .single();

    if (updateError) throw updateError;

    return response(origin, 200, {
      ok: true,
      product: {
        ...updatedProduct,
        review_note: reviewNote,
        automatically_restricted: automaticallyRestricted,
      },
    });
  }

  if (req.method === "GET" && route === "/wallet") {
    const clientId = clientIdForRequest(session, url);
    const wallet = await walletSummary(clientId);
    if (!wallet) return response(origin, 404, { ok: false, error: "Bolsillo no encontrado." });

    const { data: cards, error } = await admin
      .from("nfc_cards")
      .select("id,public_token,status,label,issued_at,last_seen_at")
      .eq("client_id", clientId)
      .order("issued_at", { ascending: false });
    if (error) throw error;

    return response(origin, 200, { ok: true, wallet, cards: cards ?? [] });
  }

  if (req.method === "GET" && route === "/transactions") {
    const clientId = clientIdForRequest(session, url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 50));
    const { data, error } = await admin
      .from("wallet_transactions")
      .select(
        "id,direction,kind,amount,balance_after,source,operator_name,shift_id,invoice_id,notes,created_at,reversal_of",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return response(origin, 200, { ok: true, transactions: data ?? [] });
  }

  if (req.method === "PATCH" && route === "/wallet/goal") {
    const body = await parseJson(req);
    const clientId = session.actor_type === "client"
      ? requiredString(session.client_id, "client_id")
      : requiredString(body.client_id, "client_id", 120);
    const goalName = optionalString(body.savings_goal_name, 160);
    const goalAmount = body.savings_goal_amount === null || body.savings_goal_amount === ""
      ? null
      : requiredPositiveAmount(body.savings_goal_amount, "savings_goal_amount");
    const { error } = await admin
      .from("wallet_accounts")
      .update({ savings_goal_name: goalName, savings_goal_amount: goalAmount })
      .eq("client_id", clientId);
    if (error) throw error;
    return response(origin, 200, { ok: true, wallet: await walletSummary(clientId) });
  }

  if (req.method === "POST" && route === "/operator/wallet/purchase") {
    requireOperator(session);

    const body = await parseJson(req);
    const clientId = requiredString(body.client_id, "client_id", 120);
    const clientCode = requiredString(body.client_code, "client_code", 120);
    const clientPassword = requiredString(
      body.client_password,
      "client_password",
      200,
    );
    const invoiceId = requiredString(body.invoice_id, "invoice_id", 120);
    const invoiceNumber = requiredString(
      body.invoice_number,
      "invoice_number",
      120,
    );
    const idempotencyKey = requiredString(
      body.idempotency_key,
      "idempotency_key",
      160,
    );
    const walletAmount = requiredPositiveAmount(
      body.wallet_amount,
      "wallet_amount",
    );
    const remainingPaymentMethod = optionalString(
      body.remaining_payment_method,
      80,
    ) ?? "";

    const deliveryFee = body.delivery_fee === null ||
        body.delivery_fee === undefined
      ? 0
      : Number(body.delivery_fee);

    if (
      !Number.isFinite(deliveryFee) ||
      deliveryFee < 0 ||
      deliveryFee > 500000
    ) {
      throw new Error("delivery_fee is outside the allowed range");
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0 ||
      body.items.length > 100
    ) {
      throw new Error("items must contain between 1 and 100 products");
    }

    const deliveryMethod =
      optionalString(body.delivery_method, 30) ?? "recoge";

    if (!["oficina", "cliente", "recoge"].includes(deliveryMethod)) {
      throw new Error("Unsupported delivery method");
    }

    const activeShift = await activeShiftForOperator(session);
    const normalizedIdentifier = clientCode.toLowerCase();
    const identifierHash = await sha256Hex(
      `${normalizedIdentifier}:${sessionPepper}`,
    );
    const ipHash = await sha256Hex(
      `${clientIp(req)}:${sessionPepper}`,
    );
    const since = new Date(
      Date.now() - LOGIN_WINDOW_MINUTES * 60_000,
    ).toISOString();

    const [identifierFailures, ipFailures] = await Promise.all([
      failureCount("identifier_hash", identifierHash, since),
      failureCount("ip_hash", ipHash, since),
    ]);

    if (
      identifierFailures >= LOGIN_IDENTIFIER_LIMIT ||
      ipFailures >= LOGIN_IP_LIMIT
    ) {
      await recordAuthEvent({
        event_type: "rate_limited",
        actor_type: "client",
        identifier_hash: identifierHash,
        ip_hash: ipHash,
      });

      return response(origin, 429, {
        ok: false,
        error: "Intenta nuevamente más tarde.",
      });
    }

    const { data: credentialData, error: credentialError } =
      await admin.rpc("wallet_verify_client_credentials", {
        p_code: clientCode,
        p_password: clientPassword,
      });

    if (credentialError) throw credentialError;

    const clientActor = Array.isArray(credentialData)
      ? credentialData[0]
      : null;

    if (!clientActor || clientActor.actor_id !== clientId) {
      await recordAuthEvent({
        event_type: "login_failure",
        actor_type: "client",
        identifier_hash: identifierHash,
        ip_hash: ipHash,
      });

      return response(origin, 401, {
        ok: false,
        error: "El cliente no autorizó el uso de su Bolsillo.",
      });
    }

    const temporaryToken = randomToken();
    const temporaryTokenHash = await sha256Hex(
      `${temporaryToken}:${sessionPepper}`,
    );
    const authorizationExpiresAt = new Date(
      Date.now() + 5 * 60_000,
    ).toISOString();

    const { data: authorizationSession, error: authorizationError } =
      await admin
        .from("wallet_auth_sessions")
        .insert({
          token_hash: temporaryTokenHash,
          actor_type: "client",
          user_id: null,
          client_id: clientId,
          actor_role: clientActor.actor_role,
          expires_at: authorizationExpiresAt,
          metadata: {
            purpose: "operator_wallet_purchase",
            invoice_id: invoiceId,
            operator_user_id: session.user_id,
            shift_id: activeShift.id,
          },
        })
        .select("id")
        .single();

    if (authorizationError) throw authorizationError;

    try {
      const { data, error } = await admin.rpc(
        "wallet_operator_purchase_invoice",
        {
          p_client_id: clientId,
          p_invoice_id: invoiceId,
          p_invoice_number: invoiceNumber,
          p_items: body.items,
          p_delivery_fee: deliveryFee,
          p_delivery_method: deliveryMethod,
          p_delivery_address: optionalString(
            body.delivery_address,
            500,
          ),
          p_wallet_amount: walletAmount,
          p_idempotency_key: idempotencyKey,
          p_session_id: session.id,
          p_client_session_id: authorizationSession.id,
          p_operator_user_id: session.user_id,
          p_shift_id: activeShift.id,
          p_remaining_payment_method: remainingPaymentMethod,
        },
      );

      if (error) throw error;

      return response(origin, 201, { ok: true, ...data });
    } finally {
      const { error: revokeError } = await admin
        .from("wallet_auth_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_reason: "operator_wallet_purchase_consumed",
        })
        .eq("id", authorizationSession.id);

      if (revokeError) {
        console.error(
          "operator_wallet_authorization_revoke_failed",
          revokeError.code,
        );
      }
    }
  }

  if (req.method === "POST" && route === "/wallet/purchase") {
    if (session.actor_type !== "client" || !session.client_id) {
      throw new Error("FORBIDDEN");
    }

    const body = await parseJson(req);
    const invoiceId = requiredString(body.invoice_id, "invoice_id", 120);
    const invoiceNumber = requiredString(body.invoice_number, "invoice_number", 120);
    const idempotencyKey = requiredString(body.idempotency_key, "idempotency_key", 160);
    const walletAmount = requiredPositiveAmount(body.wallet_amount, "wallet_amount");
    const deliveryFee = body.delivery_fee === null || body.delivery_fee === undefined
      ? 0
      : Number(body.delivery_fee);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 500000) {
      throw new Error("delivery_fee is outside the allowed range");
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
      throw new Error("items must contain between 1 and 100 products");
    }

    const deliveryMethod = optionalString(body.delivery_method, 30) ?? "recoge";
    if (!["oficina", "cliente", "recoge"].includes(deliveryMethod)) {
      throw new Error("Unsupported delivery method");
    }

    const { data, error } = await admin.rpc("wallet_purchase_invoice", {
      p_client_id: session.client_id,
      p_invoice_id: invoiceId,
      p_invoice_number: invoiceNumber,
      p_items: body.items,
      p_delivery_fee: deliveryFee,
      p_delivery_method: deliveryMethod,
      p_delivery_address: optionalString(body.delivery_address, 500),
      p_wallet_amount: walletAmount,
      p_idempotency_key: idempotencyKey,
      p_session_id: session.id,
    });
    if (error) throw error;
    const result = typeof data === "object" && data !== null
      ? await applyWebPromotionToResult(
        data as Record<string, unknown>,
        session.client_id,
      )
      : null;
    if (!result) throw new Error("Failed to create wallet invoice");

    return response(origin, 201, { ok: true, ...result });
  }

  if (req.method === "POST" && route === "/web/bold-payment-intent") {
    if (session.actor_type !== "client" || !session.client_id) {
      throw new Error("FORBIDDEN");
    }
    if (!boldConfigurationReady()) {
      throw new Error("BOLD_NOT_CONFIGURED");
    }

    const body = await parseJson(req);
    const invoiceId = requiredString(
      body.invoice_id,
      "invoice_id",
      120,
    );
    const invoiceNumber = requiredString(
      body.invoice_number,
      "invoice_number",
      120,
    );
    const idempotencyKey = requiredString(
      body.idempotency_key,
      "idempotency_key",
      160,
    );

    if (
      !Array.isArray(body.items) ||
      body.items.length < 1 ||
      body.items.length > 100
    ) {
      throw new Error(
        "items must contain between 1 and 100 products",
      );
    }

    const deliveryFee =
      body.delivery_fee === null ||
        body.delivery_fee === undefined
        ? 0
        : Number(body.delivery_fee);

    if (
      !Number.isFinite(deliveryFee) ||
      deliveryFee < 0 ||
      deliveryFee > 500000
    ) {
      throw new Error(
        "delivery_fee is outside the allowed range",
      );
    }

    const deliveryMethod =
      optionalString(body.delivery_method, 30) ?? "recoge";

    if (
      !["oficina", "cliente", "recoge"].includes(
        deliveryMethod,
      )
    ) {
      throw new Error("Unsupported delivery method");
    }

    const orderReference = webBoldOrderReference();
    const expiresAt = new Date(
      Date.now() + BOLD_INTENT_HOURS * 3_600_000,
    ).toISOString();

    const { data, error } = await admin.rpc(
      "web_bold_create_payment_intent",
      {
        p_client_id: session.client_id,
        p_invoice_id: invoiceId,
        p_invoice_number: invoiceNumber,
        p_items: body.items,
        p_delivery_fee: deliveryFee,
        p_delivery_method: deliveryMethod,
        p_delivery_address: optionalString(
          body.delivery_address,
          500,
        ),
        p_idempotency_key: idempotencyKey,
        p_order_reference: orderReference,
        p_session_id: session.id,
        p_expires_at: expiresAt,
      },
    );

    if (error) throw error;

    const rawResult =
      typeof data === "object" && data !== null
        ? data as Record<string, unknown>
        : null;

    if (!rawResult) {
      throw new Error(
        "Failed to create direct Bold payment intent",
      );
    }

    const result = await applyWebPromotionToResult(
      rawResult,
      session.client_id,
      true,
    );

    const intentValue = result.intent;
    const intent =
      typeof intentValue === "object" &&
        intentValue !== null
        ? intentValue as Record<string, unknown>
        : null;

    if (!intent) {
      throw new Error(
        "Direct Bold payment intent was not returned",
      );
    }

    const finalReference = requiredString(
      intent.order_reference,
      "order_reference",
      60,
    );
    const finalAmount = requiredBoldAmount(intent.amount);
    const integritySignature = await sha256Hex(
      `${finalReference}${finalAmount}COP${boldSecretKey}`,
    );

    return response(origin, 201, {
      ok: true,
      invoice: result.invoice,
      intent,
      idempotent_replay:
        result.idempotent_replay === true,
      checkout: {
        api_key: boldIdentityKey,
        order_id: finalReference,
        amount: String(finalAmount),
        currency: "COP",
        integrity_signature: integritySignature,
        redirection_url: boldRedirectUrl,
        description: `Pago factura ${invoiceNumber}`,
      },
    });
  }
  if (req.method === "POST" && route === "/wallet/topup-intent") {
    if (session.actor_type !== "client" || !session.client_id) {
      throw new Error("FORBIDDEN");
    }
    if (!boldConfigurationReady()) throw new Error("BOLD_NOT_CONFIGURED");

    const body = await parseJson(req);
    const amount = requiredBoldAmount(body.amount);
    const idempotencyKey = requiredString(body.idempotency_key, "idempotency_key", 160);
    const orderReference = walletOrderReference();
    const expiresAt = new Date(Date.now() + BOLD_INTENT_HOURS * 3_600_000).toISOString();
    const { data, error } = await admin.rpc("wallet_create_bold_topup_intent", {
      p_client_id: session.client_id,
      p_amount: amount,
      p_idempotency_key: idempotencyKey,
      p_order_reference: orderReference,
      p_session_id: session.id,
      p_expires_at: expiresAt,
    });
    if (error) throw error;

    const intent = typeof data === "object" && data !== null
      ? data as Record<string, unknown>
      : null;
    if (!intent) throw new Error("Failed to create Bold top-up intent");
    const finalReference = requiredString(intent.order_reference, "order_reference", 60);
    const finalAmount = requiredBoldAmount(intent.amount);
    const integritySignature = await sha256Hex(
      `${finalReference}${finalAmount}COP${boldSecretKey}`,
    );

    return response(origin, 201, {
      ok: true,
      intent: {
        id: intent.id,
        status: intent.status,
        order_id: finalReference,
        amount: finalAmount,
        currency: "COP",
        expires_at: intent.expires_at,
      },
      checkout: {
        api_key: boldIdentityKey,
        order_id: finalReference,
        amount: String(finalAmount),
        currency: "COP",
        integrity_signature: integritySignature,
        redirection_url: boldRedirectUrl,
        description: "Recarga Bolsillo digital",
      },
    });
  }

  if (req.method === "GET" && route === "/wallet/topup-intent/status") {
    if (session.actor_type !== "client" || !session.client_id) {
      throw new Error("FORBIDDEN");
    }
    const orderReference = requiredString(
      url.searchParams.get("order_reference"),
      "order_reference",
      60,
    );
    const { data, error } = await admin
      .from("wallet_topup_intents")
      .select("id,amount,currency,status,order_reference,expires_at,approved_at,created_at,updated_at")
      .eq("client_id", session.client_id)
      .eq("order_reference", orderReference)
      .maybeSingle();
    if (error) throw error;
    if (!data) return response(origin, 404, { ok: false, error: "Recarga no encontrada." });
    return response(origin, 200, { ok: true, intent: data });
  }

  if (req.method === "POST" && route === "/operator/topup") {
    requireOperator(session);
    const body = await parseJson(req);
    const clientId = requiredString(body.client_id, "client_id", 120);
    const amount = requiredPositiveAmount(body.amount, "amount");
    if (amount > 50_000_000) throw new Error("amount is outside the allowed range");
    const paymentMethod = requiredString(body.payment_method, "payment_method", 30)
      .toLowerCase();
    const idempotencyKey = requiredString(body.idempotency_key, "idempotency_key", 160);
    const notes = optionalString(body.notes, 500);
    if (!["cash", "transfer", "card"].includes(paymentMethod)) {
      throw new Error("Unsupported office top-up payment method");
    }

    const shift = await activeShiftForOperator(session);
    const { data, error } = await admin.rpc("wallet_post_operator_topup", {
      p_client_id: clientId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_idempotency_key: idempotencyKey,
      p_operator_user_id: session.user_id,
      p_shift_id: shift.id,
      p_notes: notes,
      p_metadata: { api_version: 2 },
    });
    if (error) throw error;
    return response(origin, 201, { ok: true, transaction: data, shift });
  }

  if (req.method === "POST" && route === "/operator/reverse") {
    requireAdministrator(session);
    const body = await parseJson(req);
    const transactionId = requiredString(body.transaction_id, "transaction_id", 100);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) {
      throw new Error("Invalid transaction_id");
    }
    const idempotencyKey = requiredString(body.idempotency_key, "idempotency_key", 160);
    const notes = requiredString(body.notes, "notes", 500);
    const shift = await activeShiftForOperator(session);
    const { data, error } = await admin.rpc("wallet_reverse_operator_transaction", {
      p_transaction_id: transactionId,
      p_idempotency_key: idempotencyKey,
      p_operator_user_id: session.user_id,
      p_shift_id: shift.id,
      p_notes: notes,
    });
    if (error) throw error;
    return response(origin, 201, { ok: true, transaction: data, shift });
  }

  if (req.method === "GET" && route === "/shift/summary") {
    requireOperator(session);
    const activeShift = await activeShiftForOperator(session);
    const requestedShiftId = optionalString(url.searchParams.get("shift_id"), 120);
    if (requestedShiftId && requestedShiftId !== activeShift.id) {
      requireAdministrator(session);
    }
    const shiftId = requestedShiftId ?? activeShift.id;
    const { data, error } = await admin
      .from("wallet_shift_closure_summary")
      .select(
        "shift_id,operator_name,shift_status,movement_count,cash_topups,transfer_topups,card_topups,wallet_purchases,ledger_credits,ledger_debits",
      )
      .eq("shift_id", shiftId)
      .maybeSingle();
    if (error) throw error;
    return response(origin, 200, {
      ok: true,
      summary: data ?? {
        shift_id: shiftId,
        movement_count: 0,
        cash_topups: 0,
        transfer_topups: 0,
        card_topups: 0,
        wallet_purchases: 0,
        ledger_credits: 0,
        ledger_debits: 0,
      },
    });
  }

  if (req.method === "POST" && route === "/nfc/lookup") {
    requireOperator(session);
    const body = await parseJson(req);
    const publicToken = optionalString(body.public_token, 160);
    const uid = optionalString(body.uid, 200);
    if (!publicToken && !uid) throw new Error("public_token or uid is required");

    let query = admin
      .from("nfc_cards")
      .select("id,client_id,public_token,status,label,issued_at,last_seen_at");
    query = publicToken
      ? query.eq("public_token", publicToken)
      : query.eq("uid_hash", await sha256Hex(`${normalizeUid(uid!)}:${nfcPepper}`));
    const { data: card, error } = await query.maybeSingle();
    if (error) throw error;
    if (!card) return response(origin, 404, { ok: false, error: "Tarjeta no encontrada." });
    if (card.status !== "active") {
      return response(origin, 409, { ok: false, error: "La tarjeta no está activa.", card });
    }

    const [{ data: client, error: clientError }, wallet] = await Promise.all([
      admin
        .from("clients")
        .select("id,name,rut,email,phone")
        .eq("id", card.client_id)
        .maybeSingle(),
      walletSummary(card.client_id),
    ]);
    if (clientError) throw clientError;
    await admin.from("nfc_cards").update({ last_seen_at: new Date().toISOString() }).eq("id", card.id);
    return response(origin, 200, { ok: true, card, client, wallet });
  }

  if (req.method === "POST" && route === "/nfc/issue") {
    requireAdministrator(session);
    const body = await parseJson(req);
    const clientId = requiredString(body.client_id, "client_id", 120);
    const uid = requiredString(body.uid, "uid", 200);
    const label = optionalString(body.label, 120);
    const record: Record<string, unknown> = {
      client_id: clientId,
      label,
      issued_by_user_id: session.user_id,
    };
    record.uid_hash = await sha256Hex(`${normalizeUid(uid)}:${nfcPepper}`);

    const { data, error } = await admin
      .from("nfc_cards")
      .insert(record)
      .select("id,client_id,public_token,status,label,issued_at")
      .single();
    if (error?.code === "23505") {
      return response(origin, 409, {
        ok: false,
        error: "El cliente o la tarjeta ya tiene una vinculación activa.",
      });
    }
    if (error) throw error;
    return response(origin, 201, { ok: true, card: data });
  }

  if (req.method === "POST" && route === "/nfc/block") {
    requireOperator(session);
    const body = await parseJson(req);
    const cardId = requiredString(body.card_id, "card_id", 100);
    const { data, error } = await admin
      .from("nfc_cards")
      .update({ status: "blocked", blocked_at: new Date().toISOString() })
      .eq("id", cardId)
      .eq("status", "active")
      .select("id,client_id,status,blocked_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return response(origin, 404, { ok: false, error: "Tarjeta activa no encontrada." });
    return response(origin, 200, { ok: true, card: data });
  }

  return response(origin, 404, { ok: false, error: "Ruta no encontrada." });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (!isOriginAllowed(origin)) {
    return response(origin, 403, { ok: false, error: "Origen no autorizado." });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!supabaseUrl || !serviceRoleKey || sessionPepper.length < 32 || nfcPepper.length < 32) {
    return response(origin, 503, { ok: false, error: "Wallet API no está configurada." });
  }

  const url = new URL(req.url);
  const route = normalizeRoute(url.pathname);

  try {
    if (req.method === "GET" && route === "/health") {
      return response(origin, 200, { ok: true, service: "wallet-api", version: 8 });
    }
    if (req.method === "POST" && route === "/login/operator") {
      return await login(req, origin, "operator");
    }
    if (req.method === "POST" && route === "/login/client") {
      return await login(req, origin, "client");
    }

    return await handleAuthenticated(req, origin, route, url);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "UNKNOWN";
    if (message === "UNAUTHORIZED") {
      return response(origin, 401, { ok: false, error: "Sesión inválida o vencida." });
    }
    if (message === "FORBIDDEN") {
      return response(origin, 403, { ok: false, error: "No tienes permiso para esta acción." });
    }
    if (message === "BOLD_NOT_CONFIGURED") {
      return response(origin, 503, {
        ok: false,
        error: "Las recargas en línea todavía no están configuradas.",
      });
    }
    if (message === "WALLET_PRODUCT_NOT_ELIGIBLE") {
      return response(origin, 409, {
        ok: false,
        error: "Uno o más productos todavía no están habilitados para pagar con el Bolsillo.",
      });
    }
    if (message === "INVOICE_NOT_PAYABLE") {
      return response(origin, 409, {
        ok: false,
        error: "La factura no está disponible para recibir pagos del Bolsillo.",
      });
    }
    if (message.includes("Insufficient wallet balance")) {
      return response(origin, 409, {
        ok: false,
        error: "Saldo insuficiente en el Bolsillo.",
      });
    }
    if (message.includes("Idempotency key was already used")) {
      return response(origin, 409, { ok: false, error: message });
    }
    if (message.includes("Wallet account is not active")) {
      return response(origin, 409, { ok: false, error: "El Bolsillo no está activo." });
    }
    if (message.includes("Wallet account not found")) {
      return response(origin, 404, { ok: false, error: "Bolsillo no encontrado." });
    }
    if (
      message === "OPEN_SHIFT_REQUIRED" ||
      message === "MULTIPLE_OPEN_SHIFTS" ||
      message.includes("open shift") ||
      message.includes("shift does not belong")
    ) {
      return response(origin, 409, {
        ok: false,
        error: "El operador necesita un único turno abierto propio.",
      });
    }
    if (
      message.includes("required") ||
      message.includes("too long") ||
      message.includes("greater than zero") ||
      message.includes("outside the allowed range") ||
      message.includes("outside the Bold wallet range") ||
      message.includes("whole number of COP") ||
      message.includes("JSON") ||
      message.includes("too large") ||
      message.includes("Invalid NFC UID") ||
      message.includes("Unsupported data table") ||
      message.includes("record must be") ||
      message.includes("Invalid field") ||
      message.includes("Invalid transaction_id") ||
      message.includes("Unsupported office top-up payment method") ||
      message.includes("Unsupported delivery method") ||
      message.includes("items must contain") ||
      message.includes("delivery_fee") ||
      message.includes("wallet amount exceeds") ||
      message.includes("Product not found") ||
      message.includes("Invalid product quantity") ||
      message.includes("Insufficient product stock")
    ) {
      return response(origin, 400, { ok: false, error: message });
    }

    console.error("wallet_api_error", message);
    return response(origin, 500, { ok: false, error: "Error interno del Bolsillo." });
  }
});
