import React, { useState } from 'react';
import { Shift, Invoice, Expense, User } from '../types';
import { 
  Key, 
  Lock, 
  Unlock, 
  DollarSign, 
  FileText, 
  TrendingUp, 
  ArrowDownCircle, 
  AlertCircle, 
  Printer, 
  Clock, 
  UserCheck, 
  ShieldAlert,
  X,
  CreditCard
} from 'lucide-react';

interface CajaJornadaProps {
  shifts: Shift[];
  invoices: Invoice[];
  expenses: Expense[];
  users: User[];
  currentUser: User;
  onOpenShift: (initialCash: number, user: string) => void;
  onCloseShift: (shiftId: string, actualCash: number, notes: string) => void;
}

export default function CajaJornada({
  shifts,
  invoices,
  expenses,
  users,
  currentUser,
  onOpenShift,
  onCloseShift
}: CajaJornadaProps) {
  
  // Find active shift
  const activeShift = shifts.find(s => s.status === 'Abierta');

  // Selected shift for audit detail report
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);

  // Opening form state
  const [initialCashInput, setInitialCashInput] = useState(200);
  const [selectedCashier, setSelectedCashier] = useState(currentUser.fullName);

  // Closing form state
  const [actualCashInput, setActualCashInput] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [showClosingModal, setShowClosingModal] = useState(false);

  // Form error
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter shifts to closed ones for history
  const closedShifts = shifts.filter(s => s.status === 'Cerrada');

  // Trigger opening shift
  const handleOpenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialCashInput < 0) {
      setErrorMsg("El fondo inicial no puede ser negativo.");
      return;
    }
    onOpenShift(parseFloat(initialCashInput.toString()), selectedCashier);
    setErrorMsg(null);
  };

  // Prepare closing modal
  const handlePrepareClosing = () => {
    if (!activeShift) return;
    setActualCashInput(activeShift.expectedCash); // default to expected to help them
    setClosingNotes('');
    setShowClosingModal(true);
  };

  // Trigger closing shift
  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    onCloseShift(activeShift.id, parseFloat(actualCashInput.toString()), closingNotes);
    setShowClosingModal(false);
    setErrorMsg(null);
  };

  // Get invoices processed during a specific shift
  const getShiftInvoices = (shiftUser: string, startTimeStr: string, endTimeStr?: string) => {
    const start = new Date(startTimeStr);
    const end = endTimeStr ? new Date(endTimeStr) : new Date();

    return invoices.filter(inv => {
      const invDate = new Date(inv.createdAt);
      return invDate >= start && invDate <= end && inv.cashierName === shiftUser;
    });
  };

  // Get expenses processed during a specific shift
  const getShiftExpenses = (shiftUser: string, startTimeStr: string, endTimeStr?: string) => {
    const start = new Date(startTimeStr);
    const end = endTimeStr ? new Date(endTimeStr) : new Date();

    return expenses.filter(exp => {
      const expDate = new Date(exp.createdAt);
      return expDate >= start && expDate <= end; // expenses affect the register overall
    });
  };

  return (
    <div className="space-y-6" id="shift-module">
      
      {/* Module Title */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Key className="text-cyber-pink" />
          APERTURA Y CIERRE DE JORNADA CONTABLE
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Arqueo de caja integrado, control de egresos e historial auditado de jornadas laborales.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: ACTIVE SESSION (7 cols) */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-5">
          
          {activeShift ? (
            // Active shift dashboard
            <div className="space-y-5">
              <div className="flex justify-between items-center bg-cyber-green/10 border border-cyber-green/30 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-cyber-green/20 p-2.5 rounded-lg text-cyber-green">
                    <Unlock size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                      JORNADA DE CAJA EN CURSO
                    </h2>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Iniciada el {new Date(activeShift.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <span className="text-[10px] font-mono font-bold bg-cyber-green text-black px-2.5 py-1 rounded">
                  SESIÓN ACTIVA
                </span>
              </div>

              {/* Cash Ledger Status Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-gray-500 uppercase block">Fondo Inicial</span>
                  <span className="text-sm font-bold text-white block mt-1">${activeShift.initialCash.toFixed(2)}</span>
                </div>
                
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-gray-500 uppercase block">Ventas Efectivo</span>
                  <span className="text-sm font-bold text-cyber-green block mt-1">+${activeShift.salesCash.toFixed(2)}</span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-gray-500 uppercase block">Gastos / Egresos</span>
                  <span className="text-sm font-bold text-cyber-pink block mt-1">-${activeShift.expensesTotal.toFixed(2)}</span>
                </div>

                <div className="bg-cyber-orange/10 p-3 rounded-lg border border-cyber-orange/20">
                  <span className="text-[9px] text-cyber-orange uppercase block font-bold">Caja Esperada</span>
                  <span className="text-sm font-extrabold text-cyber-orange block mt-1">${activeShift.expectedCash.toFixed(2)}</span>
                </div>
              </div>

              {/* Auditing stats breakdown by type */}
              <div className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  RESUMEN DE AUDITORÍA CONTABLE (TRANSACCIONES DE HOY)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-900 flex justify-between items-center">
                    <span className="text-gray-400">Despachos Efectivo:</span>
                    <span className="text-white font-bold">${activeShift.salesCash.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-900 flex justify-between items-center">
                    <span className="text-gray-400">Recaudos Tarjeta:</span>
                    <span className="text-cyber-blue font-bold">${activeShift.salesCard.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-900 flex justify-between items-center">
                    <span className="text-gray-400">Cartera de Crédito:</span>
                    <span className="text-cyber-pink font-bold">${activeShift.salesCredit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Items audited list */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  COMPROBANTES EMITIDOS EN ESTA JORNADA ({activeShift.user})
                </h3>
                
                <div className="bg-slate-950 rounded-xl border border-slate-900 max-h-48 overflow-y-auto divide-y divide-slate-900">
                  {getShiftInvoices(activeShift.user, activeShift.startTime).map(inv => (
                    <div key={inv.id} className="p-2.5 flex justify-between items-center text-[11px] font-mono">
                      <div>
                        <span className="font-bold text-white">{inv.invoiceNumber}</span>
                        <span className="text-gray-500 text-[10px] ml-2">{inv.clientName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">{inv.paymentMethod}</span>
                        <span className="text-white font-bold">${inv.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {getShiftInvoices(activeShift.user, activeShift.startTime).length === 0 && (
                    <div className="p-6 text-center text-gray-500 font-mono text-[10px]">
                      Aún no se registran comprobantes bajo este operador.
                    </div>
                  )}
                </div>
              </div>

              {/* Closing Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePrepareClosing}
                  className="w-full py-3 bg-cyber-pink hover:bg-cyber-accent text-black font-bold font-mono text-xs rounded-xl tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer neon-shadow-pink"
                >
                  <Lock size={15} /> Realizar Arqueo y Cerrar Jornada
                </button>
              </div>

            </div>
          ) : (
            // No shift is open - opening setup
            <div className="space-y-5">
              <div className="flex justify-between items-center bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/20 p-2.5 rounded-lg text-red-400">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                      SISTEMA DE CAJA CERRADO
                    </h2>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Aperture la jornada laboral antes de registrar ventas u operaciones.
                    </p>
                  </div>
                </div>
                
                <span className="text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded">
                  BLOQUEADO
                </span>
              </div>

              <form onSubmit={handleOpenSubmit} className="space-y-4 text-xs font-mono">
                <p className="text-xs text-cyber-pink font-bold uppercase tracking-wider border-b border-cyber-border pb-2">
                  PROTOCOLO DE APERTURA DE JORNADA
                </p>

                <div className="space-y-1">
                  <label className="text-gray-400 block uppercase text-[10px]">OPERADOR / CAJERO DE TURNO</label>
                  <select 
                    value={selectedCashier}
                    onChange={e => setSelectedCashier(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    {users.filter(u => u.status === 'Activo').map(user => (
                      <option key={user.id} value={user.fullName}>{user.fullName} ({user.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 block uppercase text-[10px]">FONDO DE CAJA INICIAL (SALDO FLOTANTE - USD)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={initialCashInput}
                      onChange={e => setInitialCashInput(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-bold text-sm focus:outline-none glow-border-pink pl-6"
                      required
                    />
                    <span className="absolute left-2.5 top-3 text-xs text-gray-500">$</span>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-normal">
                    Este valor representa el efectivo base en la gaveta física para vueltas y operaciones iniciales.
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-cyber-orange text-black hover:bg-orange-600 transition-all font-bold text-xs uppercase rounded-xl tracking-wider flex items-center justify-center gap-2 cursor-pointer neon-shadow-orange"
                >
                  <Unlock size={14} /> Desbloquear Caja y Aperturar Turno
                </button>
              </form>
            </div>
          )}

        </div>

        {/* RIGHT PANEL: HISTORICAL AUDITS (5 cols) */}
        <div className="lg:col-span-5 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3">
            <FileText size={14} className="text-cyber-pink" />
            HISTORIAL DE CIERRES AUDITADOS
          </h2>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {closedShifts.slice().reverse().map(shift => {
              const disc = shift.discrepancy || 0;
              return (
                <div 
                  key={shift.id}
                  onClick={() => setSelectedAuditShift(shift)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all space-y-2 text-[11px] font-mono ${
                    selectedAuditShift?.id === shift.id 
                      ? 'bg-slate-900 border-cyber-pink/50 neon-shadow-pink' 
                      : 'bg-slate-900/40 border-cyber-border hover:bg-slate-900/80 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-white uppercase block text-xs">{shift.user}</span>
                      <span className="text-[9px] text-gray-500 mt-1 block">
                        Cierre: {new Date(shift.endTime || '').toLocaleDateString()}
                      </span>
                    </div>
                    
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      disc === 0 
                        ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {disc === 0 ? 'Cuadrado' : `Diferencia: $${disc.toFixed(1)}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-400 border-t border-slate-800/60 pt-2">
                    <span>Efectivo Final: ${shift.actualCash?.toFixed(1)}</span>
                    <span className="text-cyber-pink">Total Ventas: ${(shift.salesCash + shift.salesCard + shift.salesCredit).toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
            
            {closedShifts.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-xs font-mono">
                No se registran actas de cierres anteriores en este terminal.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* OVERLAY / MODAL: AUDIT CLOSING ACT (Diferential count) */}
      {showClosingModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Lock size={15} className="text-cyber-pink animate-bounce" />
                ARQUEO CONTABLE DE CIERRE
              </h3>
              <button onClick={() => setShowClosingModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1.5">
              <div className="flex justify-between text-gray-400">
                <span>Fondo Inicial:</span>
                <span className="text-white font-bold">${activeShift.initialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Ventas en Efectivo:</span>
                <span className="text-cyber-green font-bold">+${activeShift.salesCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Gastos Registrados:</span>
                <span className="text-cyber-pink font-bold">-${activeShift.expensesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-cyber-orange font-bold border-t border-slate-800 pt-1.5 mt-1.5">
                <span>Saldo en Efectivo Esperado:</span>
                <span>${activeShift.expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">EFECTIVO FÍSICO CONTADO ($)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={actualCashInput}
                    onChange={e => setActualCashInput(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-bold text-sm focus:outline-none glow-border-pink pl-6"
                    required
                  />
                  <span className="absolute left-2.5 top-3 text-xs text-gray-500">$</span>
                </div>
              </div>

              {/* Discrepancy counter dynamic */}
              <div className="flex justify-between text-[11px] font-bold border-t border-b border-slate-800 py-2">
                <span className="text-gray-400">DIFERENCIA / DESCUADRE:</span>
                <span className={actualCashInput - activeShift.expectedCash === 0 ? 'text-cyber-green' : 'text-red-400'}>
                  ${(actualCashInput - activeShift.expectedCash).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Observaciones / Auditoría interna</label>
                <textarea 
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder="Justifique discrepancias o deje observaciones del turno..."
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs h-16 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowClosingModal(false)}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold font-mono"
                >
                  Cerrar Caja Definitivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL: DISPLAY SPECIFIC HISTORICAL SHIFT AUDIT SHEET */}
      {selectedAuditShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white text-black p-6 rounded-2xl max-w-md w-full font-mono text-xs shadow-2xl relative border-2 border-black print-card space-y-4">
            
            <div className="flex justify-between items-center border-b border-black pb-2 no-print">
              <span className="font-bold text-black uppercase">FICHA AUDITADA DE JORNADA</span>
              <button 
                onClick={() => setSelectedAuditShift(null)}
                className="text-gray-500 hover:text-black p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Print Layout Header */}
            <div className="text-center space-y-1 pb-4 border-b border-black">
              <h3 className="text-sm font-extrabold uppercase tracking-tight">ACTA DE ARQUEO Y AUDITORÍA CONTABLE</h3>
              <p className="text-[10px]">ORGANIZACIÓN: Rosa Fuerte Pero NO Tan Fucsia</p>
              <p className="text-[10px]">Cierre Nro: {selectedAuditShift.id}</p>
            </div>

            {/* Audit metrics table */}
            <div className="space-y-1.5 py-2 border-b border-black text-[11px]">
              <div className="flex justify-between">
                <span>OPERADOR / CAJERO:</span>
                <span className="font-bold uppercase">{selectedAuditShift.user}</span>
              </div>
              <div className="flex justify-between">
                <span>HORA INICIO:</span>
                <span>{new Date(selectedAuditShift.startTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>HORA CIERRE:</span>
                <span>{new Date(selectedAuditShift.endTime || '').toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-black pt-1.5 mt-1.5">
                <span>FONDO INICIAL CAJA:</span>
                <span>${selectedAuditShift.initialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-bold">
                <span>(+) RECAUDOS EFECTIVO:</span>
                <span>+${selectedAuditShift.salesCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold">
                <span>(-) GASTOS DEL TURNO:</span>
                <span>-${selectedAuditShift.expensesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-black pt-1 mt-1">
                <span>(=) SALDO EFECTIVO ESPERADO:</span>
                <span>${selectedAuditShift.expectedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-700">
                <span>(=) EFECTIVO FÍSICO ARQUEADO:</span>
                <span>${selectedAuditShift.actualCash?.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-extrabold text-xs border-t border-black pt-1 mt-1 ${
                (selectedAuditShift.discrepancy || 0) === 0 ? 'text-green-700' : 'text-red-600'
              }`}>
                <span>(=) DISCREPANCIA (SOBRANTE/FALTANTE):</span>
                <span>${(selectedAuditShift.discrepancy || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Cashier user actions details */}
            <div className="space-y-2 border-b border-black pb-3">
              <p className="font-bold uppercase text-[10px]">DETALLE DE COMPROBANTES EXPEDIDOS POR EL OPERADOR:</p>
              
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th>Factura</th>
                    <th>Adquiriente</th>
                    <th>Pago</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {getShiftInvoices(selectedAuditShift.user, selectedAuditShift.startTime, selectedAuditShift.endTime).map(inv => (
                    <tr key={inv.id}>
                      <td className="py-1 font-bold">{inv.invoiceNumber}</td>
                      <td className="py-1 truncate max-w-[120px]">{inv.clientName}</td>
                      <td className="py-1">{inv.paymentMethod}</td>
                      <td className="py-1 text-right font-bold">${inv.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {getShiftInvoices(selectedAuditShift.user, selectedAuditShift.startTime, selectedAuditShift.endTime).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-gray-500">
                        Ningún comprobante registrado bajo este operador.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Expenses section under this shift */}
            <div className="space-y-2 border-b border-black pb-3">
              <p className="font-bold uppercase text-[10px]">GASTOS DEDUCIDOS DE CAJA REGISTRADOS:</p>
              
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th>Categoría</th>
                    <th>Motivo</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {getShiftExpenses(selectedAuditShift.user, selectedAuditShift.startTime, selectedAuditShift.endTime).map(exp => (
                    <tr key={exp.id}>
                      <td className="py-1 font-bold">{exp.category}</td>
                      <td className="py-1 truncate max-w-[150px]">{exp.description}</td>
                      <td className="py-1 text-right font-bold">-${exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {getShiftExpenses(selectedAuditShift.user, selectedAuditShift.startTime, selectedAuditShift.endTime).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 text-center text-gray-500">
                        No se dedujeron gastos de caja en este turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Observations footer */}
            <div className="text-[10px] space-y-1">
              <span className="font-bold uppercase">Observaciones de Auditoría:</span>
              <p className="text-gray-600 bg-gray-100 p-2 rounded border leading-relaxed">
                {selectedAuditShift.notes || 'Arqueo de caja auditado de forma regular sin observaciones.'}
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-12 grid grid-cols-2 gap-4 text-center text-[10px]">
              <div>
                <div className="border-t border-black w-24 mx-auto"></div>
                <p className="mt-1 font-bold uppercase">{selectedAuditShift.user}</p>
                <p className="text-[8px] text-gray-500">Operador Cajero</p>
              </div>
              <div>
                <div className="border-t border-black w-24 mx-auto"></div>
                <p className="mt-1 font-bold">CONTROL CONTABLE</p>
                <p className="text-[8px] text-gray-500">Auditor Interno</p>
              </div>
            </div>

            {/* Action buttons inside overlay */}
            <div className="flex gap-2 pt-4 border-t border-gray-300 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-black text-white hover:bg-slate-900 p-2 rounded font-bold flex items-center justify-center gap-1 cursor-pointer font-mono"
              >
                <Printer size={13} /> Imprimir Acta
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditShift(null)}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 p-2 rounded font-bold flex items-center justify-center cursor-pointer font-mono"
              >
                Cerrar Acta
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
