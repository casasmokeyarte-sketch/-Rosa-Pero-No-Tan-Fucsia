import React, { useState, useEffect } from 'react';
import { PhoneRecord, Client } from '../types';
import { INITIAL_PHONE_RECORDS } from '../utils/dummyData';
import { 
  Phone, 
  Search, 
  MapPin, 
  ShieldCheck, 
  ShieldAlert, 
  Radio, 
  Activity, 
  Tag, 
  Plus, 
  FileText, 
  CornerDownRight, 
  User, 
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';

interface IdentificadorTlfProps {
  clients: Client[];
  onAddClient: (client: Client) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function IdentificadorTlf({ clients, onAddClient, showToast }: IdentificadorTlfProps) {
  const [phoneDb, setPhoneDb] = useState<PhoneRecord[]>(() => {
    const saved = localStorage.getItem('extreme_phone_records');
    return saved ? JSON.parse(saved) : INITIAL_PHONE_RECORDS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('extreme_phone_records', JSON.stringify(phoneDb));
    } catch (e) {
      console.warn("Failed to save extreme_phone_records to localStorage:", e);
    }
  }, [phoneDb]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PhoneRecord | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackingLogs, setTrackingLogs] = useState<string[]>([]);
  
  // Form states for manual registration
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newRut, setNewRut] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRep, setNewRep] = useState<'Confiable' | 'Sospechoso' | 'Fraude Reportado' | 'Nuevo / No Verificado'>('Confiable');
  const [newCarrier, setNewCarrier] = useState('NeonNet Telecom');
  const [newLocation, setNewLocation] = useState('Distrito Central');
  const [newTags, setNewTags] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Handle phone trace search
  const handleTrace = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchQuery.replace(/\s+/g, '').replace(/[()]/g, '');
    if (!cleanedQuery) return;

    setIsTracking(true);
    setTrackingProgress(0);
    setTrackingLogs([]);

    const logSteps = [
      "ESTABLECIENDO ENLACE SATELITAL CLASE-4...",
      "TRIANGULANDO COORDENADAS CON CELDAS CELULARES EN COLA...",
      "INTERCEPTANDO PORTADORAS DE FRECUENCIA EN SECTOR OPERATIVO...",
      "CONSULTANDO REGISTRO GENERAL DE IDENTIDADES CORPORATIVAS...",
      "LOGÍSTICA DE ROSA FUERTE: CONEXIÓN EXITOSA."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      setTrackingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Perform actual search inside local phone db
          const found = phoneDb.find(r => {
            const cleanRecNum = r.phoneNumber.replace(/\s+/g, '').replace(/[()]/g, '');
            return cleanRecNum.includes(cleanedQuery) || cleanedQuery.includes(cleanRecNum);
          });

          if (found) {
            // Update search frequency
            const updated = phoneDb.map(r => r.phoneNumber === found.phoneNumber ? { ...r, searchCount: r.searchCount + 1 } : r);
            setPhoneDb(updated);
            setSelectedRecord({ ...found, searchCount: found.searchCount + 1 });
            showToast(`Triangulación exitosa para ${found.ownerName}`, 'success');
          } else {
            // Procedural Generator for unregistered numbers to make the tool fully functional!
            const isSuspicious = cleanedQuery.startsWith('666') || cleanedQuery.includes('1337') || Math.random() > 0.6;
            const carrierList = ['NeonNet Telecom', 'SkyNet Networks', 'Wasteland Wireless', 'ProxNet Anon', 'RebelLink Sat'];
            const locationList = ['Distrito Central de Finanzas', 'Complejo Industrial Altavista', 'Subnivel 4, Laboratorios Black Mesa', 'Frontera del Páramo Seco', 'Zona Residencial de Bajo Nivel'];
            const companyPrefixes = ['Suministros', 'Industrias', 'Corporación', 'Consorcio', 'Enlace'];
            const suffixList = ['S.A.', 'Corp', 'S.A.S.', 'Trading', 'Group'];
            const names = ['Carlos Restrepo', 'Juliana Gómez', 'Andrés Mendoza', 'Mariana Torres', 'Sebastián Ortiz'];
            
            const randomCarrier = carrierList[Math.floor(Math.random() * carrierList.length)];
            const randomLoc = locationList[Math.floor(Math.random() * locationList.length)];
            const chosenRep = isSuspicious ? 'Sospechoso' : 'Nuevo / No Verificado';
            const randomOwner = Math.random() > 0.4 
              ? `${companyPrefixes[Math.floor(Math.random() * companyPrefixes.length)]} ${names[Math.floor(Math.random() * names.length)].split(' ')[1]} ${suffixList[Math.floor(Math.random() * suffixList.length)]}`
              : names[Math.floor(Math.random() * names.length)];

            const mockRecord: PhoneRecord = {
              phoneNumber: searchQuery,
              ownerName: randomOwner,
              rutOrId: `NIT ${Math.floor(100000000 + Math.random() * 900000000)}-${Math.floor(Math.random() * 9)}`,
              address: `Avenida ${Math.floor(Math.random() * 100)} # ${Math.floor(Math.random() * 80)} - ${Math.floor(Math.random() * 90)}, ${randomLoc}`,
              reputation: chosenRep,
              carrier: randomCarrier,
              location: randomLoc,
              tags: isSuspicious ? ["Número No Fichado", "Prefijo Variable", "Uso Reciente"] : ["Usuario Civil", "Nuevo Registro", "Señal Estable"],
              notes: "Registro generado de manera dinámica mediante análisis de metadatos telefónicos del cuadrante. No se registran facturas pendientes en Rosa Fuerte S.A.S.",
              searchCount: 1,
              isRegisteredClient: false
            };

            setSelectedRecord(mockRecord);
            showToast(`Rastreo inteligente finalizado para número desconocido`, 'info');
          }

          setIsTracking(false);
          return 100;
        }
        
        if (currentStep < logSteps.length) {
          setTrackingLogs(prevLogs => [...prevLogs, logSteps[currentStep]]);
          currentStep++;
        }
        return prev + 20;
      });
    }, 450);
  };

  // Convert tracked phone record to client
  const handleCreateClientFromRecord = (rec: PhoneRecord) => {
    if (clients.some(c => c.phone.includes(rec.phoneNumber))) {
      showToast("Ya existe un cliente con este número de teléfono registrado.", "error");
      return;
    }

    const newClient: Client = {
      id: `c-tr-${Date.now()}`,
      name: rec.ownerName,
      rut: rec.rutOrId.replace("NIT ", "").trim(),
      email: `${rec.ownerName.toLowerCase().replace(/\s+/g, '')}@bunker.com`,
      phone: rec.phoneNumber,
      address: rec.address,
      creditLimit: rec.reputation === 'Confiable' ? 1000.00 : 0.00,
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };

    onAddClient(newClient);
    
    // Update phoneDB record to show associated client
    const updated = phoneDb.map(r => r.phoneNumber === rec.phoneNumber ? { ...r, isRegisteredClient: true, associatedClientId: newClient.id } : r);
    setPhoneDb(updated);
    if (selectedRecord && selectedRecord.phoneNumber === rec.phoneNumber) {
      setSelectedRecord({ ...selectedRecord, isRegisteredClient: true, associatedClientId: newClient.id });
    }

    showToast(`Cliente '${rec.ownerName}' registrado desde metadatos`, 'success');
  };

  // Create new manual record
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || !newName) {
      showToast("Teléfono y Propietario son campos obligatorios", "error");
      return;
    }

    const exists = phoneDb.find(r => r.phoneNumber.replace(/\s+/g, '') === newPhone.replace(/\s+/g, ''));
    if (exists) {
      showToast("Este número de teléfono ya tiene un registro de rastreo.", "error");
      return;
    }

    const cleanTags = newTags.split(',').map(t => t.trim()).filter(Boolean);

    const newRec: PhoneRecord = {
      phoneNumber: newPhone,
      ownerName: newName,
      rutOrId: newRut || 'N/A',
      address: newAddress || 'Desconocida',
      reputation: newRep,
      carrier: newCarrier,
      location: newLocation,
      tags: cleanTags.length ? cleanTags : ["Manual"],
      notes: newNotes || 'Sin comentarios adicionales.',
      searchCount: 0,
      isRegisteredClient: clients.some(c => c.phone.includes(newPhone))
    };

    setPhoneDb(prev => [newRec, ...prev]);
    setSelectedRecord(newRec);
    setShowAddForm(false);
    
    // Clear state
    setNewPhone('');
    setNewName('');
    setNewRut('');
    setNewAddress('');
    setNewRep('Confiable');
    setNewCarrier('NeonNet Telecom');
    setNewLocation('Distrito Central');
    setNewTags('');
    setNewNotes('');

    showToast("Registro de número agregado a la base de seguridad", "success");
  };

  return (
    <div className="space-y-6" id="phone-tracker-module">
      
      {/* Title block */}
      <div className="bg-gradient-to-r from-cyan-950/20 to-transparent p-5 rounded-xl border border-cyber-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyber-cyan/15 rounded-lg border border-cyber-cyan/30 text-cyber-cyan">
            <Radio size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-black font-mono text-white tracking-widest uppercase flex items-center gap-1.5">
              IDENTIFICADOR Y RASTREADOR ATÓMICO
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Consulte metadatos telefónicos, triangulación satelital en tiempo real, operadoras cibernéticas y reputación de seguridad para mitigar fraudes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SEARCH & TRACK LIST (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tracker search box */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-cyber-cyan" />
              Rastrear Cuadrante Telefónico
            </h3>

            <form onSubmit={handleTrace} className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 block text-[10px] uppercase">Número Celular o Fijo:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-3 text-gray-500" size={14} />
                    <input 
                      type="text"
                      placeholder="e.g. +57 (320) 412-9988"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-cyber-bg border border-cyber-border text-white text-xs pl-9 pr-4 py-2.5 rounded-lg focus:outline-none glow-border-pink font-mono"
                      required
                      disabled={isTracking}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTracking || !searchQuery.trim()}
                    className="bg-cyber-cyan text-black hover:bg-cyan-400 disabled:opacity-45 disabled:cursor-not-allowed font-extrabold px-4 py-2.5 rounded-lg transition-all flex items-center gap-1 shadow-md hover:shadow-cyan-500/10 cursor-pointer"
                  >
                    {isTracking ? <RefreshCw size={13} className="animate-spin" /> : <Activity size={13} />}
                    <span>{isTracking ? 'RASTREANDO' : 'RASTREAR'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Triangulating loading state */}
            {isTracking && (
              <div className="space-y-3 p-4 bg-slate-950/80 rounded-lg border border-cyber-cyan/30 font-mono text-[10px]">
                <div className="flex justify-between items-center text-cyber-cyan">
                  <span className="font-bold uppercase tracking-widest animate-pulse">📡 Triangulando Celda...</span>
                  <span className="font-extrabold">{trackingProgress}%</span>
                </div>
                
                {/* Visual Progress bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div className="bg-cyber-cyan h-full transition-all duration-300" style={{ width: `${trackingProgress}%` }}></div>
                </div>

                <div className="space-y-1 text-gray-500 h-16 overflow-y-auto select-none mt-2 leading-tight">
                  {trackingLogs.map((log, index) => (
                    <div key={index} className="flex gap-1">
                      <span className="text-cyber-cyan font-bold">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Registry Database List */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-cyber-border pb-3">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Radio size={14} className="text-cyber-cyan" />
                Fichero de Seguridad
              </h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-[10px] bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/20 px-2 py-1 rounded font-mono uppercase font-extrabold cursor-pointer"
              >
                {showAddForm ? 'Cancelar' : '+ Registrar'}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddRecord} className="bg-slate-950 p-4 rounded-lg border border-cyber-border space-y-3 font-mono text-[10px] text-gray-300">
                <h4 className="font-bold text-cyber-cyan uppercase text-center border-b border-slate-900 pb-1.5">Registrar Identidad Telefónica</h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label>Teléfono Celular:</label>
                    <input 
                      type="text" 
                      placeholder="+57 (300) 123-4567" 
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label>Propietario / Nombre:</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Daniel San" 
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label>Identidad RUT / NIT:</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 900.555.221-1" 
                      value={newRut}
                      onChange={e => setNewRut(e.target.value)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label>Dirección física:</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Calle Central #4" 
                      value={newAddress}
                      onChange={e => setNewAddress(e.target.value)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label>Reputación de Canal:</label>
                    <select
                      value={newRep}
                      onChange={e => setNewRep(e.target.value as any)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                    >
                      <option value="Confiable">✅ Confiable</option>
                      <option value="Sospechoso">⚠️ Sospechoso</option>
                      <option value="Fraude Reportado">🚨 Fraude Reportado</option>
                      <option value="Nuevo / No Verificado">🔷 Nuevo / No Verificado</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label>Carrier / Red:</label>
                    <input 
                      type="text" 
                      placeholder="e.g. NeonNet" 
                      value={newCarrier}
                      onChange={e => setNewCarrier(e.target.value)}
                      className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label>Ubicación / Sector:</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Zona Financiera" 
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                  />
                </div>

                <div className="space-y-1">
                  <label>Etiquetas (Separadas por comas):</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cliente VIP, Corporativo" 
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px]"
                  />
                </div>

                <div className="space-y-1">
                  <label>Notas de Rastreo:</label>
                  <textarea 
                    placeholder="Historial de llamadas, alerta de cobro, etc..." 
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className="w-full bg-cyber-bg border border-slate-800 p-1.5 rounded text-white text-[10px] h-14 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyber-cyan text-black hover:bg-cyan-400 font-bold py-2 rounded font-mono uppercase text-[10px] cursor-pointer"
                >
                  Registrar Número en Base de Rastreo
                </button>
              </form>
            )}

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-900 font-mono text-xs">
              {phoneDb.map((rec, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedRecord(rec)}
                  className={`py-2 px-2.5 rounded-lg flex justify-between items-center cursor-pointer transition-all ${
                    selectedRecord?.phoneNumber === rec.phoneNumber 
                      ? 'bg-cyber-cyan/15 border border-cyber-cyan/30 text-white' 
                      : 'hover:bg-slate-900/60 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <div>
                    <span className="font-extrabold text-white block text-xs">{rec.phoneNumber}</span>
                    <span className="text-[10px] text-gray-500 block truncate max-w-[140px]">{rec.ownerName}</span>
                  </div>

                  <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold ${
                    rec.reputation === 'Confiable' 
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                      : rec.reputation === 'Fraude Reportado'
                      ? 'bg-red-950/40 text-red-400 border border-red-500/20 animate-pulse'
                      : rec.reputation === 'Sospechoso'
                      ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                      : 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {rec.reputation.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: RASTREO TELEMETRY PROFILE DISPLAY (7 cols) */}
        <div className="lg:col-span-7">
          
          {selectedRecord ? (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-6 space-y-5 relative overflow-hidden">
              
              {/* Corner scan badge */}
              <div className="absolute top-0 right-0 bg-cyber-cyan text-black font-mono font-black text-[9px] px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                TELEMETRÍA DE RED S-90
              </div>

              {/* Main owner header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest block">IDENTIDAD RASTREADA</span>
                  <h3 className="text-lg font-black text-white">{selectedRecord.ownerName}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className="text-cyber-cyan font-bold">{selectedRecord.phoneNumber}</span>
                    <span>•</span>
                    <span>{selectedRecord.rutOrId}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[9px] text-gray-500 font-mono block">REPUTACIÓN</span>
                  <span className={`inline-block text-xs font-mono font-black px-3 py-1 rounded-lg border mt-1 ${
                    selectedRecord.reputation === 'Confiable' 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' 
                      : selectedRecord.reputation === 'Fraude Reportado'
                      ? 'bg-red-950 text-red-300 border-red-500/40 animate-pulse shadow-md shadow-red-500/15'
                      : selectedRecord.reputation === 'Sospechoso'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                  }`}>
                    {selectedRecord.reputation.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Grid with technical data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1">
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider block">Carrier / Operador de Red:</span>
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Radio size={13} className="text-cyber-cyan" />
                    <span>{selectedRecord.carrier}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1">
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider block">Ubicación de Triangulación:</span>
                  <div className="flex items-center gap-2 text-white font-bold">
                    <MapPin size={13} className="text-cyber-cyan animate-bounce" />
                    <span>{selectedRecord.location}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1 sm:col-span-2">
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider block">Dirección Física de Registro:</span>
                  <span className="text-white font-medium block mt-0.5">{selectedRecord.address}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1 sm:col-span-2">
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider block">Etiquetas Logísticas y Observaciones:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedRecord.tags.map((tag, idx) => (
                      <span key={idx} className="bg-slate-900 border border-slate-800 text-gray-300 text-[9px] px-2 py-0.5 rounded flex items-center gap-1">
                        <Tag size={8} className="text-cyber-cyan" />
                        {tag}
                      </span>
                    ))}
                    <span className="bg-slate-900 border border-slate-800 text-cyber-cyan text-[9px] px-2 py-0.5 rounded flex items-center gap-1 font-extrabold ml-auto">
                      CONSULTAS: {selectedRecord.searchCount} Veces
                    </span>
                  </div>
                </div>

                {/* Tracking Notes */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-900 space-y-2 sm:col-span-2">
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider block flex items-center gap-1">
                    <FileText size={10} />
                    Bitácora y Reporte de Seguridad:
                  </span>
                  <p className="text-gray-300 text-[11px] leading-relaxed italic">{selectedRecord.notes}</p>
                </div>

              </div>

              {/* ACTION BUTTONS */}
              <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row gap-2 font-mono text-xs">
                
                {selectedRecord.isRegisteredClient ? (
                  <div className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-lg flex items-center gap-2 flex-1 justify-center">
                    <ShieldCheck size={14} />
                    <span>NÚMERO ASOCIADO A CLIENTE VIP</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateClientFromRecord(selectedRecord)}
                    className="flex-1 bg-cyber-pink hover:bg-cyber-accent text-black font-black py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Plus size={14} />
                    <span>Crear Cliente Corporativo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    // Quick edit to mark record as suspicious/warning
                    const isSpam = selectedRecord.reputation === 'Fraude Reportado';
                    const newRepVal = isSpam ? 'Confiable' : 'Fraude Reportado';
                    const updated = phoneDb.map(r => r.phoneNumber === selectedRecord.phoneNumber ? { 
                      ...r, 
                      reputation: newRepVal,
                      tags: newRepVal === 'Fraude Reportado' ? [...r.tags, "Alerta Fraude"] : r.tags.filter(t => t !== "Alerta Fraude")
                    } : r);
                    setPhoneDb(updated);
                    setSelectedRecord({
                      ...selectedRecord,
                      reputation: newRepVal,
                      tags: newRepVal === 'Fraude Reportado' ? [...selectedRecord.tags, "Alerta Fraude"] : selectedRecord.tags.filter(t => t !== "Alerta Fraude")
                    });
                    showToast(
                      newRepVal === 'Fraude Reportado' 
                        ? `Alerta de Fraude asignada a ${selectedRecord.ownerName}` 
                        : `Identidad verificada como Confiable`, 
                      newRepVal === 'Fraude Reportado' ? 'error' : 'success'
                    );
                  }}
                  className={`py-2.5 px-4 rounded-lg font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    selectedRecord.reputation === 'Fraude Reportado'
                      ? 'bg-emerald-950 hover:bg-emerald-900 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-950 hover:bg-red-900 border-red-500/30 text-red-400'
                  }`}
                >
                  <AlertTriangle size={14} />
                  <span>{selectedRecord.reputation === 'Fraude Reportado' ? 'Marcar Confiable' : 'Marcar como Fraude'}</span>
                </button>

              </div>

              {/* RADAR EFFECT MOCKUP IN BOTTOM CORNER FOR NEON AESTHETICS */}
              <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full border border-cyber-cyan/15 pointer-events-none flex items-center justify-center animate-ping opacity-30">
                <div className="w-16 h-16 rounded-full border border-cyber-cyan/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-cyber-cyan/10"></div>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-12 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center gap-3 h-full min-h-[400px]">
              <Radio size={36} className="text-gray-600 animate-pulse" />
              <span>Ningún número de teléfono rastreado o seleccionado.</span>
              <p className="max-w-xs text-[10px] text-gray-600">
                Ingrese un número de teléfono arriba o seleccione uno del fichero lateral para desplegar la telemetría satelital y el perfil del propietario.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
