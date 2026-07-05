import React, { useState, useRef } from 'react';
import { Invoice, Client, BusinessConfig } from '../types';
import {
  FileText, Search, Printer, Ban, Eye, X, Calendar,
  ChevronDown, Filter, CheckCircle2, Clock, AlertCircle,
  Download, RotateCcw, Hash, User, CreditCard
} from 'lucide-react';

interface HistorialFacturasProps {
  invoices: Invoice[];
  clients: Client[];
  config: BusinessConfig;
  currentUserName: string;
  canAnular: boolean;
  canImprimir: boolean;
  onUpdateInvoice: (inv: Invoice) => void;
}

const STATUS_STYLE: Record<string, string> = {
  Pagado:   'bg-cyber-green/15 text-cyber-green border-cyber-green/30',
  Pendiente:'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Vencido:  'bg-red-500/15 text-red-400 border-red-500/30',
  Anulada:  'bg-gray-500/15 text-gray-400 border-gray-500/30'
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pagado:    <CheckCircle2 size={10} />,
  Pendiente: <Clock size={10} />,
  Vencido:   <AlertCircle size={10} />,
  Anulada:   <Ban size={10} />
};

export default function HistorialFacturas({
  invoices, clients, config, currentUserName,
  canAnular, canImprimir, onUpdateInvoice
}: HistorialFacturasProps) {

  // Filters
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterMethod, setFilterMethod] = useState('Todos');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  // Modals
  const [viewInvoice, setViewInvoice]   = useState<Invoice | null>(null);
  const [anulando, setAnulando]         = useState<Invoice | null>(null);
  const [anulReason, setAnulReason]     = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  // ── Filtering ─────────────────────────────────────────────
  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.clientRut.toLowerCase().includes(q) ||
      inv.cashierName?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Todos' || inv.paymentStatus === filterStatus;
    const matchMethod = filterMethod === 'Todos' || inv.paymentMethod === filterMethod;
    const invDate = inv.createdAt.split('T')[0];
    const matchFrom = !dateFrom || invDate >= dateFrom;
    const matchTo   = !dateTo   || invDate <= dateTo;
    return matchSearch && matchStatus && matchMethod && matchFrom && matchTo;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const paymentMethods = ['Todos', ...Array.from(new Set(invoices.map(i => i.paymentMethod).filter(Boolean)))];

  // ── Totals ────────────────────────────────────────────────
  const totalFiltered  = filtered.reduce((s, i) => s + (i.paymentStatus !== 'Anulada' ? i.total : 0), 0);
  const countAnuladas  = filtered.filter(i => i.paymentStatus === 'Anulada').length;

  // ── Reprint ───────────────────────────────────────────────
  const handleReprint = (inv: Invoice) => {
    setViewInvoice(inv);
    setTimeout(() => window.print(), 400);
  };

  // ── Anular ────────────────────────────────────────────────
  const handleAnular = () => {
    if (!anulando) return;
    onUpdateInvoice({
      ...anulando,
      paymentStatus: 'Anulada' as any,
      notes: `ANULADA por ${currentUserName} — ${anulReason || 'Sin motivo indicado'} — ${new Date().toLocaleString('es-CO')}`
    });
    setAnulando(null);
    setAnulReason('');
  };

  return (
    <div className="space-y-6 relative" id="historial-facturas-module">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="text-cyber-pink" />
          HISTORIAL DE FACTURAS Y REMISIONES
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Consulta, reimprima o anule cualquier comprobante emitido. Filtros por fecha, estado y método de pago.
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total registros', value: filtered.length,      color: 'text-white',       border: 'border-cyber-border' },
          { label: 'Monto neto',      value: `$${totalFiltered.toFixed(2)}`, color: 'text-cyber-green', border: 'border-cyber-green/30' },
          { label: 'Pagadas',         value: filtered.filter(i => i.paymentStatus === 'Pagado').length,  color: 'text-cyber-green', border: 'border-cyber-green/20' },
          { label: 'Anuladas',        value: countAnuladas,         color: 'text-gray-400',    border: 'border-gray-500/20' }
        ].map(s => (
          <div key={s.label} className={`bg-cyber-card border ${s.border} rounded-xl p-4`}>
            <p className="text-[10px] text-gray-500 font-mono uppercase">{s.label}</p>
            <p className={`text-2xl font-extrabold font-mono mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono">
          {/* Search */}
          <div className="lg:col-span-2 flex items-center gap-2 bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2">
            <Search size={13} className="text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por #, cliente, cajero..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none w-full"
            />
          </div>
          {/* Status */}
          <div className="flex items-center gap-1.5 bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2">
            <Filter size={11} className="text-gray-500" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-transparent text-gray-300 text-xs focus:outline-none w-full cursor-pointer">
              {['Todos','Pagado','Pendiente','Vencido','Anulada'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {/* Payment method */}
          <div className="flex items-center gap-1.5 bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2">
            <CreditCard size={11} className="text-gray-500" />
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
              className="bg-transparent text-gray-300 text-xs focus:outline-none w-full cursor-pointer">
              {paymentMethods.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2">
            <Calendar size={11} className="text-gray-500 shrink-0" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-gray-300 text-[10px] focus:outline-none w-full cursor-pointer" />
            <span className="text-gray-600">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-gray-300 text-[10px] focus:outline-none w-full cursor-pointer" />
          </div>
        </div>

        {/* Reset filters */}
        {(search || filterStatus !== 'Todos' || filterMethod !== 'Todos' || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setFilterStatus('Todos'); setFilterMethod('Todos'); setDateFrom(''); setDateTo(''); }}
            className="mt-2 flex items-center gap-1 text-[9px] text-gray-500 hover:text-cyber-pink font-mono cursor-pointer">
            <RotateCcw size={9} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-slate-950 border-b border-cyber-border">
              <tr>
                {['# Factura','Cliente','Fecha','Método','Total','Estado','Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-bold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-600 font-mono">
                    <FileText size={28} className="mx-auto mb-2 opacity-40" />
                    No se encontraron facturas con los filtros aplicados.
                  </td>
                </tr>
              ) : filtered.map(inv => (
                <tr key={inv.id}
                  className={`hover:bg-slate-900/30 transition-colors ${inv.paymentStatus === 'Anulada' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-bold text-cyber-pink whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-white font-semibold truncate">{inv.clientName}</p>
                    <p className="text-[10px] text-gray-500">{inv.clientRut}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {new Date(inv.createdAt).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{inv.paymentMethod}</td>
                  <td className="px-4 py-3 font-bold text-white whitespace-nowrap">${inv.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${STATUS_STYLE[inv.paymentStatus] || STATUS_STYLE.Pendiente}`}>
                      {STATUS_ICON[inv.paymentStatus]}
                      {inv.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Ver */}
                      <button onClick={() => setViewInvoice(inv)}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-gray-400 hover:text-white border border-slate-800 hover:border-cyber-pink/40 transition-all cursor-pointer">
                        <Eye size={12} />
                      </button>
                      {/* Reimprimir */}
                      {canImprimir && inv.paymentStatus !== 'Anulada' && (
                        <button onClick={() => handleReprint(inv)}
                          title="Reimprimir"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-gray-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer">
                          <Printer size={12} />
                        </button>
                      )}
                      {/* Anular */}
                      {canAnular && inv.paymentStatus !== 'Anulada' && (
                        <button onClick={() => { setAnulando(inv); setAnulReason(''); }}
                          title="Anular factura"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-slate-800 hover:border-red-500/40 transition-all cursor-pointer">
                          <Ban size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Ver Detalle ─────────────────────────────── */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-cyber-card border border-cyber-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Printable area */}
            <div ref={printRef} className="p-6 space-y-5 print:text-black print:bg-white">

              {/* Header modal */}
              <div className="flex justify-between items-start no-print">
                <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <FileText size={15} className="text-cyber-pink" />
                  COMPROBANTE #{viewInvoice.invoiceNumber}
                </h2>
                <div className="flex gap-2">
                  {canImprimir && viewInvoice.paymentStatus !== 'Anulada' && (
                    <button onClick={() => window.print()}
                      className="flex items-center gap-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono cursor-pointer">
                      <Printer size={11} /> Imprimir
                    </button>
                  )}
                  <button onClick={() => setViewInvoice(null)} className="text-gray-400 hover:text-white cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Invoice body — printable */}
              <div className="print:block">
                {/* Company header */}
                <div className="text-center border-b border-cyber-border pb-4 mb-4">
                  <h3 className="text-lg font-black text-white font-mono uppercase print:text-black">{config.companyName}</h3>
                  <p className="text-[10px] text-gray-400 font-mono print:text-gray-700">NIT: {config.rut} | {config.phone} | {config.email}</p>
                  <p className="text-[10px] text-gray-400 font-mono print:text-gray-700">{config.address}</p>
                  <div className="mt-2 inline-flex items-center gap-2 bg-cyber-pink/10 border border-cyber-pink/30 px-3 py-1 rounded-full print:bg-transparent print:border-black">
                    <span className="text-cyber-pink font-extrabold font-mono text-sm print:text-black">#{viewInvoice.invoiceNumber}</span>
                    <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${STATUS_STYLE[viewInvoice.paymentStatus]}`}>
                      {viewInvoice.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Client + dates grid */}
                <div className="grid grid-cols-2 gap-4 text-[11px] font-mono mb-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Cliente</p>
                    <p className="text-white font-bold print:text-black">{viewInvoice.clientName}</p>
                    <p className="text-gray-400 print:text-gray-700">Doc: {viewInvoice.clientRut}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Factura</p>
                    <p className="text-gray-300 print:text-gray-700">Fecha: {new Date(viewInvoice.createdAt).toLocaleDateString('es-CO')}</p>
                    <p className="text-gray-300 print:text-gray-700">Vence: {viewInvoice.dueDate || 'Contado'}</p>
                    <p className="text-gray-300 print:text-gray-700">Cajero: {viewInvoice.cashierName}</p>
                  </div>
                </div>

                {/* Items table */}
                <table className="w-full text-[11px] font-mono mb-4">
                  <thead className="bg-slate-950 print:bg-gray-100">
                    <tr>
                      {['Descripción','Cant.','Precio Unit.','IVA','Total'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[9px] text-gray-500 uppercase print:text-gray-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30">
                    {viewInvoice.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-white print:text-black">{item.productName}</td>
                        <td className="px-3 py-2 text-gray-300 print:text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-300 print:text-gray-700">${item.price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-300 print:text-gray-700">${item.taxAmount.toFixed(2)}</td>
                        <td className="px-3 py-2 font-bold text-white print:text-black">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="ml-auto w-48 space-y-1 text-[11px] font-mono border-t border-cyber-border pt-3">
                  <div className="flex justify-between text-gray-400 print:text-gray-700">
                    <span>Subtotal</span><span>${viewInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {viewInvoice.discount > 0 && (
                    <div className="flex justify-between text-cyber-green print:text-green-700">
                      <span>Descuento</span><span>-${viewInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400 print:text-gray-700">
                    <span>IVA ({viewInvoice.taxRate}%)</span><span>${viewInvoice.taxAmount.toFixed(2)}</span>
                  </div>
                  {viewInvoice.deliveryFee && viewInvoice.deliveryFee > 0 && (
                    <div className="flex justify-between text-gray-400 print:text-gray-700">
                      <span>Domicilio</span><span>${viewInvoice.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-white print:text-black border-t border-cyber-border pt-1.5">
                    <span>TOTAL</span><span className="text-cyber-pink print:text-black">${viewInvoice.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 print:text-gray-700 text-[10px]">
                    <span>Método</span><span>{viewInvoice.paymentMethod}</span>
                  </div>
                </div>

                {/* Notes / annulment */}
                {viewInvoice.notes && (
                  <div className="mt-4 bg-red-950/20 border border-red-500/20 rounded-lg p-3 text-[10px] text-red-300 font-mono print:text-red-700 print:border-red-400">
                    {viewInvoice.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Anular ──────────────────────────────────── */}
      {anulando && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-red-500/40 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Ban size={18} />
              <h2 className="font-bold font-mono text-sm uppercase">Anular Factura</h2>
            </div>
            <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3 text-[11px] font-mono space-y-1">
              <p className="text-gray-400">Factura: <span className="text-white font-bold">{anulando.invoiceNumber}</span></p>
              <p className="text-gray-400">Cliente: <span className="text-white">{anulando.clientName}</span></p>
              <p className="text-gray-400">Total: <span className="text-cyber-pink font-bold">${anulando.total.toFixed(2)}</span></p>
            </div>
            <p className="text-[10px] text-red-300 font-mono">
              Esta acción <strong>no se puede deshacer</strong>. La factura quedará marcada como ANULADA en el historial.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-mono">Motivo de anulación (opcional)</label>
              <textarea value={anulReason} onChange={e => setAnulReason(e.target.value)}
                rows={2} placeholder="Ej: Error en precio, duplicado, etc."
                className="w-full bg-cyber-bg border border-cyber-border rounded-lg p-2.5 text-white text-xs font-mono focus:outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setAnulando(null)}
                className="py-2.5 bg-slate-900 border border-slate-700 text-gray-400 rounded-lg text-xs font-bold font-mono cursor-pointer hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={handleAnular}
                className="py-2.5 bg-red-700 hover:bg-red-600 border border-red-500 text-white rounded-lg text-xs font-bold font-mono cursor-pointer transition-all flex items-center justify-center gap-1.5">
                <Ban size={12} /> Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
