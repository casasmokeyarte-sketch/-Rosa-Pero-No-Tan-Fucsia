import React, { useState } from 'react';
import { Invoice, BusinessConfig, Product, InvoiceItem } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  Globe, 
  Search, 
  MapPin, 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  Printer, 
  CheckCircle, 
  Play, 
  CreditCard,
  Inbox,
  Package,
  Edit,
  Plus,
  Minus,
  Trash,
  PlusCircle,
  FileText
} from 'lucide-react';

interface ComprasWebProps {
  invoices: Invoice[];
  config: BusinessConfig;
  onUpdateInvoice: (updated: Invoice) => void;
  products?: Product[];
}

export default function ComprasWeb({ invoices, config, onUpdateInvoice, products = [] }: ComprasWebProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Orden de Compra' | 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado'>('Todos');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  // Review & Edit Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewInvoice, setReviewInvoice] = useState<Invoice | null>(null);
  const [editedItems, setEditedItems] = useState<InvoiceItem[]>([]);
  const [editedDeliveryFee, setEditedDeliveryFee] = useState<number>(0);
  const [editedAddress, setEditedAddress] = useState<string>('');
  const [editedNotes, setEditedNotes] = useState<string>('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');

  // Get all online purchases
  const webInvoices = invoices.filter(inv => inv.cashierName === 'Portal Online');

  // Statistics
  const totalCount = webInvoices.length;
  const pendingApprovalCount = webInvoices.filter(inv => inv.paymentStatus === 'Orden de Compra').length;
  const pendingPackCount = webInvoices.filter(inv => inv.paymentStatus !== 'Orden de Compra' && inv.deliveryStatus === 'Pendiente').length;
  const readyCount = webInvoices.filter(inv => inv.paymentStatus !== 'Orden de Compra' && inv.deliveryStatus === 'En Camino').length;
  const completedCount = webInvoices.filter(inv => inv.paymentStatus !== 'Orden de Compra' && inv.deliveryStatus === 'Entregado').length;

  const totalEarnings = webInvoices
    .filter(inv => inv.paymentStatus === 'Pagado')
    .reduce((sum, inv) => sum + inv.total, 0);

  // Filter lists
  const filteredInvoices = webInvoices.filter(inv => {
    // Custom filter mapping for status tab selection
    if (statusFilter !== 'Todos') {
      if (statusFilter === 'Orden de Compra') {
        if (inv.paymentStatus !== 'Orden de Compra') return false;
      } else {
        if (inv.paymentStatus === 'Orden de Compra') return false;
        if (inv.deliveryStatus !== statusFilter) return false;
      }
    }

    const query = searchTerm.toLowerCase();
    const matchNumber = inv.invoiceNumber.toLowerCase().includes(query);
    const matchClient = inv.clientName.toLowerCase().includes(query);
    const matchMethod = (inv.paymentMethod || '').toLowerCase().includes(query);

    return matchNumber || matchClient || matchMethod;
  });

  // Handle logistical status update
  const handleUpdateStatus = (invoiceId: string, newStatus: 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado') => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      const updatedInvoice: Invoice = {
        ...inv,
        deliveryStatus: newStatus
      };
      
      // If completed delivery, make sure payment is set to paid if it was not credit
      if (newStatus === 'Entregado' && inv.paymentMethod !== 'Crédito') {
        updatedInvoice.paymentStatus = 'Pagado';
      }
      onUpdateInvoice(updatedInvoice);
    }
  };

  // Confirm payment transition ('Pendiente' -> 'Pagado')
  const handleConfirmPayment = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      const updatedInvoice: Invoice = {
        ...inv,
        paymentStatus: 'Pagado'
      };
      onUpdateInvoice(updatedInvoice);
    }
  };

  // Open pre-pedido review modal
  const openReviewModal = (inv: Invoice) => {
    setReviewInvoice(inv);
    setEditedItems([...inv.items]);
    setEditedDeliveryFee(inv.deliveryFee || 0);
    setEditedAddress(inv.guideAddress || '');
    setEditedNotes(inv.guideNotes || '');
    setSelectedProductToAdd('');
    setShowReviewModal(true);
  };

  // Adjust item quantity in review modal
  const handleAdjustReviewQty = (productId: string, amount: number) => {
    setEditedItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + amount);
        return {
          ...item,
          quantity: newQty,
          total: item.price * newQty
        };
      }
      return item;
    }));
  };

  // Remove item from review modal
  const handleRemoveReviewItem = (productId: string) => {
    setEditedItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Add replacement/new product to pre-pedido review modal
  const handleAddProductToReview = () => {
    if (!selectedProductToAdd) return;
    const prod = products.find(p => p.id === selectedProductToAdd);
    if (!prod) return;

    // Check if already in order
    const exists = editedItems.find(item => item.productId === prod.id);
    if (exists) {
      handleAdjustReviewQty(prod.id, 1);
    } else {
      const newItem: InvoiceItem = {
        productId: prod.id,
        productName: prod.name,
        price: prod.price,
        quantity: 1,
        taxAmount: 0,
        total: prod.price
      };
      setEditedItems(prev => [...prev, newItem]);
    }
    setSelectedProductToAdd('');
  };

  // Save approved pre-pedido order
  const handleApprovePrePedido = () => {
    if (!reviewInvoice) return;
    if (editedItems.length === 0) {
      alert("La orden no puede quedar sin insumos. Agrega algún producto o anula la orden.");
      return;
    }

    const calculatedSubtotal = editedItems.reduce((sum, item) => sum + item.total, 0);
    const calculatedTotal = calculatedSubtotal + editedDeliveryFee;

    const approvedInvoice: Invoice = {
      ...reviewInvoice,
      items: editedItems,
      subtotal: calculatedSubtotal,
      deliveryFee: editedDeliveryFee,
      total: calculatedTotal,
      guideAddress: editedAddress,
      guideNotes: editedNotes,
      paymentStatus: 'Pendiente', // Transition from 'Orden de Compra' to 'Pendiente' (Aprobado, esperando transferencia)
      deliveryStatus: 'Pendiente'
    };

    onUpdateInvoice(approvedInvoice);
    setShowReviewModal(false);
    setReviewInvoice(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-mono text-xs text-gray-300">
      
      {/* HEADER */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyber-pink/5 to-transparent"></div>
        <div className="flex items-center gap-2 text-cyber-pink font-bold uppercase tracking-widest text-[10px] animate-pulse">
          <Globe size={14} />
          <span>Servidor de Enlace Web</span>
        </div>
        <h1 className="text-xl font-bold text-white mt-1 tracking-wider">
          CENTRO DE LOGÍSTICA COMPRAS WEB
        </h1>
        <p className="text-[10px] text-gray-400 mt-0.5 font-sans leading-relaxed">
          Gestione las Órdenes de Compra (pre-pedidos) generadas por los clientes. Revise existencias, corrija las cantidades o agregue insumos sustitutos antes de aprobar la orden de cobro.
        </p>
      </div>

      {/* STATS BENTO ROW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Compras Web', value: totalCount, icon: Inbox, color: 'text-white', border: 'border-cyber-border' },
          { label: 'Pre-pedidos Nuevos', value: pendingApprovalCount, icon: FileText, color: 'text-amber-400 animate-pulse', border: 'border-amber-500/20' },
          { label: 'Por Empacar', value: pendingPackCount, icon: Package, color: 'text-cyan-400', border: 'border-cyan-500/20' },
          { label: 'En Ruta / Retiro', value: readyCount, icon: Clock, color: 'text-pink-400', border: 'border-pink-500/20' },
          { label: 'Recaudado Web', value: `$${totalEarnings.toLocaleString('es-CO')}`, icon: DollarSign, color: 'text-emerald-400 font-extrabold', border: 'border-emerald-500/20', isCurrency: true }
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-cyber-card border ${s.border} rounded-xl p-4 flex flex-col justify-between hover:border-cyber-pink/40 transition-all`}>
              <span className="text-[9px] text-gray-500 block uppercase tracking-wider">{s.label}</span>
              <div className="flex items-baseline justify-between mt-2.5">
                <span className={`text-xl font-extrabold font-mono ${s.color}`}>{s.value}</span>
                <Icon size={14} className={s.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search size={14} className="absolute left-3 top-3 text-gray-500" />
          <input 
            type="text"
            placeholder="Buscar por remito, cliente o método..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-bg border border-cyber-border text-white text-xs pl-9 pr-4 py-2.5 rounded-lg focus:outline-none glow-border-pink font-mono"
          />
        </div>

        {/* Tab Status Filter */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto font-mono">
          {([
            { id: 'Todos', label: 'TODOS' },
            { id: 'Orden de Compra', label: 'NUEVAS ÓRDENES' },
            { id: 'Pendiente', label: 'POR EMPACAR' },
            { id: 'En Camino', label: 'RUTA/RETIRO' },
            { id: 'Entregado', label: 'ENTREGADOS' },
            { id: 'Cancelado', label: 'ANULADAS' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink'
                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* WEB PURCHASES LIST TABLE */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cyber-border bg-slate-950/80 text-gray-400 uppercase text-[9px] tracking-wider">
                <th className="p-4">Pedido / Fecha</th>
                <th className="p-4">Cliente / Identificación</th>
                <th className="p-4">Entrega / Dirección</th>
                <th className="p-4">Detalle Pago / Estado</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4 text-center">Estado Logístico</th>
                <th className="p-4 text-right">Acciones de Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.map(invoice => {
                let statusBadgeColor = 'text-amber-400 bg-amber-400/10 border border-amber-400/20';
                let statusLabel = 'Por Empacar';
                
                if (invoice.paymentStatus === 'Orden de Compra') {
                  statusBadgeColor = 'text-amber-400 bg-amber-400/10 border border-amber-400/20';
                  statusLabel = 'Esperando Aprobación';
                } else if (invoice.deliveryStatus === 'En Camino') {
                  statusBadgeColor = 'text-cyan-400 bg-cyan-400/10 border-cyber-cyan/20 animate-pulse';
                  statusLabel = invoice.deliveryMethod === 'recoge' ? 'Listo para Retiro' : 'En Ruta';
                } else if (invoice.deliveryStatus === 'Entregado') {
                  statusBadgeColor = 'text-cyber-green bg-cyber-green/10 border border-cyber-green/20';
                  statusLabel = invoice.deliveryMethod === 'recoge' ? 'Retirado' : 'Entregado';
                } else if (invoice.deliveryStatus === 'Cancelado') {
                  statusBadgeColor = 'text-red-400 bg-red-400/10 border border-red-400/20';
                  statusLabel = 'Cancelado';
                }

                return (
                  <tr key={invoice.id} className="hover:bg-slate-900/40 text-gray-300">
                    
                    {/* Invoice ID & Date */}
                    <td className="p-4">
                      <div className="font-bold text-white uppercase tracking-wider">{invoice.invoiceNumber}</div>
                      <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar size={10} />
                        <span>{new Date(invoice.createdAt).toLocaleDateString('es-CO')}</span>
                        <Clock size={10} className="ml-1" />
                        <span>{new Date(invoice.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="p-4">
                      <div className="font-semibold text-white">{invoice.clientName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">RUT: {invoice.clientRut}</div>
                    </td>

                    {/* Delivery / Address */}
                    <td className="p-4 max-w-xs">
                      <div className="flex items-center gap-1 text-gray-200">
                        <MapPin size={11} className="text-cyber-pink shrink-0" />
                        <span className="truncate">{invoice.guideAddress || 'Dirección Registrada'}</span>
                      </div>
                      <div className="mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          invoice.deliveryMethod === 'oficina' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          invoice.deliveryMethod === 'cliente' ? 'bg-cyber-pink/10 text-cyber-pink border border-cyber-pink/20' :
                          'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                        }`}>
                          {invoice.deliveryMethod === 'oficina' ? 'Envío Oficina' :
                           invoice.deliveryMethod === 'cliente' ? 'Envío Propio' :
                           'Retira en Persona'}
                        </span>
                        {invoice.deliveryMethod === 'oficina' && (
                          <span className="text-[9px] text-gray-500 ml-1.5 uppercase">
                            [{invoice.deliveryTransport} - {invoice.deliveryRider}]
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Payment details */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={11} className="text-cyber-blue shrink-0" />
                        <span className="text-white font-medium uppercase">{invoice.paymentMethod}</span>
                      </div>
                      <div className="text-[9px] mt-1">
                        Estatus: 
                        {invoice.paymentStatus === 'Orden de Compra' ? (
                          <span className="ml-1 text-amber-400 font-bold bg-amber-400/10 px-1 py-0.5 rounded border border-amber-400/25">PRE-PEDIDO</span>
                        ) : invoice.paymentStatus === 'Pendiente' ? (
                          <span className="ml-1 text-cyber-orange font-bold bg-cyber-orange/10 px-1 py-0.5 rounded border border-cyber-orange/25 animate-pulse">PENDIENTE TRANSFERENCIA</span>
                        ) : (
                          <span className="ml-1 text-cyber-green font-bold bg-cyber-green/10 px-1 py-0.5 rounded border border-cyber-green/25">PAGADO</span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="p-4 text-right font-bold text-white text-sm">
                      ${invoice.total.toLocaleString('es-CO')}
                    </td>

                    {/* Delivery Status */}
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold border ${statusBadgeColor}`}>
                        {statusLabel.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-1.5 font-mono text-[9px]">
                        
                        {/* 1. Web Order in draft status */}
                        {invoice.paymentStatus === 'Orden de Compra' && (
                          <button
                            onClick={() => openReviewModal(invoice)}
                            className="bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/40 px-2 py-1.5 rounded font-bold cursor-pointer transition-all flex items-center gap-1 border-none"
                          >
                            <Edit size={11} />
                            <span>REVISAR / APROBAR</span>
                          </button>
                        )}

                        {/* 2. Web Order approved but waiting for bank transfer */}
                        {invoice.paymentStatus === 'Pendiente' && (
                          <button
                            onClick={() => handleConfirmPayment(invoice.id)}
                            className="bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/45 border border-cyber-green/50 px-2 py-1.5 rounded font-bold cursor-pointer transition-all flex items-center gap-1 border-none"
                            title="Confirmar recibo de transferencia bancaria"
                          >
                            <CheckCircle size={11} />
                            <span>CONFIRMAR PAGO</span>
                          </button>
                        )}

                        {/* 3. Logical Dispatch Flow for approved & paid invoices */}
                        {invoice.paymentStatus !== 'Orden de Compra' && invoice.deliveryStatus === 'Pendiente' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'En Camino')}
                            className="bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/30 px-2.5 py-1.5 rounded border border-cyan-500/40 font-bold cursor-pointer flex items-center gap-1 transition-all border-none"
                            title={invoice.deliveryMethod === 'recoge' ? "Marcar como empacado y alistado" : "Empacar e iniciar despacho"}
                          >
                            <Play size={10} />
                            <span>{invoice.deliveryMethod === 'recoge' ? 'EMPACAR' : 'DESPACHAR'}</span>
                          </button>
                        )}

                        {invoice.paymentStatus !== 'Orden de Compra' && invoice.deliveryStatus === 'En Camino' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'Entregado')}
                            className="bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/40 px-2.5 py-1.5 rounded border border-cyber-green/30 font-bold cursor-pointer flex items-center gap-1 transition-all border-none"
                            title={invoice.deliveryMethod === 'recoge' ? "Confirmar entrega al cliente en tienda" : "Confirmar entrega en domicilio"}
                          >
                            <CheckCircle size={10} />
                            <span>{invoice.deliveryMethod === 'recoge' ? 'ENTREGAR' : 'ENTREGADO'}</span>
                          </button>
                        )}

                        {invoice.deliveryStatus !== 'Entregado' && invoice.deliveryStatus !== 'Cancelado' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'Cancelado')}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1.5 rounded font-bold border border-red-500/20 cursor-pointer transition-all"
                            title="Anular despacho"
                          >
                            ✕
                          </button>
                        )}

                        {/* Print Button */}
                        <button
                          onClick={() => setSelectedInvoiceForPrint(invoice)}
                          className="bg-slate-900 hover:bg-slate-800 text-gray-300 p-1.5 rounded border border-slate-800 cursor-pointer"
                          title="Imprimir Guía de Despacho"
                        >
                          <Printer size={12} />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 px-4">
                    <CyberEmpty 
                      title="Sin Compras Web" 
                      description="No se registran compras web con los filtros aplicados en este momento." 
                      icon={Globe}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REVIEW AND EDIT PRE-PEDIDO */}
      {showReviewModal && reviewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-3xl w-full space-y-4 relative shadow-[0_0_60px_rgba(244,63,94,0.15)] font-mono text-xs">
            
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit size={16} className="text-amber-400" />
                  REVISAR Y AJUSTAR ORDEN DE COMPRA #{reviewInvoice.invoiceNumber}
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Cliente: {reviewInvoice.clientName} (RUT: {reviewInvoice.clientRut})</p>
              </div>
              <button 
                onClick={() => { setShowReviewModal(false); setReviewInvoice(null); }} 
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Product items review table */}
            <div className="space-y-2">
              <span className="text-[10px] text-cyber-pink font-bold uppercase tracking-wider block">Insumos Solicitados por el Cliente:</span>
              <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950 text-gray-500 font-bold uppercase text-[9px]">
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-center">Stock Bodega</th>
                      <th className="p-2.5 text-right">Precio Unit.</th>
                      <th className="p-2.5 text-center">Cantidad</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map(item => {
                      const prodInfo = products.find(p => p.id === item.productId);
                      const currentStock = prodInfo ? prodInfo.stock : 0;
                      return (
                        <tr key={item.productId} className="border-b border-slate-900/50 hover:bg-slate-900/10 text-gray-300">
                          <td className="p-2.5 font-bold text-white">{item.productName}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              currentStock >= item.quantity ? 'bg-cyber-green/10 text-cyber-green' : 'bg-red-950/60 text-red-400 animate-pulse'
                            }`}>
                              {currentStock} und
                            </span>
                          </td>
                          <td className="p-2.5 text-right">${item.price.toLocaleString('es-CO')}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAdjustReviewQty(item.productId, -1)}
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white p-1 rounded font-bold cursor-pointer"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="font-bold text-white px-1.5 w-6 block text-center text-xs">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleAdjustReviewQty(item.productId, 1)}
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white p-1 rounded font-bold cursor-pointer"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-right font-bold text-white">${item.total.toLocaleString('es-CO')}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveReviewItem(item.productId)}
                              className="text-red-400 hover:text-red-300 p-1.5 rounded cursor-pointer transition-colors"
                            >
                              <Trash size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Substitution / Add product section */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[10px] text-cyber-blue font-bold uppercase tracking-wider block">
                🔄 Sustituir o Añadir otro Insumo al Pre-pedido:
              </span>
              <div className="flex gap-2">
                <select
                  value={selectedProductToAdd}
                  onChange={e => setSelectedProductToAdd(e.target.value)}
                  className="flex-1 bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="">-- Seleccionar producto de inventario --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                      {p.name} (Ref: {p.code}) — Stock: {p.stock} und | Price: ${p.price}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProductToReview}
                  className="bg-cyber-blue hover:bg-cyan-500 text-black px-4 rounded-lg font-bold font-mono text-xs cursor-pointer flex items-center gap-1 border-none shadow-md shadow-cyber-blue/10"
                >
                  <PlusCircle size={14} />
                  Añadir Insumo
                </button>
              </div>
            </div>

            {/* Delivery address & Fee, note textareas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 font-bold mb-1 uppercase text-[10px]">Costo de Domicilio / Envío ($):</label>
                  <input
                    type="number"
                    value={editedDeliveryFee}
                    onChange={e => setEditedDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-bold mb-1 uppercase text-[10px]">Dirección de Entrega:</label>
                  <input
                    type="text"
                    value={editedAddress}
                    onChange={e => setEditedAddress(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1 uppercase text-[10px]">Nota del Asesor (Ej: Motivo de sustitución o descuento):</label>
                <textarea
                  value={editedNotes}
                  onChange={e => setEditedNotes(e.target.value)}
                  placeholder="Escribe una nota para el cliente..."
                  className="w-full h-[106px] bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none resize-none"
                />
              </div>

            </div>

            {/* Summary Box & Approve */}
            <div className="border-t border-cyber-border pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900 text-[10px] space-y-1 font-mono text-left w-full sm:w-auto">
                <div>Subtotal Productos: <span className="font-bold text-white">${editedItems.reduce((sum, item) => sum + item.total, 0).toLocaleString('es-CO')} COP</span></div>
                <div>Costo Domicilio: <span className="font-bold text-white">${editedDeliveryFee.toLocaleString('es-CO')} COP</span></div>
                <div className="text-xs pt-1 border-t border-slate-900 text-cyber-pink font-bold">
                  TOTAL A PAGAR: ${(editedItems.reduce((sum, item) => sum + item.total, 0) + editedDeliveryFee).toLocaleString('es-CO')} COP
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setShowReviewModal(false); setReviewInvoice(null); }}
                  className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl border border-slate-800 font-bold cursor-pointer transition-all active:scale-95 text-center"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleApprovePrePedido}
                  className="flex-1 sm:flex-initial bg-cyber-green text-black hover:bg-emerald-400 px-6 py-3 rounded-xl font-bold cursor-pointer transition-all active:scale-95 text-center hover:neon-shadow-green"
                >
                  ✓ Aprobar y Enviar al Cliente
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DISPATCH RECEIPT OVERLAY MODAL */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white text-black p-6 rounded-2xl max-w-sm w-full font-mono text-xs shadow-2xl relative border-4 border-double border-black">
            
            {/* Ticket Header */}
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-black">
              <h3 className="text-sm font-extrabold uppercase">TICKET DE COMPRA WEB</h3>
              <p className="text-[10px] font-bold">ROSA FUERTE LOGÍSTICA</p>
              <p className="text-[9px]">Soporte de Bodega y Despacho</p>
            </div>

            {/* Delivery Core */}
            <div className="py-3 border-b border-dashed border-black text-[10px] space-y-1.5">
              <div className="flex justify-between font-bold">
                <span>REMITO / COMPRA:</span>
                <span>{selectedInvoiceForPrint.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA REGISTRO:</span>
                <span>{new Date(selectedInvoiceForPrint.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>MÉTODO PAGO:</span>
                <span className="font-bold uppercase">{selectedInvoiceForPrint.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>ESTADO PAGO:</span>
                <span className="font-bold text-emerald-700">{selectedInvoiceForPrint.paymentStatus.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>MODALIDAD ENVÍO:</span>
                <span className="font-bold uppercase text-red-600">
                  {selectedInvoiceForPrint.deliveryMethod === 'oficina' ? 'Por Oficina' :
                   selectedInvoiceForPrint.deliveryMethod === 'cliente' ? 'Por cuenta del cliente' :
                   'Retira en persona'}
                </span>
              </div>
            </div>

            {/* Destiny */}
            <div className="py-3 border-b border-dashed border-black text-[10px] space-y-1">
              <div className="font-bold">CLIENTE VIP:</div>
              <div className="uppercase font-bold">{selectedInvoiceForPrint.clientName}</div>
              <div>RUT/NIT: {selectedInvoiceForPrint.clientRut}</div>
              <div className="bg-slate-100 p-1.5 rounded mt-1 font-sans text-[9px] leading-relaxed">
                📍 <strong>Dirección de entrega:</strong> {selectedInvoiceForPrint.guideAddress}
              </div>
            </div>

            {/* Items Summary */}
            <div className="py-3 border-b border-dashed border-black text-[10px] space-y-1">
              <div className="font-bold">INSUMOS A DESPACHAR:</div>
              <div className="space-y-1 border-t border-dashed border-black/20 pt-1.5 mt-1">
                {selectedInvoiceForPrint.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between font-bold">
                    <span>{it.productName} (x{it.quantity})</span>
                    <span>${it.total.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-dashed border-black pt-1.5 mt-2 text-sm font-bold">
                <span>TOTAL LIQUIDADO:</span>
                <span>${selectedInvoiceForPrint.total.toLocaleString('es-CO')} COP</span>
              </div>
            </div>

            {/* Courier Details */}
            {selectedInvoiceForPrint.deliveryMethod === 'oficina' && (
              <div className="py-3 border-b border-dashed border-black text-[10px] space-y-1">
                <div className="font-bold">ASIGNACIÓN MENSAJERÍA:</div>
                <div className="flex justify-between">
                  <span>DOMICILIARIO:</span>
                  <span className="font-bold uppercase">{selectedInvoiceForPrint.deliveryRider || 'ASIGNANDO'}</span>
                </div>
                <div className="flex justify-between">
                  <span>VEHÍCULO / TRANSPORTE:</span>
                  <span className="font-bold uppercase">{selectedInvoiceForPrint.deliveryTransport || 'No definido'}</span>
                </div>
              </div>
            )}

            {/* Signature Area */}
            <div className="py-4 text-center space-y-1">
              <div className="pt-8 border-b border-black w-2/3 mx-auto"></div>
              <p className="text-[8px] uppercase tracking-wider text-gray-600">Firma de Entrega / Despachador de Guardia</p>
            </div>

            {/* Action buttons inside overlay */}
            <div className="flex gap-2 mt-4 border-t border-slate-300 pt-4 no-print font-mono text-xs">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-black text-white hover:bg-slate-900 p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                <Printer size={14} /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPrint(null)}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 p-2.5 rounded-lg font-bold flex items-center justify-center cursor-pointer border-none"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
