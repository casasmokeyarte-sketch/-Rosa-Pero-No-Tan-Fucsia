import React, { useState } from 'react';
import { Expense, Shift, BusinessConfig } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  ArrowDownCircle, 
  PlusCircle, 
  Trash2, 
  AlertTriangle, 
  X, 
  DollarSign,
  Briefcase
} from 'lucide-react';

interface GastosProps {
  expenses: Expense[];
  shifts: Shift[];
  currentUser: any;
  config?: BusinessConfig;
  onAddExpense: (expense: Expense) => void;
}

export default function Gastos({ 
  expenses, 
  shifts, 
  currentUser,
  config,
  onAddExpense 
}: GastosProps) {
  
  // Find if shift is open
  const activeShift = shifts.find(s => s.status === 'Abierta');

  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState(() => config?.productCategories?.[0] || 'Suministros');
  const [amount, setAmount] = useState(10);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(() => config?.paymentMethods?.[0] || 'Efectivo');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Submit expense
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeShift) {
      setErrorMsg("⚠️ CAJA BLOQUEADA: No se pueden asentar gastos sin antes APERURAR LA JORNADA de caja.");
      return;
    }

    if (amount <= 0) {
      setErrorMsg("El monto del egreso debe ser superior a cero.");
      return;
    }

    if (paymentMethod === 'Efectivo' && amount > activeShift.expectedCash) {
      setErrorMsg(`⚠️ CAJA INSUFICIENTE: El gasto supera el saldo en caja disponible ($${activeShift.expectedCash.toFixed(2)}).`);
      return;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      category,
      amount: parseFloat(amount.toString()) || 0,
      description,
      paymentMethod,
      createdAt: new Date().toISOString(),
      cashierName: currentUser.fullName
    };

    onAddExpense(newExpense);

    // Reset and close
    setCategory('Suministros');
    setAmount(10);
    setDescription('');
    setPaymentMethod('Efectivo');
    setErrorMsg(null);
    setShowAddModal(false);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6" id="expenses-module">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-cyber-card border border-cyber-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowDownCircle className="text-cyber-pink" />
            REGISTRO DE GASTOS Y SALIDAS DE CAJA (EGRESOS)
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Registro de egresos corrientes que impactan la liquidación final de la jornada de caja.
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer neon-shadow-pink shrink-0"
        >
          <PlusCircle size={15} /> Asentar Egreso
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Live expenses logs list (8 cols) */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-cyber-border pb-3">
            <h2 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
              BITÁCORA DE EGRESOS DE CAJA GENERAL
            </h2>
            <span className="text-xs font-mono text-cyber-pink font-bold bg-cyber-pink/5 border border-cyber-pink/15 px-2.5 py-0.5 rounded">
              Total Egresos: ${totalExpenses.toFixed(2)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-cyber-border text-gray-400 uppercase text-[9px]">
                  <th className="py-2">Egreso SKU</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Justificación / Descripción</th>
                  <th className="py-2">Método</th>
                  <th className="py-2">Fecha / Operador</th>
                  <th className="py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-gray-300">
                {expenses.slice().reverse().map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-900/30">
                    <td className="py-3.5 font-bold text-cyber-pink">{exp.id.split('-')[1] || exp.id}</td>
                    <td className="py-3.5 font-sans font-semibold text-white">{exp.category}</td>
                    <td className="py-3.5 text-gray-400 max-w-[200px] truncate" title={exp.description}>
                      {exp.description}
                    </td>
                    <td className="py-3.5 text-gray-400">{exp.paymentMethod}</td>
                    <td className="py-3.5 text-gray-500 text-[10px]">
                      <div>{new Date(exp.createdAt).toLocaleString()}</div>
                      <div className="uppercase mt-0.5">{exp.cashierName}</div>
                    </td>
                    <td className="py-3.5 text-right font-extrabold text-white">
                      -${exp.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4">
                      <CyberEmpty 
                        title="Bandeja de Gastos Vacía" 
                        description="Aún no se han registrado egresos o salidas de efectivo durante la jornada actual." 
                        icon={ArrowDownCircle}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Rules and Guidelines (4 cols) */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3">
            <AlertTriangle size={14} className="text-cyber-orange" />
            DIRECTIVAS OPERATIVAS DE EGRESOS
          </h2>
          
          <div className="text-xs text-gray-400 space-y-3 font-sans leading-relaxed">
            <p>
              1. Todo egreso asentado en efectivo será restado en tiempo real del saldo esperado en gaveta para la jornada contable.
            </p>
            <p>
              2. Compruebe la disponibilidad física de fondos antes de autorizar cualquier compra menor o recarga logística.
            </p>
            <p>
              3. Queda estrictamente prohibido realizar retiros sin ingresar la descripción detallada y el operador responsable.
            </p>
            {activeShift ? (
              <div className="bg-cyber-green/10 border border-cyber-green/20 p-3 rounded-lg text-[11px] font-mono text-cyber-green">
                CAJA DISPONIBLE PARA EGRESOS: ${activeShift.expectedCash.toFixed(2)}
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-[11px] font-mono text-red-400">
                CAJA CERRADA - EGRESOS INHABILITADOS
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: Add Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <ArrowDownCircle size={16} className="text-cyber-pink" />
                ASENTAR EGRESO DE CAJA
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Categoría de Egreso</label>
                <select 
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                >
                  {(config?.productCategories || ["Suministros", "Combustible", "Mantenimiento", "Viáticos", "Papelería", "Otros"]).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Monto a retirar ($)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={amount}
                    onChange={e => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-bold text-sm focus:outline-none glow-border-pink pl-6"
                    required
                  />
                  <span className="absolute left-2.5 top-3 text-xs text-gray-500">$</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Medio de Pago</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                >
                  {(config?.paymentMethods || ["Efectivo", "Tarjeta"]).map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px] block">Justificación detallada del egreso</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Escriba motivo, placa del vehículo, o repuesto adquirido..."
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs h-16 focus:outline-none glow-border-pink"
                  required
                />
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg text-red-400 text-xs flex items-center gap-1.5 animate-bounce">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold"
                >
                  Confirmar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
