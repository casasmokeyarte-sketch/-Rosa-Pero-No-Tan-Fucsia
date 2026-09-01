const configuredWalletApiUrl = import.meta.env.VITE_WALLET_API_URL as string | undefined;
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const derivedWalletApiUrl = configuredSupabaseUrl
  ? `${configuredSupabaseUrl.replace(/\/$/, '')}/functions/v1/wallet-api`
  : '';

export const WALLET_API_URL = (
  configuredWalletApiUrl || derivedWalletApiUrl
).replace(/\/$/, '');

const sessionKey = (clientId: string) => `wallet_session_${clientId}`;
const operatorSessionKey = (userId: string) => `wallet_operator_session_${userId}`;
const ACTIVE_OPERATOR_KEY = 'wallet_active_operator_id';

export type WalletSummary = {
  wallet_account_id: string;
  client_id: string;
  client_name: string;
  balance: number;
  currency: string;
  status: 'active' | 'blocked' | 'closed' | string;
  savings_goal_name: string | null;
  savings_goal_amount: number | null;
  updated_at: string;
};

export type WalletCard = {
  id: string;
  public_token?: string | null;
  status: string;
  label: string | null;
  issued_at: string | null;
  last_seen_at: string | null;
};

export type WalletEligibleProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  wallet_eligible: boolean;
  wallet_eligibility_status: 'unreviewed' | 'eligible' | 'restricted' | string;
  wallet_eligibility_note: string | null;
  wallet_eligibility_reviewed_at: string | null;
  automatically_restricted: boolean;
};

export type WalletTransaction = {
  id: string;
  direction: 'credit' | 'debit' | string;
  kind: string;
  amount: number;
  balance_after: number;
  source: string;
  operator_name: string | null;
  shift_id: string | null;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
  reversal_of: string | null;
};

export type WalletShiftSummary = {
  shift_id: string;
  operator_name?: string;
  shift_status?: string;
  movement_count: number;
  cash_topups: number;
  transfer_topups: number;
  card_topups: number;
  wallet_purchases: number;
  ledger_credits: number;
  ledger_debits: number;
};

export type WalletLookupResult = {
  ok: true;
  card: WalletCard & { client_id: string };
  client: {
    id: string;
    name: string;
    rut: string;
    email: string;
    phone: string;
  } | null;
  wallet: WalletSummary | null;
};

export type BoldCheckout = {
  api_key: string;
  order_id: string;
  amount: string;
  currency: string;
  integrity_signature: string;
  redirection_url: string;
  description: string;
};

export type WalletPurchaseInvoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  client_rut: string;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    taxAmount: number;
    total: number;
    unitType?: string;
    note?: string;
  }>;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  wallet_paid_amount: number;
  amount_due?: number;
  payment_method: string;
  payment_status: 'Pagado' | 'Pendiente' | string;
  due_date: string;
  cashier_name: string;
  is_delivery: boolean;
  delivery_fee: number;
  delivery_status: string;
  delivery_address: string | null;
  delivery_method: 'oficina' | 'cliente' | 'recoge';
  created_at: string;
};

export type WalletPurchaseResult = {
  ok: true;
  invoice: WalletPurchaseInvoice;
  transaction: WalletTransaction;
  idempotent_replay: boolean;
};

export type TopupIntent = {
  id: string;
  status: string;
  order_id?: string;
  order_reference?: string;
  amount: number;
  currency: string;
  expires_at: string;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiOptions = RequestInit & { token?: string | null };

async function walletRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!WALLET_API_URL) {
    throw new Error('El servicio seguro no está configurado para esta instalación.');
  }
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(`${WALLET_API_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : 'No fue posible conectar con el servicio del Bolsillo.';
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export function getWalletSession(clientId: string): string | null {
  return sessionStorage.getItem(sessionKey(clientId));
}

export function saveWalletSession(clientId: string, token: string): void {
  sessionStorage.setItem(sessionKey(clientId), token);
}

export function clearWalletSession(clientId: string): void {
  sessionStorage.removeItem(sessionKey(clientId));
}

export function getWalletOperatorSession(userId: string): string | null {
  return sessionStorage.getItem(operatorSessionKey(userId));
}

export function saveWalletOperatorSession(userId: string, token: string): void {
  sessionStorage.setItem(operatorSessionKey(userId), token);
  sessionStorage.setItem(ACTIVE_OPERATOR_KEY, userId);
}

export function clearWalletOperatorSession(userId: string): void {
  sessionStorage.removeItem(operatorSessionKey(userId));
  if (sessionStorage.getItem(ACTIVE_OPERATOR_KEY) === userId) {
    sessionStorage.removeItem(ACTIVE_OPERATOR_KEY);
  }
}

export function getActiveWalletOperatorSession(): string | null {
  const userId = sessionStorage.getItem(ACTIVE_OPERATOR_KEY);
  return userId ? getWalletOperatorSession(userId) : null;
}

export function clearActiveWalletOperatorSession(): void {
  const userId = sessionStorage.getItem(ACTIVE_OPERATOR_KEY);
  if (userId) sessionStorage.removeItem(operatorSessionKey(userId));
  sessionStorage.removeItem(ACTIVE_OPERATOR_KEY);
}

export async function loginWalletOperator(username: string, password: string) {
  return walletRequest<{
    ok: true;
    token: string;
    expires_at: string;
    actor: { id: string; name: string; role: string; type: 'operator' };
  }>('/login/operator', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function completeInitialCompanySetup(
  config: Record<string, unknown>,
  administrator: Record<string, unknown>,
  setupToken: string
) {
  return walletRequest<{ ok: true; company_id: string; administrator_id: string }>(
    '/setup/initial',
    {
      method: 'POST',
      body: JSON.stringify({ config, administrator, setup_token: setupToken })
    }
  );
}

export async function loginWalletClient(code: string, password: string) {
  return walletRequest<{
    ok: true;
    token: string;
    expires_at: string;
    actor: { id: string; name: string; type: 'client' };
    client: Record<string, unknown>;
    requires_password_change: boolean;
  }>('/login/client', {
    method: 'POST',
    body: JSON.stringify({ code, password })
  });
}

export async function changeWalletClientPassword(
  token: string,
  newPassword: string
) {
  return walletRequest<{ ok: true }>('/client/password', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ new_password: newPassword })
  });
}

export async function fetchWalletClientChat(token: string) {
  return walletRequest<{ ok: true; data: Record<string, unknown>[] }>(
    '/client/chat',
    { token }
  );
}

export async function sendWalletClientChatMessage(
  token: string,
  message: {
    id: string;
    text: string;
    attachment?: unknown;
  }
) {
  return walletRequest<{ ok: true; data: Record<string, unknown> }>(
    '/client/chat',
    {
      method: 'POST',
      token,
      body: JSON.stringify(message)
    }
  );
}

function requireActiveOperatorToken(): string {
  const token = getActiveWalletOperatorSession();
  if (!token) throw new Error('No hay una sesión de operador activa.');
  return token;
}

export async function fetchSecureDataTable(table: string) {
  const token = requireActiveOperatorToken();
  return walletRequest<{ ok: true; data: any[] }>(
    `/data?table=${encodeURIComponent(table)}`,
    { token }
  );
}

export async function secureDataUpsert(table: string, record: unknown) {
  const token = requireActiveOperatorToken();
  return walletRequest<{ ok: true; data: unknown }>('/data/upsert', {
    method: 'POST',
    token,
    body: JSON.stringify({ table, record })
  });
}

export async function secureDataDelete(table: string, id: string) {
  const token = requireActiveOperatorToken();
  return walletRequest<{ ok: true }>('/data/delete', {
    method: 'POST',
    token,
    body: JSON.stringify({ table, id })
  });
}

export async function secureDataDeleteByField(
  table: string,
  field: string,
  value: string | number | boolean
) {
  const token = requireActiveOperatorToken();
  return walletRequest<{ ok: true }>('/data/delete-by-field', {
    method: 'POST',
    token,
    body: JSON.stringify({ table, field, value })
  });
}

export async function logoutWalletClient(token: string): Promise<void> {
  await walletRequest('/logout', { method: 'POST', token });
}

export async function fetchWallet(token: string, clientId?: string) {
  const query = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return walletRequest<{ ok: true; wallet: WalletSummary; cards: WalletCard[] }>(
    `/wallet${query}`,
    { token }
  );
}

export async function fetchWalletTransactions(
  token: string,
  limit = 50,
  clientId?: string
) {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(100, limit)))
  });
  if (clientId) params.set('client_id', clientId);
  return walletRequest<{ ok: true; transactions: WalletTransaction[] }>(
    `/transactions?${params.toString()}`,
    { token }
  );
}

export async function fetchWalletEligibleProducts(token: string) {
  return walletRequest<{ ok: true; products: WalletEligibleProduct[] }>(
    '/products/wallet-eligibility',
    { token }
  );
}

export async function updateWalletProductEligibility(
  token: string,
  input: {
    product_id: string;
    eligible: boolean;
    review_note: string;
  }
) {
  return walletRequest<{ ok: true; product: WalletEligibleProduct }>(
    '/products/wallet-eligibility',
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(input)
    }
  );
}

export type DispatchReviewProduct = {
  id: string;
  code?: string;
  name: string;
  category?: string;
  dispatch_eligibility_status:
    | 'unreviewed'
    | 'allowed'
    | 'restricted';
  dispatch_reviewed_at?: string | null;
  dispatch_reviewed_by?: string | null;
  dispatch_review_requested_at?: string | null;
  dispatch_review_requested_by?: string | null;
  automatically_restricted: boolean;
};

export async function fetchDispatchReviewProducts(token: string) {
  return walletRequest<{
    ok: true;
    products: DispatchReviewProduct[];
  }>('/products/dispatch-review', {
    token
  });
}

export async function updateDispatchReview(
  token: string,
  input: {
    product_id: string;
    status: 'allowed' | 'restricted';
    review_note: string;
  }
) {
  return walletRequest<{
    ok: true;
    product: DispatchReviewProduct & {
      review_note?: string;
    };
  }>('/products/dispatch-review', {
    method: 'PATCH',
    token,
    body: JSON.stringify(input)
  });
}
export async function operatorPurchaseWithWallet(
  token: string,
  input: {
    client_id: string;
    client_code: string;
    client_password: string;
    invoice_id: string;
    invoice_number: string;
    items: Array<{
      productId: string;
      quantity: number;
      note?: string;
    }>;
    delivery_fee: number;
    delivery_method: 'oficina' | 'cliente' | 'recoge';
    delivery_address?: string;
    wallet_amount: number;
    remaining_payment_method: string;
    idempotency_key: string;
  }
) {
  return walletRequest<WalletPurchaseResult>(
    '/operator/wallet/purchase',
    {
      method: 'POST',
      token,
      body: JSON.stringify(input)
    }
  );
}
export async function purchaseWithWallet(
  token: string,
  input: {
    invoice_id: string;
    invoice_number: string;
    items: Array<{ productId: string; quantity: number; note?: string }>;
    delivery_fee: number;
    delivery_method: 'oficina' | 'cliente' | 'recoge';
    delivery_address?: string;
    wallet_amount: number;
    idempotency_key: string;
  }
) {
  return walletRequest<WalletPurchaseResult>('/wallet/purchase', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}

export async function createDirectBoldPaymentIntent(
  token: string,
  input: {
    invoice_id: string;
    invoice_number: string;
    items: Array<{
      productId: string;
      quantity: number;
      note?: string;
    }>;
    delivery_fee: number;
    delivery_method: 'oficina' | 'cliente' | 'recoge';
    delivery_address?: string;
    idempotency_key: string;
  }
) {
  return walletRequest<{
    ok: true;
    invoice: WalletPurchaseInvoice;
    intent: {
      id: string;
      client_id: string;
      invoice_id: string;
      order_reference: string;
      amount: number;
      currency: string;
      status:
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'cancelled'
        | 'expired'
        | 'review_required';
      expires_at: string;
      provider_payment_id?: string | null;
      approved_at?: string | null;
      rejected_at?: string | null;
      cancelled_at?: string | null;
      last_event_at?: string | null;
    };
    idempotent_replay: boolean;
    checkout: BoldCheckout;
  }>('/web/bold-payment-intent', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}
export async function createWalletTopupIntent(
  token: string,
  amount: number,
  idempotencyKey: string
) {
  return walletRequest<{
    ok: true;
    intent: TopupIntent;
    checkout: BoldCheckout;
  }>('/wallet/topup-intent', {
    method: 'POST',
    token,
    body: JSON.stringify({
      amount,
      idempotency_key: idempotencyKey
    })
  });
}

export async function fetchWalletTopupStatus(token: string, orderReference: string) {
  return walletRequest<{ ok: true; intent: TopupIntent }>(
    `/wallet/topup-intent/status?order_reference=${encodeURIComponent(orderReference)}`,
    { token }
  );
}

export async function createOperatorWalletTopup(
  token: string,
  input: {
    client_id: string;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'card';
    idempotency_key: string;
    notes?: string;
  }
) {
  return walletRequest<{ ok: true; transaction: unknown; shift: { id: string } }>(
    '/operator/topup',
    { method: 'POST', token, body: JSON.stringify(input) }
  );
}

export async function reverseOperatorWalletTransaction(
  token: string,
  input: {
    transaction_id: string;
    idempotency_key: string;
    notes: string;
  }
) {
  return walletRequest<{ ok: true; transaction: unknown; shift: { id: string } }>(
    '/operator/reverse',
    { method: 'POST', token, body: JSON.stringify(input) }
  );
}

export async function fetchWalletShiftSummary(token: string, shiftId?: string) {
  const query = shiftId ? `?shift_id=${encodeURIComponent(shiftId)}` : '';
  return walletRequest<{ ok: true; summary: WalletShiftSummary }>(
    `/shift/summary${query}`,
    { token }
  );
}

export async function lookupWalletNfc(
  token: string,
  input: { uid?: string; public_token?: string }
) {
  return walletRequest<WalletLookupResult>('/nfc/lookup', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}

export async function issueWalletNfc(
  token: string,
  input: { client_id: string; uid?: string; label?: string }
) {
  return walletRequest<{
    ok: true;
    card: WalletCard & { client_id: string; public_token: string };
  }>('/nfc/issue', {
    method: 'POST',
    token,
    body: JSON.stringify(input)
  });
}

export async function blockWalletNfc(token: string, cardId: string) {
  return walletRequest<{ ok: true; card: WalletCard & { client_id: string } }>(
    '/nfc/block',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ card_id: cardId })
    }
  );
}
