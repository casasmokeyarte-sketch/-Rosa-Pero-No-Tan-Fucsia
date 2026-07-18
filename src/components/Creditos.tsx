import React, { useState, useMemo } from 'react';
import { Client, Product, Invoice } from '../types';
import { 
  CreditCard, 
  Percent, 
  Search, 
  Settings, 
  ShieldAlert, 
  CheckCircle, 
  X, 
  Coins, 
  UserCheck, 
  Sparkles,
  FileText
} from 'lucide-react';

interface CreditosProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  onUpdateClient: (client: Client) => void;
  currentUser: any;
}

export default function Creditos({ 
  clients, 
  products, 
  invoices, 
  onUpdateClient,
  currentUser 
}: CreditosProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'credito' | 'descuento' | 'empleados'>('todos');
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Edit fields
  const [isEmployee, setIsEmployee] = useState(false);
  const [hasCredit, setHasCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [creditTermsDays, setCreditTermsDays] = useState(30);
  const [creditConditions, setCreditConditions] = useState('');
  const [hasSpecialDiscount, setHasSpecialDiscount] = useState(false);
  const [specialDiscountPercentage, setSpecialDiscountPercentage] = useState(0);
  const [discountType, setDiscountType] = useState<'todos' | 'especificos'>('todos');
  const [discountedProductIds, setDiscountedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // 1. Dashboard Metrics
  const metrics = useMemo(() => {
    const activeClients = clients.filter(c => c.id !== 'c-ocasional');
    const creditActiveCount = activeClients.filter(c => c.hasCredit).length;
    const discountActiveCount = activeClients.filter(c => c.specialDiscountPercentage && c.specialDiscountPercentage > 0).length;
    const employeeCount = activeClients.filter(c => c.isEmployee).length;
    const totalDebt = activeClients.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

    return {
      creditActiveCount,
      discountActiveCount,
      employeeCount,
      totalDebt
    };
  }, [clients]);

  // 2. Filter Clients
  const displayClients = useMemo(() => {
    return clients
      .filter(c => c.id !== 'c-ocasional') // Ignore ocasional cash client
      .filter(c => {
        const matchesSearch = 
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.rut.includes(search) ||
          (c.code && c.code.toLowerCase().includes(search.toLowerCase()));
        
        if (!matchesSearch) return false;

        if (filterType === 'credito') return c.hasCredit;
        if (filterType === 'descuento') return c.specialDiscountPercentage && c.specialDiscountPercentage > 0;
        if (filterType === 'empleados') return c.isEmployee;

        return true;
      });
  }, [clients, search, filterType]);

  // 3. Open Editing Modal
  const handleOpenConfig = (client: Client) => {
    setEditingClient(client);
    setIsEmployee(!!client.isEmployee);
    setHasCredit(!!client.hasCredit);
    setCreditLimit(client.creditLimit || 0);
    setCreditTermsDays(client.creditTermsDays || 30);
    setCreditConditions(client.creditConditions || '');
    
    const pct = client.specialDiscountPercentage || 0;
    setHasSpecialDiscount(pct > 0);
    setSpecialDiscountPercentage(pct);
    
    const specificIds = client.discountedProductIds || [];
    setDiscountType(specificIds.length > 0 ? 'especificos' : 'todos');
    setDiscountedProductIds(specificIds);
    setProductSearch('');
  };

  // 4. Toggle Product Selection for Specific Discounts
  const handleToggleProduct = (productId: string) => {
    setDiscountedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // 5. Submit Changes
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const updated: Client = {
      ...editingClient,
      isEmployee,
      hasCredit,
      creditLimit: hasCredit ? parseFloat(creditLimit.toString()) || 0 : 0,
      creditTermsDays: hasCredit ? parseInt(creditTermsDays.toString()) || 30 : 30,
      creditConditions: hasCredit ? creditConditions.trim() : '',
      specialDiscountPercentage: hasSpecialDiscount ? parseFloat(specialDiscountPercentage.toString()) || 0 : 0,
      discountedProductIds: hasSpecialDiscount && discountType === 'especificos' ? discountedProductIds : []
    };

    onUpdateClient(updated);
    setEditingClient(null);
  };

  // 6. Filter products in catalog for selection
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-cyber-border pb-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
            <Coins className="text-cyber-pink animate-pulse" />
            MÓDULO DE CRÉDITOS Y DESCUENTOS
          </h1>
          <p className="text-[10px] text-gray-400 mt-1">
            Gestión de líneas de crédito autorizadas, plazos de mora y políticas de descuento único por cliente.
          </p>
        </div>
      </div>

      {/* METRICS WIDGET PANEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-cyber-pink/50 transition-colors">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Deuda en Cartera</span>
            <h3 className="text-lg font-extrabold text-cyber-pink tracking-tight">
              ${metrics.totalDebt.toLocaleString('es-CO')} COP
            </h3>
          </div>
          <Coins size={32} className="text-gray-800 opacity-40 group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-cyber-pink/20 group-hover:bg-cyber-pink transition-colors"></div>
        </div>

        {/* Metric 2 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-cyber-orange/50 transition-colors">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Créditos Habilitados</span>
            <h3 className="text-lg font-extrabold text-cyber-orange tracking-tight">
              {metrics.creditActiveCount} Clientes
            </h3>
          </div>
          <CreditCard size={32} className="text-gray-800 opacity-40 group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-cyber-orange/20 group-hover:bg-cyber-orange transition-colors"></div>
        </div>

        {/* Metric 3 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-cyber-blue/50 transition-colors">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Descuentos Especiales</span>
            <h3 className="text-lg font-extrabold text-cyber-blue tracking-tight">
              {metrics.discountActiveCount} Clientes
            </h3>
          </div>
          <Percent size={32} className="text-gray-800 opacity-40 group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-cyber-blue/20 group-hover:bg-cyber-blue transition-colors"></div>
        </div>

        {/* Metric 4 */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-cyber-green/50 transition-colors">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Fichas de Empleados</span>
            <h3 className="text-lg font-extrabold text-cyber-green tracking-tight">
              {metrics.employeeCount} Registros
            </h3>
          </div>
          <UserCheck size={32} className="text-gray-800 opacity-40 group-hover:scale-110 transition-transform" />
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-cyber-green/20 group-hover:bg-cyber-green transition-colors"></div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col md:flex-row gap-3.5 items-center justify-between shadow-md">
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          <button 
            type="button"
            onClick={() => setFilterType('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              filterType === 'todos' 
                ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink font-black' 
                : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            TODOS ({clients.filter(c => c.id !== 'c-ocasional').length})
          </button>
          <button 
            type="button"
            onClick={() => setFilterType('credito')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              filterType === 'credito' 
                ? 'bg-cyber-orange/20 border-cyber-orange text-cyber-orange font-black' 
                : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            💳 LÍNEA CRÉDITO ({metrics.creditActiveCount})
          </button>
          <button 
            type="button"
            onClick={() => setFilterType('descuento')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              filterType === 'descuento' 
                ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue font-black' 
                : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            🏷️ CON DESCUENTO ({metrics.discountActiveCount})
          </button>
          <button 
            type="button"
            onClick={() => setFilterType('empleados')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              filterType === 'empleados' 
                ? 'bg-cyber-green/20 border-cyber-green text-cyber-green font-black' 
                : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            👥 EMPLEADOS ({metrics.employeeCount})
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por Nombre, RUT o Código..."
            className="w-full bg-cyber-bg border border-cyber-border text-white text-xs pl-8 pr-3 py-2 rounded-lg focus:outline-none glow-border-pink font-mono"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
        </div>
      </div>

      {/* CLIENTS CRITICAL POLICIES LIST */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950/80 text-gray-400 border-b border-cyber-border font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Cliente / Código</th>
                <th className="p-4">Documento/RUT</th>
                <th className="p-4 text-center">Perfil Empleado</th>
                <th className="p-4">Línea de Crédito</th>
                <th className="p-4">Descuento Especial</th>
                <th className="p-4 text-right">Saldo Deuda</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {displayClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-600">
                    No se encontraron clientes que coincidan con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                displayClients.map(client => {
                  return (
                    <tr key={client.id} className="hover:bg-slate-900/40 transition-colors animate-pulse-once">
                      {/* Name & Code */}
                      <td className="p-4">
                        <div className="font-bold text-white text-xs truncate max-w-[200px]">{client.name}</div>
                        <div className="text-[9px] text-cyber-pink font-bold mt-0.5">{client.code || 'SIN CÓDIGO'}</div>
                      </td>

                      {/* RUT */}
                      <td className="p-4 text-gray-300 font-mono">{client.rut}</td>

                      {/* Employee profile status badge */}
                      <td className="p-4 text-center">
                        {client.isEmployee ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyber-green/10 border border-cyber-green/30 text-cyber-green">
                            👥 EMPLEADO
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[10px] font-bold">-</span>
                        )}
                      </td>

                      {/* Credit limit */}
                      <td className="p-4">
                        {client.hasCredit ? (
                          <div className="space-y-0.5">
                            <div className="text-white font-bold">${client.creditLimit.toLocaleString('es-CO')} COP</div>
                            <div className="text-[9px] text-cyber-orange font-bold flex items-center gap-1">
                              💳 {client.creditTermsDays} días plazo
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 font-semibold italic text-[10px]">Restringido (Caja)</span>
                        )}
                      </td>

                      {/* Special Discount */}
                      <td className="p-4">
                        {client.specialDiscountPercentage && client.specialDiscountPercentage > 0 ? (
                          <div className="space-y-0.5">
                            <div className="text-cyber-blue font-bold">-{client.specialDiscountPercentage}% Desc.</div>
                            <div className="text-[9px] text-gray-500 font-bold truncate max-w-[150px]">
                              {client.discountedProductIds && client.discountedProductIds.length > 0
                                ? `Catálogo: ${client.discountedProductIds.length} prod.`
                                : 'Todo el Catálogo'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 font-bold">-</span>
                        )}
                      </td>

                      {/* Debt Balance */}
                      <td className="p-4 text-right">
                        <span className={`font-extrabold ${client.outstandingBalance > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          ${(client.outstandingBalance || 0).toLocaleString('es-CO')}
                        </span>
                      </td>

                      {/* Settings action */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenConfig(client)}
                          className="p-2 bg-slate-900 border border-slate-800 text-gray-400 hover:text-white hover:border-cyber-pink hover:bg-cyber-pink/10 rounded-lg cursor-pointer transition-all"
                          title="Configurar Políticas Financieras"
                        >
                          <Settings size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIGURATION MODAL */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-950 p-4 border-b border-cyber-border flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] text-cyber-pink font-bold font-mono uppercase tracking-widest">Ajuste de Políticas</span>
                <h3 className="text-xs font-bold text-white uppercase truncate font-mono mt-0.5">
                  POLÍTICAS FINANCIERAS: {editingClient.name}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setEditingClient(null)} 
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* SECTION A: Employee Profile */}
              <div className="bg-slate-900/40 border border-slate-850 p-3 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    👥 Perfil de Empleado (Rosa Fuerte)
                  </h4>
                  <p className="text-[9px] text-gray-500 max-w-sm font-mono">
                    Habilitar si este cliente es un miembro del equipo para registrarlo con privilegios internos.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isEmployee} 
                    onChange={e => setIsEmployee(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-green"></div>
                </label>
              </div>

              {/* SECTION B: Credit Line */}
              <div className="border border-cyber-border/40 rounded-xl overflow-hidden">
                <div className="bg-slate-900/80 p-3 border-b border-cyber-border/40 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    💳 Línea de Crédito Autorizada
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={hasCredit} 
                      onChange={e => setHasCredit(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-orange"></div>
                  </label>
                </div>

                {hasCredit && (
                  <div className="p-4 bg-slate-900/20 space-y-4 animate-pulse-once">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Credit Limit Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Cupo Límite de Crédito (COP):</label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={creditLimit}
                            onChange={e => setCreditLimit(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-orange"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-gray-500">$</span>
                        </div>
                      </div>

                      {/* Terms Limit Days */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Plazo de Vencimiento (Días):</label>
                        <select
                          value={creditTermsDays}
                          onChange={e => setCreditTermsDays(parseInt(e.target.value))}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-orange"
                        >
                          <option value={15}>15 días</option>
                          <option value={30}>30 días</option>
                          <option value={45}>45 días</option>
                          <option value={60}>60 días</option>
                        </select>
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-bold">Condiciones Especiales de Crédito:</label>
                      <textarea
                        value={creditConditions}
                        onChange={e => setCreditConditions(e.target.value)}
                        placeholder="Ej. Facturar a 30 días contra entrega de remisiones selladas..."
                        rows={2}
                        className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange resize-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION C: Special Discount Percentage */}
              <div className="border border-cyber-border/40 rounded-xl overflow-hidden">
                <div className="bg-slate-900/80 p-3 border-b border-cyber-border/40 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    🏷️ Descuento Especial Único
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={hasSpecialDiscount} 
                      onChange={e => setHasSpecialDiscount(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-blue"></div>
                  </label>
                </div>

                {hasSpecialDiscount && (
                  <div className="p-4 bg-slate-900/20 space-y-4 animate-pulse-once">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Percent value */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Porcentaje de Descuento (%):</label>
                        <div className="relative">
                          <input 
                            type="number"
                            value={specialDiscountPercentage}
                            onChange={e => setSpecialDiscountPercentage(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                            className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-blue"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-gray-500">%</span>
                        </div>
                      </div>

                      {/* Scope Selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Alcance de Aplicación:</label>
                        <select
                          value={discountType}
                          onChange={e => setDiscountType(e.target.value as 'todos' | 'especificos')}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-blue"
                        >
                          <option value="todos">Todo el Catálogo</option>
                          <option value="especificos">Productos Específicos</option>
                        </select>
                      </div>
                    </div>

                    {/* Product Specific Checklist */}
                    {discountType === 'especificos' && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-cyan-400 uppercase font-bold">Seleccionar Productos Autorizados:</label>
                          <span className="text-[9px] text-gray-500 font-mono">({discountedProductIds.length} seleccionados)</span>
                        </div>
                        
                        {/* Search product filter inside list */}
                        <div className="relative">
                          <input 
                            type="text"
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            placeholder="Filtrar productos..."
                            className="w-full bg-cyber-bg border border-slate-800 text-[10px] pl-7 pr-3 py-1.5 rounded focus:outline-none text-white font-mono"
                          />
                          <Search size={11} className="absolute left-2.5 top-2.5 text-gray-600" />
                        </div>

                        {/* Product Checkboxes List */}
                        <div className="border border-slate-850 rounded bg-black/40 max-h-40 overflow-y-auto divide-y divide-slate-900">
                          {filteredProducts.length === 0 ? (
                            <div className="p-4 text-center text-gray-600 text-[10px]">No hay productos que coincidan.</div>
                          ) : (
                            filteredProducts.map(prod => {
                              const isChecked = discountedProductIds.includes(prod.id);
                              return (
                                <label 
                                  key={prod.id}
                                  className="flex items-center justify-between p-2 hover:bg-slate-900/60 cursor-pointer"
                                >
                                  <div className="flex flex-col max-w-[80%]">
                                    <span className="text-[11px] font-bold text-gray-200 truncate">{prod.name}</span>
                                    <span className="text-[9px] text-gray-600">{prod.sku} • Precio: ${prod.price.toLocaleString()} COP</span>
                                  </div>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleProduct(prod.id)}
                                    className="accent-cyber-blue w-3.5 h-3.5"
                                  />
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Warning message on Non-cumulative */}
              {(hasSpecialDiscount || hasCredit) && (
                <div className="bg-cyber-blue/5 border border-cyber-blue/30 rounded-lg p-3 text-[9px] text-cyan-400 font-mono leading-relaxed space-y-1">
                  <span className="font-extrabold uppercase text-cyan-300">💡 REGLAS DE NEGOCIO Y RIESGOS:</span>
                  <p>1. Los descuentos especiales asignados a los clientes son de carácter único y **NO acumulables** con otras promociones o cupones del sistema.</p>
                  <p>2. Si la deuda pendiente de facturas a crédito excede el cupo máximo o el cliente cae en mora, el sistema **bloqueará inmediatamente** cualquier intento de facturación en caja y web.</p>
                </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="bg-slate-950 p-4 border-t border-cyber-border flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-gray-400 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2 bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold rounded-lg text-xs shadow-md neon-shadow-pink cursor-pointer"
              >
                APLICAR CAMBIOS
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
