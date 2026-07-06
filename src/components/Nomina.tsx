import React, { useState } from 'react';
import { User, PayrollEntry, BusinessConfig } from '../types';
import {
  DollarSign, Plus, Trash2, Printer, X, Edit2,
  ChevronDown, User as UserIcon, Calendar, Check
} from 'lucide-react';

interface NominaProps {
  users: User[];
  payrollEntries: PayrollEntry[];
  config: BusinessConfig;
  currentUserName: string;
  onAddEntry: (e: PayrollEntry) => void;
  onUpdateEntry: (e: PayrollEntry) => void;
  onDeleteEntry: (id: string) => void;
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

function calcNet(entry: Omit<PayrollEntry, 'id' | 'createdAt' | 'createdBy'>): number {
  const ot = entry.overtimeHours * entry.overtimeRate;
  const bon = entry.bonuses.reduce((s, b) => s + b.amount, 0);
  const ded = entry.deductions.reduce((s, d) => s + d.amount, 0);
  return Math.max(0, entry.baseSalary + ot + bon - ded);
}

export default function Nomina({ users, payrollEntries, config, currentUserName, onAddEntry, onUpdateEntry, onDeleteEntry }: NominaProps) {
  const now = new Date();
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`);
  const [baseSalary, setBaseSalary] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [overtimeRate, setOvertimeRate] = useState(0);
  const [bonuses, setBonuses] = useState<{ concept: string; amount: number }[]>([]);
  const [deductions, setDeductions] = useState<{ concept: string; amount: number }[]>([]);
  const [paymentDate, setPaymentDate] = useState(now.toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const [printEntry, setPrintEntry] = useState<PayrollEntry | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const resetForm = () => {
    setBaseSalary(0); setOvertimeHours(0); setOvertimeRate(0);
    setBonuses([]); setDeductions([]); setNotes('');
    setPaymentDate(now.toISOString().split('T')[0]);
    setPaymentMethod('Transferencia');
    setEditing(null);
  };

  const loadEdit = (e: PayrollEntry) => {
    setEditing(e);
    setSelectedUserId(e.userId);
    setPeriod(e.period);
    setBaseSalary(e.baseSalary);
    setOvertimeHours(e.overtimeHours);
    setOvertimeRate(e.overtimeRate);
    setBonuses([...e.bonuses]);
    setDeductions([...e.deductions]);
    setPaymentDate(e.paymentDate);
    setPaymentMethod(e.paymentMethod);
    setNotes(e.notes || '');
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const u = users.find(x => x.id === selectedUserId);
    if (!u) return;
    const payload: PayrollEntry = {
      id: editing ? editing.id : `pay-${Date.now()}`,
      userId: u.id,
      userName: u.fullName,
      userRole: u.role,
      period,
      baseSalary,
      overtimeHours,
      overtimeRate,
      bonuses: bonuses.filter(b => b.concept && b.amount > 0),
      deductions: deductions.filter(d => d.concept && d.amount > 0),
      paymentDate,
      paymentMethod,
      notes,
      createdAt: editing ? editing.createdAt : new Date().toISOString(),
      createdBy: currentUserName
    };
    editing ? onUpdateEntry(payload) : onAddEntry(payload);
    resetForm();
  };

  const overtimeTotal = overtimeHours * overtimeRate;
  const totalBon = bonuses.reduce((s, b) => s + (b.amount || 0), 0);
  const totalDed = deductions.reduce((s, d) => s + (d.amount || 0), 0);
  const netSalary = Math.max(0, baseSalary + overtimeTotal + totalBon - totalDed);

  const filtered = payrollEntries
    .filter(e => (!filterUser || e.userId === filterUser) && (!filterPeriod || e.period === filterPeriod))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6" id="nomina-module">
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="text-cyber-green" /> MÓDULO DE NÓMINA
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Gestión de pagos a operadores: salarios, horas extras, bonificaciones y descuentos.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ── FORM ─── */}
        <div className="xl:col-span-5">
          <form onSubmit={handleSubmit} className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <p className="text-[10px] text-cyber-green font-bold uppercase">
                {editing ? '🔧 Editar Recibo' : '➕ Nuevo Recibo de Pago'}
              </p>
              {editing && <button type="button" onClick={resetForm} className="text-[9px] text-red-400 hover:underline cursor-pointer">Cancelar</button>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Empleado / Operador</label>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none">
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Período</label>
                <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Fecha de Pago</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Salario Base ($)</label>
                <input type="number" min={0} step={0.01} value={baseSalary} onChange={e => setBaseSalary(parseFloat(e.target.value) || 0)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Método de Pago</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none">
                  {['Transferencia','Efectivo','Cheque','Nequi','Daviplata'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Horas Extras</label>
                <input type="number" min={0} step={0.5} value={overtimeHours} onChange={e => setOvertimeHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Tarifa x Hora Extra ($)</label>
                <input type="number" min={0} step={0.01} value={overtimeRate} onChange={e => setOvertimeRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none" />
              </div>
            </div>

            {/* Bonuses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-gray-400 text-[10px] uppercase font-bold">Bonificaciones</label>
                <button type="button" onClick={() => setBonuses(p => [...p, { concept: '', amount: 0 }])}
                  className="text-[9px] text-cyber-green hover:underline flex items-center gap-1 cursor-pointer">
                  <Plus size={10} /> Agregar
                </button>
              </div>
              {bonuses.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input value={b.concept} onChange={e => setBonuses(p => p.map((x, j) => j === i ? { ...x, concept: e.target.value } : x))}
                    placeholder="Concepto..." className="flex-1 bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none" />
                  <input type="number" min={0} step={0.01} value={b.amount} onChange={e => setBonuses(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                    className="w-20 bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none" />
                  <button type="button" onClick={() => setBonuses(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 cursor-pointer"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            {/* Deductions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-gray-400 text-[10px] uppercase font-bold">Descuentos / Deducciones</label>
                <button type="button" onClick={() => setDeductions(p => [...p, { concept: '', amount: 0 }])}
                  className="text-[9px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <Plus size={10} /> Agregar
                </button>
              </div>
              {deductions.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input value={d.concept} onChange={e => setDeductions(p => p.map((x, j) => j === i ? { ...x, concept: e.target.value } : x))}
                    placeholder="Concepto..." className="flex-1 bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none" />
                  <input type="number" min={0} step={0.01} value={d.amount} onChange={e => setDeductions(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                    className="w-20 bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none" />
                  <button type="button" onClick={() => setDeductions(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 cursor-pointer"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-slate-950 border border-slate-900 rounded-lg p-3 space-y-1 text-[10px]">
              <div className="flex justify-between text-gray-400"><span>Salario Base</span><span>${baseSalary.toFixed(2)}</span></div>
              {overtimeTotal > 0 && <div className="flex justify-between text-cyan-400"><span>Horas Extras ({overtimeHours}h × ${overtimeRate})</span><span>+${overtimeTotal.toFixed(2)}</span></div>}
              {totalBon > 0 && <div className="flex justify-between text-cyber-green"><span>Total Bonificaciones</span><span>+${totalBon.toFixed(2)}</span></div>}
              {totalDed > 0 && <div className="flex justify-between text-red-400"><span>Total Deducciones</span><span>-${totalDed.toFixed(2)}</span></div>}
              <div className="flex justify-between font-extrabold text-white border-t border-slate-800 pt-1 text-[11px]"><span>NETO A PAGAR</span><span className="text-cyber-green">${netSalary.toFixed(2)}</span></div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Notas (opcional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none resize-none" />
            </div>

            <button type="submit" className="w-full bg-cyber-green text-black hover:bg-green-400 font-bold py-2.5 rounded-lg text-xs font-mono cursor-pointer transition-all">
              {editing ? '💾 Actualizar Recibo' : '✅ Generar Recibo de Pago'}
            </button>
          </form>
        </div>

        {/* ── HISTORY ─── */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none cursor-pointer">
              <option value="">Todos los empleados</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
            <input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
              className="bg-cyber-bg border border-cyber-border rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none" />
            {(filterUser || filterPeriod) && <button type="button" onClick={() => { setFilterUser(''); setFilterPeriod(''); }}
              className="text-[9px] text-gray-500 hover:text-white font-mono cursor-pointer">✕ Limpiar</button>}
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="bg-cyber-card border border-cyber-border rounded-xl p-10 text-center">
                <DollarSign size={28} className="mx-auto mb-2 text-gray-700" />
                <p className="text-gray-600 text-xs font-mono">Sin recibos de nómina registrados.</p>
              </div>
            ) : filtered.map(e => {
              const net = calcNet(e);
              return (
                <div key={e.id} className="bg-cyber-card border border-cyber-border rounded-xl p-4 text-xs font-mono space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{e.userName}</p>
                      <p className="text-[10px] text-gray-500">{e.userRole} · Período: {(() => { const [y, m] = e.period.split('-'); return `${MONTHS[parseInt(m)-1]} ${y}`; })()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-cyber-green">${net.toFixed(2)}</p>
                      <p className="text-[9px] text-gray-500">{e.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400">
                    <span>Base: <strong className="text-gray-200">${e.baseSalary.toFixed(2)}</strong></span>
                    {e.overtimeHours > 0 && <span>OT: <strong className="text-cyan-400">+${(e.overtimeHours * e.overtimeRate).toFixed(2)}</strong></span>}
                    {e.bonuses.length > 0 && <span>Bon: <strong className="text-cyber-green">+${e.bonuses.reduce((s,b)=>s+b.amount,0).toFixed(2)}</strong></span>}
                    {e.deductions.length > 0 && <span>Ded: <strong className="text-red-400">-${e.deductions.reduce((s,d)=>s+d.amount,0).toFixed(2)}</strong></span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPrintEntry(e)} className="flex items-center gap-1 text-[9px] bg-slate-900 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/40 text-gray-400 hover:text-cyan-400 px-2 py-1 rounded cursor-pointer transition-all">
                      <Printer size={10} /> Imprimir
                    </button>
                    <button onClick={() => loadEdit(e)} className="flex items-center gap-1 text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-gray-400 hover:text-white px-2 py-1 rounded cursor-pointer transition-all">
                      <Edit2 size={10} /> Editar
                    </button>
                    <button onClick={() => onDeleteEntry(e.id)} className="flex items-center gap-1 text-[9px] bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-500/30 text-gray-500 hover:text-red-400 px-2 py-1 rounded cursor-pointer transition-all">
                      <Trash2 size={10} /> Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PRINT MODAL ─── */}
      {printEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPrintEntry(null)}>
          <div className="bg-white text-black rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4 print:block" id="nomina-print">
              <div className="flex justify-between items-center no-print border-b pb-3">
                <h2 className="text-sm font-bold font-mono">RECIBO DE NÓMINA</h2>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer hover:bg-gray-700">
                    <Printer size={12} /> Imprimir
                  </button>
                  <button onClick={() => setPrintEntry(null)} className="text-gray-500 hover:text-black cursor-pointer"><X size={16} /></button>
                </div>
              </div>

              {/* Receipt */}
              <div className="text-center border-b pb-3">
                <h3 className="font-black text-base uppercase">{config.companyName}</h3>
                <p className="text-xs text-gray-600">NIT: {config.rut} | {config.phone}</p>
                <p className="text-xs text-gray-600">{config.address}</p>
                <p className="mt-1 font-bold text-sm uppercase">Comprobante de Pago de Nómina</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-b pb-3">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold">Empleado</p>
                  <p className="font-bold">{printEntry.userName}</p>
                  <p className="text-gray-600">{printEntry.userRole}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] uppercase font-bold">Período</p>
                  <p className="font-bold">{(() => { const [y, m] = printEntry.period.split('-'); return `${MONTHS[parseInt(m)-1]} ${y}`; })()}</p>
                  <p className="text-gray-600">Pago: {new Date(printEntry.paymentDate).toLocaleDateString('es-CO')}</p>
                  <p className="text-gray-600">Método: {printEntry.paymentMethod}</p>
                </div>
              </div>

              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-200">
                  <tr><td className="py-1.5 text-gray-600">Salario Base</td><td className="py-1.5 text-right font-bold">${printEntry.baseSalary.toFixed(2)}</td></tr>
                  {printEntry.overtimeHours > 0 && <tr><td className="py-1.5 text-gray-600">Horas Extras ({printEntry.overtimeHours}h × ${printEntry.overtimeRate})</td><td className="py-1.5 text-right font-bold text-blue-700">+${(printEntry.overtimeHours * printEntry.overtimeRate).toFixed(2)}</td></tr>}
                  {printEntry.bonuses.map((b, i) => <tr key={i}><td className="py-1 pl-3 text-gray-600">+ {b.concept}</td><td className="py-1 text-right text-green-700">+${b.amount.toFixed(2)}</td></tr>)}
                  {printEntry.deductions.map((d, i) => <tr key={i}><td className="py-1 pl-3 text-gray-600">- {d.concept}</td><td className="py-1 text-right text-red-700">-${d.amount.toFixed(2)}</td></tr>)}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black">
                    <td className="py-2 font-extrabold text-sm uppercase">NETO A PAGAR</td>
                    <td className="py-2 text-right font-extrabold text-sm">${calcNet(printEntry).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              {printEntry.notes && <p className="text-xs text-gray-500 border-t pt-2">Notas: {printEntry.notes}</p>}

              <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t">
                <div className="text-center">
                  <div className="border-t border-black mt-8 pt-1"></div>
                  <p className="text-[10px] text-gray-500">Firma Empleador / Administrador</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-black mt-8 pt-1"></div>
                  <p className="text-[10px] text-gray-500">Firma Empleado / Receptor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
