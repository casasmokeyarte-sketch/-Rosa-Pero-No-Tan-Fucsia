import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  CreditCard,
  History,
  KeyRound,
  LockKeyhole,
  LogOut,
  Nfc,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  UserRound,
  WalletCards
} from 'lucide-react';
import { Client, User } from '../types';
import {
  blockWalletNfc,
  clearWalletOperatorSession,
  createOperatorWalletTopup,
  fetchWallet,
  fetchWalletEligibleProducts,
  fetchWalletShiftSummary,
  fetchWalletTransactions,
  getWalletOperatorSession,
  issueWalletNfc,
  loginWalletOperator,
  logoutWalletClient,
  lookupWalletNfc,
  reverseOperatorWalletTransaction,
  saveWalletOperatorSession,
  WalletCard,
  WalletEligibleProduct,
  WalletShiftSummary,
  WalletSummary,
  WalletTransaction,
  updateWalletProductEligibility
} from '../lib/walletApi';

type WalletOperadorAdminProps = {
  currentUser: User;
  clients: Client[];
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info'
  ) => void;
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const randomKey = (prefix: string) =>
  typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta'
};

const escapeReportText = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export default function WalletOperadorAdmin({
  currentUser,
  clients,
  showToast
}: WalletOperadorAdminProps) {
  const isAdmin = currentUser.role === 'Administrador';
  const [token, setToken] = useState(() =>
    getWalletOperatorSession(currentUser.id)
  );
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [eligibleProducts, setEligibleProducts] = useState<WalletEligibleProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productReviewNotes, setProductReviewNotes] = useState<Record<string, string>>({});
  const [eligibilityBusyId, setEligibilityBusyId] = useState('');
  const [shiftSummary, setShiftSummary] = useState<WalletShiftSummary | null>(null);
  const [amount, setAmount] = useState('1000');
  const [paymentMethod, setPaymentMethod] =
    useState<'cash' | 'transfer' | 'card'>('cash');
  const [topupNotes, setTopupNotes] = useState('');
  const [nfcValue, setNfcValue] = useState('');
  const [nfcMode, setNfcMode] = useState<'uid' | 'public_token'>('uid');
  const [newCardLabel, setNewCardLabel] = useState('Tarjeta Bolsillo');
  const [reverseId, setReverseId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [error, setError] = useState('');

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients.slice(0, 20);
    return clients
      .filter((client) =>
        [client.name, client.code, client.rut, client.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 30);
  }, [clients, search]);

  const filteredEligibilityProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return eligibleProducts;
    return eligibleProducts.filter((product) =>
      [product.name, product.code, product.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [eligibleProducts, productSearch]);

  const expireSession = useCallback(() => {
    clearWalletOperatorSession(currentUser.id);
    setToken(null);
    setWallet(null);
    setCards([]);
    setTransactions([]);
    setShiftSummary(null);
    setEligibleProducts([]);
  }, [currentUser.id]);

  const handleApiError = useCallback(
    (requestError: unknown) => {
      const typedError = requestError as Error & { status?: number };
      if (typedError.status === 401) expireSession();
      setError(typedError.message || 'No fue posible completar la operación.');
    },
    [expireSession]
  );

  const loadShiftSummary = useCallback(
    async (sessionToken: string) => {
      try {
        const response = await fetchWalletShiftSummary(sessionToken);
        setShiftSummary(response.summary);
      } catch (requestError) {
        const typedError = requestError as Error & { status?: number };
        if (typedError.status === 401) expireSession();
        if (typedError.status === 409) {
          setShiftSummary(null);
          return;
        }
        setError(typedError.message);
      }
    },
    [expireSession]
  );

  const loadEligibilityProducts = useCallback(
    async (sessionToken: string) => {
      if (!isAdmin) return;
      try {
        const response = await fetchWalletEligibleProducts(sessionToken);
        setEligibleProducts(response.products);
      } catch (requestError) {
        handleApiError(requestError);
      }
    },
    [handleApiError, isAdmin]
  );

  const loadClientWallet = useCallback(
    async (sessionToken: string, clientId: string) => {
      setLoadingWallet(true);
      setError('');
      try {
        const [walletResponse, transactionResponse] = await Promise.all([
          fetchWallet(sessionToken, clientId),
          fetchWalletTransactions(sessionToken, 100, clientId)
        ]);
        setWallet(walletResponse.wallet);
        setCards(walletResponse.cards);
        setTransactions(transactionResponse.transactions);
      } catch (requestError) {
        setWallet(null);
        setCards([]);
        setTransactions([]);
        handleApiError(requestError);
      } finally {
        setLoadingWallet(false);
      }
    },
    [handleApiError]
  );

  useEffect(() => {
    if (token) loadShiftSummary(token);
  }, [loadShiftSummary, token]);

  useEffect(() => {
    if (token && isAdmin) loadEligibilityProducts(token);
  }, [isAdmin, loadEligibilityProducts, token]);

  useEffect(() => {
    if (token && selectedClientId) {
      loadClientWallet(token, selectedClientId);
    } else {
      setWallet(null);
      setCards([]);
      setTransactions([]);
    }
  }, [loadClientWallet, selectedClientId, token]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await loginWalletOperator(currentUser.username, password);
      saveWalletOperatorSession(currentUser.id, response.token);
      setToken(response.token);
      setPassword('');
      showToast('Acceso privado al Bolsillo verificado.', 'success');
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await logoutWalletClient(token);
      } catch {
        // La sesión se elimina localmente aunque ya haya vencido.
      }
    }
    expireSession();
  };

  const handleTopup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !selectedClientId) return;
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setError('El monto debe ser un valor entero de COP mayor que cero.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createOperatorWalletTopup(token, {
        client_id: selectedClientId,
        amount: numericAmount,
        payment_method: paymentMethod,
        idempotency_key: randomKey('office-topup'),
        notes: topupNotes.trim() || undefined
      });
      setTopupNotes('');
      showToast(
        `Recarga de ${money(numericAmount)} registrada como ${paymentLabels[paymentMethod]}.`,
        'success'
      );
      await Promise.all([
        loadClientWallet(token, selectedClientId),
        loadShiftSummary(token)
      ]);
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const handleNfcLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !nfcValue.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await lookupWalletNfc(
        token,
        nfcMode === 'uid'
          ? { uid: nfcValue.trim() }
          : { public_token: nfcValue.trim() }
      );
      setSelectedClientId(response.card.client_id);
      setWallet(response.wallet);
      setCards([response.card]);
      const transactionResponse = await fetchWalletTransactions(
        token,
        100,
        response.card.client_id
      );
      setTransactions(transactionResponse.transactions);
      showToast(
        `Tarjeta reconocida: ${response.client?.name || 'cliente identificado'}.`,
        'success'
      );
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const handleIssueCard = async () => {
    if (!token || !selectedClientId || !isAdmin) return;
    if (nfcMode !== 'uid' || !nfcValue.trim()) {
      setError('Primero selecciona UID del lector e ingresa el código leído de la tarjeta física.');
      return;
    }
    if (cards.some((card) => card.status === 'active')) {
      setError('Este cliente ya tiene una tarjeta activa. Bloquéala antes de vincular una tarjeta de reemplazo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await issueWalletNfc(token, {
        client_id: selectedClientId,
        uid: nfcValue.trim(),
        label: newCardLabel.trim() || undefined
      });
      showToast(
        `Tarjeta NFC vinculada. Token público: ${response.card.public_token}`,
        'success'
      );
      setNfcValue('');
      await loadClientWallet(token, selectedClientId);
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const handleEligibilityChange = async (
    product: WalletEligibleProduct,
    eligible: boolean
  ) => {
    if (!token || !isAdmin) return;
    const reviewNote = (productReviewNotes[product.id] || '').trim();
    if (reviewNote.length < 10) {
      setError('Escribe una observación de revisión de al menos 10 caracteres para ese producto.');
      return;
    }
    if (
      eligible &&
      !window.confirm(
        'Confirma que una persona adulta autorizada revisó este producto y que NO es restringido ni está sujeto a controles de edad.'
      )
    ) {
      return;
    }

    setEligibilityBusyId(product.id);
    setError('');
    try {
      const response = await updateWalletProductEligibility(token, {
        product_id: product.id,
        eligible,
        review_note: reviewNote
      });
      setEligibleProducts((current) =>
        current.map((item) =>
          item.id === response.product.id ? response.product : item
        )
      );
      showToast(
        eligible
          ? 'Producto habilitado para pagos con Bolsillo.'
          : 'Producto bloqueado para pagos con Bolsillo.',
        eligible ? 'success' : 'warning'
      );
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setEligibilityBusyId('');
    }
  };

  const handlePrintStatement = () => {
    if (!selectedClient || !wallet) {
      setError('Selecciona un cliente y consulta su Bolsillo antes de imprimir.');
      return;
    }
    const reportWindow = window.open('', '_blank', 'width=980,height=760');
    if (!reportWindow) {
      setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo otra vez.');
      return;
    }
    reportWindow.opener = null;
    const rows = transactions
      .map(
        (transaction) => `
          <tr>
            <td>${escapeReportText(new Date(transaction.created_at).toLocaleString('es-CO'))}</td>
            <td>${escapeReportText(transaction.notes || transaction.kind)}</td>
            <td>${escapeReportText(transaction.operator_name || 'Sistema')}</td>
            <td class="amount">${transaction.direction === 'credit' ? '+' : '-'}${escapeReportText(money(transaction.amount))}</td>
            <td class="amount">${escapeReportText(money(transaction.balance_after))}</td>
          </tr>`
      )
      .join('');
    reportWindow.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:32px}h1{font-size:22px;margin:0 0 6px}
        .meta{color:#444;font-size:12px;margin-bottom:22px}.summary{display:flex;gap:24px;padding:14px;border:1px solid #bbb;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:8px;text-align:left}
        th{background:#eee}.amount{text-align:right;white-space:nowrap}.footer{margin-top:20px;font-size:10px;color:#555}
        @media print{body{margin:12mm}}
      </style></head><body>
      <h1>Estado de cuenta del Bolsillo</h1>
      <div class="meta">Generado: ${escapeReportText(new Date().toLocaleString('es-CO'))}</div>
      <div class="summary">
        <div><strong>Cliente:</strong><br>${escapeReportText(selectedClient.name)}</div>
        <div><strong>Documento:</strong><br>${escapeReportText(selectedClient.rut)}</div>
        <div><strong>Saldo:</strong><br>${escapeReportText(money(wallet.balance))}</div>
        <div><strong>Estado:</strong><br>${escapeReportText(wallet.status)}</div>
      </div>
      <table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Operador</th><th>Valor</th><th>Saldo</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No hay movimientos confirmados.</td></tr>'}</tbody></table>
      <div class="footer">Este reporte es informativo. Los movimientos confirmados permanecen en el libro contable del sistema.</div>
      </body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
  };

  const handleBlockCard = async (cardId: string) => {
    if (!token || !selectedClientId || !isAdmin) return;
    if (!window.confirm('¿Confirmas bloquear esta tarjeta NFC?')) return;
    setBusy(true);
    setError('');
    try {
      await blockWalletNfc(token, cardId);
      showToast('Tarjeta NFC bloqueada correctamente.', 'warning');
      await loadClientWallet(token, selectedClientId);
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !selectedClientId || !isAdmin) return;
    if (!reverseId || reverseReason.trim().length < 5) {
      setError('Selecciona un movimiento y escribe una razón de al menos 5 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reverseOperatorWalletTransaction(token, {
        transaction_id: reverseId,
        idempotency_key: randomKey('admin-reversal'),
        notes: reverseReason.trim()
      });
      setReverseId('');
      setReverseReason('');
      showToast('Movimiento revertido y auditado correctamente.', 'success');
      await Promise.all([
        loadClientWallet(token, selectedClientId),
        loadShiftSummary(token)
      ]);
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-xl mx-auto bg-cyber-card border border-cyber-border rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyber-pink/15 border border-cyber-pink/30 flex items-center justify-center">
            <LockKeyhole className="text-cyber-pink" size={27} />
          </div>
          <h2 className="text-base text-white font-black font-mono uppercase">
            Control interno del Bolsillo
          </h2>
          <p className="text-xs text-gray-400">
            Confirma nuevamente tu contraseña operativa. Las credenciales no se guardan en el navegador.
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[9px] text-gray-500 font-mono uppercase">
              Usuario operativo
            </label>
            <input
              value={currentUser.username}
              readOnly
              className="w-full mt-1 rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 font-mono uppercase">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full mt-1 rounded-xl bg-slate-950 border border-cyber-border p-3 text-white text-xs focus:outline-none focus:border-cyber-pink"
              required
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
              {error}
            </div>
          )}
          <button
            disabled={busy}
            className="w-full py-3 rounded-xl bg-cyber-pink text-black font-black font-mono text-xs disabled:opacity-40"
          >
            {busy ? 'VERIFICANDO…' : 'DESBLOQUEAR MÓDULO'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-cyber-pink/15 to-cyan-500/5 border border-cyber-pink/25 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyber-pink font-mono text-[10px] font-bold uppercase">
            <ShieldCheck size={15} />
            {isAdmin ? 'Consola administrativa' : 'Consola de operador'}
          </div>
          <h2 className="text-xl text-white font-black mt-1">
            Bolsillos y tarjetas NFC
          </h2>
          <p className="text-[10px] text-gray-400 mt-1">
            Sesión privada: {currentUser.fullName}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="self-start sm:self-auto p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-red-300"
          title="Cerrar sesión privada del Bolsillo"
        >
          <LogOut size={16} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
          {error}
        </div>
      )}

      {isAdmin && (
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <PackageCheck size={17} className="text-emerald-300" />
              <div>
                <h3 className="text-white text-xs font-black font-mono uppercase">
                  Productos habilitados para Bolsillo
                </h3>
                <p className="text-[9px] text-gray-500">
                  Solo una persona adulta autorizada puede habilitar productos no restringidos.
                </p>
              </div>
            </div>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar por nombre, código o categoría…"
              className="sm:ml-auto w-full sm:max-w-sm rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredEligibilityProducts.slice(0, 50).map((product) => (
              <div
                key={product.id}
                className="rounded-xl bg-slate-950 border border-slate-800 p-3 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_auto] gap-3 lg:items-center"
              >
                <div>
                  <p className="text-white text-xs font-bold">{product.name}</p>
                  <p className="text-[9px] text-gray-500">
                    {product.code} · {product.category || 'Sin categoría'}
                  </p>
                  <span
                    className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-[8px] font-bold ${
                      product.wallet_eligible
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : product.automatically_restricted
                          ? 'bg-red-500/15 text-red-200'
                          : 'bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    {product.wallet_eligible
                      ? 'APTO PARA BOLSILLO'
                      : product.automatically_restricted
                        ? 'RESTRINGIDO AUTOMÁTICAMENTE'
                        : 'NO CLASIFICADO'}
                  </span>
                </div>
                <input
                  value={productReviewNotes[product.id] || ''}
                  onChange={(event) =>
                    setProductReviewNotes((current) => ({
                      ...current,
                      [product.id]: event.target.value
                    }))
                  }
                  placeholder="Motivo de la revisión (mínimo 10 caracteres)…"
                  className="rounded-xl bg-black/30 border border-slate-800 p-2.5 text-white text-[10px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEligibilityChange(product, false)}
                    disabled={eligibilityBusyId === product.id}
                    className="px-3 py-2 rounded-lg border border-red-500/30 text-red-200 text-[9px] font-bold disabled:opacity-40"
                  >
                    BLOQUEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEligibilityChange(product, true)}
                    disabled={
                      eligibilityBusyId === product.id ||
                      product.automatically_restricted
                    }
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-black text-[9px] font-black disabled:opacity-30"
                  >
                    HABILITAR
                  </button>
                </div>
              </div>
            ))}
            {filteredEligibilityProducts.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-6">
                No se encontraron productos.
              </p>
            )}
          </div>
          <p className="text-[9px] text-amber-200/80">
            Los controles automáticos son una barrera adicional; no reemplazan la revisión legal, de identidad o de edad.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-cyber-pink" />
            <h3 className="text-white text-xs font-black font-mono uppercase">
              Buscar cliente
            </h3>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, código, documento o teléfono…"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
          />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  selectedClientId === client.id
                    ? 'border-cyber-pink bg-cyber-pink/10'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                }`}
              >
                <p className="text-white text-xs font-bold">{client.name}</p>
                <p className="text-[9px] text-gray-500">
                  {client.code || 'Sin código'} · {client.rut}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-5">
          <form
            onSubmit={handleNfcLookup}
            className="bg-cyber-card border border-cyber-border rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Nfc size={17} className="text-cyan-300" />
              <h3 className="text-white text-xs font-black font-mono uppercase">
                Consultar tarjeta NFC
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2">
              <select
                value={nfcMode}
                onChange={(event) =>
                  setNfcMode(event.target.value as 'uid' | 'public_token')
                }
                className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
              >
                <option value="uid">UID del lector</option>
                <option value="public_token">Token público</option>
              </select>
              <input
                value={nfcValue}
                onChange={(event) => setNfcValue(event.target.value)}
                placeholder="Acerca la tarjeta o escribe el código leído…"
                className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs font-mono"
                required
              />
              <button
                disabled={busy}
                className="px-5 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 text-xs font-bold disabled:opacity-40"
              >
                CONSULTAR
              </button>
            </div>
            <p className="text-[9px] text-gray-500">
              El navegador recibe el UID o token que entregue el lector. La tarjeta no contiene datos personales ni saldo.
            </p>
          </form>

          {!selectedClient ? (
            <div className="bg-cyber-card border border-cyber-border rounded-2xl p-12 text-center">
              <UserRound size={34} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-500 text-xs">
                Busca un cliente o consulta su tarjeta NFC para abrir el Bolsillo.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-5">
                  <p className="text-[9px] text-gray-500 uppercase font-mono">
                    Cliente seleccionado
                  </p>
                  <h3 className="text-white font-black text-lg mt-1">
                    {selectedClient.name}
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    {selectedClient.code || 'Sin código'} · {selectedClient.rut}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-cyber-pink/20 to-cyber-card border border-cyber-pink/30 rounded-2xl p-5">
                  <p className="text-[9px] text-gray-400 uppercase font-mono">
                    Saldo confirmado
                  </p>
                  <p className="text-2xl text-white font-black mt-2">
                    {loadingWallet ? '…' : money(wallet?.balance)}
                  </p>
                  <p className="text-[9px] text-gray-500 mt-1">
                    Estado: {wallet?.status || 'Sin consultar'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <form
                  onSubmit={handleTopup}
                  className="bg-cyber-card border border-cyber-border rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <BadgeDollarSign size={17} className="text-emerald-300" />
                    <h3 className="text-white text-xs font-black font-mono uppercase">
                      Recarga presencial
                    </h3>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white font-bold"
                    required
                  />
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as 'cash' | 'transfer' | 'card'
                      )
                    }
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                  <textarea
                    value={topupNotes}
                    onChange={(event) => setTopupNotes(event.target.value)}
                    placeholder="Observación o comprobante…"
                    className="w-full min-h-20 rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
                  />
                  <button
                    disabled={busy || wallet?.status !== 'active'}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-black font-black text-xs disabled:opacity-40"
                  >
                    DEPOSITAR
                  </button>
                  <p className="text-[9px] text-amber-200/80">
                    Requiere un único turno abierto del operador y se reflejará en su cierre.
                  </p>
                </form>

                <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <WalletCards size={17} className="text-cyan-300" />
                    <h3 className="text-white text-xs font-black font-mono uppercase">
                      Tarjetas vinculadas
                    </h3>
                  </div>
                  {cards.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No hay tarjetas vinculadas.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cards.map((card) => (
                        <div
                          key={card.id}
                          className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex justify-between gap-3"
                        >
                          <div>
                            <p className="text-white text-xs font-bold">
                              {card.label || 'Tarjeta Bolsillo'}
                            </p>
                            <p className="text-[9px] text-gray-500">
                              Estado: {card.status}
                            </p>
                            <p className="text-[9px] text-cyan-200 font-mono break-all">
                              Código: {card.public_token || card.id}
                            </p>
                          </div>
                          {isAdmin && card.status === 'active' && (
                            <button
                              onClick={() => handleBlockCard(card.id)}
                              disabled={busy}
                              className="p-2 rounded-lg border border-red-500/30 text-red-300"
                              title="Bloquear tarjeta"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="border-t border-slate-800 pt-3 space-y-2">
                      <input
                        value={newCardLabel}
                        onChange={(event) => setNewCardLabel(event.target.value)}
                        placeholder="Nombre de la tarjeta"
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleIssueCard}
                        disabled={
                          busy ||
                          nfcMode !== 'uid' ||
                          !nfcValue.trim() ||
                          cards.some((card) => card.status === 'active')
                        }
                        className="w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 text-xs font-bold disabled:opacity-40"
                      >
                        VINCULAR NUEVA TARJETA
                      </button>
                      <p className="text-[9px] text-gray-500">
                        Selecciona «UID del lector», lee la tarjeta y confirma que el código aparezca arriba. El UID se guarda únicamente como hash; el código interno permite identificar la vinculación.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-cyber-card border border-cyber-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                  <History size={16} className="text-cyber-pink" />
                  <h3 className="text-white text-xs font-black font-mono uppercase">
                    Movimientos del cliente
                  </h3>
                  <button
                    type="button"
                    onClick={handlePrintStatement}
                    className="ml-auto px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-gray-200 text-[10px] font-bold flex items-center gap-2"
                  >
                    <Printer size={14} />
                    IMPRIMIR ESTADO DE CUENTA
                  </button>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs">
                    No hay movimientos confirmados.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="p-4 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-white text-xs font-bold truncate">
                            {transaction.notes || transaction.kind}
                          </p>
                          <p className="text-[9px] text-gray-500">
                            {new Date(transaction.created_at).toLocaleString('es-CO')}
                            {transaction.operator_name
                              ? ` · ${transaction.operator_name}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
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
                          {isAdmin && !transaction.reversal_of && (
                            <button
                              onClick={() => setReverseId(transaction.id)}
                              className={`p-2 rounded-lg border ${
                                reverseId === transaction.id
                                  ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                                  : 'border-slate-700 text-gray-400'
                              }`}
                              title="Seleccionar para reversión"
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && reverseId && (
                <form
                  onSubmit={handleReverse}
                  className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 text-amber-200">
                    <KeyRound size={16} />
                    <h3 className="text-xs font-black font-mono uppercase">
                      Reversión administrativa auditada
                    </h3>
                  </div>
                  <textarea
                    value={reverseReason}
                    onChange={(event) => setReverseReason(event.target.value)}
                    placeholder="Explica detalladamente la razón de la reversión…"
                    className="w-full min-h-20 rounded-xl bg-slate-950 border border-slate-800 p-3 text-white text-xs"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReverseId('');
                        setReverseReason('');
                      }}
                      className="py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-gray-300 text-xs"
                    >
                      CANCELAR
                    </button>
                    <button
                      disabled={busy}
                      className="py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs disabled:opacity-40"
                    >
                      CONFIRMAR REVERSIÓN
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={16} className="text-cyber-pink" />
          <h3 className="text-white text-xs font-black font-mono uppercase">
            Resumen del turno
          </h3>
          <button
            onClick={() => token && loadShiftSummary(token)}
            className="ml-auto p-2 rounded-lg bg-slate-950 border border-slate-800 text-gray-300"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        {shiftSummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              ['Movimientos', shiftSummary.movement_count],
              ['Efectivo', money(shiftSummary.cash_topups)],
              ['Transferencia', money(shiftSummary.transfer_topups)],
              ['Tarjeta', money(shiftSummary.card_topups)],
              ['Compras', money(shiftSummary.wallet_purchases)],
              ['Créditos', money(shiftSummary.ledger_credits)],
              ['Débitos', money(shiftSummary.ledger_debits)]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <p className="text-[8px] text-gray-500 uppercase">{label}</p>
                <p className="text-white text-xs font-bold mt-1">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-200/80">
            No hay un único turno abierto para consultar. Las recargas presenciales permanecerán bloqueadas hasta abrir el turno.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100/80 flex gap-2">
        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
        <span>
          El saldo del Bolsillo es un medio contable. No sustituye controles legales, de identidad o de edad aplicables a productos o servicios restringidos.
        </span>
      </div>
    </div>
  );
}
