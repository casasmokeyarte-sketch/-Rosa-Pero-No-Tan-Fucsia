import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  LockKeyhole,
  LogOut,
  Nfc,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from 'lucide-react';
import {
  BoldCheckout,
  clearWalletSession,
  createWalletTopupIntent,
  fetchWallet,
  fetchWalletTopupStatus,
  fetchWalletTransactions,
  getWalletSession,
  loginWalletClient,
  logoutWalletClient,
  saveWalletSession,
  TopupIntent,
  WalletCard,
  WalletSummary,
  WalletTransaction
} from '../lib/walletApi';

type BolsilloClienteProps = {
  client: {
    id: string;
    code?: string;
    name: string;
  };
  hasPendingPurchase?: boolean;
  onContinuePurchase?: () => void;
};

const pendingKey = (clientId: string) => `wallet_pending_topup_${clientId}`;

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendiente de confirmación',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Anulada',
    expired: 'Vencida',
    active: 'Activa',
    blocked: 'Bloqueada',
    closed: 'Cerrada'
  };
  return labels[status] || status;
};

export function OfficialBoldButton({ checkout }: { checkout: BoldCheckout }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();

    const script = document.createElement('script');
    script.src = 'https://checkout.bold.co/library/boldPaymentButton.js';
    script.async = true;
    script.setAttribute('data-bold-button', '');
    script.setAttribute('data-api-key', checkout.api_key);
    script.setAttribute('data-order-id', checkout.order_id);
    script.setAttribute('data-currency', checkout.currency);
    script.setAttribute('data-amount', checkout.amount);
    script.setAttribute('data-integrity-signature', checkout.integrity_signature);
    script.setAttribute('data-redirection-url', checkout.redirection_url);
    script.setAttribute('data-description', checkout.description);
    container.appendChild(script);

    return () => container.replaceChildren();
  }, [checkout]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-12 flex items-center justify-center" />
      <p className="text-[9px] text-gray-500 text-center">
        El botón abre el checkout oficial de Bold. Esta página no solicita ni almacena datos de tarjeta.
      </p>
    </div>
  );
}

export default function BolsilloCliente({
  client,
  hasPendingPurchase = false,
  onContinuePurchase
}: BolsilloClienteProps) {
  const [token, setToken] = useState(() => getWalletSession(client.id));
  const [password, setPassword] = useState('');
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState('1000');
  const [checkout, setCheckout] = useState<BoldCheckout | null>(null);
  const [intent, setIntent] = useState<TopupIntent | null>(null);
  const [pendingReference, setPendingReference] = useState(
    () => sessionStorage.getItem(pendingKey(client.id)) || ''
  );
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const expireSession = useCallback(() => {
    clearWalletSession(client.id);
    setToken(null);
    setWallet(null);
    setCards([]);
    setTransactions([]);
    setCheckout(null);
  }, [client.id]);

  const loadData = useCallback(async (sessionToken: string) => {
    setLoading(true);
    setError('');
    try {
      const [walletResponse, transactionResponse] = await Promise.all([
        fetchWallet(sessionToken),
        fetchWalletTransactions(sessionToken)
      ]);
      setWallet(walletResponse.wallet);
      setCards(walletResponse.cards);
      setTransactions(transactionResponse.transactions);
    } catch (requestError) {
      const typedError = requestError as Error & { status?: number };
      if (typedError.status === 401) expireSession();
      setError(typedError.message);
    } finally {
      setLoading(false);
    }
  }, [expireSession]);

  useEffect(() => {
    if (token) loadData(token);
  }, [token, loadData]);

  const checkPending = useCallback(async () => {
    if (!token || !pendingReference) return;
    setChecking(true);
    try {
      const response = await fetchWalletTopupStatus(token, pendingReference);
      setIntent(response.intent);
      if (['approved', 'rejected', 'cancelled', 'expired'].includes(response.intent.status)) {
        sessionStorage.removeItem(pendingKey(client.id));
        setPendingReference('');
        setCheckout(null);
        await loadData(token);
      }
    } catch (requestError) {
      const typedError = requestError as Error & { status?: number };
      if (typedError.status === 401) expireSession();
      setError(typedError.message);
    } finally {
      setChecking(false);
    }
  }, [client.id, expireSession, loadData, pendingReference, token]);

  useEffect(() => {
    if (!token || !pendingReference) return;
    checkPending();
    const timer = window.setInterval(checkPending, 6000);
    return () => window.clearInterval(timer);
  }, [checkPending, pendingReference, token]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client.code) {
      setError('Este cliente no tiene código de acceso configurado.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await loginWalletClient(client.code, password);
      saveWalletSession(client.id, response.token);
      setToken(response.token);
      setPassword('');

      if (hasPendingPurchase && onContinuePurchase) {
        onContinuePurchase();
      }
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await logoutWalletClient(token);
      } catch {
        // La sesión se elimina localmente aunque el servidor ya la haya vencido.
      }
    }
    expireSession();
  };

  const handleCreateTopup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 1000) {
      setError('La recarga mínima es de $1.000 COP y debe ser un valor entero.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const idempotencyKey =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `wallet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await createWalletTopupIntent(
        token,
        numericAmount,
        idempotencyKey
      );
      setIntent(response.intent);
      setCheckout(response.checkout);
      setPendingReference(response.checkout.order_id);
      sessionStorage.setItem(pendingKey(client.id), response.checkout.order_id);
    } catch (requestError) {
      const typedError = requestError as Error & { status?: number };
      if (typedError.status === 401) expireSession();
      setError(typedError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 sm:p-7 max-w-xl mx-auto space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyber-pink/15 border border-cyber-pink/30 flex items-center justify-center">
            <LockKeyhole className="text-cyber-pink" size={26} />
          </div>
          <h2 className="text-base font-black text-white font-mono uppercase tracking-wider">
            Desbloquear mi Bolsillo
          </h2>
          <p className="text-xs text-gray-400">
            Confirma tu contraseña para consultar el saldo, recargar o regresar a pagar tu pedido.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[9px] text-gray-500 font-mono uppercase mb-1">
              Código de cliente
            </label>
            <input
              value={client.code || ''}
              readOnly
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 font-mono uppercase mb-1">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-cyber-border p-3 text-white text-xs focus:outline-none focus:border-cyber-pink"
              required
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-cyber-pink text-black font-black font-mono text-xs disabled:opacity-50"
          >
            {submitting ? 'VERIFICANDO…' : 'ENTRAR AL BOLSILLO'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-cyber-pink/15 to-cyan-500/5 border border-cyber-pink/25 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyber-pink font-mono text-[10px] font-bold uppercase">
              <PiggyBank size={15} /> Bolsillo digital
            </div>
            <p className="text-3xl sm:text-4xl text-white font-black mt-2">
              {money(wallet?.balance)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Saldo confirmado por el registro contable de Supabase.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => token && loadData(token)}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-gray-300 disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-red-300"
              title="Cerrar sesión del Bolsillo"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {hasPendingPurchase && onContinuePurchase && (
        <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4 space-y-3">
          <div>
            <p className="text-sm font-black text-white font-mono uppercase">
              Tienes una compra pendiente
            </p>
            <p className="mt-1 text-[10px] text-cyan-100/80">
              El saldo puede aplicarse desde el paso de pago del pedido.
            </p>
          </div>
          <button
            type="button"
            onClick={onContinuePurchase}
            className="w-full rounded-xl bg-cyan-300 py-3 text-xs font-black font-mono text-slate-950"
          >
            VOLVER AL PEDIDO Y PAGAR
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <WalletCards className="text-cyber-pink" size={18} />
            <h3 className="font-mono font-black text-white text-sm uppercase">
              Recargar saldo con Bold
            </h3>
          </div>

          <form onSubmit={handleCreateTopup} className="space-y-3">
            <label className="block text-[10px] text-gray-400">
              Monto libre desde $1.000 COP
            </label>
            <input
              type="number"
              min="1000"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-lg font-bold"
              required
            />
            <button
              type="submit"
              disabled={submitting || wallet?.status !== 'active'}
              className="w-full py-3 rounded-xl bg-cyber-pink text-black font-black font-mono text-xs disabled:opacity-40"
            >
              {submitting ? 'CREANDO INTENCIÓN…' : 'RECARGAR CON BOLD'}
            </button>
          </form>

          {checkout && (
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-amber-200 text-[10px]">
                La recarga quedará pendiente hasta que el webhook firmado de Bold confirme el pago.
              </div>
              <OfficialBoldButton checkout={checkout} />
            </div>
          )}

          {intent && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-[10px] space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Estado</span>
                <span className="text-white font-bold">{statusLabel(intent.status)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Referencia</span>
                <span className="text-cyber-pink font-mono truncate">
                  {intent.order_id || intent.order_reference}
                </span>
              </div>
            </div>
          )}

          {pendingReference && (
            <button
              onClick={checkPending}
              disabled={checking}
              className="w-full py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-xs font-bold"
            >
              {checking ? 'CONSULTANDO…' : 'VERIFICAR ESTADO DE LA RECARGA'}
            </button>
          )}
        </div>

        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Nfc className="text-cyan-300" size={18} />
            <h3 className="font-mono font-black text-white text-sm uppercase">
              Tarjetas NFC
            </h3>
          </div>
          {cards.length === 0 ? (
            <p className="text-xs text-gray-500">
              Todavía no hay una tarjeta NFC vinculada a este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-white text-xs font-bold">
                      {card.label || 'Tarjeta Bolsillo'}
                    </p>
                    <p className="text-[9px] text-gray-500">
                      Última lectura: {card.last_seen_at
                        ? new Date(card.last_seen_at).toLocaleString('es-CO')
                        : 'Sin lecturas'}
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded-full border border-cyan-500/30 text-cyan-200 uppercase">
                    {statusLabel(card.status)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 text-white text-xs font-bold mb-2">
              <ShieldCheck size={15} className="text-emerald-300" />
              Protección del saldo
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              La tarjeta contiene únicamente un identificador opaco. Los datos personales y el dinero permanecen en el servidor.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <Clock3 size={16} className="text-cyber-pink" />
          <h3 className="font-mono font-black text-white text-sm uppercase">
            Movimientos del Bolsillo
          </h3>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            Aún no hay movimientos confirmados.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">
                    {transaction.notes || transaction.kind}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {new Date(transaction.created_at).toLocaleString('es-CO')}
                    {transaction.operator_name ? ` · ${transaction.operator_name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-black text-sm ${
                      transaction.direction === 'credit'
                        ? 'text-emerald-300'
                        : 'text-red-300'
                    }`}
                  >
                    {transaction.direction === 'credit' ? '+' : '-'}
                    {money(transaction.amount)}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    Saldo: {money(transaction.balance_after)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100/80 leading-relaxed flex gap-2">
        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
        <span>
          Tener saldo en el Bolsillo no reemplaza controles legales, de identidad o de edad exigidos para una compra.
        </span>
      </div>
    </div>
  );
}
