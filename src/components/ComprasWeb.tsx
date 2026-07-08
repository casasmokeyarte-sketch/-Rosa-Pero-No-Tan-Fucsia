import React, { useState } from 'react';
import { Invoice, BusinessConfig } from '../types';
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
  Package
} from 'lucide-react';

interface ComprasWebProps {
  invoices: Invoice[];
  config: BusinessConfig;
  onUpdateInvoice: (updated: Invoice) => void;
}

export default function ComprasWeb({ invoices, config, onUpdateInvoice }: ComprasWebProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado'>('Todos');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  // Get all online purchases
  const webInvoices = invoices.filter(inv => inv.cashierName === 'Portal Online');

  // Statistics
  const totalCount = webInvoices.length;
  const pendingPackCount = webInvoices.filter(inv => inv.deliveryStatus === 'Pendiente').length;
  const readyCount = webInvoices.filter(inv => inv.deliveryStatus === 'En Camino').length;
  const completedCount = webInvoices.filter(inv => inv.deliveryStatus === 'Entregado').length;

  const totalEarnings = webInvoices
    .filter(inv => inv.paymentStatus === 'Pagado')
    .reduce((sum, inv) => sum + inv.total, 0);

  // Filter lists
  const filteredInvoices = webInvoices.filter(inv => {
    if (statusFilter !== 'Todos' && inv.deliveryStatus !== statusFilter) return false;

    const query = searchTerm.toLowerCase();
    const matchNumber = inv.invoiceNumber.toLowerCase().includes(query);
    const matchClient = inv.clientName.toLowerCase().includes(query);
    const matchMethod = (inv.paymentMethod || '').toLowerCase().includes(query);

    return matchNumber || matchClient || matchMethod;
  });

  // Handle status update
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
          Procesamiento inmediato de compras liquidadas en el portal online. Empaque los insumos y organice los despachos o retiros en oficina.
        </p>
      </div>

      {/* STATS BENTO ROW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Compras Web', value: totalCount, icon: Inbox, color: 'text-white', border: 'border-cyber-border' },
          { label: 'Por Empacar', value: pendingPackCount, icon: Package, color: 'text-amber-400 animate-pulse', border: 'border-amber-500/20' },
          { label: 'En Ruta / Retiro', value: readyCount, icon: Clock, color: 'text-cyan-400', border: 'border-cyan-500/20' },
          { label: 'Completado', value: completedCount, icon: CheckCircle, color: 'text-cyber-green', border: 'border-cyber-green/20' },
          { label: 'Recaudado Web', value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400 font-extrabold', border: 'border-emerald-500/20', isCurrency: true }
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
          {(['Todos', 'Pendiente', 'En Camino', 'Entregado', 'Cancelado'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink'
                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'Pendiente' ? 'POR EMPACAR' : (tab === 'En Camino' ? 'RUTA/RETIRO' : tab.toUpperCase())}
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
                <th className="p-4">Detalle Pago</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4 text-center">Estado Logístico</th>
                <th className="p-4 text-right">Acciones de Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.map(invoice => {
                let statusBadgeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
                let statusLabel = 'Por Empacar';
                
                if (invoice.deliveryStatus === 'En Camino') {
                  statusBadgeColor = 'text-cyan-400 bg-cyan-400/10 border-cyber-cyan/20 animate-pulse';
                  statusLabel = invoice.deliveryMethod === 'recoge' ? 'Listo para Retiro' : 'En Ruta';
                } else if (invoice.deliveryStatus === 'Entregado') {
                  statusBadgeColor = 'text-cyber-green bg-cyber-green/10 border-cyber-green/20';
                  statusLabel = invoice.deliveryMethod === 'recoge' ? 'Retirado' : 'Entregado';
                } else if (invoice.deliveryStatus === 'Cancelado') {
                  statusBadgeColor = 'text-red-400 bg-red-400/10 border-red-400/20';
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
                      <div className="text-[9px] mt-0.5">
                        Estatus: 
                        <span className={`ml-1 font-bold ${
                          invoice.paymentStatus === 'Pagado' ? 'text-cyber-green' : 'text-amber-400'
                        }`}>
                          {invoice.paymentStatus.toUpperCase()}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="p-4 text-right font-bold text-white text-sm">
                      ${invoice.total.toFixed(2)}
                    </td>

                    {/* Delivery Status */}
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold border ${statusBadgeColor}`}>
                        {statusLabel.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        
                        {/* State Transitions */}
                        {invoice.deliveryStatus === 'Pendiente' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'En Camino')}
                            className="bg-[#E82E3E]/20 text-[#E82E3E] hover:bg-[#E82E3E]/40 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-[#E82E3E]/30 cursor-pointer flex items-center gap-1 transition-all"
                            title={invoice.deliveryMethod === 'recoge' ? "Marcar como empacado y alistado" : "Empacar e iniciar despacho"}
                          >
                            <Play size={10} />
                            <span>{invoice.deliveryMethod === 'recoge' ? 'EMPACAR' : 'DESPACHAR'}</span>
                          </button>
                        )}

                        {invoice.deliveryStatus === 'En Camino' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'Entregado')}
                            className="bg-cyber-green/20 text-cyber-green hover:bg-cyber-green/40 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-cyber-green/30 cursor-pointer flex items-center gap-1 transition-all"
                            title={invoice.deliveryMethod === 'recoge' ? "Confirmar entrega al cliente en tienda" : "Confirmar entrega en domicilio"}
                          >
                            <CheckCircle size={10} />
                            <span>{invoice.deliveryMethod === 'recoge' ? 'ENTREGAR' : 'ENTREGADO'}</span>
                          </button>
                        )}

                        {invoice.deliveryStatus !== 'Entregado' && invoice.deliveryStatus !== 'Cancelado' && (
                          <button
                            onClick={() => handleUpdateStatus(invoice.id, 'Cancelado')}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-[9px] font-bold border border-red-500/20 cursor-pointer transition-all"
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
                    <span>${it.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-dashed border-black pt-1.5 mt-2 text-sm font-bold">
                <span>TOTAL LIQUIDADO:</span>
                <span>${selectedInvoiceForPrint.total.toFixed(2)} USD</span>
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
            <div className="flex gap-2 mt-4 border-t border-slate-300 pt-4 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-black text-white hover:bg-slate-900 p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 font-mono text-xs cursor-pointer border-none"
              >
                <Printer size={14} /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPrint(null)}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 p-2.5 rounded-lg font-bold flex items-center justify-center font-mono text-xs cursor-pointer border-none"
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
