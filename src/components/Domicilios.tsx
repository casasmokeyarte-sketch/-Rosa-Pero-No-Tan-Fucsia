import React, { useState } from 'react';
import { Invoice, BusinessConfig, Product } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  Truck, 
  Search, 
  MapPin, 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  Printer, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle,
  Play
} from 'lucide-react';

interface DomiciliosProps {
  invoices: Invoice[];
  products: Product[];
  config: BusinessConfig;
  onUpdateInvoice: (updated: Invoice) => void;
}

export default function Domicilios({
  invoices,
  products,
  config,
  onUpdateInvoice
}: DomiciliosProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado'>('Todos');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  const blockedDispatchItems = selectedInvoiceForPrint
    ? selectedInvoiceForPrint.items.filter(item => {
        const product = products.find(
          candidate => candidate.id === item.productId
        );

        return product?.dispatchEligibilityStatus !== 'allowed';
      })
    : [];

  const canPrintSelectedDispatch =
    Boolean(selectedInvoiceForPrint?.isDelivery) &&
    blockedDispatchItems.length === 0;

  const updateSelectedGuideField = (
    field: 'guideName' | 'guideRut' | 'guidePhone' | 'guideAddress' | 'guideNotes',
    value: string
  ) => {
    setSelectedInvoiceForPrint(current =>
      current ? { ...current, [field]: value } : current
    );
  };

  const saveSelectedGuideChanges = () => {
    if (!selectedInvoiceForPrint) return;
    onUpdateInvoice(selectedInvoiceForPrint);
  };

  // Get all delivery-related invoices
  const deliveryInvoices = invoices.filter(inv => inv.isDelivery);

  // Statistics calculations
  const totalDeliveriesCount = deliveryInvoices.length;
  const pendingCount = deliveryInvoices.filter(inv => inv.deliveryStatus === 'Pendiente').length;
  const inTransitCount = deliveryInvoices.filter(inv => inv.deliveryStatus === 'En Camino').length;
  const completedCount = deliveryInvoices.filter(inv => inv.deliveryStatus === 'Entregado').length;
  const cancelledCount = deliveryInvoices.filter(inv => inv.deliveryStatus === 'Cancelado').length;
  
  const totalDeliveryFees = deliveryInvoices
    .filter(inv => inv.deliveryStatus === 'Entregado')
    .reduce((sum, inv) => sum + (inv.deliveryFee || 0), 0);

  // Filter list
  const filteredDeliveries = deliveryInvoices.filter(inv => {
    // Status Filter
    if (statusFilter !== 'Todos' && inv.deliveryStatus !== statusFilter) {
      return false;
    }

    // Search query
    const query = searchTerm.toLowerCase();
    const matchesClient = inv.clientName.toLowerCase().includes(query);
    const matchesRider = (inv.deliveryRider || '').toLowerCase().includes(query);
    const matchesInvoice = inv.invoiceNumber.toLowerCase().includes(query);
    
    return matchesClient || matchesRider || matchesInvoice;
  });

  // Action: update status
  const handleUpdateStatus = (invoiceId: string, newStatus: 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado') => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      const updatedInvoice: Invoice = {
        ...inv,
        deliveryStatus: newStatus
      };
      // If completed, update payment status if it wasn't on credit
      if (newStatus === 'Entregado' && inv.paymentMethod !== 'Crédito') {
        updatedInvoice.paymentStatus = 'Pagado';
      }
      onUpdateInvoice(updatedInvoice);
    }
  };

  // Browser Print trigger for thermal simulation inside modal
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* MODULE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-cyber-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-cyber-pink font-mono text-xs font-bold uppercase tracking-widest">
            <Truck size={14} className="animate-bounce" />
            <span>Consola de Operaciones</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1 font-mono">
            GESTIÓN DE DOMICILIOS
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Controle despachos en tiempo real, asigne estados y verifique la recaudación de mensajeros.
          </p>
        </div>
      </div>

      {/* OPERATIONS BENTO STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        
        {/* Total Deliveries */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between space-y-1.5 hover:border-cyber-pink/50 transition-all">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">TOTAL DESPACHOS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono">{totalDeliveriesCount}</span>
            <span className="text-cyber-pink text-[10px] font-mono bg-cyber-pink/10 px-1.5 py-0.5 rounded">ENVÍOS</span>
          </div>
        </div>

        {/* Pending Deliveries */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between space-y-1.5 hover:border-amber-400/50 transition-all">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">PENDIENTES</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-400 font-mono">{pendingCount}</span>
            <span className="text-amber-400 text-[10px] font-mono bg-amber-400/10 px-1.5 py-0.5 rounded">ESPERA</span>
          </div>
        </div>

        {/* In Route Deliveries */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between space-y-1.5 hover:border-cyber-cyan/50 transition-all">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">EN CAMINO</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-cyan-400 font-mono">{inTransitCount}</span>
            <span className="text-cyan-400 text-[10px] font-mono bg-cyan-400/10 px-1.5 py-0.5 rounded">RUTA</span>
          </div>
        </div>

        {/* Completed Deliveries */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between space-y-1.5 hover:border-cyber-green/50 transition-all">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">ENTREGADOS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-cyber-green font-mono">{completedCount}</span>
            <span className="text-cyber-green text-[10px] font-mono bg-cyber-green/10 px-1.5 py-0.5 rounded">CONCLUIDO</span>
          </div>
        </div>

        {/* Total Delivery Fees Collected */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between col-span-2 md:col-span-1 space-y-1.5 hover:border-emerald-400/50 transition-all">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">RECAUDO DOMICILIOS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-400 font-mono">${totalDeliveryFees.toFixed(2)}</span>
            <span className="text-emerald-400 text-[10px] font-mono bg-emerald-400/10 px-1.5 py-0.5 rounded">USD</span>
          </div>
        </div>

      </div>

      {/* FILTER PANEL */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search size={14} />
          </div>
          <input 
            type="text"
            placeholder="Buscar por cliente, domiciliario o número de remito..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-cyber-bg border border-cyber-border text-white text-xs pl-9 pr-4 py-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
          />
        </div>

        {/* Tab Status Filter */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto font-mono">
          {(['Todos', 'Pendiente', 'En Camino', 'Entregado', 'Cancelado'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink neon-shadow-pink'
                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.toUpperCase()} 
              {tab === 'Todos' && ` (${totalDeliveriesCount})`}
              {tab === 'Pendiente' && ` (${pendingCount})`}
              {tab === 'En Camino' && ` (${inTransitCount})`}
              {tab === 'Entregado' && ` (${completedCount})`}
              {tab === 'Cancelado' && ` (${cancelledCount})`}
            </button>
          ))}
        </div>

      </div>

      {/* DELIVERIES LIST TABLE */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-cyber-border bg-slate-950/80 text-gray-400 font-mono uppercase text-[10px] tracking-wider">
                <th className="p-4">Factura / Remito</th>
                <th className="p-4">Adquiriente / Cliente</th>
                <th className="p-4">Dirección de Entrega</th>
                <th className="p-4">Domiciliario / Vehículo</th>
                <th className="p-4 text-right">Recargo</th>
                <th className="p-4 text-center">Estado de Despacho</th>
                <th className="p-4 text-right">Acciones de Protocolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredDeliveries.map(delivery => {
                let statusBadgeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
                let statusLabel = delivery.deliveryStatus || '';

                if (delivery.deliveryStatus === 'Pendiente') {
                  statusLabel = 'Por Empacar';
                } else if (delivery.deliveryStatus === 'En Camino') {
                  statusBadgeColor = 'text-cyan-400 bg-cyan-400/10 border-cyber-cyan/20 animate-pulse';
                  statusLabel = delivery.deliveryMethod === 'recoge' ? 'Listo para Retiro' : 'En Camino';
                } else if (delivery.deliveryStatus === 'Entregado') {
                  statusBadgeColor = 'text-cyber-green bg-cyber-green/10 border-cyber-green/20';
                  statusLabel = delivery.deliveryMethod === 'recoge' ? 'Retirado' : 'Entregado';
                } else if (delivery.deliveryStatus === 'Cancelado') {
                  statusBadgeColor = 'text-red-400 bg-red-400/10 border-red-400/20';
                  statusLabel = 'Cancelado';
                }

                return (
                  <tr key={delivery.id} className="hover:bg-slate-900/40 text-gray-300">
                    
                    {/* Invoice Meta */}
                    <td className="p-4">
                      <div className="font-bold text-white uppercase">{delivery.invoiceNumber}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <Calendar size={10} />
                        <span>{new Date(delivery.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="p-4">
                      <div className="font-semibold text-white">{delivery.clientName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">RUT: {delivery.clientRut}</div>
                    </td>

                    {/* Delivery Address */}
                    <td className="p-4 max-w-xs truncate text-xs" title={delivery.guideAddress || delivery.clientRut}>
                      <div className="flex items-center gap-1 text-gray-200">
                        <MapPin size={11} className="text-cyber-pink shrink-0" />
                        <span className="truncate">{delivery.guideAddress || (delivery.clientRut === '222.222.222-2' ? 'Venta Directa / Despacho Programado' : 'Dirección Registrada')}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 flex flex-col gap-0.5">
                        <div>Cobro: <span className="text-white font-bold">{delivery.paymentMethod}</span></div>
                        {delivery.deliveryMethod && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span>Modalidad:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              delivery.deliveryMethod === 'oficina' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                              delivery.deliveryMethod === 'cliente' ? 'bg-cyber-pink/10 text-cyber-pink border border-cyber-pink/20' :
                              'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                            }`}>
                              {delivery.deliveryMethod === 'oficina' ? 'Por Oficina' :
                               delivery.deliveryMethod === 'cliente' ? 'Cuenta Propia' :
                               'Retiro en persona'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Rider and Transport */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-cyber-orange shrink-0" />
                        <span className="text-white font-medium">{delivery.deliveryRider || 'POR ASIGNAR'}</span>
                      </div>
                      <div className="text-[10px] text-cyber-orange mt-1">
                        Medio: {delivery.deliveryTransport || 'No especificado'}
                      </div>
                    </td>

                    {/* Delivery Fee */}
                    <td className="p-4 text-right font-bold text-white text-sm">
                      ${(delivery.deliveryFee || 0).toFixed(2)}
                    </td>

                    {/* Delivery Status */}
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadgeColor}`}>
                        {statusLabel.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        
                        {/* State Transitions */}
                        {delivery.deliveryStatus === 'Pendiente' && (
                          <button
                            onClick={() => handleUpdateStatus(delivery.id, 'En Camino')}
                            className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40 px-2 py-1 rounded text-[10px] font-bold border border-cyan-500/30 cursor-pointer flex items-center gap-1 transition-all"
                            title={delivery.deliveryMethod === 'recoge' ? "Marcar listo para retiro" : "Despachar y empacar"}
                          >
                            <Play size={10} />
                            <span>{delivery.deliveryMethod === 'recoge' ? 'EMPACAR' : 'DESPACHAR'}</span>
                          </button>
                        )}

                        {delivery.deliveryStatus === 'En Camino' && (
                          <button
                            onClick={() => handleUpdateStatus(delivery.id, 'Entregado')}
                            className="bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/40 px-2 py-1 rounded text-[10px] font-bold border border-cyber-green/30 cursor-pointer flex items-center gap-1 transition-all"
                            title={delivery.deliveryMethod === 'recoge' ? "Confirmar retiro por cliente" : "Marcar como entregado"}
                          >
                            <CheckCircle size={10} />
                            <span>{delivery.deliveryMethod === 'recoge' ? 'RETIRAR' : 'ENTREGAR'}</span>
                          </button>
                        )}

                        {/* Cancel option if not finished */}
                        {delivery.deliveryStatus !== 'Entregado' && delivery.deliveryStatus !== 'Cancelado' && (
                          <button
                            onClick={() => handleUpdateStatus(delivery.id, 'Cancelado')}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold border border-red-500/20 cursor-pointer transition-all"
                            title="Anular despacho"
                          >
                            X
                          </button>
                        )}

                        {/* Receipt slip */}
                        <button
                          onClick={() => setSelectedInvoiceForPrint(delivery)}
                          className="bg-slate-900 hover:bg-slate-800 text-gray-300 p-1.5 rounded border border-slate-800 cursor-pointer"
                          title="Ficha de Despacho"
                        >
                          <Printer size={12} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredDeliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 px-4">
                    <CyberEmpty 
                      title="No hay Despachos" 
                      description="No se registran despachos que coincidan con los filtros o la búsqueda." 
                      icon={Truck}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDITABLE A4 DISPATCH GUIDE */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm print-modal-container">
          <div className="print-card relative mx-auto w-full max-w-5xl rounded-2xl border-4 border-double border-black bg-white p-6 font-mono text-xs text-black shadow-2xl">

            <section className="no-print mb-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-black uppercase">
                    Editar guía de despacho
                  </h2>
                  <p className="text-[10px] text-slate-600">
                    Revisa los datos del destinatario antes de guardar o imprimir.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveSelectedGuideChanges}
                  className="rounded bg-cyan-700 px-4 py-2 text-[10px] font-black text-white hover:bg-cyan-800"
                >
                  Guardar datos
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-[10px] font-bold">
                  Destinatario
                  <input
                    type="text"
                    value={
                      selectedInvoiceForPrint.guideName ||
                      selectedInvoiceForPrint.clientName
                    }
                    onChange={event =>
                      updateSelectedGuideField('guideName', event.target.value)
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                  />
                </label>

                <label className="text-[10px] font-bold">
                  Documento / NIT
                  <input
                    type="text"
                    value={
                      selectedInvoiceForPrint.guideRut ||
                      selectedInvoiceForPrint.clientRut
                    }
                    onChange={event =>
                      updateSelectedGuideField('guideRut', event.target.value)
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                  />
                </label>

                <label className="text-[10px] font-bold">
                  Teléfono
                  <input
                    type="text"
                    value={selectedInvoiceForPrint.guidePhone || ''}
                    onChange={event =>
                      updateSelectedGuideField('guidePhone', event.target.value)
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                  />
                </label>

                <label className="text-[10px] font-bold">
                  Dirección completa
                  <input
                    type="text"
                    value={selectedInvoiceForPrint.guideAddress || ''}
                    onChange={event =>
                      updateSelectedGuideField('guideAddress', event.target.value)
                    }
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                  />
                </label>

                <label className="text-[10px] font-bold md:col-span-2">
                  Observaciones e instrucciones
                  <textarea
                    value={selectedInvoiceForPrint.guideNotes || ''}
                    onChange={event =>
                      updateSelectedGuideField('guideNotes', event.target.value)
                    }
                    rows={2}
                    className="mt-1 w-full resize-y rounded border border-slate-300 bg-white p-2 text-xs"
                  />
                </label>
              </div>
            </section>

            {!canPrintSelectedDispatch ? (
              <section className="no-print rounded-xl border-2 border-red-600 bg-red-50 p-5 text-red-800">
                <h2 className="text-sm font-black uppercase">
                  Guía bloqueada
                </h2>
                <p className="mt-1 text-xs">
                  Esta guía no puede imprimirse porque contiene artículos
                  pendientes de revisión o no autorizados para despacho.
                </p>

                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                  {blockedDispatchItems.map(item => (
                    <li key={item.productId}>
                      {item.productName}: pendiente o restringido
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <article className="dispatch-guide-sheet mx-auto w-full bg-white text-black">
                <header className="border-b-2 border-black pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase">
                        Guía de despacho
                      </div>
                      <h1 className="text-2xl font-black">
                        G-{selectedInvoiceForPrint.invoiceNumber.replace(
                          /[^A-Za-z0-9]/g,
                          ''
                        )}
                      </h1>
                    </div>

                    <div className="border border-black px-3 py-1 text-[10px] font-bold">
                      COPIA CONTROL
                    </div>
                  </div>
                </header>

                <section className="grid grid-cols-[90px_1fr] gap-3 border-b border-black py-3">
                  <div className="flex h-16 items-center justify-center border border-slate-300 text-center text-[9px] font-black">
                    LOGO
                  </div>

                  <div className="text-[10px] leading-tight">
                    <h2 className="text-sm font-black uppercase">
                      {config.companyName}
                    </h2>
                    <div>NIT: {config.rut}</div>
                    <div>{config.address}</div>
                    <div>Teléfono: {config.phone}</div>
                    <div>{config.email}</div>
                  </div>
                </section>

                <section className="flex flex-wrap gap-2 border-b border-black py-2 text-[10px]">
                  <div className="border border-black px-2 py-1 font-black uppercase">
                    {selectedInvoiceForPrint.paymentMethod}
                  </div>
                  <div className="border border-slate-400 bg-slate-50 px-2 py-1">
                    Factura: {selectedInvoiceForPrint.invoiceNumber}
                  </div>
                  <div className="border border-slate-400 bg-slate-50 px-2 py-1">
                    Fecha: {
                      new Date(
                        selectedInvoiceForPrint.createdAt
                      ).toLocaleDateString()
                    }
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
                  <div className="min-h-32 border border-black p-2 text-[10px]">
                    <h2 className="mb-2 font-black uppercase">
                      Destinatario
                    </h2>
                    <div className="font-bold uppercase">
                      {
                        selectedInvoiceForPrint.guideName ||
                        selectedInvoiceForPrint.clientName
                      }
                    </div>
                    <div>
                      Documento: {
                        selectedInvoiceForPrint.guideRut ||
                        selectedInvoiceForPrint.clientRut
                      }
                    </div>
                    <div>
                      Teléfono: {
                        selectedInvoiceForPrint.guidePhone ||
                        'No registrado'
                      }
                    </div>
                    <div className="mt-1">
                      Dirección: {
                        selectedInvoiceForPrint.guideAddress ||
                        'No registrada'
                      }
                    </div>
                  </div>

                  <div className="min-h-32 border border-black p-2 text-[10px]">
                    <h2 className="mb-2 font-black uppercase">
                      Datos del envío
                    </h2>
                    <div>Remitente: {config.companyName}</div>
                    <div>
                      Responsable: {selectedInvoiceForPrint.cashierName}
                    </div>
                    <div>
                      Mensajero: {
                        selectedInvoiceForPrint.deliveryRider ||
                        'Pendiente de asignar'
                      }
                    </div>
                    <div>
                      Transporte: {
                        selectedInvoiceForPrint.deliveryTransport ||
                        'No definido'
                      }
                    </div>
                    <div>
                      Estado: {selectedInvoiceForPrint.deliveryStatus}
                    </div>
                  </div>
                </section>

                <section className="border border-black">
                  <h2 className="border-b border-black p-2 text-[10px] font-black uppercase">
                    Artículos autorizados
                  </h2>

                  <table className="w-full border-collapse text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="p-2">Artículo</th>
                        <th className="w-24 p-2 text-right">Cantidad</th>
                        <th className="w-24 p-2 text-right">Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoiceForPrint.items.map(item => (
                        <tr
                          key={item.productId}
                          className="border-b border-slate-300 last:border-0"
                        >
                          <td className="p-2">
                            <div className="font-bold">
                              {item.productName}
                            </div>
                            {item.note && (
                              <div className="text-[9px] italic text-slate-600">
                                {item.note}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {item.quantity}
                          </td>
                          <td className="p-2 text-right">
                            {
                              item.unitType === 'gr'
                                ? 'g'
                                : item.unitType === 'ml'
                                  ? 'ml'
                                  : item.unitType === 'l'
                                    ? 'L'
                                    : 'unidad'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
                  <div className="min-h-24 border border-black p-2 text-[10px]">
                    <h2 className="mb-2 font-black uppercase">
                      Contenido declarado
                    </h2>
                    <p>
                      {selectedInvoiceForPrint.items
                        .map(
                          item =>
                            `${item.productName} x${item.quantity}`
                        )
                        .join(', ')}
                    </p>
                  </div>

                  <div className="min-h-24 border border-black p-2 text-[10px]">
                    <h2 className="mb-2 font-black uppercase">
                      Nota / instrucciones
                    </h2>
                    <p>
                      {
                        selectedInvoiceForPrint.guideNotes ||
                        'Sin observaciones.'
                      }
                    </p>
                  </div>
                </section>

                <section className="border border-black p-2 text-[10px]">
                  <h2 className="font-black uppercase">Código de guía</h2>
                  <div
                    aria-label={`Código de guía G-${selectedInvoiceForPrint.invoiceNumber}`}
                    className="mx-auto mt-3 h-14 max-w-sm border-x-8 border-black"
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, #000 0, #000 2px, #fff 2px, #fff 5px)'
                    }}
                  />
                  <div className="mt-1 text-center font-black">
                    G-{selectedInvoiceForPrint.invoiceNumber.replace(
                      /[^A-Za-z0-9]/g,
                      ''
                    )}
                  </div>
                </section>

                <section className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="min-h-28 border border-black p-2 text-[10px]">
                    <h2 className="mb-2 font-black uppercase">
                      Políticas operativas
                    </h2>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>Verificar destinatario y estado del paquete.</li>
                      <li>No entregar a terceros sin autorización.</li>
                      <li>Registrar novedades de la entrega.</li>
                    </ul>
                  </div>

                  <div className="min-h-28 border border-black p-2 text-[10px]">
                    <h2 className="mb-3 font-black uppercase">
                      Control de entrega
                    </h2>
                    <div className="mb-3 border-b border-black">Recibe:</div>
                    <div className="mb-3 border-b border-black">Documento:</div>
                    <div className="mb-3 border-b border-black">Fecha:</div>
                    <div className="border-b border-black">
                      Observaciones:
                    </div>
                  </div>
                </section>
              </article>
            )}

            <div className="no-print mt-4 flex gap-2 border-t border-slate-300 pt-4">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!canPrintSelectedDispatch}
                aria-disabled={!canPrintSelectedDispatch}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-black p-2.5 text-xs font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Printer size={14} /> Imprimir guía
              </button>

              <button
                type="button"
                onClick={() => setSelectedInvoiceForPrint(null)}
                className="flex-1 rounded-lg bg-red-600 p-2.5 text-xs font-bold text-white hover:bg-red-700"
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
