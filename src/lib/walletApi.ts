const DEFAULT_WALLET_API_URL =
  'https://ekutrlduqdvfprtuigaf.supabase.co/functions/v1/wallet-api';

export const WALLET_API_URL = (
  import.meta.env.VITE_WALLET_API_URL || DEFAULT_WALLET_API_URL
).replace(/\/$/, '');

const sessionKey = (clientId: string) => `wallet_session_${clientId}`;

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
  status: string;
  label: string | null;
  issued_at: string | null;
  last_seen_at: string | null;
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

export type BoldCheckout = {
  api_key: string;
  order_id: string;
  amount: string;
  currency: string;
  integrity_signature: string;
  redirection_url: string;
  description: string;
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

export async function loginWalletClient(code: string, password: string) {
  return walletRequest<{
    ok: true;
    token: string;
    expires_at: string;
    actor: { id: string; name: string; type: 'client' };
  }>('/login/client', {
    method: 'POST',
    body: JSON.stringify({ code, password })
  });
}

export async function logoutWalletClient(token: string): Promise<void> {
  await walletRequest('/logout', { method: 'POST', token });
}

export async function fetchWallet(token: string) {
  return walletRequest<{ ok: true; wallet: WalletSummary; cards: WalletCard[] }>(
    '/wallet',
    { token }
  );
}

export async function fetchWalletTransactions(token: string, limit = 50) {
  return walletRequest<{ ok: true; transactions: WalletTransaction[] }>(
    `/transactions?limit=${Math.max(1, Math.min(100, limit))}`,
    { token }
  );
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
