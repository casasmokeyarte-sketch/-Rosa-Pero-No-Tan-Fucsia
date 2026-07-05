import React, { useState } from 'react';
import { Invoice, Client } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  Briefcase, 
  Search, 
  Send, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  PhoneCall, 
  MessageSquare,
  X,
  CreditCard
} from 'lucide-react';

interface CarteraProps {
  invoices: Invoice[];
  clients: Client[];
  onAddPayment: (invoiceId: string, amount: number) => void;
}

export default function Cartera({ 
  invoices, 
  clients, 
  onAddPayment 
}: CarteraProps) {
  
  // States
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Pendientes' | 'Vencidos' | 'Pagados'>('Pendientes');
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);

  // Installment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Filter credit invoices
  const creditInvoices = invoices.filter(inv => inv.paymentMethod === 'Crédito');

  // Compute status in real time to classify as overdue
  const getInvoiceWithRealStatus = (inv: Invoice): Invoice & { isOverdue: boolean } => {
    const today = new Date().toISOString().split('T')[0];
    const isPastDue = inv.dueDate < today && inv.paymentStatus !== 'Pagado';
    return {
      ...inv,
      isOverdue: isPastDue,
      paymentStatus: isPastDue ? 'Vencido' : inv.paymentStatus
    };
  };

  const processedInvoices = creditInvoices.map(getInvoiceWithRealStatus);

  // Apply search and status filters
  const filteredInvoices = processedInvoices.filter(inv => {
    const matchesSearch = inv.clientName.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.includes(search);
    
    if (filterStatus === 'Todos') return matchesSearch;
    if (filterStatus === 'Pendientes') return matchesSearch && inv.paymentStatus === 'Pendiente';
    if (filterStatus === 'Vencidos') return matchesSearch && inv.isOverdue;
    if (filterStatus === 'Pagados') return matchesSearch && inv.paymentStatus === 'Pagado';
    return matchesSearch;
  });

  // Calculate total outstanding credit in portfolio
  const totalOutstanding = clients.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const overdueTotal = processedInvoices
    .filter(inv => inv.isOverdue)
    .reduce((sum, inv) => sum + inv.total, 0);

  // Simulate Due Date Notification
  const handleTriggerNotification = (inv: Invoice) => {
    const client = clients.find(c => c.id === inv.clientId);
    const destEmail = client?.email || "suministros@cyberdyne.corp";
    const destPhone = client?.phone || "+57 (315) 888-2910";
    
    setNotifSuccess(`📧 NOTIFICACIÓN ENVIADA: Alerta de cobro automático para ${inv.invoiceNumber} enviada a ${destEmail} y Whatsapp ${destPhone}.`);
    
    // Auto clear notification banner after 5 seconds
    setTimeout(() => {
      setNotifSuccess(null);
    }, 6000);
  };

  // Open installment logger
  const openPaymentLog = (inv: Invoice) => {
    setActiveInvoice(inv);
    setPaymentAmount(inv.total); // default to pay in full
    setShowPaymentModal(true);
  };

  // Submit payment/installment
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || paymentAmount <= 0) return;

    onAddPayment(activeInvoice.id, parseFloat(paymentAmount.toString()));
    
    // Reset and close
    setShowPaymentModal(false);
    setActiveInvoice(null);
  };

  return (
    <div className="space-y-6" id="portfolio-module">
      
      {/* Banner / Header */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Briefcase className="text-cyber-pink" />
          CARTERA Y CUENTAS POR COBRAR (SISTEMA DE CRÉDITO)
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Auditoría de facturas a crédito, cobro de abonos, control de deudores y recordatorios automáticos de vencimiento.
        </p>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl font-mono relative overflow-hidden group">
          <span className="text-[9px] text-gray-500 uppercase">Cuentas por Cobrar Totales</span>
          <h3 className="text-2xl font-black text-white mt-1">${totalOutstanding.toFixed(2)}</h3>
          <p className="text-[9px] text-cyber-pink mt-1">Cartera comercial activa</p>
        </div>

        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl font-mono relative overflow-hidden group">
          <span className="text-[9px] text-gray-500 uppercase">Monto Total Vencido</span>
          <h3 className="text-2xl font-black text-red-400 mt-1">${overdueTotal.toFixed(2)}</h3>
          <p className="text-[9px] text-red-500/80 mt-1">Requiere gestión de cobro inmediata</p>
        </div>

        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl font-mono relative overflow-hidden group">
          <span className="text-[9px] text-gray-500 uppercase">Efectividad de Recaudo</span>
          <h3 className="text-2xl font-black text-cyber-green mt-1">
            {creditInvoices.length > 0 
              ? `${Math.round((creditInvoices.filter(i => i.paymentStatus === 'Pagado').length / creditInvoices.length) * 100)}%` 
              : '100%'}
          </h3>
          <p className="text-[9px] text-gray-500 mt-1">Proporción de facturas saldadas</p>
        </div>

      </div>

      {/* Notifications overlay if triggered */}
      {notifSuccess && (
        <div className="bg-cyber-orange/10 border border-cyber-orange/40 text-cyber-orange p-3.5 rounded-xl text-xs font-mono flex items-center justify-between gap-3 animate-pulse-once">
          <div className="flex items-center gap-2">
            <Send size={15} className="shrink-0 animate-bounce" />
            <span>{notifSuccess}</span>
          </div>
          <button onClick={() => setNotifSuccess(null)} className="text-gray-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filter and search panel */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-3">
        
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search size={14} />
          </div>
          <input 
            type="text"
            placeholder="Buscar por factura o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-cyber-bg border border-cyber-border text-white text-xs pl-9 pr-3 py-2 rounded-lg w-full focus:outline-none glow-border-pink"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1 overflow-x-auto w-full md:w-auto font-mono text-[10px]">
          {(['Todos', 'Pendientes', 'Vencidos', 'Pagados'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg border shrink-0 transition-all ${
                filterStatus === status 
                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink' 
                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

      </div>

      {/* Portfolio Ledger Table */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-cyber-border text-gray-400 uppercase text-[10px] font-bold">
              <th className="py-3">Factura</th>
              <th className="py-3">Cliente / Deudor</th>
              <th className="py-3">Fecha Emisión</th>
              <th className="py-3">Vencimiento</th>
              <th className="py-3 text-right">Monto Total</th>
              <th className="py-3 text-center">Estado</th>
              <th className="py-3 text-right">Gestiones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-gray-300">
            {filteredInvoices.map(inv => {
              const isPending = inv.paymentStatus !== 'Pagado';
              return (
                <tr key={inv.id} className="hover:bg-slate-900/35">
                  <td className="py-4 font-bold text-white">{inv.invoiceNumber}</td>
                  <td className="py-4">
                    <span className="font-sans font-semibold text-white block">{inv.clientName}</span>
                    <span className="text-[10px] text-gray-500">RUT: {inv.clientRut}</span>
                  </td>
                  <td className="py-4 text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className={`py-4 font-bold ${inv.isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                    {inv.dueDate}
                  </td>
                  <td className="py-4 text-right font-bold text-white">${inv.total.toFixed(2)}</td>
                  <td className="py-4 text-center">
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${
                      inv.paymentStatus === 'Pagado' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                      inv.isOverdue ? 'bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse' :
                      'bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/20'
                    }`}>
                      {inv.isOverdue ? 'Vencida' : inv.paymentStatus}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {isPending ? (
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleTriggerNotification(inv)}
                          title="Enviar alerta automática de vencimiento"
                          className="bg-slate-900 hover:bg-slate-800 text-cyber-orange hover:text-white border border-slate-800 hover:border-cyber-orange/40 p-1.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Send size={11} /> Recordatorio
                        </button>
                        <button
                          onClick={() => openPaymentLog(inv)}
                          className="bg-cyber-pink/10 hover:bg-cyber-pink text-cyber-pink hover:text-black border border-cyber-pink/20 p-1.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <DollarSign size={11} /> Cobrar
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-[10px] italic">Liquidada</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 px-4">
                  <CyberEmpty 
                    title="Cartera de Crédito Vacía" 
                    description="No se han localizado facturas pendientes que cumplan con los filtros de búsqueda." 
                    icon={Briefcase}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Register payment on credit / installment */}
      {showPaymentModal && activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <CreditCard size={15} className="text-cyber-pink" />
                REGISTRAR RECAUDO / ABONO
              </h3>
              <button onClick={() => { setShowPaymentModal(false); setActiveInvoice(null); }} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Comprobante:</span>
                <span className="text-white font-bold">{activeInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cliente Deudor:</span>
                <span className="text-white font-bold">{activeInvoice.clientName}</span>
              </div>
              <div className="flex justify-between text-cyber-pink font-bold border-t border-slate-800 pt-1.5 mt-1.5">
                <span>Saldo Pendiente de Cobro:</span>
                <span>${activeInvoice.total.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Monto del Recaudo a Registrar ($)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(Math.min(activeInvoice.total, Math.max(1, parseFloat(e.target.value) || 0)))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-bold text-sm focus:outline-none glow-border-pink pl-6"
                    required
                  />
                  <span className="absolute left-2.5 top-3 text-xs text-gray-500">$</span>
                </div>
                <p className="text-[9px] text-gray-500 leading-normal">
                  Puede ser un abono parcial o el pago total (${activeInvoice.total.toFixed(2)}) del saldo comercial.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowPaymentModal(false); setActiveInvoice(null); }}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold"
                >
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
