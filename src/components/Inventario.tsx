import React, { useState } from 'react';
import { Product, StockAdjustment, BusinessConfig, StockTransfer, User } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  Package, 
  Search, 
  Plus, 
  Minus, 
  AlertTriangle, 
  TrendingUp, 
  History, 
  Layers, 
  RefreshCw,
  PlusCircle,
  X,
  DollarSign,
  Upload,
  Download,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  FileText,
  Send,
  Users
} from 'lucide-react';

interface InventarioProps {
  products: Product[];
  adjustments: StockAdjustment[];
  currentUser: any;
  config?: BusinessConfig;
  onAddProduct: (product: Product) => void;
  onAdjustStock: (adjustment: StockAdjustment) => void;
  onImportProducts?: (products: Product[]) => void;
  transfers?: StockTransfer[];
  onAddTransfer?: (transfer: StockTransfer) => void;
  onUpdateTransferStatus?: (transferId: string, status: 'aprobado' | 'rechazado', supportNotes?: string) => void;
  users?: User[];
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export default function Inventario({ 
  products, 
  adjustments, 
  currentUser,
  config,
  onAddProduct, 
  onAdjustStock,
  onImportProducts,
  transfers = [],
  onAddTransfer,
  onUpdateTransferStatus,
  users = [],
  onUpdateProduct,
  onDeleteProduct
}: InventarioProps) {
  
  // States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // Edit product form states
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editCost, setEditCost] = useState(0);
  const [editMinStock, setEditMinStock] = useState(0);
  const [editEmoji, setEditEmoji] = useState('📦');
  const [editUnitType, setEditUnitType] = useState<'unidad' | 'gr' | 'ml' | 'l'>('unidad');
  const [editSpecialPrice1g, setEditSpecialPrice1g] = useState('');
  const [editSpecialPriceHalfG, setEditSpecialPriceHalfG] = useState('');
  const [editSpecialPriceQuarterG, setEditSpecialPriceQuarterG] = useState('');
  
  // Subtab State
  const [activeSubTab, setActiveSubTab] = useState<'catalogo' | 'traspasos'>('catalogo');
  
  // New Transfer Form States
  const [transferProductId, setTransferProductId] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferDirection, setTransferDirection] = useState<'bodega_to_user' | 'user_to_bodega'>('bodega_to_user');
  const [supportProofNotes, setSupportProofNotes] = useState('');

  // Approval support state
  const [resolvingTransferId, setResolvingTransferId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [activeAdjustProduct, setActiveAdjustProduct] = useState<Product | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // New product fields
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(() => config?.productCategories?.[0] || 'Contenedores');
  const [newPrice, setNewPrice] = useState(10.00);
  const [newCost, setNewCost] = useState(5.00);
  const [newStock, setNewStock] = useState(10);
  const [newMinStock, setNewMinStock] = useState(3);
  const [newEmoji, setNewEmoji] = useState('📦');
  const [newUnitType, setNewUnitType] = useState<'unidad' | 'gr' | 'ml' | 'l'>('unidad');
  const [newSpecialPrice1g, setNewSpecialPrice1g] = useState<string>('');
  const [newSpecialPriceHalfG, setNewSpecialPriceHalfG] = useState<string>('');
  const [newSpecialPriceQuarterG, setNewSpecialPriceQuarterG] = useState<string>('');

  // Adjustment fields
  const [adjustType, setAdjustType] = useState<'Ingreso' | 'Egreso'>('Ingreso');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');

  // Categories
  const categories = ['Todos', ...new Set([
    ...(config?.productCategories || []),
    ...products.map(p => p.category)
  ])];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle Add Product
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    const nProduct: Product = {
      id: `p-${Date.now()}`,
      code: newCode,
      name: newName,
      category: newCategory,
      price: parseFloat(newPrice.toString()) || 0,
      cost: parseFloat(newCost.toString()) || 0,
      stock: parseFloat(newStock.toString()) || 0, // Allow decimal/float for weights/volumes
      minStock: parseFloat(newMinStock.toString()) || 0,
      imageUrl: newEmoji,
      unitType: newUnitType,
      specialPrice1g: newUnitType === 'gr' && newSpecialPrice1g !== '' ? parseFloat(newSpecialPrice1g) : undefined,
      specialPriceHalfG: newUnitType === 'gr' && newSpecialPriceHalfG !== '' ? parseFloat(newSpecialPriceHalfG) : undefined,
      specialPriceQuarterG: newUnitType === 'gr' && newSpecialPriceQuarterG !== '' ? parseFloat(newSpecialPriceQuarterG) : undefined,
    };

    onAddProduct(nProduct);
    
    // Log adjustment for initial inventory
    const initialAdj: StockAdjustment = {
      id: `adj-${Date.now()}`,
      productId: nProduct.id,
      productName: nProduct.name,
      type: 'Inventario Inicial',
      quantity: nProduct.stock,
      reason: 'Carga inicial de mercancía en almacén central',
      createdAt: new Date().toISOString(),
      user: currentUser.fullName
    };
    onAdjustStock(initialAdj);

    // Reset Form
    setNewCode('');
    setNewName('');
    setNewCategory('Contenedores');
    setNewPrice(10);
    setNewCost(5);
    setNewStock(10);
    setNewMinStock(3);
    setNewEmoji('📦');
    setNewUnitType('unidad');
    setNewSpecialPrice1g('');
    setNewSpecialPriceHalfG('');
    setNewSpecialPriceQuarterG('');
    setShowAddProduct(false);
  };

  // Start product edit
  const handleStartEditProduct = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCode(p.code);
    setEditCategory(p.category);
    setEditPrice(p.price);
    setEditCost(p.cost);
    setEditMinStock(p.minStock);
    setEditEmoji(p.imageUrl || '📦');
    setEditUnitType(p.unitType || 'unidad');
    setEditSpecialPrice1g(p.specialPrice1g?.toString() || '');
    setEditSpecialPriceHalfG(p.specialPriceHalfG?.toString() || '');
    setEditSpecialPriceQuarterG(p.specialPriceQuarterG?.toString() || '');
  };

  // Submit product edit
  const handleUpdateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updated: Product = {
      ...editingProduct,
      name: editName,
      code: editCode,
      category: editCategory,
      price: parseFloat(editPrice.toString()) || 0,
      cost: parseFloat(editCost.toString()) || 0,
      minStock: parseFloat(editMinStock.toString()) || 0,
      imageUrl: editEmoji,
      unitType: editUnitType,
      specialPrice1g: editUnitType === 'gr' && editSpecialPrice1g !== '' ? parseFloat(editSpecialPrice1g) : undefined,
      specialPriceHalfG: editUnitType === 'gr' && editSpecialPriceHalfG !== '' ? parseFloat(editSpecialPriceHalfG) : undefined,
      specialPriceQuarterG: editUnitType === 'gr' && editSpecialPriceQuarterG !== '' ? parseFloat(editSpecialPriceQuarterG) : undefined
    };

    onUpdateProduct(updated);
    setEditingProduct(null);
  };

  // Confirm delete product
  const handleConfirmDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (window.confirm(`¿Está seguro de eliminar el insumo "${prod.name}" permanentemente del inventario?`)) {
      onDeleteProduct(productId);
    }
  };

  // Open history modal
  const openHistory = (p: Product) => {
    setHistoryProduct(p);
  };

  // Open stock adjustment modal
  const openAdjustment = (product: Product) => {
    setActiveAdjustProduct(product);
    setAdjustType('Ingreso');
    setAdjustQty(1);
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  // Submit stock adjustment
  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdjustProduct) return;

    const logAdj: StockAdjustment = {
      id: `adj-${Date.now()}`,
      productId: activeAdjustProduct.id,
      productName: activeAdjustProduct.name,
      type: adjustType,
      quantity: parseInt(adjustQty.toString()) || 0,
      reason: adjustReason || 'Ajuste de inventario periódico por auditoría',
      createdAt: new Date().toISOString(),
      user: currentUser.fullName
    };

    onAdjustStock(logAdj);
    
    // Close modal
    setShowAdjustModal(false);
    setActiveAdjustProduct(null);
  };

  // Export products to JSON
  const handleExportProducts = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `productos_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Read JSON file for products
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportText(text);
      setImportError(null);
    };
    reader.readAsText(file);
  };

  // Submit and validate imported products
  const handleImportProductsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) {
      setImportError("Por favor ingrese un contenido JSON o cargue un archivo.");
      return;
    }

    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        throw new Error("El JSON debe ser un arreglo de productos [ { ... }, { ... } ].");
      }

      const validated: Product[] = parsed.map((item: any, idx: number) => {
        if (!item.name || !item.code) {
          throw new Error(`El producto en la posición ${idx + 1} no cuenta con un 'name' o 'code' válido.`);
        }
        return {
          id: item.id || `p-${Date.now()}-${idx}`,
          code: item.code,
          name: item.name,
          category: item.category || 'Contenedores',
          price: parseFloat(item.price) || 0,
          cost: parseFloat(item.cost) || 0,
          stock: parseFloat(item.stock) || 0,
          minStock: parseFloat(item.minStock) || 0,
          imageUrl: item.imageUrl || '📦',
          unitType: item.unitType || 'unidad',
          specialPrice1g: item.specialPrice1g ? parseFloat(item.specialPrice1g) : undefined,
          specialPriceHalfG: item.specialPriceHalfG ? parseFloat(item.specialPriceHalfG) : undefined,
          specialPriceQuarterG: item.specialPriceQuarterG ? parseFloat(item.specialPriceQuarterG) : undefined
        };
      });

      if (onImportProducts) {
        onImportProducts(validated);
      } else {
        // Fallback
        validated.forEach(p => onAddProduct(p));
      }

      setShowImportModal(false);
      setImportText('');
      setImportError(null);
    } catch (err: any) {
      setImportError(err.message || "Error al decodificar JSON. Verifique la estructura.");
    }
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProductId || !onAddTransfer) return;

    const prod = products.find(p => p.id === transferProductId);
    if (!prod) return;

    const origin = transferDirection === 'user_to_bodega' ? currentUser.id : 'bodega';
    const destination = transferDirection === 'bodega_to_user' 
      ? currentUser.id 
      : (transferDirection === 'admin_to_any' ? transferUserId : 'bodega');

    if (!destination) return;

    // Check stock availability
    if (origin === 'bodega') {
      if (prod.stock < transferQty) {
        alert(`Error: La Bodega Central no posee stock suficiente (${prod.stock}) para este traspaso.`);
        return;
      }
    } else {
      const pStock = getPersonalStock(prod);
      if (pStock < transferQty) {
        alert(`Error: No posees stock suficiente (${pStock}) en tu inventario para este traspaso.`);
        return;
      }
    }

    const originName = origin === 'bodega' ? 'Bodega Central' : currentUser.fullName || origin;
    const destUser = users.find(u => u.id === destination);
    const destinationName = destination === 'bodega' ? 'Bodega Central' : (destUser ? destUser.fullName : destination);

    const newTransfer: StockTransfer = {
      id: `tr-${Date.now()}`,
      origin,
      destination,
      originName,
      destinationName,
      status: 'pendiente',
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          quantity: transferQty,
          unitType: prod.unitType
        }
      ],
      supportNotes: supportProofNotes || `Traspaso iniciado por ${currentUser.fullName}.`,
      createdAt: new Date().toISOString()
    };

    onAddTransfer(newTransfer);

    // Reset Form
    setTransferProductId('');
    setTransferUserId('');
    setTransferQty(1);
    setSupportProofNotes('');
  };

  // Find low stock in Bodega Principal
  const lowStockBodega = products.filter(p => p.stock <= p.minStock);

  // Find low stock in personal inventory
  const getPersonalStock = (p: Product): number => {
    if (!p.userStocks) return 0;
    return p.userStocks[currentUser.id] !== undefined ? p.userStocks[currentUser.id] : 0;
  };
  const lowStockPersonal = products.filter(p => getPersonalStock(p) <= p.minStock);

  const pendingTransfersCount = transfers.filter(t => {
    if (t.status !== 'pendiente') return false;
    if (currentUser.role === 'Administrador' && t.destination === 'bodega') return true;
    if (t.destination === currentUser.id) return true;
    return false;
  }).length;

  return (
    <div className="space-y-6" id="inventory-module">
      
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-cyber-card border border-cyber-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="text-cyber-pink" />
            CONTROL DE INVENTARIO MULTI-NODO
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Gestión independiente por usuario, Bodega Central, alertas de escasez y solicitudes de traspaso con soportes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            type="button"
            onClick={handleExportProducts}
            className="bg-slate-900 hover:bg-slate-800 text-white border border-cyber-border text-xs font-bold font-mono px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            title="Exportar productos a JSON"
          >
            <Download size={14} /> Exportar
          </button>
          <button 
            type="button"
            onClick={() => setShowImportModal(true)}
            className="bg-cyber-blue/20 hover:bg-cyber-blue text-cyber-blue border border-cyber-blue/30 text-xs font-bold font-mono px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            title="Importar productos desde JSON"
          >
            <Upload size={14} /> Importar
          </button>
          <button 
            type="button"
            onClick={() => setShowAddProduct(true)}
            className="bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer neon-shadow-pink shrink-0"
          >
            <PlusCircle size={15} /> Registrar Insumo
          </button>
        </div>
      </div>

      {/* Visual Notification Alert System for Low Stock */}
      {(lowStockBodega.length > 0 || lowStockPersonal.length > 0) && (
        <div className="bg-gradient-to-r from-amber-950/40 to-slate-950 border border-cyber-orange/40 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="p-2.5 bg-cyber-orange/10 border border-cyber-orange/30 text-cyber-orange rounded-lg animate-pulse shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-cyber-orange font-mono uppercase tracking-wider flex items-center gap-1.5">
                SISTEMA DE CONTROL: ALERTA DE ABASTECIMIENTO MÍNIMO
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Se detectaron insumos por debajo del stock mínimo de seguridad. Reabastezca para evitar demoras.
              </p>
              <div className="flex flex-wrap gap-2 mt-2 font-mono text-[9px]">
                {lowStockBodega.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-800 px-2 py-1 rounded flex items-center gap-1.5 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-cyber-orange rounded-full animate-ping"></span>
                    <span>BODEGA CENTRAL ({lowStockBodega.length}):</span>
                    <span className="text-cyber-orange font-bold">
                      {lowStockBodega.map(p => `${p.name} (${p.stock})`).join(', ')}
                    </span>
                  </div>
                )}
                {lowStockPersonal.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-800 px-2 py-1 rounded flex items-center gap-1.5 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-cyber-pink rounded-full animate-ping"></span>
                    <span>MI INVENTARIO ({lowStockPersonal.length}):</span>
                    <span className="text-cyber-pink font-bold">
                      {lowStockPersonal.map(p => `${p.name} (${getPersonalStock(p)})`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {lowStockPersonal.length > 0 && activeSubTab !== 'traspasos' && (
            <button
              onClick={() => setActiveSubTab('traspasos')}
              className="bg-cyber-orange text-black hover:bg-amber-400 text-[10px] font-extrabold font-mono px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-lg shrink-0"
            >
              Solicitar Traspaso Ahora ➜
            </button>
          )}
        </div>
      )}

      {/* Sub-tabs Selection */}
      <div className="flex border-b border-slate-800 font-mono text-xs">
        <button
          onClick={() => setActiveSubTab('catalogo')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'catalogo'
              ? 'border-cyber-pink text-cyber-pink bg-cyber-pink/5'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Layers size={14} /> 📦 CATÁLOGO Y BODEGA CENTRAL
        </button>
        <button
          onClick={() => setActiveSubTab('traspasos')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-2 relative ${
            activeSubTab === 'traspasos'
              ? 'border-cyber-pink text-cyber-pink bg-cyber-pink/5'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <RefreshCw size={14} className={pendingTransfersCount > 0 ? 'animate-spin-slow text-cyber-orange' : ''} /> 🤝 TRASPASOS & INVENTARIO PERSONAL
          {pendingTransfersCount > 0 && (
            <span className="absolute top-1.5 right-2 px-1.5 py-0.5 bg-cyber-orange text-black font-extrabold text-[8px] rounded-full animate-bounce">
              {pendingTransfersCount} PENDIENTE{pendingTransfersCount > 1 ? 'S' : ''}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'catalogo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* LEFT: Products Inventory grid (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-cyber-card border border-cyber-border rounded-xl p-3">
              {/* Search */}
              <div className="relative w-full sm:max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Buscar código o descripción..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs pl-9 pr-3 py-2 rounded-lg w-full focus:outline-none glow-border-pink"
                />
              </div>

              {/* Category Filter */}
              <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none font-mono text-[10px]">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-md border shrink-0 transition-all ${
                      selectedCategory === cat 
                        ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink' 
                        : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map(p => {
                const pStock = getPersonalStock(p);
                const isBodegaLow = p.stock <= p.minStock;
                const isPersonalLow = pStock <= p.minStock;
                const isLowStock = isBodegaLow || isPersonalLow;

                return (
                  <div 
                    key={p.id}
                    className={`bg-cyber-card border rounded-xl p-4 flex flex-col justify-between space-y-4 transition-all relative overflow-hidden group ${
                      isLowStock 
                        ? 'border-cyber-orange/40 neon-shadow-orange' 
                        : 'border-cyber-border hover:border-slate-700'
                    }`}
                  >
                    {isLowStock && (
                      <div className="absolute -right-12 -top-1 px-12 py-1 rotate-45 bg-cyber-orange text-black font-extrabold font-mono text-[8px] tracking-wider text-center animate-pulse">
                        ALERTA STOCK
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <span className="text-3xl bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">{p.imageUrl || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-cyber-pink uppercase bg-cyber-pink/5 border border-cyber-pink/15 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-400/5 border border-cyan-400/15 px-1.5 py-0.5 rounded">
                            {p.unitType === 'gr' ? 'Gramaje (Gr)' : p.unitType === 'ml' ? 'Volumen (ML)' : p.unitType === 'l' ? 'Litros (L)' : 'Unidad'}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-white mt-1.5 group-hover:text-cyber-pink transition-colors truncate" title={p.name}>
                          {p.name}
                        </h3>
                        <p className="text-[10px] font-mono text-gray-500 mt-0.5">CÓD: {p.code}</p>

                        {p.unitType === 'gr' && (p.specialPrice1g || p.specialPriceHalfG || p.specialPriceQuarterG) && (
                          <div className="text-[9px] text-cyber-pink font-mono bg-cyber-pink/5 border border-cyber-pink/10 px-1.5 py-0.5 rounded mt-1.5">
                            <span className="font-bold text-[8px] uppercase tracking-wider text-gray-400 block mb-0.5">Precios Especiales:</span>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {p.specialPrice1g !== undefined && <span>1 Gr (1): <strong>${p.specialPrice1g}</strong></span>}
                              {p.specialPriceHalfG !== undefined && <span>1/2 Gr (1/2): <strong>${p.specialPriceHalfG}</strong></span>}
                              {p.specialPriceQuarterG !== undefined && <span>1/4 Gr (1/4): <strong>${p.specialPriceQuarterG}</strong></span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financials / Stocks */}
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase">Costo</span>
                        <div className="text-white mt-0.5">${p.cost.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase">Precio</span>
                        <div className="text-cyber-green font-bold mt-0.5">
                          ${p.price.toFixed(2)}
                          <span className="text-[8px] text-gray-400">/{p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'l' : 'u'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase">Margen</span>
                        <div className="text-cyber-blue mt-0.5">+{Math.round(((p.price - p.cost) / p.price) * 100)}%</div>
                      </div>
                    </div>

                    {/* Stock level indicators */}
                    <div className="space-y-2 border-t border-slate-800/80 pt-3">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyber-pink"></span>
                          Bodega Central:
                        </span>
                        <span className={`font-bold ${isBodegaLow ? 'text-cyber-orange animate-pulse' : 'text-white'}`}>
                          {p.stock} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'l' : 'u.'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                          Mi Inventario Personal:
                        </span>
                        <span className={`font-bold ${isPersonalLow ? 'text-cyber-orange animate-pulse' : 'text-white'}`}>
                          {pStock} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'l' : 'u.'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-800/40">
                        <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                          <span>Límite Mínimo: {p.minStock} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'l' : 'u.'}</span>
                          <button 
                            type="button"
                            onClick={() => openHistory(p)}
                            className="bg-slate-900/60 hover:bg-slate-800 text-gray-305 hover:text-cyan-400 border border-slate-850 px-1.5 py-0.5 rounded text-[8px] font-mono flex items-center gap-0.5 cursor-pointer transition-colors"
                          >
                            <History size={8} /> Ver Historial
                          </button>
                        </div>
                        {currentUser.role === 'Administrador' && (
                          <div className="flex gap-1.5 pt-1">
                            <button 
                              type="button"
                              onClick={() => openAdjustment(p)}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white hover:text-cyber-pink transition-all border border-slate-850 py-1 rounded text-[8px] font-mono flex items-center justify-center gap-0.5 cursor-pointer"
                            >
                              <RefreshCw size={8} /> Ajustar
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleStartEditProduct(p)}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white hover:text-cyber-blue transition-all border border-slate-850 py-1 rounded text-[8px] font-mono flex items-center justify-center gap-0.5 cursor-pointer"
                            >
                              ✏️ Editar
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleConfirmDeleteProduct(p.id)}
                              className="flex-1 bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-all border border-red-900/30 py-1 rounded text-[8px] font-mono flex items-center justify-center gap-0.5 cursor-pointer"
                            >
                              🗑️ Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-4">
                <CyberEmpty 
                  title="Catálogo Vacío" 
                  description="Ningún suministro localizado bajo los filtros o búsquedas ingresadas." 
                  icon={Package}
                />
              </div>
            )}

          </div>

          {/* RIGHT: Stock Movements Log (4 cols) */}
          <div className="lg:col-span-4 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <History size={14} className="text-cyber-pink" />
                AUDITORÍA DE BODEGA CENTRAL
              </h2>
              <span className="text-[10px] text-gray-500 font-mono">Bitácora General</span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {adjustments.slice().reverse().map(adj => {
                const isIngreso = adj.type === 'Ingreso' || adj.type === 'Inventario Inicial';
                return (
                  <div key={adj.id} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-2 text-[11px]">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white truncate max-w-[150px]">{adj.productName}</span>
                      <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isIngreso 
                          ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {isIngreso ? `+${adj.quantity}` : `-${adj.quantity}`}
                      </span>
                    </div>
                    <p className="text-gray-400 font-sans leading-tight text-[10px]">
                      {adj.reason}
                    </p>
                    <div className="flex justify-between text-[9px] font-mono text-gray-500 pt-1 border-t border-slate-800/60">
                      <span>{adj.user}</span>
                      <span>{new Date(adj.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
              {adjustments.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-xs font-mono">
                  Sin movimientos de almacén para auditar.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* activeSubTab === 'traspasos' */}
      {activeSubTab === 'traspasos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* LEFT: Request / Send Form (5 cols) */}
          <div className="lg:col-span-5 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4 h-fit">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Send size={14} className="text-cyber-pink" />
              NUEVO MOVIMIENTO ENTRE BODEGA & MIEMBROS
            </h2>
            <p className="text-[11px] text-gray-400">
              Inicie un traspaso de Bodega Central a su inventario, o envíe una devolución. Los cambios requieren aprobación del destinatario para hacerse efectivos.
            </p>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-mono block">DIRECCIÓN DE OPERACIÓN</label>
                <select
                  value={transferDirection}
                  onChange={e => {
                    setTransferDirection(e.target.value as any);
                    setTransferProductId('');
                    setTransferUserId('');
                  }}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                >
                  <option value="bodega_to_user">📥 Solicitar Traspaso: Bodega Central ➔ Mi Stock</option>
                  <option value="user_to_bodega">📤 Enviar Devolución: Mi Stock ➔ Bodega Central</option>
                  {currentUser.role === 'Administrador' && (
                    <option value="admin_to_any">📦 Traspasar de Bodega Central ➔ Otro Usuario</option>
                  )}
                </select>
              </div>

              {transferDirection === 'admin_to_any' && (
                <div className="space-y-1">
                  <label className="text-gray-400 font-mono block">USUARIO DESTINATARIO</label>
                  <select
                    value={transferUserId}
                    onChange={e => setTransferUserId(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  >
                    <option value="">-- Seleccionar usuario --</option>
                    {users.filter(u => u.id !== 'bodega' && u.id !== currentUser.id).map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-400 font-mono block">SELECCIONAR INSUMO</label>
                <select
                  value={transferProductId}
                  onChange={e => setTransferProductId(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  required
                >
                  <option value="">-- Seleccionar insumo --</option>
                  {products.map(p => {
                    const currentStock = transferDirection === 'user_to_bodega' ? getPersonalStock(p) : p.stock;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.imageUrl || '📦'} {p.name} (Disp: {currentStock} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'l' : 'u'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono block">CANTIDAD A TRASPASAR</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={transferQty}
                  onChange={e => setTransferQty(Math.max(0.01, parseFloat(e.target.value) || 0))}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono block">SOPORTE DIGITAL / NOTAS DE ENVÍO</label>
                <textarea
                  placeholder="Describa el motivo, estado del empaque, sello de seguridad, etc."
                  value={supportProofNotes}
                  onChange={e => setSupportProofNotes(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 h-20 rounded-lg text-white text-xs focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyber-pink text-black hover:bg-cyber-accent font-bold font-mono py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 neon-shadow-pink"
              >
                <Send size={14} /> Enviar Solicitud de Traspaso
              </button>
            </form>
          </div>

          {/* RIGHT: Pending & History Lists (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Pending Approvals Section */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <AlertCircle size={14} className="text-cyber-orange" />
                SOLICITUDES PENDIENTES DE VERIFICACIÓN
              </h2>

              <div className="space-y-3">
                {transfers.filter(t => t.status === 'pendiente').map(t => {
                  const prod = products.find(p => p.id === t.items[0]?.productId);
                  const senderName = t.origin === 'bodega' ? 'Bodega Central' : users.find(u => u.id === t.origin)?.fullName || t.origin;
                  const receiverName = t.destination === 'bodega' ? 'Bodega Central' : users.find(u => u.id === t.destination)?.fullName || t.destination;
                  
                  const isActionable = 
                    (currentUser.role === 'Administrador' && t.destination === 'bodega') ||
                    (t.destination === currentUser.id);

                  return (
                    <div key={t.id} className={`p-4 rounded-xl border ${isActionable ? 'border-cyber-orange/40 bg-cyber-orange/5' : 'border-slate-800 bg-slate-900/40'} space-y-3`}>
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-gray-500 block">ID: {t.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-xs font-bold text-white">Traspaso de {senderName} ➔ {receiverName}</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/20 px-2 py-0.5 rounded-full uppercase animate-pulse">
                          Pendiente Verificación
                        </span>
                      </div>

                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-xs space-y-1 text-gray-300">
                        {t.items.map(it => (
                          <div key={it.productId} className="flex justify-between">
                            <span>{it.productName}</span>
                            <span className="font-bold text-cyber-pink">{it.quantity} {prod?.unitType === 'gr' ? 'g' : prod?.unitType === 'ml' ? 'ml' : prod?.unitType === 'l' ? 'l' : 'u'}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-gray-400 font-sans italic bg-slate-900/60 p-2.5 rounded border border-slate-850">
                        <strong className="text-gray-300 font-mono text-[9px] block uppercase not-italic">Soporte de Envío:</strong>
                        "{t.supportNotes || 'Sin comentarios adicionales.'}"
                      </div>

                      <div className="text-[10px] font-mono text-gray-500">
                        Solicitado el {new Date(t.createdAt).toLocaleString()}
                      </div>

                      {isActionable ? (
                        <div className="space-y-3 pt-2 border-t border-slate-800/80">
                          {resolvingTransferId === t.id ? (
                            <div className="space-y-2">
                              <label className="text-[10px] font-mono text-cyber-orange block">INGRESAR SOPORTE / ACTA DE VERIFICACIÓN DE ENTREGA</label>
                              <textarea
                                value={approvalNotes}
                                onChange={e => setApprovalNotes(e.target.value)}
                                placeholder="Verificado en orden, insumos pesados y sellados conforme."
                                className="w-full bg-cyber-bg border border-cyber-orange/30 p-2 rounded-lg text-white text-xs focus:outline-none"
                                required
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onUpdateTransferStatus) {
                                      onUpdateTransferStatus(t.id, 'aprobado', approvalNotes || 'Sello e insumos verificados conforme.');
                                    }
                                    setResolvingTransferId(null);
                                    setApprovalNotes('');
                                  }}
                                  className="bg-cyber-green text-black hover:bg-emerald-400 font-bold font-mono px-3 py-1.5 rounded-md text-[10px] cursor-pointer flex-1"
                                >
                                  Confirmar y Aprobar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onUpdateTransferStatus) {
                                      onUpdateTransferStatus(t.id, 'rechazado', approvalNotes || 'Rechazado en verificación.');
                                    }
                                    setResolvingTransferId(null);
                                    setApprovalNotes('');
                                  }}
                                  className="bg-red-500 text-white hover:bg-red-400 font-bold font-mono px-3 py-1.5 rounded-md text-[10px] cursor-pointer"
                                >
                                  Rechazar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResolvingTransferId(null)}
                                  className="bg-slate-800 text-gray-400 px-3 py-1.5 rounded-md text-[10px] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setResolvingTransferId(t.id);
                                  setApprovalNotes('');
                                }}
                                className="bg-cyber-orange text-black hover:bg-amber-400 font-bold font-mono px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 shadow-md hover:neon-shadow-orange transition-all"
                              >
                                <CheckCircle size={13} /> Verificar y Recibir Stock
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-500 font-mono italic">
                          Esperando verificación por parte del destinatario.
                        </div>
                      )}
                    </div>
                  );
                })}

                {transfers.filter(t => t.status === 'pendiente').length === 0 && (
                  <div className="py-2">
                    <CyberEmpty 
                      title="Sin Pendientes" 
                      description="No tienes solicitudes de verificación de traspaso pendientes." 
                      icon={AlertCircle}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Historical Ledger Section */}
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <History size={14} className="text-cyber-pink" />
                HISTORIAL DE TRASPASOS & COMPROBANTES DE SOPORTE
              </h2>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {transfers.filter(t => t.status !== 'pendiente').map(t => {
                  const prod = products.find(p => p.id === t.items[0]?.productId);
                  const senderName = t.origin === 'bodega' ? 'Bodega Central' : users.find(u => u.id === t.origin)?.fullName || t.origin;
                  const receiverName = t.destination === 'bodega' ? 'Bodega Central' : users.find(u => u.id === t.destination)?.fullName || t.destination;
                  const isApproved = t.status === 'aprobado';

                  return (
                    <div key={t.id} className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[10px] text-gray-500">DOC: #{t.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isApproved 
                            ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {t.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white">
                        {senderName} ➔ {receiverName}
                      </div>

                      <div className="text-[11px] text-gray-300">
                        {t.items.map(it => `${it.productName} (${it.quantity} ${prod?.unitType === 'gr' ? 'g' : prod?.unitType === 'ml' ? 'ml' : prod?.unitType === 'l' ? 'l' : 'u'})`).join(', ')}
                      </div>

                      <div className="text-[10px] text-gray-400 bg-slate-950/40 p-2 rounded border border-slate-850/60 space-y-1">
                        <div>
                          <strong className="text-gray-500 uppercase text-[8px] block">Soporte de Envío:</strong>
                          <span className="italic">"{t.supportNotes}"</span>
                        </div>
                        {t.resolvedAt && (
                          <div className="pt-1.5 border-t border-slate-800 mt-1.5">
                            <strong className="text-gray-500 uppercase text-[8px] block">Fecha de Resolución:</strong>
                            <span>{new Date(t.resolvedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {transfers.filter(t => t.status !== 'pendiente').length === 0 && (
                  <div className="py-2">
                    <CyberEmpty 
                      title="Historial Limpio" 
                      description="No hay registros históricos de traspaso o comprobantes resueltos." 
                      icon={FileText}
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Stock Adjustment */}
      {showAdjustModal && activeAdjustProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <RefreshCw size={15} className="text-cyber-orange" />
                REGISTRAR MOVIMIENTO DE STOCK
              </h3>
              <button onClick={() => { setShowAdjustModal(false); setActiveAdjustProduct(null); }} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div className="font-semibold text-white">{activeAdjustProduct.name}</div>
              <div className="text-gray-400 font-mono">Stock actual: {activeAdjustProduct.stock} unidades</div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Tipo de Transacción</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('Ingreso')}
                    className={`py-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                      adjustType === 'Ingreso' 
                        ? 'bg-cyber-green/10 border-cyber-green text-cyber-green' 
                        : 'bg-slate-900 border-slate-800 text-gray-400'
                    }`}
                  >
                    Ingreso (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('Egreso')}
                    className={`py-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                      adjustType === 'Egreso' 
                        ? 'bg-red-500/10 border-red-500 text-red-400' 
                        : 'bg-slate-900 border-slate-800 text-gray-400'
                    }`}
                  >
                    Egreso (-)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Cantidad de Unidades</label>
                <input 
                  type="number"
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-orange"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Justificación del ajuste</label>
                <textarea 
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Por ejemplo: Ingreso de mercancía por pedido #19, Merma de almacén..."
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs h-16 focus:outline-none glow-border-orange"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowAdjustModal(false); setActiveAdjustProduct(null); }}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-orange text-black hover:bg-orange-600 px-4 py-2 rounded-lg font-bold font-mono"
                >
                  Grabar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Product */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <PlusCircle size={15} className="text-cyber-pink" />
                REGISTRAR NUEVO SUMINISTRO EN INVENTARIO
              </h3>
              <button onClick={() => setShowAddProduct(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-gray-400 font-mono">Descripción del Suministro</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    placeholder="e.g. Inyector de Energía Solar"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Código SKU</label>
                  <input 
                    type="text" 
                    value={newCode} 
                    onChange={e => setNewCode(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    placeholder="SKU-001"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    {(config?.productCategories || ["Contenedores", "Energía", "Químicos", "Dispositivos", "Protección", "Filtros", "Botánica"]).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Costo de Compra ($)</label>
                  <input 
                    type="number" 
                    value={newCost} 
                    onChange={e => setNewCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Precio de Despacho ($)</label>
                  <input 
                    type="number" 
                    value={newPrice} 
                    onChange={e => setNewPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Unidad de Venta</label>
                  <select
                    value={newUnitType}
                    onChange={e => setNewUnitType(e.target.value as any)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    <option value="unidad">📦 Por Unidad (U)</option>
                    <option value="gr">⚖️ Por Gramo (Gr)</option>
                    <option value="ml">🧪 Por Mililitro (ML)</option>
                    <option value="l">🍶 Por Litro (L)</option>
                  </select>
                </div>

                {newUnitType === 'gr' && (
                  <div className="col-span-2 p-3 bg-slate-900/60 rounded-lg border border-cyber-pink/20 space-y-2.5">
                    <div className="text-[10px] text-cyber-pink font-bold font-mono tracking-wider uppercase">
                      PRECIOS ESPECIALES PARA GRAMAJES (OPCIONALES)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1 Gr (Símb. 1)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $5.0"
                          value={newSpecialPrice1g}
                          onChange={e => setNewSpecialPrice1g(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1/2 Gr (Símb. 1/2)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $3.0"
                          value={newSpecialPriceHalfG}
                          onChange={e => setNewSpecialPriceHalfG(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1/4 Gr (Símb. 1/4)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $1.8"
                          value={newSpecialPriceQuarterG}
                          onChange={e => setNewSpecialPriceQuarterG(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Inventario Inicial</label>
                  <input 
                    type="number" 
                    step="any"
                    value={newStock} 
                    onChange={e => setNewStock(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Alerta Stock Mínimo</label>
                  <input 
                    type="number" 
                    step="any"
                    value={newMinStock} 
                    onChange={e => setNewMinStock(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-gray-400 font-mono">Emoji / Icono representativo</label>
                  <input 
                    type="text" 
                    value={newEmoji} 
                    onChange={e => setNewEmoji(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink text-center text-lg"
                    placeholder="📦"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddProduct(false)}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold font-mono"
                >
                  Registrar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Product */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <span>✏️</span> EDITAR SUMINISTRO: {editingProduct.name.toUpperCase()}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateProductSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-gray-400 font-mono">Descripción del Suministro</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Código SKU</label>
                  <input 
                    type="text" 
                    value={editCode} 
                    onChange={e => setEditCode(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Categoría</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    {(config?.productCategories || ["Contenedores", "Energía", "Químicos", "Dispositivos", "Protección", "Filtros", "Botánica"]).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Costo de Compra ($)</label>
                  <input 
                    type="number" 
                    value={editCost} 
                    onChange={e => setEditCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Precio de Despacho ($)</label>
                  <input 
                    type="number" 
                    value={editPrice} 
                    onChange={e => setEditPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Unidad de Venta</label>
                  <select
                    value={editUnitType}
                    onChange={e => setEditUnitType(e.target.value as any)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    <option value="unidad">📦 Por Unidad (U)</option>
                    <option value="gr">⚖️ Por Gramo (Gr)</option>
                    <option value="ml">🧪 Por Mililitro (ML)</option>
                    <option value="l">🍶 Por Litro (L)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-mono">Alerta Stock Mínimo</label>
                  <input 
                    type="number" 
                    step="any"
                    value={editMinStock} 
                    onChange={e => setEditMinStock(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>

                {editUnitType === 'gr' && (
                  <div className="col-span-2 p-3 bg-slate-900/60 rounded-lg border border-cyber-pink/20 space-y-2.5">
                    <div className="text-[10px] text-cyber-pink font-bold font-mono tracking-wider uppercase">
                      PRECIOS ESPECIALES PARA GRAMAJES (OPCIONALES)
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1 Gr (Símb. 1)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $5.0"
                          value={editSpecialPrice1g}
                          onChange={e => setEditSpecialPrice1g(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1/2 Gr (Símb. 1/2)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $3.0"
                          value={editSpecialPriceHalfG}
                          onChange={e => setEditSpecialPriceHalfG(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-mono">1/4 Gr (Símb. 1/4)</label>
                        <input 
                          type="number"
                          placeholder="P. ej. $1.8"
                          value={editSpecialPriceQuarterG}
                          onChange={e => setEditSpecialPriceQuarterG(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2 rounded text-white text-xs focus:outline-none focus:border-cyber-pink"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1 col-span-2">
                  <label className="text-gray-400 font-mono">Emoji / Icono representativo</label>
                  <input 
                    type="text" 
                    value={editEmoji} 
                    onChange={e => setEditEmoji(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink text-center text-lg"
                    placeholder="📦"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)}
                  className="bg-slate-900 text-gray-400 px-4 py-2 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold font-mono text-xs cursor-pointer neon-shadow-pink"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Product History */}
      {historyProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                <History size={15} className="text-cyan-400" />
                HISTORIAL DE MOVIMIENTOS: {historyProduct.name.toUpperCase()}
              </h3>
              <button onClick={() => setHistoryProduct(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {adjustments.filter(a => a.productId === historyProduct.id).slice().reverse().map(adj => {
                const isIngreso = adj.type === 'Ingreso' || adj.type === 'Inventario Inicial';
                return (
                  <div key={adj.id} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="font-bold text-white uppercase text-[10px]">{adj.type}</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                        isIngreso 
                          ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {isIngreso ? `+${adj.quantity}` : `-${adj.quantity}`}
                      </span>
                    </div>
                    <div className="text-gray-400 text-[10px] leading-tight">Concepto: "{adj.reason}"</div>
                    <div className="flex justify-between text-[9px] text-gray-500 pt-1">
                      <span>Por: {adj.user}</span>
                      <span>{new Date(adj.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}

              {adjustments.filter(a => a.productId === historyProduct.id).length === 0 && (
                <div className="py-6 text-center text-xs text-gray-500 font-mono">
                  No se registran movimientos para este producto en la bitácora.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryProduct(null)}
                className="bg-slate-900 border border-slate-800 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
