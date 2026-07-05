import React, { useState } from 'react';
import { ClientRequest, Client } from '../types';
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Filter,
  X,
  ChevronDown,
  Flag,
  User,
  Calendar,
  FileText,
  Edit3,
  Check
} from 'lucide-react';

interface SolicitudesClientesProps {
  requests: ClientRequest[];
  clients: Client[];
  currentUserName: string;
  onUpdateRequest: (req: ClientRequest) => void;
}

const TYPE_COLORS: Record<ClientRequest['type'], string> = {
  Reclamo:   'bg-red-500/15 text-red-400 border-red-500/30',
  Sugerencia:'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Consulta:  'bg-cyber-orange/15 text-cyber-orange border-cyber-orange/30',
  Solicitud: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
};

const STATUS_COLORS: Record<ClientRequest['status'], string> = {
  Pendiente:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'En Revisión':'bg-cyber-blue/15 text-cyber-blue border-cyber-blue/30',
  Resuelto:     'bg-cyber-green/15 text-cyber-green border-cyber-green/30',
  Cerrado:      'bg-gray-500/15 text-gray-400 border-gray-500/30'
};

const PRIORITY_COLORS: Record<ClientRequest['priority'], string> = {
  Baja:    'text-gray-400',
  Media:   'text-cyber-orange',
  Alta:    'text-red-400',
  Urgente: 'text-red-500 font-extrabold animate-pulse'
};

export default function SolicitudesClientes({
  requests,
  clients,
  currentUserName,
  onUpdateRequest
}: SolicitudesClientesProps) {

  const [filterType, setFilterType]     = useState<'Todos' | ClientRequest['type']>('Todos');
  const [filterStatus, setFilterStatus] = useState<'Todos' | ClientRequest['status']>('Todos');
  const [selected, setSelected]         = useState<ClientRequest | null>(null);
  const [agentNotes, setAgentNotes]     = useState('');
  const [editNotes, setEditNotes]       = useState(false);

  const filtered = requests.filter(r => {
    const matchType   = filterType   === 'Todos' || r.type   === filterType;
    const matchStatus = filterStatus === 'Todos' || r.status === filterStatus;
    return matchType && matchStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    total:      requests.length,
    pendiente:  requests.filter(r => r.status === 'Pendiente').length,
    revision:   requests.filter(r => r.status === 'En Revisión').length,
    resuelto:   requests.filter(r => r.status === 'Resuelto' || r.status === 'Cerrado').length
  };

  const handleStatusChange = (newStatus: ClientRequest['status']) => {
    if (!selected) return;
    const updated: ClientRequest = {
      ...selected,
      status: newStatus,
      agentId: currentUserName,
      agentNotes: agentNotes.trim() || selected.agentNotes,
      resolvedAt: (newStatus === 'Resuelto' || newStatus === 'Cerrado')
        ? new Date().toISOString()
        : selected.resolvedAt
    };
    onUpdateRequest(updated);
    setSelected(updated);
    setEditNotes(false);
  };

  const handleSaveNotes = () => {
    if (!selected) return;
    const updated: ClientRequest = {
      ...selected,
      agentNotes: agentNotes.trim(),
      agentId: currentUserName
    };
    onUpdateRequest(updated);
    setSelected(updated);
    setEditNotes(false);
  };

  const openDetail = (req: ClientRequest) => {
    setSelected(req);
    setAgentNotes(req.agentNotes || '');
    setEditNotes(false);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Inbox className="text-cyber-pink" />
          SOLICITUDES Y RECLAMOS DE CLIENTES
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Gestión centralizada de requerimientos, sugerencias y reclamos del portal de clientes.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total,     icon: FileText,     color: 'text-white',        border: 'border-cyber-border' },
          { label: 'Pendientes', value: stats.pendiente, icon: Clock,       color: 'text-yellow-400',   border: 'border-yellow-500/30' },
          { label: 'En Revisión', value: stats.revision,  icon: AlertCircle, color: 'text-cyber-blue',   border: 'border-cyber-blue/30' },
          { label: 'Resueltos',  value: stats.resuelto,  icon: CheckCircle2, color: 'text-cyber-green',  border: 'border-cyber-green/30' }
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-cyber-card border ${s.border} rounded-xl p-4 flex items-center gap-3`}>
              <Icon size={20} className={s.color} />
              <div>
                <p className="text-[10px] text-gray-500 font-mono uppercase">{s.label}</p>
                <p className={`text-2xl font-extrabold font-mono ${s.color}`}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LIST PANEL */}
        <div className="xl:col-span-5 space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-2 text-[10px] font-mono">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5">
              <Filter size={11} className="text-gray-500" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                className="bg-transparent text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos los tipos</option>
                <option value="Reclamo">Reclamos</option>
                <option value="Sugerencia">Sugerencias</option>
                <option value="Consulta">Consultas</option>
                <option value="Solicitud">Solicitudes</option>
              </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5">
              <ChevronDown size={11} className="text-gray-500" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="bg-transparent text-gray-300 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Resuelto">Resuelto</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </div>

          {/* Request Cards */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="bg-cyber-card border border-cyber-border rounded-xl p-8 text-center">
                <Inbox size={32} className="text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-xs font-mono">Sin solicitudes registradas.</p>
              </div>
            ) : filtered.map(req => (
              <button
                key={req.id}
                type="button"
                onClick={() => openDetail(req)}
                className={`w-full text-left bg-cyber-card border rounded-xl p-3.5 space-y-2 transition-all cursor-pointer hover:border-cyber-pink/40 ${
                  selected?.id === req.id ? 'border-cyber-pink/60 shadow-[0_0_12px_rgba(236,72,153,0.15)]' : 'border-cyber-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase font-mono ${TYPE_COLORS[req.type]}`}>
                    {req.type}
                  </span>
                  <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase font-mono ${STATUS_COLORS[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">{req.subject}</p>
                <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono">
                  <span className="flex items-center gap-1"><User size={9} /> {req.clientName}</span>
                  <span className={`flex items-center gap-1 ${PRIORITY_COLORS[req.priority]}`}>
                    <Flag size={9} /> {req.priority}
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono flex items-center gap-1">
                  <Calendar size={9} />
                  {new Date(req.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className="xl:col-span-7">
          {!selected ? (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-12 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <MessageSquare size={36} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm font-mono">Selecciona una solicitud para ver el detalle</p>
            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-5">

              {/* Detail Header */}
              <div className="flex items-start justify-between gap-3 border-b border-cyber-border pb-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase font-mono ${TYPE_COLORS[selected.type]}`}>
                      {selected.type}
                    </span>
                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase font-mono ${PRIORITY_COLORS[selected.priority]} border-current`}>
                      <Flag size={8} className="inline mr-0.5" />{selected.priority}
                    </span>
                  </div>
                  <h2 className="text-sm font-extrabold text-white font-mono">{selected.subject}</h2>
                  <p className="text-[10px] text-gray-500 font-mono">
                    ID: {selected.id} · {new Date(selected.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white shrink-0 cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              {/* Client Info */}
              <div className="bg-slate-950 rounded-lg p-3 text-[10px] font-mono space-y-1 border border-slate-900">
                <p className="text-gray-500 uppercase text-[9px] font-bold mb-1.5">Datos del Cliente</p>
                <p><span className="text-gray-500">Nombre:</span> <span className="text-white font-bold">{selected.clientName}</span></p>
                <p><span className="text-gray-500">Doc:</span> <span className="text-gray-300">{selected.clientRut}</span></p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-mono font-bold uppercase">Descripción del Requerimiento</p>
                <p className="text-xs text-gray-200 bg-slate-950 border border-slate-900 rounded-lg p-3 leading-relaxed font-sans">
                  {selected.description}
                </p>
              </div>

              {/* Change Status */}
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 font-mono font-bold uppercase">Cambiar Estado</p>
                <div className="flex flex-wrap gap-2">
                  {(['Pendiente', 'En Revisión', 'Resuelto', 'Cerrado'] as ClientRequest['status'][]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer ${
                        selected.status === s
                          ? STATUS_COLORS[s] + ' opacity-100'
                          : 'border-slate-800 text-gray-500 hover:border-slate-700 hover:text-gray-300'
                      }`}
                    >
                      {s === selected.status && <Check size={10} className="inline mr-1" />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-mono font-bold uppercase">Notas del Agente</p>
                  <button
                    type="button"
                    onClick={() => { setEditNotes(!editNotes); setAgentNotes(selected.agentNotes || ''); }}
                    className="text-[9px] text-cyber-orange font-mono hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={10} /> {editNotes ? 'Cancelar' : 'Editar'}
                  </button>
                </div>
                {editNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={agentNotes}
                      onChange={e => setAgentNotes(e.target.value)}
                      rows={3}
                      placeholder="Escribe aquí las observaciones del agente..."
                      className="w-full bg-cyber-bg border border-cyber-border rounded-lg p-2.5 text-white text-xs font-mono focus:outline-none glow-border-orange resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="bg-cyber-orange text-black px-4 py-1.5 rounded-lg text-[10px] font-bold font-mono cursor-pointer hover:bg-orange-500 transition-all"
                    >
                      Guardar Notas
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 bg-slate-950 border border-slate-900 rounded-lg p-3 min-h-[50px] font-sans leading-relaxed">
                    {selected.agentNotes || <span className="text-gray-600 italic">Sin notas del agente.</span>}
                  </p>
                )}
                {selected.agentId && (
                  <p className="text-[9px] text-gray-600 font-mono">Gestionado por: {selected.agentId}</p>
                )}
                {selected.resolvedAt && (
                  <p className="text-[9px] text-cyber-green font-mono">
                    ✅ Resuelto: {new Date(selected.resolvedAt).toLocaleString('es-CO')}
                  </p>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
