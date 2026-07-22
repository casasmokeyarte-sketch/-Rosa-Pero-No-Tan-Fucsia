import React, { useState } from 'react';
import { Shift, Invoice, Expense, User } from '../types';
import { 
  FileText, 
  Calendar, 
  Clock, 
  DollarSign, 
  AlertCircle, 
  X, 
  Printer, 
  Download, 
  TrendingUp, 
  ArrowDownCircle, 
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface HistorialCierresProps {
  shifts: Shift[];
  invoices: Invoice[];
  expenses: Expense[];
  users: User[];
}

export default function HistorialCierres({
  shifts,
  invoices,
  expenses,
  users
}: HistorialCierresProps) {
  
  // Filter states
  const [cashierFilter, setCashierFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Cerrada'); // Default to closed, but can view open too
  const [searchDate, setSearchDate] = useState<string>('');
  
  // Selected shift for audit detail report
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Filter shifts based on selections
  const filteredShifts = shifts.filter(s => {
    const matchesCashier = cashierFilter === 'Todos' || s.user === cashierFilter;
    const matchesStatus = statusFilter === 'Todos' || s.status === statusFilter;
    const matchesDate = !searchDate || s.startTime.includes(searchDate) || (s.endTime && s.endTime.includes(searchDate));
    return matchesCashier && matchesStatus && matchesDate;
  });

  // Get invoices processed during a specific shift
  const getShiftInvoices = (shiftUser: string, startTimeStr: string, endTimeStr?: string) => {
    const start = new Date(startTimeStr);
    const end = endTimeStr ? new Date(endTimeStr) : new Date();

    return invoices.filter(inv => {
      const invDate = new Date(inv.createdAt);
      const withinTime = invDate >= start && invDate <= end;
      if (!withinTime) return false;
      return (
        inv.cashierName === shiftUser ||
        inv.cashierName === 'Portal Online' ||
        (inv.invoiceNumber && inv.invoiceNumber.startsWith('WEB-'))
      );
    });
  };

  // Get expenses processed during a specific shift
  const getShiftExpenses = (shiftUser: string, startTimeStr: string, endTimeStr?: string) => {
    const start = new Date(startTimeStr);
    const end = endTimeStr ? new Date(endTimeStr) : new Date();

    return expenses.filter(exp => {
      const expDate = new Date(exp.createdAt);
      return expDate >= start && expDate <= end && exp.cashierName === shiftUser;
    });
  };

  // Stats calculators
  const totalShifts = shifts.filter(s => s.status === 'Cerrada').length;
  const totalInvoicesSum = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalExpensesSum = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalDiscrepancies = shifts
    .filter(s => s.status === 'Cerrada' && s.discrepancy !== undefined)
    .reduce((sum, s) => sum + Math.abs(s.discrepancy || 0), 0);

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Export selected shift to CSV format
  const handleExportCSV = (shift: Shift) => {
    const sInvoices = getShiftInvoices(shift.user, shift.startTime, shift.endTime);
    const sExpenses = getShiftExpenses(shift.user, shift.startTime, shift.endTime);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header
    csvContent += `ACTA DE ARQUEO Y AUDITORÍA CONTABLE\n`;
    csvContent += `Shift ID,${shift.id}\n`;
    csvContent += `Cajero,${shift.user}\n`;
    csvContent += `Inicio,${new Date(shift.startTime).toLocaleString()}\n`;
    csvContent += `Cierre,${shift.endTime ? new Date(shift.endTime).toLocaleString() : "N/A"}\n`;
    csvContent += `Fondo Inicial,${shift.initialCash}\n`;
    csvContent += `Ventas Efectivo,${shift.salesCash}\n`;
    csvContent += `Ventas Tarjeta,${shift.salesCard}\n`;
    csvContent += `Ventas Credito,${shift.salesCredit}\n`;
    csvContent += `Gastos Turno,${shift.expensesTotal}\n`;
    csvContent += `Esperado,${shift.expectedCash}\n`;
    csvContent += `Efectivo Fisico,${shift.actualCash || 0}\n`;
    csvContent += `Diferencia,${shift.discrepancy || 0}\n`;
    csvContent += `Notas,"${shift.notes || ''}"\n\n`;
    
    // Invoices list
    csvContent += `COMPROBANTES EMITIDOS\n`;
    csvContent += `Factura,Cliente,Metodo,Monto,Fecha\n`;
    sInvoices.forEach(inv => {
      csvContent += `${inv.invoiceNumber},"${inv.clientName}",${inv.paymentMethod},${inv.total},${new Date(inv.createdAt).toLocaleString()}\n`;
    });
    
    csvContent += `\nGASTOS DEDUCIDOS\n`;
    csvContent += `Categoria,Motivo,Monto,Fecha\n`;
    sExpenses.forEach(exp => {
      csvContent += `${exp.category},"${exp.description}",${exp.amount},${new Date(exp.createdAt).toLocaleString()}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `Arqueo_Jornada_${shift.id}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6" id="shifts-history-module">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-cyber-card border border-cyber-border rounded-xl p-5 no-print">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-cyber-orange" />
            HISTORIAL DE JORNADAS Y CIERRES DE CAJA
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Bitácora de arqueos, balances de ventas por operador, auditoría de descuadres y reporte para contabilidad fiscal.
          </p>
        </div>

        <button 
          onClick={handlePrint}
          className="bg-slate-900 text-gray-300 hover:text-white border border-cyber-border text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
        >
          <Printer size={15} /> Imprimir Todo el Historial
        </button>
      </div>

      {/* 2. Stats Summary Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        
        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-gray-400 uppercase">Jornadas Cerradas</p>
            <h3 className="text-2xl font-bold font-mono text-white mt-1">{totalShifts}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyber-pink/10 flex items-center justify-center border border-cyber-pink/20">
            <FileText size={18} className="text-cyber-pink" />
          </div>
        </div>

        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-gray-400 uppercase">Total Ventas Registradas</p>
            <h3 className="text-2xl font-bold font-mono text-cyber-green mt-1">${totalInvoicesSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyber-green/10 flex items-center justify-center border border-cyber-green/20">
            <TrendingUp size={18} className="text-cyber-green" />
          </div>
        </div>

        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-gray-400 uppercase">Fuga por Gastos Caja</p>
            <h3 className="text-2xl font-bold font-mono text-cyber-orange mt-1">-${totalExpensesSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyber-orange/10 flex items-center justify-center border border-cyber-orange/20">
            <ArrowDownCircle size={18} className="text-cyber-orange" />
          </div>
        </div>

        <div className="bg-cyber-card border border-cyber-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-gray-400 uppercase">Desviación en Caja</p>
            <h3 className="text-2xl font-bold font-mono text-red-400 mt-1">${totalDiscrepancies.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertCircle size={18} className="text-red-400 animate-pulse" />
          </div>
        </div>

      </div>

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Shift list & search filter controls */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4 no-print">
          
          <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            
            {/* Cashier filter */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-gray-400 uppercase text-[10px]">Cajero:</span>
              <select 
                value={cashierFilter} 
                onChange={e => setCashierFilter(e.target.value)}
                className="bg-cyber-bg border border-cyber-border p-1.5 rounded text-white text-xs font-mono focus:outline-none"
              >
                <option value="Todos">Todos</option>
                {[...new Set(shifts.map(s => s.user))].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-gray-400 uppercase text-[10px]">Estado:</span>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-cyber-bg border border-cyber-border p-1.5 rounded text-white text-xs font-mono focus:outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Abierta">Abierta (En Curso)</option>
                <option value="Cerrada">Cerrada (Auditado)</option>
              </select>
            </div>

            {/* Date Search */}
            <div className="relative">
              <input 
                type="date"
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="bg-cyber-bg border border-cyber-border text-white text-xs font-mono p-1.5 rounded focus:outline-none glow-border-pink"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {filteredShifts.slice().reverse().map(shift => {
              const disc = shift.discrepancy || 0;
              const isSelected = selectedShift?.id === shift.id;
              
              return (
                <div 
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 font-mono text-xs ${
                    isSelected 
                      ? 'bg-slate-900 border-cyber-orange/60 neon-shadow-orange' 
                      : 'bg-slate-900/30 border-cyber-border hover:bg-slate-900/70 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white uppercase text-sm">{shift.user}</span>
                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                          shift.status === 'Abierta' 
                            ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                            : 'bg-slate-800 text-gray-400'
                        }`}>
                          {shift.status === 'Abierta' ? 'En Curso' : 'Cerrada'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        ID: {shift.id} • Iniciada: {new Date(shift.startTime).toLocaleString()}
                      </span>
                    </div>

                    {shift.status === 'Cerrada' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        disc === 0 
                          ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {disc === 0 ? (
                          <>
                            <CheckCircle2 size={12} /> Cuadrado
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={12} /> Descuadre: ${disc.toFixed(2)}
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-black/40 p-2.5 rounded-lg text-[11px] border border-slate-900">
                    <div>
                      <p className="text-gray-500 text-[9px] uppercase">Inicial</p>
                      <p className="text-white font-bold">${shift.initialCash.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[9px] uppercase">Total Ventas</p>
                      <p className="text-cyber-green font-bold">
                        ${(shift.salesCash + shift.salesCard + shift.salesCredit).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-[9px] uppercase">Gastos</p>
                      <p className="text-cyber-pink font-bold">-${shift.expensesTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  {shift.endTime && (
                    <p className="text-[10px] text-gray-400">
                      ⌛ Cierre: {new Date(shift.endTime).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}

            {filteredShifts.length === 0 && (
              <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl py-16 text-center text-xs text-gray-500">
                Ninguna jornada coincide con los criterios de búsqueda seleccionados.
              </div>
            )}
          </div>
        </div>

        {/* Right column: Selected shift accounting details */}
        <div className="lg:col-span-5 space-y-4">
          {selectedShift ? (
            <div className="bg-white text-black p-6 rounded-2xl font-mono text-xs shadow-2xl relative border-2 border-black print-card space-y-4">
              
              <div className="flex justify-between items-center border-b border-black pb-2 no-print">
                <span className="font-extrabold text-black uppercase text-xs tracking-wider">REPORTE DE AUDITORÍA CONTABLE</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => handleExportCSV(selectedShift)}
                    className="text-gray-700 hover:text-black p-1.5 border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                    title="Exportar acta a CSV"
                  >
                    <Download size={13} />
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="text-gray-700 hover:text-black p-1.5 border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                    title="Imprimir acta"
                  >
                    <Printer size={13} />
                  </button>
                  <button 
                    onClick={() => setSelectedShift(null)}
                    className="text-gray-500 hover:text-black p-1.5 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Print layout header */}
              <div className="text-center space-y-1 pb-4 border-b border-black">
                <h3 className="text-sm font-extrabold uppercase tracking-tight">ACTA DE ARQUEO Y CIERRE CONTABLE</h3>
                <p className="text-[10px]">Cierre ID: {selectedShift.id}</p>
                <p className="text-[10px]">Operado por: {selectedShift.user.toUpperCase()}</p>
              </div>

              {/* Financial metrics list */}
              <div className="space-y-1.5 py-2 border-b border-black text-[11px]">
                <div className="flex justify-between">
                  <span>INICIADO EL:</span>
                  <span>{new Date(selectedShift.startTime).toLocaleString()}</span>
                </div>
                {selectedShift.endTime && (
                  <div className="flex justify-between">
                    <span>FINALIZADO EL:</span>
                    <span>{new Date(selectedShift.endTime).toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold border-t border-black pt-1.5 mt-1.5">
                  <span>FONDO EN EFECTIVO INICIAL:</span>
                  <span>${selectedShift.initialCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-700 font-bold">
                  <span>(+) RECAUDADO EN EFECTIVO:</span>
                  <span>+${selectedShift.salesCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>(-) GASTOS DEL TURNO:</span>
                  <span>-${selectedShift.expensesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-black pt-1 mt-1">
                  <span>(=) SALDO EFECTIVO ESPERADO:</span>
                  <span>${selectedShift.expectedCash.toFixed(2)}</span>
                </div>
                
                {selectedShift.status === 'Cerrada' && (
                  <>
                    <div className="flex justify-between font-bold text-blue-800">
                      <span>(=) EFECTIVO FÍSICO ARQUEADO:</span>
                      <span>${selectedShift.actualCash?.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between font-extrabold text-xs border-t border-black pt-1.5 mt-1.5 ${
                      (selectedShift.discrepancy || 0) === 0 ? 'text-green-700' : 'text-red-600'
                    }`}>
                      <span>(=) DISCREPANCIA (SOBRANTE/FALTANTE):</span>
                      <span>${(selectedShift.discrepancy || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Custom payment details */}
              <div className="space-y-1 py-2 border-b border-black text-[11px]">
                <p className="font-extrabold uppercase text-[10px]">VENTAS ADICIONALES (OTRO MEDIO):</p>
                <div className="flex justify-between">
                  <span>Tarjeta (Débito/Crédito):</span>
                  <span>${selectedShift.salesCard.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ventas a Crédito (Cartera):</span>
                  <span>${selectedShift.salesCredit.toFixed(2)}</span>
                </div>
              </div>

              {/* Transactions list details */}
              <div className="space-y-2 border-b border-black pb-3">
                <p className="font-extrabold uppercase text-[10px]">DETALLE DE COMPROBANTES EMITIDOS ({getShiftInvoices(selectedShift.user, selectedShift.startTime, selectedShift.endTime).length}):</p>
                
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th>Comprobante</th>
                      <th>Adquiriente</th>
                      <th>Pago</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getShiftInvoices(selectedShift.user, selectedShift.startTime, selectedShift.endTime).map(inv => {
                      const isWeb = inv.cashierName === 'Portal Online' || inv.invoiceNumber.startsWith('WEB-');
                      return (
                        <tr key={inv.id}>
                          <td className="py-0.5 font-bold">
                            {inv.invoiceNumber}
                            {isWeb && (
                              <span className="text-[8px] bg-slate-100 text-slate-800 border border-slate-300 px-1 rounded ml-1 font-sans print:border-black print:bg-white">WEB</span>
                            )}
                          </td>
                          <td className="py-0.5 truncate max-w-[100px]">{inv.clientName}</td>
                          <td className="py-0.5">{inv.paymentMethod}</td>
                          <td className="py-0.5 text-right font-bold">${inv.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {getShiftInvoices(selectedShift.user, selectedShift.startTime, selectedShift.endTime).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-center text-gray-400">
                          Sin comprobantes en esta jornada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Expenses detail list */}
              <div className="space-y-2 pb-1">
                <p className="font-extrabold uppercase text-[10px]">DETALLE DE GASTOS REGISTRADOS ({getShiftExpenses(selectedShift.user, selectedShift.startTime, selectedShift.endTime).length}):</p>
                
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th>Categoría</th>
                      <th>Motivo</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getShiftExpenses(selectedShift.user, selectedShift.startTime, selectedShift.endTime).map(exp => (
                      <tr key={exp.id}>
                        <td className="py-0.5 font-bold">{exp.category}</td>
                        <td className="py-0.5 truncate max-w-[120px]">{exp.description}</td>
                        <td className="py-0.5 text-right font-bold">-${exp.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                    {getShiftExpenses(selectedShift.user, selectedShift.startTime, selectedShift.endTime).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-2 text-center text-gray-400">
                          Sin egresos durante este turno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedShift.notes && (
                <div className="bg-gray-100 p-2.5 rounded border border-gray-300 text-[10px]">
                  <p className="font-bold uppercase text-[9px] text-gray-600 mb-0.5">OBSERVACIONES DE AUDITORÍA:</p>
                  <p className="italic text-gray-800">{selectedShift.notes}</p>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-cyber-card/40 border border-cyber-border rounded-xl py-32 text-center text-gray-400 text-xs font-mono px-5 no-print">
              💡 SELECCIONE UNA JORNADA del listado histórico para desplegar su ACTA DE ARQUEO y AUDITORÍA CONTABLE COMPLETA.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
