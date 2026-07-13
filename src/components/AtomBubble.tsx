import React, { useState, useEffect, useRef } from 'react';
import { Client, ChatMessage, ChatAttachment, User } from '../types';
import { 
  X, 
  Send, 
  Mic, 
  Paperclip, 
  Image, 
  FileText, 
  Headphones, 
  Users, 
  ShieldCheck, 
  ChevronRight, 
  MessageSquare,
  Lock,
  Volume2
} from 'lucide-react';

interface AtomBubbleProps {
  type: 'client' | 'agent';
  client?: Client; // Required for type = 'client'
  clients?: Client[]; // Required for type = 'agent'
  chatMessages: ChatMessage[];
  currentUser?: User; // Required for type = 'agent'
  onSendMessage: (
    clientId: string, 
    text: string, 
    sender: 'client' | 'agent', 
    senderName: string, 
    attachment?: ChatAttachment
  ) => void;
  onAssignAgent?: (clientId: string, agentId: string, agentName: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function AtomBubble({
  type,
  client,
  clients = [],
  chatMessages,
  currentUser,
  onSendMessage,
  onAssignAgent,
  showToast
}: AtomBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatClientId, setActiveChatClientId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecordingSimulated, setIsRecordingSimulated] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // References
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto set client ID for Client Mode
  useEffect(() => {
    if (type === 'client' && client) {
      setActiveChatClientId(client.id);
    }
  }, [type, client]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [chatMessages, isOpen, activeChatClientId]);

  // Voice recording timer
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

  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format time helper (00:00)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Manually added chats state (synchronized with ChatSoporte)
  const [manuallyAddedClientIds, setManuallyAddedClientIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('extreme_manually_added_chats');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const saved = localStorage.getItem('extreme_manually_added_chats');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (JSON.stringify(parsed) !== JSON.stringify(manuallyAddedClientIds)) {
            setManuallyAddedClientIds(parsed);
          }
        } catch (e) {
          // ignore
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [manuallyAddedClientIds]);

  const agentChatClients = clients.filter(c => {
    if (c.id === 'c-ocasional') return false;
    const hasMessages = chatMessages.some(m => m.clientId === c.id);
    const isManuallyAdded = manuallyAddedClientIds.includes(c.id);
    return hasMessages || isManuallyAdded;
  });

  // Get active selected client info
  const activeClient = type === 'client' 
    ? client 
    : clients.find(c => c.id === activeChatClientId);

  // Filter messages for active chat
  const activeMessages = chatMessages.filter(msg => msg.clientId === activeChatClientId);

  // Simulated automated response for the client when they send a message
  const triggerClientSimulatedResponse = (textInput: string) => {
    if (type !== 'client' || !client) return;

    const inputLower = textInput.toLowerCase();
    const assignedAgentName = client.assignedAgentName || 'Operaciones General';

    setTimeout(() => {
      let replyText = '';
      if (inputLower.includes('pedido') || inputLower.includes('despacho') || inputLower.includes('orden')) {
        replyText = `Entendido. Verificamos que tu cuenta registra despacho activo. Si acabas de emitir una orden online, su estatus está como 'Pendiente' en el sistema logístico de Rosa Fuerte.`;
      } else if (inputLower.includes('hola') || inputLower.includes('buenos') || inputLower.includes('saludos')) {
        replyText = `Conexión establecida con éxito encriptado. Reportando el búnker central. Estoy a la espera de atender tu despacho prioritario.`;
      } else if (inputLower.includes('demora') || inputLower.includes('tarde') || inputLower.includes('retraso')) {
        replyText = `Nuestras unidades de mensajería operan con máxima prioridad. Por favor revisa la sección 'Trayectoria' o confirma con tu asesor.`;
      } else {
        replyText = `Mensaje transmitido a la central operativa de Rosa Fuerte. Su caso está asignado al canal de [${assignedAgentName}].`;
      }

      onSendMessage(
        client.id,
        replyText,
        'agent',
        client.assignedAgentName || 'Asistente Digital'
      );
    }, 1800);
  };

  // Handle message send (text only)
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatClientId) return;

    const senderName = type === 'client' 
      ? (client?.name || 'Cliente') 
      : (currentUser?.fullName || 'Asesor Búnker');

    onSendMessage(
      activeChatClientId,
      inputText.trim(),
      type === 'client' ? 'client' : 'agent',
      senderName
    );

    const textCopy = inputText.trim();
    setInputText('');

    if (type === 'client') {
      triggerClientSimulatedResponse(textCopy);
    }
  };

  // Handle voice record start
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
          console.warn("No mic or permission. Starting simulated voice recording...", err);
          startSimulatedRecording();
        });
    } else {
      startSimulatedRecording();
    }
  };

  // Start simulated recording fallback
  const startSimulatedRecording = () => {
    setIsRecording(true);
    setIsRecordingSimulated(true);
    showToast("Grabadora iniciada (Modo simulación sin micrófono)...", "info");
  };

  // Stop recording & send
  const handleStopRecord = () => {
    if (!isRecording) return;
    
    if (isRecordingSimulated) {
      // Send mock audio base64 (silent WAV header)
      const mockAudioBase64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
      sendAttachmentMessage('voice', mockAudioBase64, `Nota de Voz Simulada (${recordingTime}s).wav`, '22 KB');
      setIsRecording(false);
      setIsRecordingSimulated(false);
      showToast("Nota de voz simulada enviada", "success");
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      showToast("Procesando nota de voz...", "success");
    }
  };

  // Cancel recording
  const handleCancelRecord = () => {
    if (!isRecording) return;
    
    if (!isRecordingSimulated && mediaRecorderRef.current) {
      // Stop without saving
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      // Stop stream tracks
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsRecordingSimulated(false);
    showToast("Grabación cancelada", "warning");
  };

  // Trigger File Input Click
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // Handle File change upload
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

  // Send attachment helper
  const sendAttachmentMessage = (
    type: 'image' | 'audio' | 'video' | 'file' | 'voice',
    url: string,
    name: string,
    size: string
  ) => {
    if (!activeChatClientId) return;

    const senderName = thisType() === 'client' 
      ? (client?.name || 'Cliente') 
      : (currentUser?.fullName || 'Asesor Búnker');

    const attachment: ChatAttachment = { type, url, name, size };

    onSendMessage(
      activeChatClientId,
      type === 'voice' ? '🎙️ [Nota de voz]' : `📎 [Archivo]: ${name}`,
      thisType(),
      senderName,
      attachment
    );

    if (thisType() === 'client') {
      triggerClientSimulatedResponse(`[Archivo adjunto: ${type}]`);
    }
  };

  const thisType = (): 'client' | 'agent' => {
    return type === 'client' ? 'client' : 'agent';
  };

  // Advisor "Tomar Chat" click
  const handleTakeChat = () => {
    if (type !== 'agent' || !currentUser || !activeChatClientId || !onAssignAgent) return;
    onAssignAgent(activeChatClientId, currentUser.id, currentUser.fullName);
    
    // Send system message notification to the client
    onSendMessage(
      activeChatClientId,
      `🙋‍♂️ El asesor ${currentUser.fullName} ha tomado control del chat. Canal enlazado de manera prioritaria.`,
      'agent',
      'Sistema de Enlace'
    );
  };

  // Image Modal zoom state
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Count unassigned general messages for bubble badge (Agent side)
  const getGeneralChatsBadgeCount = () => {
    if (type !== 'agent') return 0;
    
    // Count clients who have chat messages and are NOT assigned
    const unassignedClients = clients.filter(c => c.id !== 'c-ocasional' && !c.assignedAgentId);
    let count = 0;
    unassignedClients.forEach(c => {
      const clientMsgs = chatMessages.filter(m => m.clientId === c.id);
      if (clientMsgs.length > 0) count++;
    });
    return count;
  };

  const badgeCount = type === 'agent' 
    ? getGeneralChatsBadgeCount() 
    : chatMessages.filter(m => m.clientId === client?.id && m.sender === 'agent').length;

  return (
    <>
      {/* FLOATING ATOM BUBBLE BUTTON */}
      <div 
        className="fixed bottom-5 right-5 z-40 select-none print:hidden animate-bounce"
        style={{ marginRight: type === 'agent' ? '70px' : '0px' }} // avoid overlapping locks/buttons if needed
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-16 h-16 flex items-center justify-center rounded-full bg-slate-950/90 border border-cyber-border focus:outline-none transition-all duration-300 hover:scale-110 shadow-[0_0_20px_rgba(236,72,153,0.25)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)] cursor-pointer group animate-pulse"
        >
          {/* Outer Rotating Atom Orbits */}
          <svg className="absolute inset-0 w-full h-full text-cyber-pink" viewBox="0 0 100 100">
            {/* Orbit 1 */}
            <ellipse 
              cx="50" cy="50" rx="42" ry="14" 
              className="fill-none stroke-cyber-pink stroke-[1.5] opacity-80 animate-orbit-1" 
            />
            {/* Orbit 2 */}
            <ellipse 
              cx="50" cy="50" rx="42" ry="14" 
              className="fill-none stroke-cyber-blue stroke-[1.5] opacity-80 animate-orbit-2" 
            />
            {/* Orbit 3 */}
            <ellipse 
              cx="50" cy="50" rx="42" ry="14" 
              className="fill-none stroke-cyber-orange stroke-[1.5] opacity-80 animate-orbit-3" 
            />
            {/* Nucleus background */}
            <circle cx="50" cy="50" r="16" className="fill-slate-950 stroke-cyber-border stroke-1" />
          </svg>

          {/* Electron dot pulsing */}
          <span className="absolute w-2 h-2 rounded-full bg-cyber-pink animate-ping" style={{ top: '15%', left: '46%' }}></span>

          {/* Central Icon */}
          <span className="absolute z-10 text-white flex items-center justify-center transition-transform group-hover:rotate-12 duration-300">
            {type === 'client' ? (
              <Headphones size={18} className="text-cyber-pink animate-pulse" />
            ) : (
              <Users size={18} className="text-cyber-blue animate-pulse" />
            )}
          </span>

          {/* Badge indicator */}
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 z-20 bg-cyber-pink text-black font-mono font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse border border-black font-sans">
              {badgeCount}
            </span>
          )}
        </button>
      </div>

      {/* FLOATING CHAT WIDGET BOX */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-5 w-[360px] sm:w-[380px] h-[520px] bg-cyber-card/95 border border-cyber-border rounded-2xl flex flex-col z-50 shadow-[0_0_30px_rgba(4,7,14,0.85)] overflow-hidden font-mono text-xs backdrop-blur-md select-text"
          style={{ marginRight: type === 'agent' ? '70px' : '0px' }}
        >
          
          {/* CHAT HEADER */}
          <div className="bg-slate-950/90 border-b border-cyber-border p-3.5 flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyber-green animate-ping"></div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase tracking-wider">
                  {type === 'client' ? 'Soporte Rosa Fuerte' : 'Atención Rápida Cliente'}
                </span>
                <span className="font-bold text-white text-xs block truncate max-w-[190px]">
                  {type === 'client' 
                    ? (activeClient?.assignedAgentName || 'Operaciones General')
                    : (activeClient ? activeClient.name : 'Seleccionar Chat')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-cyber-pink bg-cyber-pink/10 border border-cyber-pink/20 px-2 py-0.5 rounded font-bold">
                {type === 'client' ? 'SSL-CLIENT' : 'AGENT-PORT'}
              </span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* DUAL MODE CONTAINER: CHAT LIST FOR AGENT OR CHAT WINDOW */}
          {type === 'agent' && !activeChatClientId ? (
            /* AGENT MODE: LIST OF ACTIVE CLIENTS TO CHAT WITH */
            <div className="flex-1 flex flex-col overflow-hidden bg-cyber-bg/40">
              <div className="bg-slate-950 p-2.5 border-b border-slate-900 text-[10px] text-gray-500 uppercase font-bold text-center select-none">
                Bandeja de Chats ({agentChatClients.length})
              </div>

              {/* Manual search and add selector inside bubble */}
              <div className="bg-slate-950/80 p-2 border-b border-slate-900 flex gap-2">
                <select 
                  className="w-full bg-cyber-bg border border-cyber-border text-white text-[10px] p-1.5 rounded focus:outline-none font-mono"
                  defaultValue=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !manuallyAddedClientIds.includes(val)) {
                      const newManual = [...manuallyAddedClientIds, val];
                      setManuallyAddedClientIds(newManual);
                      try {
                        localStorage.setItem('extreme_manually_added_chats', JSON.stringify(newManual));
                      } catch (e) {
                        console.warn("Failed to save extreme_manually_added_chats to localStorage:", e);
                      }
                      setActiveChatClientId(val);
                      showToast("Cliente vinculado en burbuja rápida", "success");
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled>+ Vincular Cliente a Soporte...</option>
                  {clients
                    .filter(c => c.id !== 'c-ocasional' && !agentChatClients.some(cc => cc.id === c.id))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
                {agentChatClients.map(c => {
                  const msgs = chatMessages.filter(m => m.clientId === c.id);
                  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                  const isAssignedToMe = c.assignedAgentId === currentUser?.id;
                  const isUnassigned = !c.assignedAgentId;

                  return (
                    <div 
                      key={c.id}
                      onClick={() => setActiveChatClientId(c.id)}
                      className="p-3 hover:bg-slate-900/60 transition-all cursor-pointer flex items-center justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate block max-w-[170px]">{c.name}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isAssignedToMe ? 'bg-cyber-pink' : isUnassigned ? 'bg-amber-400' : 'bg-gray-600'
                          }`} />
                        </div>
                        <span className="text-[10px] text-gray-500 truncate block mt-0.5">
                          {lastMsg ? lastMsg.text : 'Sin mensajes'}
                        </span>
                      </div>
                      
                      <div className="text-right shrink-0">
                        {isUnassigned ? (
                          <span className="text-[8px] bg-amber-400/10 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded font-black uppercase font-sans">COLA</span>
                        ) : isAssignedToMe ? (
                          <span className="text-[8px] bg-cyber-pink/10 text-cyber-pink border border-cyber-pink/25 px-1.5 py-0.5 rounded font-black uppercase font-sans">MÍO</span>
                        ) : (
                          <span className="text-[8px] bg-slate-900 text-gray-500 px-1.5 py-0.5 rounded font-normal uppercase block max-w-[60px] truncate font-sans" title={c.assignedAgentName}>
                            {c.assignedAgentName?.substring(0, 5)}...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {agentChatClients.length === 0 && (
                  <div className="p-8 text-center text-gray-600 font-mono text-xs leading-relaxed select-none">
                    Bandeja de chats vacía.
                    <p className="text-[10px] text-gray-700 mt-2">Vincule un cliente arriba para iniciar soporte.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT DIALOG WINDOW */
            <div className="flex-1 flex flex-col overflow-hidden bg-cyber-bg/40">
              
              {/* Back Button for Agent list view */}
              {type === 'agent' && (
                <button
                  onClick={() => setActiveChatClientId('')}
                  className="bg-slate-950/80 p-2 text-cyber-blue hover:text-white border-b border-slate-900 text-[10px] flex items-center gap-1 hover:bg-slate-900/60 transition-all select-none cursor-pointer"
                >
                  <ChevronRight size={12} className="rotate-180" />
                  <span>Volver a la Lista de Clientes</span>
                </button>
              )}

              {/* SECURITY / ASSIGNMENT BANNER */}
              <div className="bg-slate-950 p-2 border-b border-cyber-border font-mono text-[9px] flex justify-between items-center text-gray-400 select-none">
                <div className="flex items-center gap-1 font-bold text-gray-500">
                  <ShieldCheck size={11} className="text-cyber-green shrink-0" />
                  <span>Historial Resguardado (No eliminable)</span>
                </div>
                
                {type === 'agent' && activeClient && (
                  <div>
                    {!activeClient.assignedAgentId ? (
                      <button
                        onClick={handleTakeChat}
                        className="bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold px-2 py-0.5 rounded transition-all cursor-pointer shadow-sm text-[8px]"
                      >
                        🙋‍♂️ TOMAR CHAT
                      </button>
                    ) : (
                      <span className="text-cyber-pink font-bold flex items-center gap-0.5">
                        <Lock size={8} /> Asignado
                      </span>
                    )}
                  </div>
                )}

                {type === 'client' && (
                  <span className="text-gray-500 truncate max-w-[130px] font-sans" title={client?.assignedAgentName || 'Cola General'}>
                    Operador: {client?.assignedAgentName || 'Cola General'}
                  </span>
                )}
              </div>

              {/* COLA GENERAL WARNING BANNER FOR AGENTS */}
              {type === 'agent' && activeClient && !activeClient.assignedAgentId && (
                <div className="bg-amber-950/30 border-b border-amber-500/20 p-2 text-center text-amber-300 text-[10px] animate-pulse flex items-center justify-center gap-1 select-none">
                  <span>⚠️ ESTE CHAT ESTÁ EN OPERACIONES GENERAL.</span>
                </div>
              )}

              {/* CHAT MESSAGES BODY */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3.5 select-text">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 gap-2 select-none">
                    <MessageSquare size={24} className="text-gray-700 animate-pulse" />
                    <span>Conexión establecida. No hay transmisiones aún.</span>
                    <p className="text-[10px] text-gray-700 max-w-[200px] mt-1">Escribe un mensaje para activar el enlace codificado.</p>
                  </div>
                ) : (
                  activeMessages.map(msg => {
                    const isMyMsg = (type === 'client' && msg.sender === 'client') || (type === 'agent' && msg.sender === 'agent');
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col max-w-[85%] ${isMyMsg ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <span className="text-[8px] text-gray-500 font-mono mb-0.5">
                          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <div className={`p-2.5 rounded-xl text-xs font-mono leading-relaxed border ${
                          isMyMsg 
                            ? 'bg-cyber-pink/15 text-white border-cyber-pink/30 rounded-tr-none shadow-sm shadow-cyber-pink/5' 
                            : 'bg-slate-900/90 text-gray-200 border-slate-800 rounded-tl-none'
                        }`}>
                          {/* Attachment Rendering */}
                          {msg.attachment && (
                            <div className="mb-2">
                              {msg.attachment.type === 'image' && (
                                <img 
                                  src={msg.attachment.url} 
                                  alt={msg.attachment.name} 
                                  className="max-w-[200px] max-h-[150px] rounded-lg border border-slate-800 object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                                  onClick={() => setZoomedImage(msg.attachment?.url || null)}
                                />
                              )}
                              {msg.attachment.type === 'video' && (
                                <video 
                                  src={msg.attachment.url} 
                                  controls 
                                  className="max-w-[200px] max-h-[150px] rounded-lg border border-slate-800"
                                />
                              )}
                              {msg.attachment.type === 'audio' && (
                                <audio 
                                  src={msg.attachment.url} 
                                  controls 
                                  className="max-w-[200px] h-9"
                                />
                              )}
                              {msg.attachment.type === 'voice' && (
                                <VoicePlayer url={msg.attachment.url} />
                              )}
                              {msg.attachment.type === 'file' && (
                                <a 
                                  href={msg.attachment.url} 
                                  download={msg.attachment.name}
                                  className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg text-cyber-blue hover:text-white transition-all"
                                >
                                  <FileText size={16} />
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="text-[10px] block truncate font-bold">{msg.attachment.name}</span>
                                    <span className="text-[8px] text-gray-500 block">{msg.attachment.size || 'Archivo'}</span>
                                  </div>
                                </a>
                              )}
                            </div>
                          )}

                          {msg.text && <p className="whitespace-pre-wrap text-left">{msg.text}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef}></div>
              </div>

              {/* INPUT FORM BLOCK */}
              <div className="border-t border-cyber-border bg-slate-950/80">
                {isRecording ? (
                  /* VOICE RECORDING MODE PANEL */
                  <div className="p-3 flex items-center justify-between bg-red-950/20 text-red-400 font-mono text-xs select-none">
                    <div className="flex items-center gap-2 animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="font-bold">🎙️ Grabando: {formatTime(recordingTime)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleStopRecord}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded transition-all cursor-pointer uppercase text-[10px]"
                      >
                        Enviar
                      </button>
                      <button 
                        onClick={handleCancelRecord}
                        className="bg-slate-900 border border-slate-800 text-gray-400 hover:text-white px-2 py-1 rounded transition-all cursor-pointer uppercase text-[10px]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* STANDARD MESSAGE TEXT INPUT FORM */
                  <form onSubmit={handleSend} className="p-2.5 flex items-center gap-2">
                    
                    {/* Media upload button */}
                    <button
                      type="button"
                      onClick={handleAttachClick}
                      className="p-2 text-gray-500 hover:text-cyber-pink bg-slate-900/60 rounded-lg border border-slate-800 hover:border-cyber-pink/20 transition-all cursor-pointer shrink-0"
                      title="Adjuntar Archivo"
                    >
                      <Paperclip size={13} />
                    </button>
                    
                    {/* Voice Recording trigger */}
                    <button
                      type="button"
                      onClick={handleStartRecord}
                      className="p-2 text-gray-500 hover:text-cyber-orange bg-slate-900/60 rounded-lg border border-slate-800 hover:border-cyber-orange/20 transition-all cursor-pointer shrink-0"
                      title="Grabar Nota de Voz"
                    >
                      <Mic size={13} />
                    </button>

                    <input 
                      type="text" 
                      placeholder="Escriba un mensaje..."
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      className="flex-1 bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg focus:outline-none glow-border-pink font-sans text-xs"
                      required
                    />

                    <button 
                      type="submit"
                      disabled={!inputText.trim()}
                      className="bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold p-2 rounded-lg transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send size={13} />
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
          )}

        </div>
      )}

      {/* FULLSCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in print:hidden cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-cyber-pink p-2 bg-slate-950 border border-slate-800 rounded-full"
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
    </>
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

    // Audio might already be loaded
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
          /* Pause */
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          /* Play */
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>
      
      <div className="flex-1 space-y-1 min-w-0">
        {/* Visual waveform peaks */}
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
        
        <div className="flex justify-between text-[8px] text-gray-500 font-sans leading-none">
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
