import React from 'react';
import { Client, Product, Invoice, Shift, Expense } from '../types';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight, 
  Wallet,
  ShieldCheck,
  UserCheck,
  ShoppingCart,
  Key,
  Briefcase,
  Settings,
  ArrowDownCircle,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';

interface DashboardProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  shifts: Shift[];
  expenses: Expense[];
  currentUser: any;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ 
  clients, 
  products, 
  invoices, 
  shifts, 
  expenses,
  currentUser,
  setActiveTab 
}: DashboardProps) {
  
  // Active shift
  const activeShift = shifts.find(s => s.status === 'Abierta');
  
  // KPI Calculations
  const today = new Date().toISOString().split('T')[0];
  
  const todaySales = invoices
    .filter(inv => inv.createdAt.startsWith(today))
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalOutstanding = clients.reduce((sum, c) => sum + c.outstandingBalance, 0);
  
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  
  // Accounts receivable alert count (overdue or near)
  const pendingInvoices = invoices.filter(inv => inv.paymentStatus !== 'Pagado');
  const overdueCount = pendingInvoices.filter(inv => {
    const due = new Date(inv.dueDate);
    const now = new Date();
    return due < now;
  }).length;

  // Chart data 1: Daily sales trend (past 7 days)
  const getPast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      
      const daySales = invoices
        .filter(inv => inv.createdAt.startsWith(dateString))
        .reduce((sum, inv) => sum + inv.total, 0);
        
      const formattedDate = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      data.push({
        date: formattedDate,
        Ventas: daySales,
      });
    }
    return data;
  };
  
  const salesHistoryData = getPast7DaysData();

  // Chart data 2: Payment method distribution
  const paymentMethodsData = [
    { name: 'Efectivo', value: invoices.filter(i => i.paymentMethod === 'Efectivo').reduce((s, i) => s + i.total, 0) },
    { name: 'Tarjeta', value: invoices.filter(i => i.paymentMethod === 'Tarjeta').reduce((s, i) => s + i.total, 0) },
    { name: 'Crédito', value: invoices.filter(i => i.paymentMethod === 'Crédito').reduce((s, i) => s + i.total, 0) },
  ].filter(item => item.value > 0);

  const COLORS = ['#f97316', '#06b6d4', '#ec4899']; // orange, cyan, pink

  // Chart data: Expense distribution by category
  const getExpensesCategoryData = () => {
    const catMap: Record<string, number> = {};
    (expenses || []).forEach(exp => {
      const cat = exp.category || 'Otros';
      catMap[cat] = (catMap[cat] || 0) + exp.amount;
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  };

  const expensesCategoryData = getExpensesCategoryData();
  const EXPENSE_COLORS = ['#ec4899', '#f97316', '#06b6d4', '#10b981', '#8b5cf6', '#eab308'];

  // Chart data 3: Product sales volume
  const getTopProductsData = () => {
    const prodMap: Record<string, { name: string; qty: number }> = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!prodMap[item.productId]) {
          prodMap[item.productId] = { name: item.productName, qty: 0 };
        }
        prodMap[item.productId].qty += item.quantity;
      });
    });
    
    return Object.values(prodMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  const topProductsData = getTopProductsData();

  return (
    <div className="space-y-6" id="dashboard-module">
      
      {/* Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-cyber-card/70 border border-cyber-border rounded-xl p-5 neon-shadow-pink">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-cyber-pink font-mono animate-pulse">⚡</span>
            PANEL DE OPERACIONES
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            COURIER DE MITIGACIÓN Y FACTURACIÓN EN TIEMPO REAL
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {activeShift ? (
            <div className="bg-cyber-green/10 border border-cyber-green/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-cyber-green text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping"></span>
              JORNADA ACTIVA: {activeShift.user}
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-red-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              SIN JORNADA ACTIVA - CAJA CERRADA
            </div>
          )}
          <div className="bg-cyber-orange/10 border border-cyber-orange/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-cyber-orange text-xs font-mono">
            <UserCheck size={14} />
            ROL: {currentUser.role}
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat 1 */}
        <div className="bg-cyber-card border border-cyber-border hover:border-cyber-pink/50 hover:scale-[1.02] active:scale-[0.99] hover:shadow-[0_0_20px_rgba(236,72,153,0.1)] transition-all duration-200 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-pink/5 rounded-full blur-2xl group-hover:bg-cyber-pink/15 transition-all"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-gray-400 tracking-wider">VENTAS HOY</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">${todaySales.toFixed(2)}</h3>
              <p className="text-[10px] text-cyber-pink mt-2 flex items-center gap-1 font-mono">
                <TrendingUp size={10} />
                Regulado por caja general
              </p>
            </div>
            <div className="bg-cyber-pink/10 p-2.5 rounded-lg border border-cyber-pink/20 text-cyber-pink">
              <DollarSign size={18} />
            </div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-cyber-card border border-cyber-border hover:border-cyber-orange/50 hover:scale-[1.02] active:scale-[0.99] hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all duration-200 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-orange/5 rounded-full blur-2xl group-hover:bg-cyber-orange/15 transition-all"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-gray-400 tracking-wider">CUENTAS POR COBRAR</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">${totalOutstanding.toFixed(2)}</h3>
              <button 
                onClick={() => setActiveTab('cartera')}
                className="text-[10px] text-cyber-orange hover:underline mt-2 flex items-center gap-1 font-mono"
              >
                Ver cartera activa <ArrowUpRight size={10} />
              </button>
            </div>
            <div className="bg-cyber-orange/10 p-2.5 rounded-lg border border-cyber-orange/20 text-cyber-orange">
              <Wallet size={18} />
            </div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-cyber-card border border-cyber-border hover:border-cyber-green/50 hover:scale-[1.02] active:scale-[0.99] hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all duration-200 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-green/5 rounded-full blur-2xl group-hover:bg-cyber-green/15 transition-all"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-gray-400 tracking-wider">ALERTAS DE STOCK</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{lowStockCount} <span className="text-xs font-normal text-gray-500">ítems</span></h3>
              {lowStockCount > 0 ? (
                <button 
                  onClick={() => setActiveTab('inventario')}
                  className="text-[10px] text-cyber-green hover:underline mt-2 flex items-center gap-1 font-mono animate-pulse"
                >
                  <AlertTriangle size={10} /> Requiere reabastecimiento
                </button>
              ) : (
                <p className="text-[10px] text-gray-500 mt-2 font-mono">Inventario óptimo</p>
              )}
            </div>
            <div className={`p-2.5 rounded-lg border ${lowStockCount > 0 ? 'bg-cyber-green/10 border-cyber-green/20 text-cyber-green' : 'bg-slate-800/50 border-slate-700 text-gray-500'}`}>
              <Package size={18} />
            </div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-cyber-card border border-cyber-border hover:border-cyber-blue/50 hover:scale-[1.02] active:scale-[0.99] hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-200 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-blue/5 rounded-full blur-2xl group-hover:bg-cyber-blue/15 transition-all"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono text-gray-400 tracking-wider">CRÉDITOS VENCIDOS</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{overdueCount}</h3>
              {overdueCount > 0 ? (
                <button 
                  onClick={() => setActiveTab('cartera')}
                  className="text-[10px] text-red-400 hover:underline mt-2 flex items-center gap-1 font-mono"
                >
                  Cobros urgentes pendientes
                </button>
              ) : (
                <p className="text-[10px] text-gray-500 mt-2 font-mono">Cartera al día</p>
              )}
            </div>
            <div className={`p-2.5 rounded-lg border ${overdueCount > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-800/50 border-slate-700 text-gray-500'}`}>
              <Clock size={18} />
            </div>
          </div>
        </div>

      </div>

      {/* Critical Operational Alerts */}
      {(lowStockCount > 0 || overdueCount > 0) && (
        <div className="bg-cyber-orange/10 border border-cyber-orange/30 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-cyber-orange/20 p-2 rounded-lg text-cyber-orange">
              <AlertTriangle size={18} className="animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">REQUERIMIENTO INMEDIATO DE LOGÍSTICA</h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Se detectan {lowStockCount} insumos por debajo del stock mínimo y {overdueCount} facturas de crédito vencidas que requieren gestión.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {lowStockCount > 0 && (
              <button 
                onClick={() => setActiveTab('inventario')}
                className="bg-cyber-orange/20 hover:bg-cyber-orange text-white hover:text-black transition-all border border-cyber-orange/40 text-xs px-3 py-1.5 rounded-lg font-mono"
              >
                Abastecer Inventario
              </button>
            )}
            {overdueCount > 0 && (
              <button 
                onClick={() => setActiveTab('cartera')}
                className="bg-cyber-pink/20 hover:bg-cyber-pink text-white transition-all border border-cyber-pink/40 text-xs px-3 py-1.5 rounded-lg font-mono"
              >
                Cobrar Cartera
              </button>
            )}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">DESEMPEÑO SEMANAL (VENTAS)</h3>
              <p className="text-xs text-gray-400">Facturación acumulada diaria de los últimos 7 días</p>
            </div>
            <span className="text-xs text-cyber-pink font-mono bg-cyber-pink/10 border border-cyber-pink/20 px-2 py-0.5 rounded">
              Gráfico de Barras
            </span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0e1626', borderColor: '#1e293b', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="Ventas" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses Distribution Pie Chart */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">DISTRIBUCIÓN DE GASTOS</h3>
              <p className="text-xs text-gray-400">Distribución de gastos de caja por categoría</p>
            </div>
            <span className="text-xs text-cyber-orange font-mono bg-cyber-orange/10 border border-cyber-orange/20 px-2 py-0.5 rounded">
              Circular
            </span>
          </div>
          
          <div className="h-48 flex items-center justify-center">
            {expensesCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensesCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0e1626', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500 font-mono text-center">Sin egresos/gastos registrados</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-center pt-2 max-h-[110px] overflow-y-auto pr-1">
            {expensesCategoryData.map((item, index) => (
              <div key={item.name} className="bg-slate-900/40 p-1.5 rounded border border-cyber-border/40">
                <div className="text-[10px] font-mono text-gray-400 flex items-center justify-center gap-1 truncate" title={item.name}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}></span>
                  {item.name}
                </div>
                <div className="text-xs font-bold text-white mt-0.5 font-mono">${item.value.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Grid: Top Products + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top selling items */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">INSUMOS MÁS COMPRADOS</h3>
              <p className="text-xs text-gray-400">Productos con mayor cantidad vendida</p>
            </div>
            <span className="text-xs text-cyber-blue font-mono bg-cyber-blue/10 border border-cyber-blue/20 px-2 py-0.5 rounded">
              Despacho
            </span>
          </div>

          <div className="h-60 flex items-center justify-center">
            {topProductsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <XAxis type="number" stroke="#475569" fontSize={11} hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0e1626', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="qty" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                    {topProductsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#ec4899' : '#06b6d4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500 font-mono">Sin datos de volumen de ventas</div>
            )}
          </div>
        </div>

        {/* Quick Operations History */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">LOG DE COMPROBANTES</h3>
              <p className="text-xs text-gray-400">Últimas facturas emitidas por despacho</p>
            </div>
            <button 
              onClick={() => setActiveTab('historial')}
              className="text-xs text-cyber-pink hover:underline font-mono"
            >
              Ver Historial
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {invoices.length > 0 ? (
              invoices.slice().reverse().map(inv => (
                <div key={inv.id} className="bg-slate-900/60 hover:bg-slate-900/90 transition-all p-3 rounded-lg border border-cyber-border/80 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs font-mono border ${
                      inv.paymentMethod === 'Efectivo' ? 'bg-cyber-orange/10 border-cyber-orange/30 text-cyber-orange' :
                      inv.paymentMethod === 'Tarjeta' ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue' :
                      'bg-cyber-pink/10 border-cyber-pink/30 text-cyber-pink'
                    }`}>
                      {inv.paymentMethod[0]}
                    </div>
                    <div>
                      <div className="text-xs font-mono text-white flex items-center gap-1">
                        <span>{inv.invoiceNumber}</span>
                        <span className="text-[9px] text-gray-500">• {new Date(inv.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{inv.clientName}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-white">${inv.total.toFixed(2)}</div>
                    <span className={`inline-block text-[8px] font-mono px-1.5 py-0.5 rounded mt-0.5 uppercase ${
                      inv.paymentStatus === 'Pagado' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                      inv.paymentStatus === 'Pendiente' ? 'bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {inv.paymentStatus}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 font-mono text-center py-8">No hay facturas despachadas</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
