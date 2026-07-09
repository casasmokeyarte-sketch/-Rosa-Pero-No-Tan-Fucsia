import React, { useState } from 'react';
import { Client, Invoice, BusinessConfig } from '../types';
import { 
  Users, 
  Search, 
  UserPlus, 
  FileText, 
  Printer, 
  Mail, 
  Phone, 
  MapPin, 
  DollarSign, 
  AlertCircle,
  X,
  CreditCard,
  Edit2,
  Trash2,
  Upload,
  Download
} from 'lucide-react';

interface ClientesProps {
  clients: Client[];
  invoices: Invoice[];
  config: BusinessConfig;
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onImportClients?: (clients: Client[]) => void;
}

export default function Clientes({ 
  clients, 
  invoices, 
  config,
  onAddClient, 
  onUpdateClient,
  onDeleteClient,
  onImportClients
}: ClientesProps) {
  
  // Search and view state
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Form modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  
  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientDocType, setClientDocType] = useState<Client['documentType']>('CC');
  const [clientRut, setClientRut] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientCreditLimit, setClientCreditLimit] = useState(2000);
  const [clientPassword, setClientPassword] = useState('');
  const [showClientPwd, setShowClientPwd] = useState(false);
  const [createdClientCode, setCreatedClientCode] = useState<string | null>(null);

  // Edit client reference
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Filter clients
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.rut.includes(search) || 
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(search.toLowerCase()))
  );

  // Get specific client invoices
  const getClientInvoices = (clientId: string) => {
    return invoices.filter(inv => inv.clientId === clientId);
  };

  const handleDelete = (client: Client) => {
    if (client.outstandingBalance > 0) {
      alert("No se puede eliminar un cliente con saldo deudor pendiente. Registre un abono/pago de cartera primero.");
      return;
    }
    if (confirm(`¿Está seguro de que desea eliminar al cliente "${client.name}"?`)) {
      onDeleteClient(client.id);
      setSelectedClient(null);
    }
  };

  // Submit new client
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientRut) return;

    // Generate unique non-contiguous client code (e.g. CL-XXXX)
    let generatedCode = '';
    let isUnique = false;
    while (!isUnique) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      generatedCode = `CL-${randNum}`;
      isUnique = !clients.some(c => c.code === generatedCode);
    }

    const newClient: Client = {
      id: `c-${Date.now()}`,
      name: clientName,
      documentType: clientDocType,
      rut: clientRut,
      email: clientEmail || "contacto@courier.net",
      phone: clientPhone || "+57 (300) 000-0000",
      address: clientAddress || "Zona de Despliegue",
      creditLimit: parseFloat(clientCreditLimit.toString()) || 1000,
      outstandingBalance: 0,
      createdAt: new Date().toISOString(),
      password: '1234', // Default opening password
      code: generatedCode
    };

    onAddClient(newClient);
    setCreatedClientCode(generatedCode);
    
    // Clear form
    setClientName('');
    setClientDocType('CC');
    setClientRut('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setClientCreditLimit(2000);
    setClientPassword('');
    setShowAddModal(false);
  };

  // Prepare edit client modal
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setClientName(client.name);
    setClientDocType(client.documentType || 'CC');
    setClientRut(client.rut);
    setClientEmail(client.email);
    setClientPhone(client.phone);
    setClientAddress(client.address);
    setClientCreditLimit(client.creditLimit);
    setClientPassword(client.password || '');
    setShowEditModal(true);
  };

  // Submit client modifications
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    // Keep or generate unique code for backward compatibility
    let code = editingClient.code;
    if (!code) {
      let isUnique = false;
      while (!isUnique) {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        code = `CL-${randNum}`;
        isUnique = !clients.some(c => c.code === code);
      }
    }

    const updated: Client = {
      ...editingClient,
      name: clientName,
      documentType: clientDocType,
      rut: clientRut,
      email: clientEmail,
      phone: clientPhone,
      address: clientAddress,
      creditLimit: parseFloat(clientCreditLimit.toString()),
      outstandingBalance: editingClient.outstandingBalance,
      password: clientPassword.trim() || editingClient.password || '1234',
      code
    };

    onUpdateClient(updated);
    
    // Update active view if it was edited
    if (selectedClient?.id === updated.id) {
      setSelectedClient(updated);
    }

    // Clear and close
    setClientName('');
    setClientDocType('CC');
    setClientRut('');
    setClientEmail('');
    setClientPhone('');
    setClientAddress('');
    setClientCreditLimit(2000);
    setClientPassword('');
    setShowEditModal(false);
    setEditingClient(null);
  };

  // Export clients to JSON file
  const handleExportClients = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clients, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `clientes_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // File reading for import
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

  // Submit and validate imported clients
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) {
      setImportError("Por favor ingrese un contenido JSON o cargue un archivo.");
      return;
    }

    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        throw new Error("El JSON debe ser un arreglo de clientes [ { ... }, { ... } ].");
      }
      
      const validated: Client[] = parsed.map((item: any, idx: number) => {
        if (!item.name || !item.rut) {
          throw new Error(`El cliente en la posición ${idx + 1} no tiene un 'name' o 'rut' válido.`);
        }
        return {
          id: item.id || `c-${Date.now()}-${idx}`,
          name: item.name,
          rut: item.rut,
          email: item.email || "operaciones@anonimo.net",
          phone: item.phone || "+57 (300) 000-0000",
          address: item.address || "Zona Franca",
          creditLimit: parseFloat(item.creditLimit) || 1000,
          outstandingBalance: parseFloat(item.outstandingBalance) || 0,
          createdAt: item.createdAt || new Date().toISOString()
        };
      });

      if (onImportClients) {
        onImportClients(validated);
      } else {
        // Fallback
        validated.forEach(c => onAddClient(c));
      }

      setShowImportModal(false);
      setImportText('');
      setImportError(null);
    } catch (err: any) {
      setImportError(err.message || "Error al procesar el archivo. Verifique el formato JSON.");
    }
  };

  return (
    <div className="space-y-6" id="clients-module">
      
      {/* Module Title & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-cyber-card border border-cyber-border rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-cyber-pink" />
            DIRECTORIO GENERAL DE CLIENTES
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Historial de facturas despachadas, cupos de crédito y balances comerciales.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            type="button"
            onClick={handleExportClients}
            className="bg-slate-900 hover:bg-slate-800 text-white border border-cyber-border text-xs font-bold font-mono px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            title="Exportar clientes a JSON"
          >
            <Download size={14} /> Exportar
          </button>
          <button 
            type="button"
            onClick={() => setShowImportModal(true)}
            className="bg-cyber-blue/20 hover:bg-cyber-blue text-cyber-blue border border-cyber-blue/30 text-xs font-bold font-mono px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            title="Importar clientes desde JSON"
          >
            <Upload size={14} /> Importar
          </button>
          <button 
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer neon-shadow-pink shrink-0"
          >
            <UserPlus size={15} /> Afiliar Cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Client List (5 cols) */}
        <div className="lg:col-span-5 bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search size={16} />
            </div>
            <input 
              type="text"
              placeholder="Buscar por nombre, RUT o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-cyber-bg border border-cyber-border text-white text-xs pl-10 pr-4 py-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredClients.map(c => {
              const invoicesCount = getClientInvoices(c.id).length;
              return (
                <div 
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${
                    selectedClient?.id === c.id 
                      ? 'bg-slate-900 border-cyber-pink/40 neon-shadow-pink' 
                      : 'bg-slate-900/40 border-cyber-border hover:bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      {c.name}
                      <span className="text-[9px] text-cyber-pink font-mono">({c.code || 'N/D'})</span>
                    </h3>
                    <div className="text-[10px] text-gray-400 font-mono mt-1">RUT: {c.rut}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5 font-mono">
                      {invoicesCount} Facturas despachadas
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="inline-block text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20">
                      Cliente
                    </span>
                    <div className="text-[9px] text-gray-400 mt-1">Habilitado</div>
                  </div>
                </div>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-xs font-mono">
                Ningún cliente coincide con el criterio de búsqueda.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detailed Profile Ledger View (7 cols) */}
        <div className="lg:col-span-7 bg-cyber-card border border-cyber-border rounded-xl p-5 relative">
          {selectedClient ? (
            <div className="space-y-6">
              
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-cyber-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                    {selectedClient.name}
                    <span className="text-xs bg-slate-900 border border-slate-800 text-cyber-pink px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">{selectedClient.code || 'N/D'}</span>
                  </h2>
                  <p className="text-xs text-cyber-pink font-mono mt-0.5">Ficha de Auditoría Comercial</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(selectedClient)}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-gray-300 border border-cyber-border rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedClient)}
                    className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="p-2 bg-cyber-orange/10 hover:bg-cyber-orange text-cyber-orange hover:text-black border border-cyber-orange/30 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={13} /> Imprimir PDF
                  </button>
                </div>
              </div>

              {/* Contact card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex items-center gap-2.5">
                  <Mail size={14} className="text-cyber-pink shrink-0" />
                  <div className="truncate">
                    <p className="text-[9px] font-mono text-gray-500 uppercase">Email</p>
                    <span className="text-[11px] text-gray-200">{selectedClient.email}</span>
                  </div>
                </div>
                
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex items-center gap-2.5">
                  <Phone size={14} className="text-cyber-pink shrink-0" />
                  <div>
                    <p className="text-[9px] font-mono text-gray-500 uppercase">Celular</p>
                    <span className="text-[11px] text-gray-200">{selectedClient.phone}</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex items-center gap-2.5 sm:col-span-1">
                  <MapPin size={14} className="text-cyber-pink shrink-0" />
                  <div className="truncate">
                    <p className="text-[9px] font-mono text-gray-500 uppercase">Ubicación</p>
                    <span className="text-[11px] text-gray-200">{selectedClient.address}</span>
                  </div>
                </div>
              </div>

              {/* Transaction ledger table */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  HISTORIAL DE TRANSACCIONES / COMPROBANTES
                </h3>
                
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono">
                    <thead>
                      <tr className="border-b border-cyber-border text-gray-500 uppercase text-[9px] font-bold">
                        <th className="py-2">Factura</th>
                        <th className="py-2">Fecha</th>
                        <th className="py-2">Método</th>
                        <th className="py-2 text-right font-bold">Total</th>
                        <th className="py-2 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {getClientInvoices(selectedClient.id).map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-900/50 text-gray-300">
                          <td className="py-2 font-bold text-white">{inv.invoiceNumber}</td>
                          <td className="py-2">{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td className="py-2">{inv.paymentMethod}</td>
                          <td className="py-2 text-right font-bold text-white">${inv.total.toFixed(2)}</td>
                          <td className="py-2 text-right">
                            <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded ${
                              inv.paymentStatus === 'Pagado' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/10' :
                              inv.paymentStatus === 'Pendiente' ? 'bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/10' :
                              'bg-red-500/10 text-red-400 border border-red-500/10'
                            }`}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {getClientInvoices(selectedClient.id).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-500 text-xs">
                            No hay compras despachadas a este remitente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center py-20 text-gray-500 space-y-3">
              <Users size={32} className="text-gray-600 animate-pulse-slow" />
              <div className="text-xs font-mono uppercase">Seleccione un cliente para auditar transacciones</div>
              <p className="text-[10px] text-gray-600 max-w-xs">
                Acceda a historiales de cobros, cupos crediticios activos y reportes de facturación exportables.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* PRINT-ONLY COMPONENT (Hidden in UI, rendered only when printing) */}
      {selectedClient && (
        <div className="hidden print-only p-8 text-black font-mono space-y-6">
          <div className="text-center space-y-1 pb-4 border-b-2 border-black">
            <h1 className="text-lg font-bold uppercase">{config.companyName}</h1>
            <p className="text-xs">RUT/NIT: {config.rut} | {config.address}</p>
            <p className="text-xs">REPORTE AUDITADO DE CARTERA Y HISTORIAL</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold">CLIENTE:</p>
              <p className="text-sm font-bold mt-1">{selectedClient.name}</p>
              <p>CÓDIGO ÚNICO: {selectedClient.code || 'N/D'}</p>
              <p>{selectedClient.documentType || 'DOC'}: {selectedClient.rut}</p>
              <p>EMAIL: {selectedClient.email}</p>
              <p>TELÉFONO: {selectedClient.phone}</p>
              <p>DIRECCIÓN: {selectedClient.address}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-bold">DATOS FINANCIEROS:</p>
              <p className="text-sm font-bold mt-1 text-red-600">SALDO POR COBRAR: ${selectedClient.outstandingBalance.toFixed(2)}</p>
              <p>CUPO MÁXIMO DE CRÉDITO: ${selectedClient.creditLimit.toFixed(2)}</p>
              <p>CUPO NETO DISPONIBLE: ${(selectedClient.creditLimit - selectedClient.outstandingBalance).toFixed(2)}</p>
              <p>FECHA CORTE: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold border-b border-black pb-1">ANEXO DE TRANSACCIONES ASOCIADAS</p>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-black font-bold">
                  <th className="py-2">Comprobante</th>
                  <th className="py-2">Fecha Emisión</th>
                  <th className="py-2">Método Pago</th>
                  <th className="py-2 text-right">Monto Total</th>
                  <th className="py-2 text-right">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {getClientInvoices(selectedClient.id).map(inv => (
                  <tr key={inv.id} className="border-b border-gray-300">
                    <td className="py-2 font-bold">{inv.invoiceNumber}</td>
                    <td className="py-2">{new Date(inv.createdAt).toLocaleString()}</td>
                    <td className="py-2">{inv.paymentMethod}</td>
                    <td className="py-2 text-right font-bold">${inv.total.toFixed(2)}</td>
                    <td className="py-2 text-right uppercase font-bold">{inv.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-16 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-t border-black w-48 mx-auto"></div>
              <p>Firma del Cliente</p>
              <p className="text-[10px] text-gray-500">C.C. / RUT</p>
            </div>
            <div className="space-y-1">
              <div className="border-t border-black w-48 mx-auto"></div>
              <p>Firma de Control Interno</p>
              <p className="text-[10px] text-gray-500">Rosa Fuerte Pero NO Tan Fucsia</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Client */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <UserPlus size={16} className="text-cyber-pink" />
                AFILIACIÓN DE NUEVO CLIENTE
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Nombre Completo o Razón Social</label>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-gray-400 font-mono">Tipo Doc.</label>
                  <select
                    value={clientDocType}
                    onChange={e => setClientDocType(e.target.value as Client['documentType'])}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                  >
                    <option value="CC">CC — Cédula Ciudadanía</option>
                    <option value="NIT">NIT — Identif. Tributaria</option>
                    <option value="CE">CE — Cédula Extranjería</option>
                    <option value="PPT">PPT — Perm. Protección Temp.</option>
                    <option value="PEP">PEP — Perm. Especial Perm.</option>
                    <option value="TI">TI — Tarjeta Identidad</option>
                    <option value="RC">RC — Registro Civil</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-gray-400 font-mono">Número de Documento</label>
                  <input 
                    type="text" 
                    value={clientRut} 
                    onChange={e => setClientRut(e.target.value)}
                    placeholder="Ej: 1.234.567-8"
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Correo Electrónico (Notificación)</label>
                <input 
                  type="email" 
                  value={clientEmail} 
                  onChange={e => setClientEmail(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Teléfono Móvil de Contacto</label>
                <input 
                  type="text" 
                  value={clientPhone} 
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Dirección Fiscal / Despacho</label>
                <input 
                  type="text" 
                  value={clientAddress} 
                  onChange={e => setClientAddress(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-pink"
                />
              </div>

              <div className="space-y-1 hidden">
                <label className="text-gray-400 font-mono">Límite / Cupo de Crédito Máximo ($)</label>
                <input 
                  type="number" 
                  value={clientCreditLimit} 
                  onChange={e => setClientCreditLimit(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-pink"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg text-[10px] text-gray-400 space-y-1 font-mono">
                <p className="font-bold text-cyber-pink uppercase">🔑 Contraseña de Apertura:</p>
                <p>La contraseña inicial para este cliente será fijada en <strong className="text-white">1234</strong>. Al ingresar por primera vez, el sistema le exigirá definir su propia contraseña personal.</p>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-4 py-2 rounded-lg font-bold font-mono"
                >
                  Registrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Client */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Edit2 size={16} className="text-cyber-orange" />
                MODIFICAR REGISTRO DE CLIENTE
              </h3>
              <button onClick={() => { setShowEditModal(false); setEditingClient(null); }} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Razón Social</label>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                  required
                />
              </div>

              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-gray-400 font-mono">Tipo Doc.</label>
                  <select
                    value={clientDocType}
                    onChange={e => setClientDocType(e.target.value as Client['documentType'])}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                  >
                    <option value="CC">CC — Cédula Ciudadanía</option>
                    <option value="NIT">NIT — Identif. Tributaria</option>
                    <option value="CE">CE — Cédula Extranjería</option>
                    <option value="PPT">PPT — Perm. Protección Temp.</option>
                    <option value="PEP">PEP — Perm. Especial Perm.</option>
                    <option value="TI">TI — Tarjeta Identidad</option>
                    <option value="RC">RC — Registro Civil</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-gray-400 font-mono">Número de Documento</label>
                  <input 
                    type="text" 
                    value={clientRut} 
                    onChange={e => setClientRut(e.target.value)}
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Email corporativo</label>
                <input 
                  type="email" 
                  value={clientEmail} 
                  onChange={e => setClientEmail(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Móvil celular</label>
                <input 
                  type="text" 
                  value={clientPhone} 
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono">Ubicación fiscal</label>
                <input 
                  type="text" 
                  value={clientAddress} 
                  onChange={e => setClientAddress(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                />
              </div>

              <div className="space-y-1 hidden">
                <label className="text-gray-400 font-mono">Cupo de Crédito ($)</label>
                <input 
                  type="number" 
                  value={clientCreditLimit} 
                  onChange={e => setClientCreditLimit(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-mono text-xs focus:outline-none glow-border-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-mono flex items-center gap-1">
                  Contraseña del Portal Cliente
                  <span className="text-gray-600 text-[9px]">(vacío conserva la clave actual)</span>
                </label>
                <div className="relative">
                  <input
                    type={showClientPwd ? 'text' : 'password'}
                    value={clientPassword}
                    onChange={e => setClientPassword(e.target.value)}
                    placeholder="Nueva contraseña o deja vacío para no cambiar..."
                    className="w-full bg-cyber-bg border border-cyber-border p-2.5 pr-9 rounded-lg text-white text-xs focus:outline-none glow-border-orange tracking-wide font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientPwd(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showClientPwd ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowEditModal(false); setEditingClient(null); }}
                  className="bg-slate-900 text-gray-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-orange text-black hover:bg-orange-600 px-4 py-2 rounded-lg font-bold font-mono"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY / MODAL: IMPORT CLIENTS */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] glow-border-pink">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Upload size={16} className="text-cyber-blue animate-bounce" />
                IMPORTAR BASE DE DATOS DE CLIENTES
              </h3>
              <button onClick={() => { setShowImportModal(false); setImportError(null); }} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Cargue un archivo <span className="text-cyber-pink">.json</span> con formato de arreglo de clientes, o pegue el contenido JSON directamente en la casilla inferior. El sistema fusionará los datos evitando duplicados por RUT/NIT.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-gray-400 block uppercase text-[9px]">Cargar archivo de respaldo (.json)</label>
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleFileChange}
                  className="w-full bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-white text-xs focus:outline-none file:mr-4 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-cyber-pink file:text-black hover:file:bg-cyber-accent cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 block uppercase text-[9px]">O pegue el contenido JSON aquí:</label>
                <textarea 
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder='[
  {
    "id": "c-import-1",
    "name": "Cliente de Ejemplo S.A.",
    "rut": "123.456.789-0",
    "email": "contacto@ejemplo.com",
    "phone": "+57 311 0000000",
    "address": "Calle Falsa 123",
    "creditLimit": 5000,
    "outstandingBalance": 0
  }
]'
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white font-mono text-[10px] h-32 focus:outline-none"
                />
              </div>

              {importError && (
                <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg text-red-400 text-[10px] flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowImportModal(false); setImportError(null); }}
                  className="bg-slate-900 text-gray-400 px-4 py-2 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-blue text-black hover:bg-cyan-400 px-4 py-2 rounded-lg font-bold font-mono text-xs cursor-pointer"
                >
                  Confirmar Importación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CODE CONFIRMATION MODAL */}
      {createdClientCode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center font-mono">
            <div className="w-12 h-12 bg-cyber-pink/20 border border-cyber-pink/40 rounded-full flex items-center justify-center mx-auto text-cyber-pink animate-bounce text-xl">✓</div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">¡Cliente Registrado con Éxito!</h3>
            <p className="text-[10px] text-gray-400">Entregue el siguiente código único al cliente para que acceda al portal:</p>
            
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-lg font-bold text-cyber-pink tracking-widest text-center select-all">
              {createdClientCode}
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[9px] text-gray-500 text-left space-y-1">
              <p>• <strong>Código de Acceso:</strong> {createdClientCode}</p>
              <p>• <strong>Contraseña Inicial:</strong> 1234 (Se le pedirá cambiarla al ingresar)</p>
            </div>

            <button
              onClick={() => setCreatedClientCode(null)}
              className="w-full py-2 bg-cyber-pink text-black hover:bg-cyber-accent rounded-lg font-bold text-xs"
            >
              ENTENDIDO Y COPIAR
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
