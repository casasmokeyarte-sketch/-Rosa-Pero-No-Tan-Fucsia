import React, { useState, useEffect } from 'react';
import { 
  Client, 
  Product, 
  Invoice, 
  Expense, 
  Shift, 
  User, 
  UserPermissions,
  BusinessConfig, 
  StockAdjustment,
  ChatMessage,
  ChatAttachment,
  StockTransfer,
  ClientRequest,
  Discount,
  FlashMessage,
  SoundSettings,
  PayrollEntry
} from './types';
import { 
  INITIAL_BUSINESS_CONFIG, 
  INITIAL_USERS, 
  INITIAL_PRODUCTS, 
  INITIAL_CLIENTS, 
  INITIAL_INVOICES, 
  INITIAL_EXPENSES, 
  INITIAL_SHIFTS, 
  INITIAL_ADJUSTMENTS 
} from './utils/dummyData';
import { supabase, isSupabaseEnabled } from './lib/supabase';
import { fetchConfig, fetchTable, syncUpsert, syncDelete, syncDeleteByField } from './lib/sync';

// Component Imports
import Dashboard from './components/Dashboard';
import Facturacion from './components/Facturacion';
import Clientes from './components/Clientes';
import Inventario from './components/Inventario';
import CajaJornada from './components/CajaJornada';
import Cartera from './components/Cartera';
import Gastos from './components/Gastos';
import Configuraciones from './components/Configuraciones';
import HistorialCierres from './components/HistorialCierres';
import Domicilios from './components/Domicilios';
import PortalCliente from './components/PortalCliente';
import IdentificadorTlf from './components/IdentificadorTlf';
import ChatSoporte from './components/ChatSoporte';
import SolicitudesClientes from './components/SolicitudesClientes';
import HistorialFacturas from './components/HistorialFacturas';
import Nomina from './components/Nomina';
import RestrictedAccess from './components/RestrictedAccess';
import { playTone } from './utils/soundService';
import AtomBubble from './components/AtomBubble';

// Icons
import { 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  Package, 
  Key, 
  Briefcase, 
  ArrowDownCircle, 
  Settings, 
  Clock, 
  Power,
  Menu,
  X,
  AlertTriangle,
  UserCheck,
  FileText,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  Truck,
  MapPin,
  Phone,
  MessageSquare,
  Inbox,
  DollarSign
} from 'lucide-react';

export function getUserPermissions(user: User): UserPermissions {
  if (user.permissions) return user.permissions;
  
  // fallback based on role
  const isDocAdmin = user.role === 'Administrador';
  return {
    dashboard: true,
    facturacion: true,
    domicilios: true,
    clientes: true,
    inventario: true,
    caja: true,
    historial_cierres: isDocAdmin,
    cartera: isDocAdmin,
    gastos: true,
    identificadortlf: true,
    chatsoporte: true,
    configuraciones: isDocAdmin,
    solicitudes_clientes: true,
    historial_facturas: true,
    nomina: isDocAdmin,

    crear_factura: true,
    editar_cliente: true,
    eliminar_cliente: isDocAdmin,
    ajustar_stock: isDocAdmin,
    traspaso_inventario: true,
    abrir_cerrar_caja: true,
    registrar_gasto: true,
    abonar_cartera: isDocAdmin,
    modificar_configuracion: isDocAdmin,
    gestionar_usuarios: isDocAdmin,
    imprimir_facturas: true,
    editar_facturas: isDocAdmin,
    eliminar_facturas: isDocAdmin,
    imprimir_clientes: true,
    eliminar_inventario: isDocAdmin,
    imprimir_inventario: true,
    editar_gastos: isDocAdmin,
    eliminar_gastos: isDocAdmin,
    imprimir_gastos: true,
    imprimir_cartera: isDocAdmin,
    editar_domicilios: true,
    imprimir_domicilios: true,
    imprimir_cierres: isDocAdmin
  };
}

export default function App() {
  
  const [isLoadingDB, setIsLoadingDB] = useState<boolean>(isSupabaseEnabled);
  
  // State Initialization with lazy LocalStorage loading
  const [config, setConfig] = useState<BusinessConfig>(() => {
    const saved = localStorage.getItem('extreme_config');
    return saved ? JSON.parse(saved) : INITIAL_BUSINESS_CONFIG;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('extreme_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('extreme_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return parsed;
        }
      } catch (e) {
        // Fallback
      }
    }
    return INITIAL_USERS[1]; // "Agente Neon-Pink" as default session user
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('extreme_products');
    const parsed: Product[] = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    return parsed.map(p => {
      if (!p.userStocks) {
        const stocks: { [userId: string]: number } = {};
        INITIAL_USERS.forEach(u => {
          stocks[u.id] = Math.min(10, p.stock); // Provide 10 units/g to each user initially
        });
        return {
          ...p,
          userStocks: stocks
        };
      }
      return p;
    });
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('extreme_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('extreme_invoices');
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('extreme_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('extreme_shifts');
    return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
  });

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem('extreme_adjustments');
    return saved ? JSON.parse(saved) : INITIAL_ADJUSTMENTS;
  });

  const [transfers, setTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem('extreme_transfers');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast System State
  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Shared Chat Support System State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('extreme_chat_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: 'initial-msg-1',
        clientId: 'c-1',
        sender: 'agent',
        senderName: 'Agente Neon-Pink',
        text: 'Hola, representante de Corporación CyberDyne. Conexión establecida. ¿Cómo podemos colaborar con su despacho hoy?',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString()
      },
      {
        id: 'initial-msg-2',
        clientId: 'c-2',
        sender: 'agent',
        senderName: 'Agente Neon-Pink',
        text: 'Enlace activo para Sindicato de Mensajeros del Páramo. ¿Reportando novedades de ruta?',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString()
      }
    ];
  });

  // Client Requests / Complaints State
  const [clientRequests, setClientRequests] = useState<ClientRequest[]>(() => {
    const saved = localStorage.getItem('extreme_client_requests');
    return saved ? JSON.parse(saved) : [];
  });

  // Discounts state
  const [discounts, setDiscounts] = useState<Discount[]>(() => {
    const s = localStorage.getItem('extreme_discounts'); return s ? JSON.parse(s) : [];
  });

  // Flash Messages state
  const [flashMessages, setFlashMessages] = useState<FlashMessage[]>(() => {
    const s = localStorage.getItem('extreme_flash_messages'); return s ? JSON.parse(s) : [];
  });

  // Flash views tracking { flashId: { viewerId: count } }
  const [flashViews, setFlashViews] = useState<Record<string, Record<string, number>>>(() => {
    const s = localStorage.getItem('extreme_flash_views'); return s ? JSON.parse(s) : {};
  });

  // Sound Settings state
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => {
    const s = localStorage.getItem('extreme_sound_settings');
    return s ? JSON.parse(s) : { soundEnabled: true, chatSoundEnabled: true, notifSoundEnabled: true, defaultTone: 'Predeterminado' };
  });

  // Payroll state
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>(() => {
    const s = localStorage.getItem('extreme_payroll'); return s ? JSON.parse(s) : [];
  });

  // Operator flash modal
  const [operatorFlash, setOperatorFlash] = useState<FlashMessage | null>(null);

  // Fullscreen & User authentication states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem('extreme_is_authenticated');
    return saved === 'true';
  });

  // Client Session & Dual-login states
  const [currentClient, setCurrentClient] = useState<Client | null>(() => {
    const saved = localStorage.getItem('extreme_current_client');
    return saved ? JSON.parse(saved) : null;
  });

  const [loginMode, setLoginMode] = useState<'agent' | 'client'>('client');
  const [selectedClientLoginId, setSelectedClientLoginId] = useState<string>('');
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState<boolean>(false);

  // Forgot password form states
  const [forgotRut, setForgotRut] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPwd, setShowForgotNewPwd] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Login panel form states
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Client manual login fields instead of dropdown list
  const [clientLoginRut, setClientLoginRut] = useState('');
  const [clientLoginPassword, setClientLoginPassword] = useState('');
  
  // Show/Hide password toggles
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [showAgentPassword, setShowAgentPassword] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Play notification sound
    if (currentClient) {
      const tone = currentClient.notifSoundTone || 'Predeterminado';
      playTone(tone as any);
    } else {
      if (soundSettings.soundEnabled && soundSettings.notifSoundEnabled) {
        playTone(soundSettings.defaultTone as any);
      }
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    localStorage.setItem('extreme_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('extreme_client_requests', JSON.stringify(clientRequests));
  }, [clientRequests]);

  const handleAddClientRequest = (req: ClientRequest) => {
    setClientRequests(prev => [req, ...prev]);
    if (isSupabaseEnabled) syncUpsert('client_requests', req);
  };

  const handleUpdateClientRequest = (updated: ClientRequest) => {
    setClientRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (isSupabaseEnabled) syncUpsert('client_requests', updated);
  };

  useEffect(() => { localStorage.setItem('extreme_discounts', JSON.stringify(discounts)); }, [discounts]);

  useEffect(() => { localStorage.setItem('extreme_flash_messages', JSON.stringify(flashMessages)); }, [flashMessages]);

  useEffect(() => { localStorage.setItem('extreme_flash_views', JSON.stringify(flashViews)); }, [flashViews]);

  const incrementFlashView = (flashId: string, viewerId: string) => {
    setFlashViews(prev => ({
      ...prev,
      [flashId]: { ...(prev[flashId] || {}), [viewerId]: ((prev[flashId]?.[viewerId]) || 0) + 1 }
    }));
  };

  useEffect(() => { localStorage.setItem('extreme_sound_settings', JSON.stringify(soundSettings)); }, [soundSettings]);

  useEffect(() => { localStorage.setItem('extreme_payroll', JSON.stringify(payrollEntries)); }, [payrollEntries]);

  // Payroll CRUD Handlers
  const handleAddPayrollEntry = (entry: PayrollEntry) => {
    setPayrollEntries(prev => [...prev, entry]);
    showToast(`Recibo de nómina para ${entry.userName} generado con éxito`, "success");
    if (isSupabaseEnabled) syncUpsert('payroll_entries', entry);
  };

  const handleUpdatePayrollEntry = (entry: PayrollEntry) => {
    setPayrollEntries(prev => prev.map(p => p.id === entry.id ? entry : p));
    showToast(`Recibo de nómina para ${entry.userName} actualizado con éxito`, "success");
    if (isSupabaseEnabled) syncUpsert('payroll_entries', entry);
  };

  const handleDeletePayrollEntry = (id: string) => {
    setPayrollEntries(prev => prev.filter(p => p.id !== id));
    showToast("Recibo de nómina eliminado", "warning");
    if (isSupabaseEnabled) syncDelete('payroll_entries', id);
  };

  // Play sounds for chat messages
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    
    // Check if the message is fresh (sent in the last 4 seconds)
    const msgTime = new Date(lastMsg.timestamp).getTime();
    if (Date.now() - msgTime > 4000) return;

    if (lastMsg.sender === 'client') {
      // Incoming message for operators
      if (soundSettings.soundEnabled && soundSettings.chatSoundEnabled) {
        playTone(soundSettings.defaultTone as any);
      }
    } else if (lastMsg.sender === 'agent' && currentClient) {
      // Incoming message for client
      const tone = currentClient.chatSoundTone || 'Predeterminado';
      playTone(tone as any);
    }
  }, [chatMessages, currentClient, soundSettings]);

  // Flash Message Popup trigger for Operators
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    const activeFlashes = flashMessages.filter(f => 
      f.active && 
      (f.target === 'operadores' || f.target === 'ambos') &&
      (!f.expiresAt || new Date(f.expiresAt) > new Date())
    );

    const flashToShow = activeFlashes.find(f => {
      const views = (flashViews[f.id]?.[currentUser.username]) || 0;
      return views < f.maxViews;
    });

    if (flashToShow) {
      setOperatorFlash(flashToShow);
      incrementFlashView(flashToShow.id, currentUser.username);
    }
  }, [isAuthenticated, currentUser?.id, flashMessages]);

  const handleSendMessage = (
    clientId: string, 
    text: string, 
    sender: 'client' | 'agent', 
    senderName: string,
    attachment?: ChatAttachment
  ) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      clientId,
      sender,
      senderName,
      text,
      timestamp: new Date().toISOString(),
      attachment
    };
    setChatMessages(prev => [...prev, newMsg]);
    if (isSupabaseEnabled) syncUpsert('chat_messages', newMsg);
  };

  const handleAssignAgent = (clientId: string, agentId: string, agentName: string) => {
    let updatedClient: Client | undefined;
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        updatedClient = {
          ...c,
          assignedAgentId: agentId,
          assignedAgentName: agentName
        };
        return updatedClient;
      }
      return c;
    }));
    showToast(`Enlace de chat asignado a ${agentName}`, "success");
    if (isSupabaseEnabled && updatedClient) {
      syncUpsert('clients', updatedClient);
    }
  };

  const handleClearChat = (clientId: string) => {
    // Audit protection: cannot clear chat messages
    showToast("Auditoría: Purgado de chat deshabilitado por seguridad de la base de datos.", "warning");
  };

  // Keep track of actual fullscreen element status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sync authentication state to LocalStorage
  useEffect(() => {
    localStorage.setItem('extreme_is_authenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentClient) {
      localStorage.setItem('extreme_current_client', JSON.stringify(currentClient));
    } else {
      localStorage.removeItem('extreme_current_client');
    }
  }, [currentClient]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('extreme_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('extreme_current_user');
    }
  }, [currentUser]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const user = users.find(
      u => u.username.toLowerCase().trim() === loginUsername.toLowerCase().trim()
    );

    if (!user) {
      setLoginError("CÓDIGO OPERATIVO INVÁLIDO: Agente no registrado.");
      return;
    }

    const expectedPassword = user.password || '1234';
    const isCorrect = loginPassword === expectedPassword || (user.username === 'admin' && loginPassword === '1234');
    if (isCorrect) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      setLoginPassword('');
      setLoginError(null);
    } else {
      setLoginError("ACCESO RESTRINGIDO: Contraseña de seguridad incorrecta.");
    }
  };

  const handleClientLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const clientToLogin = clients.find(
      c => c.rut.trim() === clientLoginRut.trim() || c.phone.trim() === clientLoginRut.trim()
    );
    if (!clientToLogin) {
      setLoginError("IDENTIDAD NO REGISTRADA: El NIT/RUT o Teléfono no está registrado.");
      return;
    }

    const expectedPassword = clientToLogin.password || '1234';
    if (clientLoginPassword === expectedPassword) {
      setCurrentClient(clientToLogin);
      setLoginError(null);
      setClientLoginRut('');
      setClientLoginPassword('');
    } else {
      setLoginError("CONTRASEÑA INCORRECTA: Clave del portal de cliente inválida.");
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setForgotSuccess(false);

    if (!forgotRut.trim()) {
      setLoginError("Ingresa tu NIT/RUT registrado.");
      return;
    }
    if (!forgotNewPassword.trim()) {
      setLoginError("La nueva contraseña no puede estar vacía.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setLoginError("Las contraseñas no coinciden. Verifica e intenta de nuevo.");
      return;
    }

    const found = clients.find(
      c => c.rut.trim().toLowerCase() === forgotRut.trim().toLowerCase() ||
           c.phone.trim() === forgotRut.trim()
    );
    if (!found) {
      setLoginError("NIT/RUT o Teléfono no encontrado en el sistema. Contacta al administrador.");
      return;
    }

    setClients(prev => prev.map(c => c.id === found.id ? { ...c, password: forgotNewPassword.trim() } : c));
    setForgotSuccess(true);
    setForgotRut('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setTimeout(() => {
      setForgotSuccess(false);
      setShowForgotPasswordForm(false);
      setLoginError(null);
    }, 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error to full screen: ", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Load database from Supabase on mount
  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const loadAllData = async () => {
      try {
        setIsLoadingDB(true);

        // 1. Fetch from Supabase
        const dbConfig = await fetchConfig();
        const dbUsers = await fetchTable('users');
        const dbProducts = await fetchTable('products');
        const dbClients = await fetchTable('clients');
        const dbInvoices = await fetchTable('invoices');
        const dbExpenses = await fetchTable('expenses');
        const dbShifts = await fetchTable('shifts');
        const dbAdjustments = await fetchTable('stock_adjustments');
        const dbTransfers = await fetchTable('stock_transfers');
        const dbChatMessages = await fetchTable('chat_messages');
        const dbClientRequests = await fetchTable('client_requests');
        const dbDiscounts = await fetchTable('discounts');
        const dbFlashMessages = await fetchTable('flash_messages');
        const dbPayroll = await fetchTable('payroll_entries');

        // 2. Seeding check and upload
        if (dbConfig) {
          setConfig(dbConfig);
        } else {
          await syncUpsert('business_config', { ...config, id: 'singleton' });
        }

        if (dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers);
        } else {
          for (const u of users) {
            await syncUpsert('users', u);
          }
        }

        if (dbProducts && dbProducts.length > 0) {
          setProducts(dbProducts);
        } else {
          for (const p of products) {
            await syncUpsert('products', p);
          }
        }

        if (dbClients && dbClients.length > 0) {
          setClients(dbClients);
        } else {
          for (const c of clients) {
            await syncUpsert('clients', c);
          }
        }

        if (dbInvoices && dbInvoices.length > 0) {
          setInvoices(dbInvoices);
        } else if (invoices.length > 0) {
          for (const inv of invoices) {
            await syncUpsert('invoices', inv);
          }
        }

        if (dbExpenses && dbExpenses.length > 0) {
          setExpenses(dbExpenses);
        } else if (expenses.length > 0) {
          for (const exp of expenses) {
            await syncUpsert('expenses', exp);
          }
        }

        if (dbShifts && dbShifts.length > 0) {
          setShifts(dbShifts);
        } else if (shifts.length > 0) {
          for (const sh of shifts) {
            await syncUpsert('shifts', sh);
          }
        }

        if (dbAdjustments && dbAdjustments.length > 0) {
          setAdjustments(dbAdjustments);
        } else if (adjustments.length > 0) {
          for (const adj of adjustments) {
            await syncUpsert('stock_adjustments', adj);
          }
        }

        if (dbTransfers && dbTransfers.length > 0) {
          setTransfers(dbTransfers);
        } else if (transfers.length > 0) {
          for (const tr of transfers) {
            await syncUpsert('stock_transfers', tr);
          }
        }

        if (dbChatMessages && dbChatMessages.length > 0) {
          setChatMessages(dbChatMessages);
        } else if (chatMessages.length > 0) {
          for (const msg of chatMessages) {
            await syncUpsert('chat_messages', msg);
          }
        }

        if (dbClientRequests && dbClientRequests.length > 0) {
          setClientRequests(dbClientRequests);
        } else if (clientRequests.length > 0) {
          for (const req of clientRequests) {
            await syncUpsert('client_requests', req);
          }
        }

        if (dbDiscounts && dbDiscounts.length > 0) {
          setDiscounts(dbDiscounts);
        } else if (discounts.length > 0) {
          for (const disc of discounts) {
            await syncUpsert('discounts', disc);
          }
        }

        if (dbFlashMessages && dbFlashMessages.length > 0) {
          setFlashMessages(dbFlashMessages);
        } else if (flashMessages.length > 0) {
          for (const fm of flashMessages) {
            await syncUpsert('flash_messages', fm);
          }
        }

        if (dbPayroll && dbPayroll.length > 0) {
          setPayrollEntries(dbPayroll);
        } else if (payrollEntries.length > 0) {
          for (const pe of payrollEntries) {
            await syncUpsert('payroll_entries', pe);
          }
        }

        showToast("Conexión en línea establecida. Base de datos sincronizada.", "success");
      } catch (err) {
        console.error("Error al cargar la base de datos de Supabase:", err);
        showToast("Error de conexión con base de datos. Modo offline activo.", "error");
      } finally {
        setIsLoadingDB(false);
      }
    };

    loadAllData();
  }, []);

  // Keep ticking live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set default client selection on mount/load
  useEffect(() => {
    if (clients.length > 0 && !selectedClientLoginId) {
      setSelectedClientLoginId(clients[1]?.id || clients[0].id);
    }
  }, [clients, selectedClientLoginId]);

  // Global Keyboard Shortcuts (Ctrl + F for billing, Ctrl + P for products, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed (prevent native search if Ctrl+F, or print if Ctrl+P)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'f') {
          e.preventDefault();
          setActiveTab('facturacion');
        } else if (key === 'p') {
          e.preventDefault();
          setActiveTab('inventario');
        } else if (key === 'd') {
          e.preventDefault();
          setActiveTab('dashboard');
        } else if (key === 'c') {
          e.preventDefault();
          setActiveTab('clientes');
        } else if (key === 'a') {
          e.preventDefault();
          setActiveTab('caja');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('extreme_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('extreme_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('extreme_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('extreme_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('extreme_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('extreme_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('extreme_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('extreme_adjustments', JSON.stringify(adjustments));
  }, [adjustments]);

  useEffect(() => {
    localStorage.setItem('extreme_transfers', JSON.stringify(transfers));
  }, [transfers]);

  // Business operations
  
  // 1. New Invoice logic (reduces inventory, updates cashier shifts, increases credit balances if necessary)
  const handleAddInvoice = (newInvoice: Invoice) => {
    // A. Add Invoice to ledger
    setInvoices(prev => [...prev, newInvoice]);

    // B. Deduct product inventory from current cashier's personal stock and write stock adjustments
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        const cartItem = newInvoice.items.find(item => item.productId === p.id);
        if (cartItem) {
          const userStocks = p.userStocks || {};
          const currentUserId = currentUser.id;
          const currentStock = userStocks[currentUserId] !== undefined ? userStocks[currentUserId] : 0;
          return {
            ...p,
            userStocks: {
              ...userStocks,
              [currentUserId]: Math.max(0, currentStock - cartItem.quantity)
            }
          };
        }
        return p;
      });
    });

    const newStockLogs = newInvoice.items.map(item => ({
      id: `adj-${Date.now()}-${item.productId}`,
      productId: item.productId,
      productName: item.productName,
      type: 'Egreso' as const,
      quantity: item.quantity,
      reason: `Despacho automático por factura #${newInvoice.invoiceNumber}`,
      createdAt: new Date().toISOString(),
      user: newInvoice.cashierName
    }));
    setAdjustments(prev => [...prev, ...newStockLogs]);

    // C. Update client portfolio balance if transaction was on credit terms
    if (newInvoice.paymentMethod === 'Crédito') {
      setClients(prevClients => {
        return prevClients.map(c => {
          if (c.id === newInvoice.clientId) {
            return {
              ...c,
              outstandingBalance: c.outstandingBalance + newInvoice.total
            };
          }
          return c;
        });
      });
    }

    // D. Add records to active cash register shift
    setShifts(prevShifts => {
      return prevShifts.map(s => {
        if (s.status === 'Abierta') {
          return {
            ...s,
            salesCash: s.salesCash + (newInvoice.paymentMethod === 'Efectivo' ? newInvoice.total : 0),
            salesCard: s.salesCard + (newInvoice.paymentMethod === 'Tarjeta' ? newInvoice.total : 0),
            salesCredit: s.salesCredit + (newInvoice.paymentMethod === 'Crédito' ? newInvoice.total : 0),
            expectedCash: s.expectedCash + (newInvoice.paymentMethod === 'Efectivo' ? newInvoice.total : 0)
          };
        }
        return s;
      });
    });

    showToast(`Remisión/Factura #${newInvoice.invoiceNumber} guardada y despachada`, "success");

    // Supabase sync
    if (isSupabaseEnabled) {
      syncUpsert('invoices', newInvoice);
      for (const log of newStockLogs) {
        syncUpsert('stock_adjustments', log);
      }
      newInvoice.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          const userStocks = p.userStocks || {};
          const currentUserId = currentUser.id;
          const currentStock = userStocks[currentUserId] !== undefined ? userStocks[currentUserId] : 0;
          syncUpsert('products', {
            ...p,
            userStocks: {
              ...userStocks,
              [currentUserId]: Math.max(0, currentStock - item.quantity)
            }
          });
        }
      });
      if (newInvoice.paymentMethod === 'Crédito') {
        const c = clients.find(cl => cl.id === newInvoice.clientId);
        if (c) {
          syncUpsert('clients', {
            ...c,
            outstandingBalance: c.outstandingBalance + newInvoice.total
          });
        }
      }
      const activeShift = shifts.find(s => s.status === 'Abierta');
      if (activeShift) {
        syncUpsert('shifts', {
          ...activeShift,
          salesCash: activeShift.salesCash + (newInvoice.paymentMethod === 'Efectivo' ? newInvoice.total : 0),
          salesCard: activeShift.salesCard + (newInvoice.paymentMethod === 'Tarjeta' ? newInvoice.total : 0),
          salesCredit: activeShift.salesCredit + (newInvoice.paymentMethod === 'Crédito' ? newInvoice.total : 0),
          expectedCash: activeShift.expectedCash + (newInvoice.paymentMethod === 'Efectivo' ? newInvoice.total : 0)
        });
      }
    }
  };

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
    showToast(`Estado de la orden #${updatedInvoice.invoiceNumber} actualizado a: ${updatedInvoice.deliveryStatus || 'Listo'}`, "info");
    if (isSupabaseEnabled) syncUpsert('invoices', updatedInvoice);
  };

  // 2. Client Operations
  const handleAddClient = (client: Client) => {
    setClients(prev => [...prev, client]);
    showToast(`Cliente '${client.name}' registrado exitosamente`, "success");
    if (isSupabaseEnabled) syncUpsert('clients', client);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    showToast(`Datos de '${updatedClient.name}' actualizados con éxito`, "info");
    if (isSupabaseEnabled) syncUpsert('clients', updatedClient);
  };

  const handleDeleteClient = (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
    showToast(`Expediente del cliente '${target?.name || clientId}' eliminado`, "warning");
    if (isSupabaseEnabled) syncDelete('clients', clientId);
  };

  const handleImportClients = (imported: Client[]) => {
    setClients(prev => {
      const merged = [...prev];
      imported.forEach(newC => {
        const idx = merged.findIndex(c => c.id === newC.id || c.rut === newC.rut);
        if (idx > -1) {
          merged[idx] = newC;
        } else {
          merged.push(newC);
        }
        if (isSupabaseEnabled) syncUpsert('clients', newC);
      });
      return merged;
    });
  };

  // 3. Inventory Operations
  const handleAddProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
    showToast(`Insumo '${product.name}' catalogado con éxito`, "success");
    if (isSupabaseEnabled) syncUpsert('products', product);
  };

  const handleImportProducts = (imported: Product[]) => {
    setProducts(prev => {
      const merged = [...prev];
      imported.forEach(newP => {
        const idx = merged.findIndex(p => p.id === newP.id || p.code === newP.code);
        if (idx > -1) {
          merged[idx] = newP;
        } else {
          merged.push(newP);
        }
        if (isSupabaseEnabled) syncUpsert('products', newP);
      });
      return merged;
    });
    showToast(`${imported.length} insumos importados correctamente`, "success");
  };

  const handleAdjustStock = (adjustment: StockAdjustment) => {
    setAdjustments(prev => [...prev, adjustment]);
    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (p.id === adjustment.productId) {
          const qtyDiff = adjustment.type === 'Ingreso' || adjustment.type === 'Inventario Inicial' 
            ? adjustment.quantity 
            : -adjustment.quantity;
          const updated = {
            ...p,
            stock: Math.max(0, p.stock + qtyDiff)
          };
          if (isSupabaseEnabled) syncUpsert('products', updated);
          return updated;
        }
        return p;
      });
    });
    showToast(`Ajuste de stock (${adjustment.type}): ${adjustment.quantity} unidades`, "info");
    if (isSupabaseEnabled) syncUpsert('stock_adjustments', adjustment);
  };

  const handleAddTransfer = (newTransfer: StockTransfer) => {
    setTransfers(prev => [newTransfer, ...prev]);

    // If sent from the main warehouse (bodega) to a user, deduct from warehouse immediately
    if (newTransfer.origin === 'bodega') {
      setProducts(prevProducts => {
        return prevProducts.map(p => {
          const item = newTransfer.items.find(it => it.productId === p.id);
          if (item) {
            const updated = {
              ...p,
              stock: Math.max(0, p.stock - item.quantity)
            };
            if (isSupabaseEnabled) syncUpsert('products', updated);
            return updated;
          }
          return p;
        });
      });
      showToast(`Solicitud de traspaso enviada al usuario de destino`, "success");
    } else {
      // If sent from a user to the bodega, deduct from that user's stock immediately
      const userId = newTransfer.origin;
      setProducts(prevProducts => {
        return prevProducts.map(p => {
          const item = newTransfer.items.find(it => it.productId === p.id);
          if (item) {
            const userStocks = p.userStocks || {};
            const userStock = userStocks[userId] !== undefined ? userStocks[userId] : 0;
            const updated = {
              ...p,
              userStocks: {
                ...userStocks,
                [userId]: Math.max(0, userStock - item.quantity)
              }
            };
            if (isSupabaseEnabled) syncUpsert('products', updated);
            return updated;
          }
          return p;
        });
      });
      showToast(`Solicitud de devolución enviada a Bodega Principal`, "success");
    }

    if (isSupabaseEnabled) syncUpsert('stock_transfers', newTransfer);
  };

  const handleUpdateTransferStatus = (transferId: string, status: 'aprobado' | 'rechazado', supportNotes?: string) => {
    let targetTransfer: StockTransfer | undefined;
    setTransfers(prevTransfers => {
      return prevTransfers.map(t => {
        if (t.id === transferId) {
          targetTransfer = {
            ...t,
            status,
            resolvedAt: new Date().toISOString(),
            supportNotes: supportNotes !== undefined ? supportNotes : t.supportNotes
          };
          return targetTransfer;
        }
        return t;
      });
    });

    // Wait until state updater finishes or use targetTransfer derived
    setTimeout(() => {
      if (!targetTransfer) return;

      if (isSupabaseEnabled) syncUpsert('stock_transfers', targetTransfer);

      if (status === 'aprobado') {
        if (targetTransfer.origin === 'bodega') {
          // Warehouse -> User APPROVED. Add items to user's stock.
          const userId = targetTransfer.destination;
          setProducts(prevProducts => {
            return prevProducts.map(p => {
              const item = targetTransfer!.items.find(it => it.productId === p.id);
              if (item) {
                const userStocks = p.userStocks || {};
                const userStock = userStocks[userId] !== undefined ? userStocks[userId] : 0;
                const updated = {
                  ...p,
                  userStocks: {
                    ...userStocks,
                    [userId]: userStock + item.quantity
                  }
                };
                if (isSupabaseEnabled) syncUpsert('products', updated);
                return updated;
              }
              return p;
            });
          });
          showToast(`Traspaso #${targetTransfer.id.slice(0,6).toUpperCase()} aprobado y añadido a existencias personales`, "success");
        } else {
          // User -> Warehouse APPROVED. Add items to warehouse's stock.
          setProducts(prevProducts => {
            return prevProducts.map(p => {
              const item = targetTransfer!.items.find(it => it.productId === p.id);
              if (item) {
                const updated = {
                  ...p,
                  stock: p.stock + item.quantity
                };
                if (isSupabaseEnabled) syncUpsert('products', updated);
                return updated;
              }
              return p;
            });
          });
          showToast(`Devolución #${targetTransfer.id.slice(0,6).toUpperCase()} recibida en Bodega Principal`, "success");
        }
      } else if (status === 'rechazado') {
        // Rejection returns the stock to the sender.
        if (targetTransfer.origin === 'bodega') {
          // Warehouse -> User REJECTED. Return items to main warehouse stock.
          setProducts(prevProducts => {
            return prevProducts.map(p => {
              const item = targetTransfer!.items.find(it => it.productId === p.id);
              if (item) {
                const updated = {
                  ...p,
                  stock: p.stock + item.quantity
                };
                if (isSupabaseEnabled) syncUpsert('products', updated);
                return updated;
              }
              return p;
            });
          });
          showToast(`Traspaso rechazado. Artículos devueltos a Bodega Principal`, "warning");
        } else {
          // User -> Warehouse REJECTED. Return items to the user's stock.
          const userId = targetTransfer.origin;
          setProducts(prevProducts => {
            return prevProducts.map(p => {
              const item = targetTransfer!.items.find(it => it.productId === p.id);
              if (item) {
                const userStocks = p.userStocks || {};
                const userStock = userStocks[userId] !== undefined ? userStocks[userId] : 0;
                const updated = {
                  ...p,
                  userStocks: {
                    ...userStocks,
                    [userId]: userStock + item.quantity
                  }
                };
                if (isSupabaseEnabled) syncUpsert('products', updated);
                return updated;
              }
              return p;
            });
          });
          showToast(`Devolución rechazada. Artículos retornados a tu inventario`, "warning");
        }
      }
    }, 0);
  };

  // 4. Cash Register / shifts
  const handleOpenShift = (initialCash: number, user: string) => {
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      user,
      startTime: new Date().toISOString(),
      initialCash,
      salesCash: 0,
      salesCard: 0,
      salesCredit: 0,
      expensesTotal: 0,
      expectedCash: initialCash,
      status: 'Abierta'
    };
    setShifts(prev => [...prev, newShift]);
    showToast(`Arqueo inicial cargado ($${initialCash} USD). Turno ABIERTO.`, "success");
    if (isSupabaseEnabled) syncUpsert('shifts', newShift);
  };

  const handleCloseShift = (shiftId: string, actualCash: number, notes: string) => {
    let updatedShift: Shift | undefined;
    setShifts(prevShifts => {
      return prevShifts.map(s => {
        if (s.id === shiftId) {
          const expected = s.expectedCash;
          updatedShift = {
            ...s,
            endTime: new Date().toISOString(),
            actualCash,
            discrepancy: parseFloat((actualCash - expected).toFixed(2)),
            status: 'Cerrada' as const,
            notes
          };
          return updatedShift;
        }
        return s;
      });
    });
    showToast("Turno cerrado y arqueo final reportado exitosamente", "success");
    if (isSupabaseEnabled) {
      setTimeout(() => {
        if (updatedShift) syncUpsert('shifts', updatedShift);
      }, 50);
    }
  };

  // 5. Payment on Accounts (portfolio collection)
  const handleAddPayment = (invoiceId: string, amount: number) => {
    // Subtract outstanding debt from invoice total inside lists
    setInvoices(prevInvoices => {
      return prevInvoices.map(inv => {
        if (inv.id === invoiceId) {
          const newTotalRemaining = Math.max(0, inv.total - amount);
          const updated = {
            ...inv,
            total: newTotalRemaining,
            paymentStatus: newTotalRemaining === 0 ? 'Pagado' as const : 'Pendiente' as const
          };
          if (isSupabaseEnabled) syncUpsert('invoices', updated);
          return updated;
        }
        return inv;
      });
    });

    // Reduce client deudor balance
    const targetInvoice = invoices.find(inv => inv.id === invoiceId)!;
    setClients(prevClients => {
      return prevClients.map(c => {
        if (c.id === targetInvoice.clientId) {
          const updated = {
            ...c,
            outstandingBalance: Math.max(0, c.outstandingBalance - amount)
          };
          if (isSupabaseEnabled) syncUpsert('clients', updated);
          return updated;
        }
        return c;
      });
    });

    // Add collected cash to the current active register shift if open!
    setShifts(prevShifts => {
      return prevShifts.map(s => {
        if (s.status === 'Abierta') {
          const updated = {
            ...s,
            salesCash: s.salesCash + amount,
            expectedCash: s.expectedCash + amount
          };
          if (isSupabaseEnabled) syncUpsert('shifts', updated);
          return updated;
        }
        return s;
      });
    });
    showToast(`Abono registrado: $${amount} USD ingresados a caja`, "success");
  };

  // 6. Expense additions
  const handleAddExpense = (expense: Expense) => {
    setExpenses(prev => [...prev, expense]);
    if (isSupabaseEnabled) syncUpsert('expenses', expense);
    
    // deduct from active shiftexpected cash immediately if paid in cash
    if (expense.paymentMethod === 'Efectivo') {
      setShifts(prevShifts => {
        return prevShifts.map(s => {
          if (s.status === 'Abierta') {
            const updated = {
              ...s,
              expensesTotal: s.expensesTotal + expense.amount,
              expectedCash: s.expectedCash - expense.amount
            };
            if (isSupabaseEnabled) syncUpsert('shifts', updated);
            return updated;
          }
          return s;
        });
      });
    }
    showToast(`Gasto registrado: $${expense.amount} USD (${expense.category})`, "warning");
  };

  // 7. General config & Users
  const handleUpdateConfig = (newConfig: BusinessConfig) => {
    setConfig(newConfig);
    showToast("Configuración general guardada con éxito", "success");
    if (isSupabaseEnabled) syncUpsert('business_config', { ...newConfig, id: 'singleton' });
  };

  const handleAddUser = (user: User) => {
    setUsers(prev => [...prev, user]);
    showToast(`Usuario/Agente '${user.fullName}' creado exitosamente`, "success");
    if (isSupabaseEnabled) syncUpsert('users', user);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    showToast(`Usuario '${updatedUser.fullName}' actualizado exitosamente`, "success");
    if (isSupabaseEnabled) syncUpsert('users', updatedUser);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    showToast("Acceso de usuario/agente revocado", "warning");
    if (isSupabaseEnabled) syncDelete('users', userId);
  };

  const handleImportDatabase = (data: {
    config: BusinessConfig;
    users: User[];
    clients: Client[];
    products: Product[];
    invoices: Invoice[];
    shifts: Shift[];
    expenses: Expense[];
    adjustments: StockAdjustment[];
  }) => {
    if (data.config) setConfig(data.config);
    if (data.users && data.users.length > 0) {
      setUsers(data.users);
      const stillExists = data.users.find(u => u.id === currentUser.id || u.username === currentUser.username);
      if (!stillExists) {
        setCurrentUser(data.users[0]);
      }
    }
    if (data.clients) setClients(data.clients);
    if (data.products) setProducts(data.products);
    if (data.invoices) setInvoices(data.invoices);
    if (data.shifts) setShifts(data.shifts);
    if (data.expenses) setExpenses(data.expenses);
    if (data.adjustments) setAdjustments(data.adjustments);
    showToast("Copia de seguridad restaurada correctamente", "success");
  };

  const handleResetDatabase = () => {
    localStorage.clear();
    setConfig(INITIAL_BUSINESS_CONFIG);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[1]); // Agente Neon-Pink
    setProducts(INITIAL_PRODUCTS);
    setClients(INITIAL_CLIENTS);
    setInvoices(INITIAL_INVOICES);
    setExpenses(INITIAL_EXPENSES);
    setShifts(INITIAL_SHIFTS);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setActiveTab('dashboard');
    showToast("Base de datos reiniciada. Todos los datos purgados.", "error");
  };

  // Navigation Links Definition
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp, color: 'text-cyber-pink', shortcut: 'Ctrl+D' },
    { id: 'facturacion', label: 'Facturación / Despacho', icon: ShoppingCart, color: 'text-cyber-orange', shortcut: 'Ctrl+F' },
    { id: 'historial_facturas', label: 'Historial de Facturas', icon: FileText, color: 'text-cyber-pink' },
    { id: 'domicilios', label: 'Domicilios / Mensajería', icon: Truck, color: 'text-cyber-pink' },
    { id: 'clientes', label: 'Clientes', icon: Users, color: 'text-cyber-pink', shortcut: 'Ctrl+C' },
    { id: 'inventario', label: 'Inventario de Insumos', icon: Package, color: 'text-cyber-blue', shortcut: 'Ctrl+P' },
    { id: 'caja', label: 'Apertura / Cierre Caja', icon: Key, color: 'text-cyber-green', shortcut: 'Ctrl+A' },
    { id: 'historial_cierres', label: 'Historial de Cierres', icon: FileText, color: 'text-cyber-pink' },
    { id: 'cartera', label: 'Cuentas por Cobrar', icon: Briefcase, color: 'text-cyber-orange' },
    { id: 'gastos', label: 'Gastos de Turno', icon: ArrowDownCircle, color: 'text-cyber-pink' },
    { id: 'identificadortlf', label: 'Identificador Telefónico', icon: Phone, color: 'text-cyber-blue' },
    { id: 'chatsoporte', label: 'Soporte Chat', icon: MessageSquare, color: 'text-cyber-pink' },
    { id: 'solicitudes_clientes', label: 'Solicitudes Clientes', icon: Inbox, color: 'text-cyber-orange' },
    { id: 'nomina', label: 'Nómina', icon: DollarSign, color: 'text-cyber-green' },
    { id: 'configuraciones', label: 'Configuraciones', icon: Settings, color: 'text-cyber-blue' }
  ];

  // Render Loading screen while connecting to Supabase
  if (isLoadingDB) {
    return (
      <div className="min-h-screen bg-cyber-bg text-gray-200 font-sans flex flex-col items-center justify-center relative overflow-hidden scanlines p-4">
        <div className="text-center space-y-4 relative z-10 max-w-md">
          <div className="w-16 h-16 border-4 border-cyber-pink border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-bold font-mono tracking-widest text-cyber-pink animate-pulse">CONEXIÓN ONLINE</h2>
          <p className="text-xs font-mono text-gray-400">Estableciendo enlace y sincronizando base de datos con Supabase. Por favor espere...</p>
        </div>
      </div>
    );
  }

  // Render Client Portal if client logged in
  if (currentClient) {
    return (
      <PortalCliente 
        client={currentClient}
        products={products}
        invoices={invoices}
        config={config}
        onAddInvoice={handleAddInvoice}
        onLogout={() => setCurrentClient(null)}
        chatMessages={chatMessages}
        onSendMessage={handleSendMessage}
        showToast={showToast}
        clientRequests={clientRequests.filter(r => r.clientId === currentClient.id)}
        onSubmitRequest={handleAddClientRequest}
        onDeleteClient={handleDeleteClient}
        flashMessages={flashMessages}
        flashViews={flashViews}
        onIncrementFlashView={incrementFlashView}
        onUpdateClient={handleUpdateClient}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cyber-bg text-gray-200 font-sans flex items-center justify-center relative overflow-hidden scanlines p-4">
        {/* Visual background logo */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-[0.12] mix-blend-lighten"
          style={{ backgroundImage: `url('/images/logo_cyberpunk_1783131526095.jpg')` }}
        ></div>

        <div className="bg-cyber-card/95 border border-cyber-border rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6 relative z-10 shadow-2xl neon-shadow-pink">
          <div className="text-center space-y-2">
            {/* Logo */}
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-cyber-pink mx-auto animate-pulse relative">
              <img 
                src="/images/logo_cyberpunk_1783131526095.jpg" 
                alt="Rosa Fuerte S.A." 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-widest font-mono">
                {config.companyName.toUpperCase()}
              </h1>
              <p className="text-[9px] text-cyber-pink font-mono tracking-widest uppercase mt-0.5">
                Terminal de Control y Despacho
              </p>
            </div>
          </div>

           {/* Invisible Operator Toggle dot in the top right corner of the login card */}
          <div 
            onClick={() => {
              setLoginMode(prev => prev === 'client' ? 'agent' : 'client');
              setLoginError(null);
            }}
            className="absolute top-4 right-4 w-2 h-2 rounded-full bg-cyber-pink/5 hover:bg-cyber-pink/40 cursor-pointer transition-colors"
            title="Terminal de Enlace"
          />

          {/* DYNAMIC FORMS ACCORDING TO TYPE */}
          {loginMode === 'agent' ? (
            /* AGENT OPERATOR LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono font-bold">Identidad Operativa (Usuario):</label>
                <input 
                  type="text"
                  placeholder="Usuario (Ej: admin o cajero1)..."
                  value={loginUsername} 
                  onChange={e => {
                    setLoginUsername(e.target.value);
                    setLoginError(null);
                  }}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
                  required
                />
              </div>

              <div className="space-y-1 relative">
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono">Contraseña de Seguridad:</label>
                <div className="relative">
                  <input 
                    type={showAgentPassword ? "text" : "password"} 
                    value={loginPassword} 
                    onChange={e => {
                      setLoginPassword(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="Clave (Ej: admin o 1234)..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 pr-10 rounded-lg w-full focus:outline-none glow-border-pink tracking-widest font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAgentPassword(!showAgentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                  >
                    {showAgentPassword ? (
                      /* Eye Off */
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    ) : (
                      /* Eye */
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-red-400 text-[10px] leading-relaxed font-sans">
                  🚨 {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent hover:scale-[1.01] active:scale-[0.99] font-bold tracking-wider font-mono text-xs transition-all cursor-pointer neon-shadow-pink"
              >
                AUTENTICAR E INGRESAR AL BÚNKER
              </button>
            </form>
          ) : (
            /* CLIENT LOGIN & FORGOT PASSWORD PORTLET */
            <div className="space-y-4">
              {!showForgotPasswordForm ? (
                /* MANUAL CLIENT LOGIN FORM */
                <form onSubmit={handleClientLoginSubmit} className="space-y-4 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono font-bold">Identificación RUT / NIT:</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 901.442.111-4"
                      value={clientLoginRut}
                      onChange={e => {
                        setClientLoginRut(e.target.value);
                        setLoginError(null);
                      }}
                      className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1 relative">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono font-bold">Contraseña del Portal:</label>
                    <div className="relative">
                      <input 
                        type={showClientPassword ? "text" : "password"} 
                        placeholder="Contraseña (Por defecto: 1234)..."
                        value={clientLoginPassword}
                        onChange={e => {
                          setClientLoginPassword(e.target.value);
                          setLoginError(null);
                        }}
                        className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 pr-10 rounded-lg w-full focus:outline-none glow-border-pink tracking-wide font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientPassword(!showClientPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                      >
                        {showClientPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setShowForgotPasswordForm(true); setLoginError(null); }}
                      className="text-[9px] text-cyber-pink hover:underline font-mono cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {loginError && (
                    <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-red-400 text-[10px] leading-relaxed font-sans">
                      🚨 {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent hover:scale-[1.01] active:scale-[0.99] font-bold tracking-wider font-mono text-xs transition-all cursor-pointer neon-shadow-pink"
                  >
                    INGRESAR AL PORTAL DE CLIENTE
                  </button>
                </form>
              ) : (
                /* FORGOT PASSWORD FORM */
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 font-mono text-xs">
                  <div className="text-center space-y-0.5 pb-1">
                    <h3 className="text-[11px] font-extrabold text-cyber-pink uppercase tracking-widest">Restablecer Contraseña</h3>
                    <p className="text-[9px] text-gray-500">Ingresa tu NIT/RUT y establece una nueva clave</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono">NIT / RUT registrado:</label>
                    <input
                      type="text"
                      placeholder="Ej: 901.442.111-4"
                      value={forgotRut}
                      onChange={e => { setForgotRut(e.target.value); setLoginError(null); }}
                      className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1 relative">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono">Nueva Contraseña:</label>
                    <div className="relative">
                      <input
                        type={showForgotNewPwd ? "text" : "password"}
                        placeholder="Escribe tu nueva contraseña..."
                        value={forgotNewPassword}
                        onChange={e => { setForgotNewPassword(e.target.value); setLoginError(null); }}
                        className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 pr-10 rounded-lg w-full focus:outline-none glow-border-pink tracking-wide font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPwd(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                      >
                        {showForgotNewPwd ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-mono">Confirmar Contraseña:</label>
                    <input
                      type="password"
                      placeholder="Repite la nueva contraseña..."
                      value={forgotConfirmPassword}
                      onChange={e => { setForgotConfirmPassword(e.target.value); setLoginError(null); }}
                      className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink tracking-wide font-mono"
                      required
                    />
                  </div>

                  {loginError && (
                    <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-red-400 text-[10px] leading-relaxed font-sans">
                      🚨 {loginError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="bg-cyber-green/10 border border-cyber-green/30 p-2.5 rounded text-cyber-green text-[10px] text-center font-mono">
                      ✅ ¡Contraseña actualizada! Redirigiendo al inicio de sesión...
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="submit"
                      className="py-2.5 rounded-lg bg-cyber-pink text-black hover:bg-cyber-accent font-bold font-mono text-[10px] transition-all cursor-pointer"
                    >
                      CAMBIAR CONTRASEÑA
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPasswordForm(false); setLoginError(null); setForgotRut(''); setForgotNewPassword(''); setForgotConfirmPassword(''); }}
                      className="py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-gray-400 hover:text-white font-bold font-mono text-[10px] transition-all cursor-pointer"
                    >
                      REGRESAR
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="text-center text-[9px] text-gray-500 font-mono border-t border-slate-800/80 pt-4 select-none">
            <span>Rosa Fuerte Logistics System • Acceso Encriptado • </span>
            <span 
              onClick={() => {
                setLoginMode(prev => prev === 'client' ? 'agent' : 'client');
                setLoginError(null);
              }}
              className="cursor-pointer hover:text-gray-400 select-none active:text-cyber-pink font-bold"
              title="Panel Técnico"
            >
              v4.1
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-gray-200 font-sans flex flex-col relative overflow-x-hidden scanlines">
      
      {/* Visual cyber background image (from uploaded artwork) with very low opacity to maintain readable content contrast */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-[0.12] mix-blend-lighten"
        style={{ backgroundImage: `url('/images/logo_cyberpunk_1783131526095.jpg')` }}
      ></div>

      {/* Visual cyber glow grids */}
      <div className="absolute inset-0 cyber-grid pointer-events-none opacity-25"></div>

      {/* HEADER BAR (No-print) */}
      <header className="bg-cyber-card/90 border-b border-cyber-border py-3 px-4 flex justify-between items-center z-40 sticky top-0 backdrop-blur-md no-print">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="lg:hidden text-gray-400 hover:text-white"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          
          <div className="flex items-center gap-2">
            {/* Custom generated artwork logo */}
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-cyber-pink/40 animate-pulse relative shrink-0">
              <img 
                src="/images/logo_cyberpunk_1783131526095.jpg" 
                alt="Rosa Fuerte Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wider font-mono">
                {config.companyName.toUpperCase()}
              </h1>
              <p className="text-[10px] text-cyber-pink font-mono tracking-widest mt-0.5">
                Tu Seguridad y disfrute Es Nuestra Prioridad
              </p>
            </div>
          </div>
        </div>

        {/* Global metadata status block */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden md:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-cyber-border">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping"></span>
            <span className="text-gray-400">OPERADOR:</span>
            <span className="text-white font-bold">{currentUser.fullName}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-cyber-border">
            <Clock size={13} className="text-cyber-orange animate-spin-slow" />
            <span className="text-white font-bold">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Fullscreen Toggle Button */}
          <button 
            onClick={toggleFullscreen}
            className="flex items-center justify-center bg-slate-900 text-gray-400 hover:text-white p-2 rounded-lg border border-cyber-border hover:border-cyber-pink/50 cursor-pointer transition-all"
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa'}
          >
            {isFullscreen ? <Minimize size={14} className="text-cyber-pink" /> : <Maximize size={14} className="text-cyber-pink" />}
          </button>

          {/* Security Lock / Logout Button */}
          <button 
            onClick={() => {
              setIsAuthenticated(false);
              setCurrentUser(INITIAL_USERS[1]);
            }}
            className="flex items-center justify-center bg-slate-900 text-gray-400 hover:text-red-400 p-2 rounded-lg border border-cyber-border hover:border-red-500/50 cursor-pointer transition-all"
            title="Cerrar Sesión / Bloquear Terminal"
          >
            <Lock size={14} className="text-red-400" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex z-10">
        
        {/* SIDEBAR NAVIGATION (No-print) */}
        <aside className={`no-print w-64 bg-cyber-card/95 border-r border-cyber-border flex flex-col justify-between shrink-0 transition-transform duration-300 lg:translate-x-0 fixed lg:static top-14 bottom-0 left-0 z-30 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4 space-y-6">
            
            {/* Dynamic gasmask astronaut visual card inspired directly by client's image uploads */}
            <div className="bg-slate-900/60 rounded-xl border border-cyber-border/80 p-3.5 flex items-center gap-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyber-pink/5 to-transparent"></div>
              {/* Astronaut representation */}
              <div className="w-12 h-12 rounded-full border-2 border-cyber-pink overflow-hidden shrink-0 relative">
                <img 
                  src="/images/logo_cyberpunk_1783131526095.jpg" 
                  alt="Mensajero Atómico" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-mono text-cyber-orange font-bold uppercase block tracking-wider">
                  Mascota de Búnker
                </span>
                <span className="text-xs font-bold text-white block truncate">
                  Mensajero Atómico
                </span>
                <span className="text-[9px] text-gray-500 font-mono mt-0.5 block flex items-center gap-1">
                  🌹 Rosa Fuerte
                </span>
              </div>
            </div>

            {/* Navigation links list */}
            <nav className="space-y-1">
              {navLinks.map(link => {
                const LinkIcon = link.icon;
                const isActive = activeTab === link.id;
                const userPerms = getUserPermissions(currentUser);
                const hasAccess = userPerms[link.id as keyof UserPermissions] !== false;

                return (
                  <button
                    key={link.id}
                    onClick={() => {
                      setActiveTab(link.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`group w-full py-2.5 px-3 rounded-lg flex items-center justify-between text-xs font-mono font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                      isActive 
                        ? 'bg-cyber-pink/10 text-cyber-pink border-l-4 border-cyber-pink shadow-[0_0_15px_rgba(236,72,153,0.15)]' 
                        : hasAccess
                          ? 'text-gray-400 hover:text-white hover:bg-slate-900/50'
                          : 'text-gray-600 hover:text-red-400 hover:bg-red-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <LinkIcon size={16} className={`${isActive ? 'text-cyber-pink' : hasAccess ? 'text-gray-500 group-hover:text-white transition-colors' : 'text-red-900/50 group-hover:text-red-500 transition-colors'}`} />
                      <span className={`truncate ${!hasAccess ? 'line-through decoration-red-900/40 text-gray-500/80 group-hover:text-red-400/90' : ''}`}>{link.label}</span>
                    </div>
                    {!hasAccess ? (
                      <Lock size={12} className="text-red-600 animate-pulse shrink-0 ml-1.5" />
                    ) : link.shortcut ? (
                      <kbd className="text-[8px] opacity-45 group-hover:opacity-100 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-900/80 text-gray-400 group-hover:text-cyber-pink group-hover:border-cyber-pink/30 font-mono font-normal transition-all shrink-0">
                        {link.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                );
              })}
            </nav>

          </div>

          {/* Quick exit shift summary at footer */}
          <div className="p-4 border-t border-cyber-border space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-gray-500">OPERACIÓN:</span>
              <span className={shifts.some(s => s.status === 'Abierta') ? 'text-cyber-green' : 'text-red-400'}>
                {shifts.some(s => s.status === 'Abierta') ? 'CON JORNADA' : 'SIN JORNADA'}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950 rounded-lg border border-slate-900 px-2 py-1.5">
              <span className="text-gray-500 uppercase text-[9px]">Sesión activa:</span>
              <span className="text-gray-200 font-bold truncate ml-2 text-[10px]">{currentUser.fullName}</span>
            </div>
          </div>
        </aside>

        {/* WORKSPACE AREA */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {(() => {
            const userPerms = getUserPermissions(currentUser);
            const hasAccess = userPerms[activeTab as keyof UserPermissions] !== false;
            
            if (!hasAccess) {
              const tabLabel = navLinks.find(link => link.id === activeTab)?.label || activeTab;
              return (
                <RestrictedAccess 
                  moduleName={tabLabel}
                  requiredPermission={activeTab}
                  onBackToSafety={() => {
                    const allowedTabs = navLinks.filter(link => userPerms[link.id as keyof UserPermissions] !== false);
                    setActiveTab(allowedTabs[0]?.id || 'dashboard');
                  }}
                />
              );
            }
            return null;
          })()}

          {activeTab === 'dashboard' && getUserPermissions(currentUser).dashboard !== false && (
            <Dashboard 
              clients={clients} 
              products={products} 
              invoices={invoices} 
              shifts={shifts}
              expenses={expenses}
              currentUser={currentUser}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'facturacion' && getUserPermissions(currentUser).facturacion !== false && (
            <Facturacion 
              clients={clients}
              products={products}
              invoices={invoices}
              shifts={shifts}
              config={config}
              currentUser={currentUser}
              onAddInvoice={handleAddInvoice}
              onAddClient={handleAddClient}
              discounts={discounts}
            />
          )}

          {activeTab === 'domicilios' && getUserPermissions(currentUser).domicilios !== false && (
            <Domicilios 
              invoices={invoices}
              config={config}
              onUpdateInvoice={handleUpdateInvoice}
            />
          )}

          {activeTab === 'clientes' && getUserPermissions(currentUser).clientes !== false && (
            <Clientes 
              clients={clients}
              invoices={invoices}
              config={config}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onImportClients={handleImportClients}
            />
          )}

          {activeTab === 'inventario' && getUserPermissions(currentUser).inventario !== false && (
            <Inventario 
              products={products}
              adjustments={adjustments}
              currentUser={currentUser}
              config={config}
              onAddProduct={handleAddProduct}
              onAdjustStock={handleAdjustStock}
              onImportProducts={handleImportProducts}
              transfers={transfers}
              onAddTransfer={handleAddTransfer}
              onUpdateTransferStatus={handleUpdateTransferStatus}
              users={users}
            />
          )}

          {activeTab === 'caja' && getUserPermissions(currentUser).caja !== false && (
            <CajaJornada 
              shifts={shifts}
              invoices={invoices}
              expenses={expenses}
              users={users}
              currentUser={currentUser}
              onOpenShift={handleOpenShift}
              onCloseShift={handleCloseShift}
            />
          )}

          {activeTab === 'historial_cierres' && getUserPermissions(currentUser).historial_cierres !== false && (
            <HistorialCierres 
              shifts={shifts}
              invoices={invoices}
              expenses={expenses}
              users={users}
            />
          )}

          {activeTab === 'cartera' && getUserPermissions(currentUser).cartera !== false && (
            <Cartera 
              invoices={invoices}
              clients={clients}
              onAddPayment={handleAddPayment}
            />
          )}

          {activeTab === 'gastos' && getUserPermissions(currentUser).gastos !== false && (
            <Gastos 
              expenses={expenses}
              shifts={shifts}
              currentUser={currentUser}
              config={config}
              onAddExpense={handleAddExpense}
            />
          )}

          {activeTab === 'configuraciones' && getUserPermissions(currentUser).configuraciones !== false && (
            <Configuraciones 
              config={config}
              users={users}
              clients={clients}
              products={products}
              invoices={invoices}
              shifts={shifts}
              expenses={expenses}
              adjustments={adjustments}
              currentUser={currentUser}
              onUpdateConfig={handleUpdateConfig}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onResetDatabase={handleResetDatabase}
              onImportDatabase={handleImportDatabase}
              discounts={discounts}
              onUpdateDiscounts={setDiscounts}
              flashMessages={flashMessages}
              onUpdateFlashMessages={setFlashMessages}
              soundSettings={soundSettings}
              onUpdateSoundSettings={setSoundSettings}
            />
          )}

          {activeTab === 'identificadortlf' && getUserPermissions(currentUser).identificadortlf !== false && (
            <IdentificadorTlf 
              clients={clients}
              onAddClient={handleAddClient}
              showToast={showToast}
            />
          )}

          {activeTab === 'chatsoporte' && getUserPermissions(currentUser).chatsoporte !== false && (
            <ChatSoporte 
              clients={clients}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              currentUser={currentUser}
              showToast={showToast}
              onAssignAgent={handleAssignAgent}
            />
          )}

          {activeTab === 'solicitudes_clientes' && getUserPermissions(currentUser).solicitudes_clientes !== false && (
            <SolicitudesClientes
              requests={clientRequests}
              clients={clients}
              currentUserName={currentUser.fullName}
              onUpdateRequest={handleUpdateClientRequest}
            />
          )}

          {activeTab === 'historial_facturas' && getUserPermissions(currentUser).historial_facturas !== false && (
            <HistorialFacturas
              invoices={invoices}
              clients={clients}
              config={config}
              currentUserName={currentUser.fullName}
              canAnular={getUserPermissions(currentUser).eliminar_facturas !== false}
              canImprimir={getUserPermissions(currentUser).imprimir_facturas !== false}
              onUpdateInvoice={inv => {
                setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i));
                showToast(`Factura #${inv.invoiceNumber} actualizada`, inv.paymentStatus === 'Anulada' ? 'warning' : 'info');
              }}
            />
          )}

          {activeTab === 'nomina' && getUserPermissions(currentUser).nomina !== false && (
            <Nomina 
              users={users}
              payrollEntries={payrollEntries}
              config={config}
              currentUserName={currentUser.fullName}
              onAddEntry={handleAddPayrollEntry}
              onUpdateEntry={handleUpdatePayrollEntry}
              onDeleteEntry={handleDeletePayrollEntry}
            />
          )}
        </main>

      </div>

      {/* Atom Bubble support chat for operators (Atom shape in motion) */}
      <AtomBubble 
        type="agent"
        clients={clients}
        chatMessages={chatMessages}
        currentUser={currentUser}
        onSendMessage={handleSendMessage}
        onAssignAgent={handleAssignAgent}
        showToast={showToast}
      />

      {/* Cyberpunk Toast Notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm pointer-events-none select-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border font-mono text-xs shadow-lg transition-all duration-300 flex items-center gap-3 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40'
                : toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-300 shadow-rose-950/40'
                : toast.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-300 shadow-amber-950/40'
                : 'bg-blue-950/95 border-blue-500/50 text-blue-300 shadow-blue-950/40'
            }`}
          >
            <div className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
              toast.type === 'success' 
                ? 'bg-emerald-400' 
                : toast.type === 'error' 
                ? 'bg-rose-400' 
                : toast.type === 'warning' 
                ? 'bg-amber-400' 
                : 'bg-blue-400'
            }`} />
            <span className="leading-tight">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Operator Flash Message Modal */}
      {operatorFlash && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-cyber-card border-2 border-cyber-pink/80 rounded-2xl max-w-lg w-full p-6 space-y-4 relative shadow-[0_0_40px_rgba(236,72,153,0.3)] font-mono text-xs select-text">
            {/* Pulsing neon title */}
            <div className="border-b border-cyber-border pb-3 flex justify-between items-center">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 animate-pulse">
                📢 PUBLICIDAD / RECORDATORIO DE COMUNICACIÓN
              </h2>
              <button 
                onClick={() => setOperatorFlash(null)} 
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-cyber-pink font-bold text-sm tracking-wide uppercase">
                {operatorFlash.title}
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {operatorFlash.content}
              </p>
              
              {/* Media attachment representation */}
              {operatorFlash.attachmentUrl && (
                <div className="pt-2 border-t border-slate-900 flex justify-center">
                  {operatorFlash.attachmentType === 'image' && (
                    <img 
                      src={operatorFlash.attachmentUrl} 
                      alt={operatorFlash.attachmentName || 'Adjunto'} 
                      className="max-w-full rounded-lg border border-cyber-border max-h-60 object-contain shadow-lg"
                    />
                  )}
                  {operatorFlash.attachmentType === 'video' && (
                    <video 
                      src={operatorFlash.attachmentUrl} 
                      controls 
                      className="max-w-full rounded-lg border border-cyber-border max-h-60 shadow-lg"
                    />
                  )}
                  {operatorFlash.attachmentType === 'file' && (
                    <a 
                      href={operatorFlash.attachmentUrl} 
                      download={operatorFlash.attachmentName || 'archivo'}
                      className="flex items-center gap-2.5 p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-900 hover:border-cyber-pink rounded-xl text-white hover:text-cyber-pink transition-all w-full truncate"
                    >
                      <span>📎</span>
                      <span className="truncate">{operatorFlash.attachmentName || 'Descargar archivo adjunto'}</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-900 flex justify-end">
              <button
                onClick={() => setOperatorFlash(null)}
                className="bg-cyber-pink text-black hover:bg-cyber-accent px-5 py-2.5 rounded-lg font-bold font-mono text-xs cursor-pointer shadow-lg active:scale-95 transition-all text-center neon-shadow-pink"
              >
                ENTENDIDO Y CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
