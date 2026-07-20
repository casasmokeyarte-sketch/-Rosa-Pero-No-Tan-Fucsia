import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatAttachment, Client } from '../types';
import { 
  MessageSquare, 
  Send, 
  User, 
  Briefcase, 
  Clock, 
  Zap, 
  CheckCheck,
  ShieldCheck,
  Smartphone,
  Mic,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Lock,
  Volume2,
  X
} from 'lucide-react';

interface ChatSoporteProps {
  clients: Client[];
  chatMessages: ChatMessage[];
  onSendMessage: (
    clientId: string, 
    text: string, 
    sender: 'client' | 'agent', 
    senderName: string, 
    attachment?: ChatAttachment
  ) => void;
  onClearChat: (clientId: string) => void;
  currentUser: { id: string; fullName: string };
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onAssignAgent: (clientId: string, agentId: string, agentName: string) => void;
}

export default function ChatSoporte({
  clients,
  chatMessages,
  onSendMessage,
  onClearChat,
  currentUser,
  showToast,
  onAssignAgent
}: ChatSoporteProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    // Default to the first client in list with chat messages or just the first non-casual client
    const nonCasual = clients.filter(c => c.id !== 'c-ocasional');
    return nonCasual[0]?.id || '';
  });

  const [inputText, setInputText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice Note Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecordingSimulated, setIsRecordingSimulated] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zoomed image modal state
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Manually added chats state
  const [manuallyAddedClientIds, setManuallyAddedClientIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('extreme_manually_added_chats');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('extreme_manually_added_chats', JSON.stringify(manuallyAddedClientIds));
    } catch (e) {
      console.warn("Failed to save extreme_manually_added_chats to localStorage:", e);
    }
  }, [manuallyAddedClientIds]);

  // Voice Recording timer effect
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Auto-scroll on new message and active selection
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [chatMessages, selectedClientId]);

  // Selected client details
  const activeClient = clients.find(c => c.id === selectedClientId);

  // Filter messages for current client
  const activeMessages = chatMessages.filter(msg => msg.clientId === selectedClientId);

  // Count messages per client for badges
  const getMessageCount = (clientId: string) => {
    return chatMessages.filter(msg => msg.clientId === clientId).length;
  };

  // Get last message for previews
  const getLastMessageText = (clientId: string) => {
    const msgs = chatMessages.filter(msg => msg.clientId === clientId);
    if (msgs.length === 0) return 'Sin historial de chat';
    const last = msgs[msgs.length - 1];
    return `${last.sender === 'agent' ? 'Tú: ' : ''}${last.text}`;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedClientId) return;

    onSendMessage(
      selectedClientId,
      inputText.trim(),
      'agent',
      currentUser.fullName || 'Operador Búnker'
    );
    setInputText('');
  };

  const handleStartRecord = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
              const base64data = reader.result as string;
              sendAttachmentMessage('voice', base64data, 'Nota de voz.webm', formatBytes(audioBlob.size));
            };
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
          setIsRecordingSimulated(false);
          showToast("Micrófono activo, grabando nota de voz...", "info");
        })
        .catch(err => {
          console.warn("No mic access, starting simulated recording...", err);
          startSimulatedRecording();
        });
    } else {
      startSimulatedRecording();
    }
  };

  const startSimulatedRecording = () => {
    setIsRecording(true);
    setIsRecordingSimulated(true);
    showToast("Grabadora iniciada (Modo simulación)...", "info");
  };

  const handleStopRecord = () => {
    if (!isRecording) return;
    if (isRecordingSimulated) {
      const mockAudioBase64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
      sendAttachmentMessage('voice', mockAudioBase64, `Nota de Voz (${recordingTime}s).wav`, '22 KB');
      setIsRecording(false);
      setIsRecordingSimulated(false);
      showToast("Nota de voz simulada enviada", "success");
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      showToast("Procesando nota de voz...", "success");
    }
  };

  const handleCancelRecord = () => {
    if (!isRecording) return;
    if (!isRecordingSimulated && mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsRecordingSimulated(false);
    showToast("Grabación cancelada", "warning");
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // Validar límite de tamaño (1MB) para proteger el rendimiento de la base de datos
    if (file.size > 1024 * 1024) {
      showToast("Archivo demasiado pesado (máximo 1MB). Por favor, comprímelo o sube un archivo más pequeño.", "error");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      let type: 'image' | 'video' | 'audio' | 'file' = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      sendAttachmentMessage(type, base64data, file.name, formatBytes(file.size));
    };
  };

  const sendAttachmentMessage = (
    type: 'image' | 'audio' | 'video' | 'file' | 'voice',
    url: string,
    name: string,
    size: string
  ) => {
    if (!selectedClientId) return;
    const attachment: ChatAttachment = { type, url, name, size };
    onSendMessage(
      selectedClientId,
      type === 'voice' ? '🎙️ [Nota de voz]' : `📎 [Archivo]: ${name}`,
      'agent',
      currentUser.fullName || 'Operador Búnker',
      attachment
    );
  };

  const sendQuickReply = (text: string) => {
    if (!selectedClientId) return;
    onSendMessage(
      selectedClientId,
      text,
      'agent',
      currentUser.fullName || 'Operador Búnker'
    );
  };

  const handleSendBulk = () => {
    if (!bulkText.trim()) return;
    setIsSendingBulk(true);
    const corporateClients = clients.filter(c => c.id !== 'c-ocasional');
    
    corporateClients.forEach(c => {
      onSendMessage(
        c.id,
        bulkText.trim(),
        'agent',
        currentUser.fullName || 'Operador Búnker'
      );
    });

    setIsSendingBulk(false);
    setShowBulkModal(false);
    setBulkText('');
    showToast(`Mensaje masivo enviado a ${corporateClients.length} clientes.`, "success");
  };

  const handleClear = () => {
    showToast("Seguridad: El historial de auditoría no se puede eliminar.", "warning");
  };

  const quickReplies = [
    "✅ Recibido. Su orden está siendo consolidada en el búnker principal.",
    "🏍️ El mensajero ya se encuentra en camino con el equipo solicitado.",
    "🛡️ Verificando saldo en cartera. En breve autorizamos su despacho.",
    "⚠️ Alerta en sector operativo: posible demora de 15 minutos en ruta por tormenta de ceniza.",
    "💼 Despacho listo y verificado. Agradecemos su preferencia."
  ];

  const chatClients = clients.filter(c => {
    if (c.id === 'c-ocasional') return false;
    // Show if manually added or has existing messages
    const hasMessages = chatMessages.some(m => m.clientId === c.id);
    const isManuallyAdded = manuallyAddedClientIds.includes(c.id);
    return hasMessages || isManuallyAdded;
  });

  return (
    <div className="space-y-6" id="agent-chat-support">
      
      {/* Module Title */}
      <div className="bg-gradient-to-r from-cyber-pink/15 to-transparent p-5 rounded-xl border border-cyber-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyber-pink/15 rounded-lg border border-cyber-pink/30 text-cyber-pink">
            <MessageSquare size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-black font-mono text-white tracking-widest uppercase flex items-center gap-1.5">
              CENTRAL OPERATIVA DE CHAT DE CLIENTES
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Comuníquese y dé soporte en tiempo real a las cuentas corporativas que ingresen órdenes desde el Portal de Clientes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className="bg-cyber-pink hover:bg-cyber-accent text-black font-bold font-mono text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2 neon-shadow-pink shrink-0"
        >
          <span>📢</span>
          <span>MENSAJE MASIVO</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[550px]">
        
        {/* LEFT COLUMN: CLIENTS CHAT LIST (4 cols) */}
        <div className="lg:col-span-4 bg-cyber-card border border-cyber-border rounded-xl flex flex-col h-full overflow-hidden">
          <div className="bg-slate-950 p-4 border-b border-cyber-border font-mono text-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-cyber-pink block uppercase">Cuentas en Chat ({chatClients.length})</span>
            </div>
            
            {/* Manual link selector */}
            <div className="flex gap-2">
              <select 
                className="flex-1 bg-cyber-bg border border-cyber-border text-white text-[11px] p-2 rounded focus:outline-none font-mono"
                defaultValue=""
                onChange={e => {
                  const val = e.target.value;
                  if (val && !manuallyAddedClientIds.includes(val)) {
                    setManuallyAddedClientIds(prev => [...prev, val]);
                    setSelectedClientId(val);
                    showToast("Cliente agregado a la bandeja de chat", "success");
                    e.target.value = "";
                  }
                }}
              >
                <option value="" disabled>+ Vincular Cliente a Soporte...</option>
                {clients
                  .filter(c => c.id !== 'c-ocasional' && !chatClients.some(cc => cc.id === c.id))
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-900 pr-1">
            {chatClients.length === 0 ? (
              <div className="p-8 text-center text-gray-600 font-mono text-xs leading-relaxed select-none">
                Bandeja de chats vacía.
                <p className="text-[10px] text-gray-700 mt-2">Seleccione un cliente arriba para iniciar el canal de soporte.</p>
              </div>
            ) : (
              chatClients.map(c => {
              const isSelected = c.id === selectedClientId;
              const lastMsg = getLastMessageText(c.id);
              const count = getMessageCount(c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    if (!c.assignedAgentId && currentUser && onAssignAgent) {
                      onAssignAgent(c.id, currentUser.id, currentUser.fullName);
                    }
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-cyber-pink/10 border-l-4 border-cyber-pink text-white' 
                      : 'hover:bg-slate-900/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-900 flex items-center justify-center text-cyber-pink font-extrabold text-sm shrink-0 uppercase">
                    {c.name.substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white truncate block max-w-[130px]">{c.name}</span>
                      {count > 0 && (
                        <span className="bg-cyber-pink text-black text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                          {count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 block truncate mt-1">{lastMsg}</span>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT CHANNELS (8 cols) */}
        <div className="lg:col-span-8 bg-cyber-card border border-cyber-border rounded-xl flex flex-col h-full overflow-hidden">
          
          {activeClient ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Chat Header */}
              <div className="bg-slate-950 p-4 border-b border-cyber-border flex justify-between items-center font-mono text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-500 block uppercase">Canal de Chat</span>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-sm">{activeClient.name}</h3>
                    <span className="bg-emerald-950 text-emerald-400 text-[9px] font-extrabold px-2 py-0.5 rounded border border-emerald-500/25 flex items-center gap-1">
                      <Smartphone size={8} />
                      {activeClient.phone}
                    </span>
                    {activeClient.assignedAgentId && (
                      <span className="bg-cyber-pink/15 text-cyber-pink text-[9px] font-extrabold px-2 py-0.5 rounded border border-cyber-pink/20 flex items-center gap-1">
                        <Lock size={8} />
                        Atendido por: {activeClient.assignedAgentName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[9px] text-gray-500 block">Cartera Pendiente:</span>
                    <span className="text-cyber-orange font-bold font-mono">${activeClient.outstandingBalance.toFixed(2)} USD</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-cyber-green text-[10px] font-mono font-bold bg-slate-900 border border-cyber-green/20 px-2 py-1 rounded">
                    <ShieldCheck size={12} className="text-cyber-green animate-pulse" />
                    <span>HISTORIAL PROTEGIDO</span>
                  </div>
                </div>
              </div>

              {/* COLA GENERAL / ASSIGNMENT WARNING BANNER */}
              {activeClient && !activeClient.assignedAgentId && (
                <div className="bg-amber-950/20 border-b border-amber-500/25 p-3 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span className="text-amber-300 font-bold text-[10px]">Chat en Cola General: Ningún asesor asignado.</span>
                  </div>
                  <button
                    onClick={() => onAssignAgent(activeClient.id, currentUser.id, currentUser.fullName)}
                    className="bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold px-3 py-1 rounded transition-all cursor-pointer text-[10px]"
                  >
                    🙋‍♂️ TOMAR CONTROL CHAT
                  </button>
                </div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-cyber-bg/40 select-text">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 font-mono text-xs gap-2 select-none">
                    <MessageSquare size={24} className="text-gray-700" />
                    <span>No registra mensajes con este cliente.</span>
                    <p className="max-w-xs text-[10px] text-gray-700 mt-1">Escriba un saludo o use una respuesta rápida de búnker a continuación para iniciar el enlace.</p>
                  </div>
                ) : (
                  activeMessages.map(msg => {
                    const isAgent = msg.sender === 'agent';
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col max-w-[85%] ${isAgent ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <span className="text-[9px] text-gray-500 font-mono mb-0.5">
                          {msg.senderName} • {new Date(msg.timestamp).toLocaleDateString('es-CO')} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <div className={`p-3 rounded-xl text-xs font-mono leading-relaxed shadow-sm ${
                          isAgent 
                            ? 'bg-cyber-orange/15 text-white border border-cyber-orange/30 rounded-tr-none' 
                            : 'bg-cyber-pink/15 text-white border border-cyber-pink/30 rounded-tl-none'
                        }`}>
                          {/* Attachment Rendering */}
                          {msg.attachment && (
                            <div className="mb-2">
                              {msg.attachment.type === 'image' && (
                                <img 
                                  src={msg.attachment.url} 
                                  alt={msg.attachment.name} 
                                  className="max-w-[240px] max-h-[180px] rounded-lg border border-slate-800 object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                                  onClick={() => setZoomedImage(msg.attachment?.url || null)}
                                />
                              )}
                              {msg.attachment.type === 'video' && (
                                <video 
                                  src={msg.attachment.url} 
                                  controls 
                                  className="max-w-[240px] max-h-[180px] rounded-lg border border-slate-800"
                                />
                              )}
                              {msg.attachment.type === 'audio' && (
                                <audio 
                                  src={msg.attachment.url} 
                                  controls 
                                  className="max-w-[240px] h-9"
                                />
                              )}
                              {msg.attachment.type === 'voice' && (
                                <VoicePlayer url={msg.attachment.url} />
                              )}
                              {msg.attachment.type === 'file' && (
                                <a 
                                  href={msg.attachment.url} 
                                  download={msg.attachment.name}
                                  className="flex items-center gap-2.5 p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-cyber-blue hover:text-white transition-all"
                                >
                                  <FileText size={16} />
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] block truncate font-bold text-white">{msg.attachment.name}</span>
                                    <span className="text-[8px] text-gray-500 block">{msg.attachment.size || 'Archivo'}</span>
                                  </div>
                                </a>
                              )}
                            </div>
                          )}
                          {msg.text && <p className="text-left whitespace-pre-wrap">{msg.text}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef}></div>
              </div>

              {/* Quick Replies Panel */}
              <div className="bg-slate-950 p-2 border-t border-slate-900 flex items-center gap-2 overflow-x-auto select-none no-scrollbar">
                <span className="text-[9px] font-mono font-bold text-cyber-orange uppercase tracking-widest shrink-0 flex items-center gap-1 pl-1">
                  <Zap size={10} />
                  Rápido:
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendQuickReply(qr)}
                    className="shrink-0 bg-slate-900 hover:bg-slate-800 text-[10px] text-gray-300 font-mono py-1 px-2.5 rounded border border-slate-800 hover:border-cyber-orange/30 transition-all cursor-pointer truncate max-w-[200px]"
                    title={qr}
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Chat Input form */}
              <div className="border-t border-cyber-border bg-slate-950/80">
                {isRecording ? (
                  <div className="p-3 flex items-center justify-between bg-red-950/20 text-red-400 font-mono text-xs select-none">
                    <div className="flex items-center gap-2 animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="font-bold">🎙️ Grabando: {formatTime(recordingTime)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleStopRecord}
                        type="button"
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded transition-all cursor-pointer uppercase text-[10px]"
                      >
                        Enviar
                      </button>
                      <button 
                        onClick={handleCancelRecord}
                        type="button"
                        className="bg-slate-900 border border-slate-800 text-gray-400 hover:text-white px-2 py-1 rounded transition-all cursor-pointer uppercase text-[10px]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="p-3 bg-slate-950 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      className="p-2.5 text-gray-500 hover:text-cyber-pink bg-slate-900/60 rounded-lg border border-slate-800 hover:border-cyber-pink/20 transition-all cursor-pointer shrink-0"
                      title="Adjuntar Archivo"
                    >
                      <Paperclip size={14} />
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleStartRecord}
                      className="p-2.5 text-gray-500 hover:text-cyber-orange bg-slate-900/60 rounded-lg border border-slate-800 hover:border-cyber-orange/20 transition-all cursor-pointer shrink-0"
                      title="Grabar Nota de Voz"
                    >
                      <Mic size={14} />
                    </button>

                    <input
                      type="text"
                      placeholder={`Responder a ${activeClient.name} como ${currentUser.fullName}...`}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      className="flex-1 bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg focus:outline-none glow-border-pink font-mono"
                      required
                    />
                    
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="bg-cyber-orange hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold p-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-md shadow-orange-500/10 shrink-0"
                      title="Enviar Respuesta Codificada"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                )}
              </div>

              {/* Hidden file input element */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
              />

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 font-mono text-xs p-8 gap-3">
              <MessageSquare size={36} className="text-gray-600 animate-pulse" />
              <span>No hay clientes disponibles para soporte de chat.</span>
            </div>
          )}

        </div>

      </div>

      {/* FULLSCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in print:hidden cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-cyber-pink p-2 bg-slate-950 border border-slate-800 rounded-full"
            type="button"
            onClick={() => setZoomedImage(null)}
          >
            <X size={20} />
          </button>
          <img 
            src={zoomedImage} 
            alt="Zoomed" 
            className="max-w-full max-h-full rounded-lg shadow-2xl border border-slate-800 object-contain"
          />
        </div>
      )}

      {/* Central Bulk Message Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-cyber-card border-2 border-cyber-pink rounded-3xl max-w-md w-full p-6 space-y-5 relative shadow-[0_0_50px_rgba(236,72,153,0.15)] font-mono text-xs text-gray-300">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white tracking-widest">📢 TRANSMISIÓN MASIVA</span>
              </div>
              <button 
                onClick={() => setShowBulkModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer text-sm bg-transparent border-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <p className="text-[10px] text-gray-400">
                Escriba un mensaje informativo. Este texto se enviará de forma automática e individual al chat de todas las cuentas corporativas configuradas en la base de datos (excepto el cliente ocasional).
              </p>
              
              <div className="space-y-1">
                <span className="text-[9px] text-cyber-pink font-bold uppercase tracking-wider block">Mensaje a Difundir:</span>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder="Escriba el comunicado masivo aquí..."
                  className="w-full bg-cyber-bg border border-cyber-border rounded-xl p-3.5 h-32 text-xs focus:outline-none focus:border-cyber-pink resize-none text-white font-mono"
                  disabled={isSendingBulk}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkText('');
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-gray-400 font-bold rounded-xl transition-all cursor-pointer border border-slate-800 uppercase tracking-wider"
                disabled={isSendingBulk}
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleSendBulk}
                className="px-5 py-2.5 bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold rounded-xl transition-all cursor-pointer shadow-md neon-shadow-pink uppercase tracking-wider flex items-center gap-2"
                disabled={isSendingBulk || !bulkText.trim()}
              >
                {isSendingBulk ? (
                  <>
                    <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>📢</span>
                    <span>Enviar Masivo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* CUSTOM VOICE NOTE PLAYER COMPONENT */
function VoicePlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    if (audio.readyState >= 1) {
      setDuration(audio.duration || 0);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed: ", e));
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[10px] font-mono w-[215px] select-none text-left">
      <button 
        type="button"
        onClick={togglePlay}
        className="w-7.5 h-7.5 rounded-full bg-cyber-pink hover:bg-cyber-accent text-black flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-[0_0_10px_rgba(236,72,153,0.2)]"
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>
      
      <div className="flex-1 space-y-1 min-w-0">
        {/* Waveform peaks */}
        <div className="flex items-end gap-[1.5px] h-3.5 pb-0.5">
          {Array.from({ length: 15 }).map((_, i) => {
            const baseVal = Math.abs(Math.sin(i * 0.65)) * 10 + 2;
            const heightVal = isPlaying ? Math.random() * 10 + 2 : baseVal;
            return (
              <div 
                key={i} 
                className={`w-[3.5px] rounded-full transition-all duration-150 ${isPlaying ? 'bg-cyber-pink' : 'bg-gray-600'}`}
                style={{ height: `${heightVal}px` }}
              ></div>
            );
          })}
        </div>
        
        <div className="flex justify-between text-[8px] text-gray-500 font-sans leading-none font-bold">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-0.5">
            <Volume2 size={7} />
            {duration ? formatTime(duration) : '0:03'}
          </span>
        </div>
      </div>
    </div>
  );
}
