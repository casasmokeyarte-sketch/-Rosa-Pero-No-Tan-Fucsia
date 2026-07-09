import React, { useState, useRef } from 'react';
import { 
  BusinessConfig, User, UserPermissions, Client, Product, Invoice, Shift, Expense, StockAdjustment,
  Discount, FlashMessage, SoundSettings 
} from '../types';
import { playTone, TONE_NAMES } from '../utils/soundService';
import { 
  Settings, 
  Building, 
  Users, 
  Download, 
  Trash2, 
  RefreshCw, 
  ShieldAlert, 
  Check, 
  PlusCircle, 
  UserMinus,
  FileSpreadsheet,
  Upload,
  Plus,
  Database,
  Briefcase,
  Layers,
  X,
  Edit2,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Fingerprint
} from 'lucide-react';

interface ConfiguracionesProps {
  config: BusinessConfig;
  users: User[];
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  shifts: Shift[];
  expenses: Expense[];
  adjustments: StockAdjustment[];
  currentUser: User;
  onUpdateConfig: (config: BusinessConfig) => void;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onResetDatabase: () => void;
  onImportDatabase: (data: {
    config: BusinessConfig;
    users: User[];
    clients: Client[];
    products: Product[];
    invoices: Invoice[];
    shifts: Shift[];
    expenses: Expense[];
    adjustments: StockAdjustment[];
  }) => void;
  discounts: Discount[];
  onUpdateDiscounts: (discounts: Discount[]) => void;
  flashMessages: FlashMessage[];
  onUpdateFlashMessages: (messages: FlashMessage[]) => void;
  soundSettings: SoundSettings;
  onUpdateSoundSettings: (settings: SoundSettings) => void;
}

export default function Configuraciones({
  config,
  users,
  clients,
  products,
  invoices,
  shifts,
  expenses,
  adjustments,
  currentUser,
  onUpdateConfig,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetDatabase,
  onImportDatabase,
  discounts,
  onUpdateDiscounts,
  flashMessages,
  onUpdateFlashMessages,
  soundSettings,
  onUpdateSoundSettings
}: ConfiguracionesProps) {
  
  // Local state for configuration form
  const [companyName, setCompanyName] = useState(config.companyName);
  const [rut, setRut] = useState(config.rut);
  const [address, setAddress] = useState(config.address);
  const [phone, setPhone] = useState(config.phone);
  const [email, setEmail] = useState(config.email);
  const [prefix, setPrefix] = useState(config.invoicePrefix);
  const [taxRate, setTaxRate] = useState(config.taxRate);
  const [cardFeePercentage, setCardFeePercentage] = useState(config.cardFeePercentage || 0);
  const [cardFeeEnabled, setCardFeeEnabled] = useState(config.cardFeeEnabled || false);
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Users form state
  const [selectedEditUser, setSelectedEditUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'Administrador' | 'Cajero'>('Cajero');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getDefaultPermissionsForRole = (roleType: 'Administrador' | 'Cajero'): UserPermissions => {
    const isAdmin = roleType === 'Administrador';
    return {
      dashboard: true,
      facturacion: true,
      domicilios: true,
      clientes: true,
      inventario: true,
      caja: true,
      historial_cierres: isAdmin,
      cartera: isAdmin,
      gastos: true,
      identificadortlf: true,
      chatsoporte: true,
      configuraciones: isAdmin,
      solicitudes_clientes: true,
      historial_facturas: true,
      nomina: isAdmin,
      crear_factura: true,
      editar_cliente: true,
      eliminar_cliente: isAdmin,
      ajustar_stock: isAdmin,
      traspaso_inventario: true,
      abrir_cerrar_caja: true,
      registrar_gasto: true,
      abonar_cartera: isAdmin,
      modificar_configuracion: isAdmin,
      gestionar_usuarios: isAdmin,
      autorizar_descuentos: isAdmin,
      // Acciones detalladas por módulo
      imprimir_facturas: true,
      editar_facturas: isAdmin,
      eliminar_facturas: isAdmin,
      imprimir_clientes: true,
      eliminar_inventario: isAdmin,
      imprimir_inventario: true,
      editar_gastos: isAdmin,
      eliminar_gastos: isAdmin,
      imprimir_gastos: true,
      imprimir_cartera: isAdmin,
      editar_domicilios: true,
      imprimir_domicilios: true,
      imprimir_cierres: isAdmin
    };
  };

  const [permissions, setPermissions] = useState<UserPermissions>(() => getDefaultPermissionsForRole('Cajero'));

  const handleRoleChange = (newRole: 'Administrador' | 'Cajero') => {
    setRole(newRole);
    setPermissions(getDefaultPermissionsForRole(newRole));
  };

  const handleEditUserClick = (u: User) => {
    setSelectedEditUser(u);
    setUsername(u.username);
    setFullName(u.fullName);
    setRole(u.role);
    setPassword(u.password || '');
    if (u.permissions) {
      setPermissions(u.permissions);
    } else {
      setPermissions(getDefaultPermissionsForRole(u.role));
    }
  };

  const handleCancelEditUser = () => {
    setSelectedEditUser(null);
    setUsername('');
    setFullName('');
    setRole('Cajero');
    setPassword('');
    setPermissions(getDefaultPermissionsForRole('Cajero'));
  };

  // Category and Payment Method states
  const [newCategory, setNewCategory] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Backup and Restore states
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local Sound settings state
  const [soundEnabled, setSoundEnabled] = useState(soundSettings.soundEnabled);
  const [chatSoundEnabled, setChatSoundEnabled] = useState(soundSettings.chatSoundEnabled);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(soundSettings.notifSoundEnabled);
  const [defaultTone, setDefaultTone] = useState(soundSettings.defaultTone);
  const [soundSaveSuccess, setSoundSaveSuccess] = useState(false);

  // Promotions and Discounts Form state
  const [promoName, setPromoName] = useState('');
  const [promoType, setPromoType] = useState<'porcentaje' | 'fijo'>('porcentaje');
  const [promoValue, setPromoValue] = useState(0);
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate, setPromoEndDate] = useState('');
  const [promoStartTime, setPromoStartTime] = useState('');
  const [promoEndTime, setPromoEndTime] = useState('');
  const [promoActiveDays, setPromoActiveDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]); // All days
  const [promoAppliesTo, setPromoAppliesTo] = useState<'todos' | 'facturacion' | 'domicilios'>('todos');
  const [promoActive, setPromoActive] = useState(true);

  // Flash Reminders Form state
  const [flashTitle, setFlashTitle] = useState('');
  const [flashContent, setFlashContent] = useState('');
  const [flashTarget, setFlashTarget] = useState<'operadores' | 'clientes' | 'ambos'>('ambos');
  const [flashMaxViews, setFlashMaxViews] = useState(1);
  const [flashExpiresAt, setFlashExpiresAt] = useState('');
  const [flashAttachmentUrl, setFlashAttachmentUrl] = useState<string>('');
  const [flashAttachmentType, setFlashAttachmentType] = useState<'image' | 'video' | 'file' | undefined>(undefined);
  const [flashAttachmentName, setFlashAttachmentName] = useState('');
  const [flashActive, setFlashActive] = useState(true);
  const flashFileInputRef = useRef<HTMLInputElement>(null);

  // Sound submit
  const handleSoundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSoundSettings({
      soundEnabled,
      chatSoundEnabled,
      notifSoundEnabled,
      defaultTone
    });
    setSoundSaveSuccess(true);
    setTimeout(() => setSoundSaveSuccess(false), 3000);
  };

  // Promotions CRUD Handlers
  const handleAddDiscountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoName || promoValue <= 0) return;
    
    const newPromo: Discount = {
      id: `promo-${Date.now()}`,
      name: promoName,
      type: promoType,
      value: promoValue,
      active: promoActive,
      startDate: promoStartDate || undefined,
      endDate: promoEndDate || undefined,
      startTime: promoStartTime || undefined,
      endTime: promoEndTime || undefined,
      activeDays: promoActiveDays,
      appliesTo: promoAppliesTo,
      createdAt: new Date().toISOString()
    };
    onUpdateDiscounts([...discounts, newPromo]);
    
    // Reset Form
    setPromoName('');
    setPromoValue(0);
    setPromoStartDate('');
    setPromoEndDate('');
    setPromoStartTime('');
    setPromoEndTime('');
    setPromoActiveDays([1, 2, 3, 4, 5, 6, 0]);
    setPromoAppliesTo('todos');
    setPromoActive(true);
  };

  const handleDeleteDiscount = (id: string) => {
    onUpdateDiscounts(discounts.filter(d => d.id !== id));
  };

  const handleToggleDiscountActive = (id: string) => {
    onUpdateDiscounts(discounts.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const handleFlashFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let type: 'image' | 'video' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFlashAttachmentUrl(event.target?.result as string);
      setFlashAttachmentType(type);
      setFlashAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAddFlashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flashTitle || !flashContent) return;

    const newFlash: FlashMessage = {
      id: `flash-${Date.now()}`,
      title: flashTitle,
      content: flashContent,
      target: flashTarget,
      maxViews: flashMaxViews,
      expiresAt: flashExpiresAt || undefined,
      attachmentUrl: flashAttachmentUrl || undefined,
      attachmentType: flashAttachmentType,
      attachmentName: flashAttachmentName || undefined,
      active: flashActive,
      createdAt: new Date().toISOString()
    };

    onUpdateFlashMessages([...flashMessages, newFlash]);

    // Reset Form
    setFlashTitle('');
    setFlashContent('');
    setFlashTarget('ambos');
    setFlashMaxViews(1);
    setFlashExpiresAt('');
    setFlashAttachmentUrl('');
    setFlashAttachmentType(undefined);
    setFlashAttachmentName('');
    setFlashActive(true);
    if (flashFileInputRef.current) flashFileInputRef.current.value = '';
  };

  const handleDeleteFlash = (id: string) => {
    onUpdateFlashMessages(flashMessages.filter(f => f.id !== id));
  };

  const handleToggleFlashActive = (id: string) => {
    onUpdateFlashMessages(flashMessages.map(f => f.id === id ? { ...f, active: !f.active } : f));
  };

  const handlePromoDayToggle = (day: number) => {
    if (promoActiveDays.includes(day)) {
      setPromoActiveDays(promoActiveDays.filter(d => d !== day));
    } else {
      setPromoActiveDays([...promoActiveDays, day]);
    }
  };

  // Submit config update
  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      ...config,
      companyName,
      rut,
      address,
      phone,
      email,
      invoicePrefix: prefix,
      taxRate: parseFloat(taxRate.toString()) || 0,
      cardFeePercentage: parseFloat(cardFeePercentage.toString()) || 0,
      cardFeeEnabled
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Submit new/edited user
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !fullName) return;

    if (selectedEditUser) {
      const updatedUser: User = {
        ...selectedEditUser,
        username: username.toLowerCase().trim(),
        fullName,
        role,
        password: password.trim() || selectedEditUser.password || '',
        permissions
      };
      onUpdateUser(updatedUser);
      setSelectedEditUser(null);
    } else {
      const nUser: User = {
        id: `u-${Date.now()}`,
        username: username.toLowerCase().trim(),
        fullName,
        role,
        status: 'Activo',
        password: password.trim(),
        permissions
      };
      onAddUser(nUser);
    }

    // Clear form
    setUsername('');
    setFullName('');
    setRole('Cajero');
    setPassword('');
    setPermissions(getDefaultPermissionsForRole('Cajero'));
  };

  // Lists Management
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategory.trim();
    if (!clean) return;
    
    const existing = config.productCategories || [];
    if (existing.map(c => c.toLowerCase()).includes(clean.toLowerCase())) {
      setCategoryError("Esta categoría ya existe.");
      return;
    }
    
    const updated = [...existing, clean];
    onUpdateConfig({
      ...config,
      productCategories: updated
    });
    setNewCategory('');
    setCategoryError(null);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    const existing = config.productCategories || [];
    const updated = existing.filter(c => c !== catToDelete);
    onUpdateConfig({
      ...config,
      productCategories: updated
    });
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPaymentMethod.trim();
    if (!clean) return;
    
    const existing = config.paymentMethods || [];
    if (existing.map(m => m.toLowerCase()).includes(clean.toLowerCase())) {
      setPaymentError("Este método de pago ya existe.");
      return;
    }
    
    const updated = [...existing, clean];
    onUpdateConfig({
      ...config,
      paymentMethods: updated
    });
    setNewPaymentMethod('');
    setPaymentError(null);
  };

  const handleDeletePaymentMethod = (methodToDelete: string) => {
    const existing = config.paymentMethods || [];
    const updated = existing.filter(m => m !== methodToDelete);
    onUpdateConfig({
      ...config,
      paymentMethods: updated
    });
  };

  // JSON Database Import/Export Backup
  const handleExportJSON = () => {
    const backupObj = {
      config,
      users,
      clients,
      products,
      invoices,
      shifts,
      expenses,
      adjustments,
      exportedAt: new Date().toISOString(),
      version: "4.1"
    };
    
    const content = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `respaldo_total_rosafuerte_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        if (!parsed || typeof parsed !== 'object') {
          throw new Error("El archivo no contiene un objeto válido.");
        }
        
        if (!parsed.config || !parsed.users || !parsed.clients || !parsed.products || !parsed.invoices) {
          throw new Error("Estructura de respaldo incompleta. Falta config, usuarios, clientes, productos o facturas.");
        }
        
        onImportDatabase(parsed);
        setBackupSuccess(true);
        setBackupError(null);
        setTimeout(() => setBackupSuccess(false), 5000);
      } catch (err: any) {
        setBackupError(err.message || "Error al procesar el archivo de respaldo.");
        setBackupSuccess(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // CSV Exporters
  const downloadCSV = (content: string, filename: string) => {
    // Inject BOM for perfect Excel UTF-8 display of Spanish accents
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export 1: Invoices to Excel
  const handleExportInvoices = () => {
    let csv = "ID Factura,Nro Comprobante,Cliente,RUT Cliente,Fecha Emision,Metodo Pago,Impuesto,Subtotal,Descuento,Total,Estado\n";
    invoices.forEach(inv => {
      csv += `"${inv.id}","${inv.invoiceNumber}","${inv.clientName}","${inv.clientRut}","${inv.createdAt}","${inv.paymentMethod}","${inv.taxAmount}","${inv.subtotal}","${inv.discount}","${inv.total}","${inv.paymentStatus}"\n`;
    });
    downloadCSV(csv, `historico_facturacion_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Export 2: Clients/Portfolio to Excel
  const handleExportClients = () => {
    let csv = "ID Cliente,Razon Social,RUT/NIT,Email,Telefono,Direccion,Limite Credito,Saldo Deuda Pendiente,Fecha Afiliacion\n";
    clients.forEach(c => {
      csv += `"${c.id}","${c.name}","${c.rut}","${c.email}","${c.phone}","${c.address}","${c.creditLimit}","${c.outstandingBalance}","${c.createdAt}"\n`;
    });
    downloadCSV(csv, `base_deudores_cartera_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Export 3: Products Catalog to Excel
  const handleExportProducts = () => {
    let csv = "ID Suministro,Codigo SKU,Descripcion,Categoria,Costo Compra,Precio Despacho,Existencias Stock,Minimo Reabastecer\n";
    products.forEach(p => {
      csv += `"${p.id}","${p.code}","${p.name}","${p.category}","${p.cost}","${p.price}","${p.stock}","${p.minStock}"\n`;
    });
    downloadCSV(csv, `inventario_almacen_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Export 4: Cash Sessions (Shifts) to Excel
  const handleExportShifts = () => {
    let csv = "ID Turno,Operador Cajero,Apertura,Cierre,Fondo Inicial,Ventas Efectivo,Ventas Tarjeta,Ventas Credito,Total Egresos,Caja Esperada,Efectivo Fisico,Diferencia,Estado\n";
    shifts.forEach(s => {
      csv += `"${s.id}","${s.user}","${s.startTime}","${s.endTime || 'ACTIVA'}","${s.initialCash}","${s.salesCash}","${s.salesCard}","${s.salesCredit}","${s.expensesTotal}","${s.expectedCash}","${s.actualCash || ''}","${s.discrepancy || ''}","${s.status}"\n`;
    });
    downloadCSV(csv, `reporte_turnos_caja_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6" id="configurations-module">
      
      {/* Module Title */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="text-cyber-pink" />
          CONFIGURACIONES AVANZADAS Y AUDITORÍA
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Configuración fiscal del búnker, jerarquía de cajeros autorizados y motores de exportación Excel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Business settings form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Config form */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3 mb-4">
              <Building size={14} className="text-cyber-pink" />
              IDENTIDAD FISCAL Y PARÁMETROS GENERALES
            </h2>

            <form onSubmit={handleConfigSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-gray-400 uppercase text-[9px]">Nombre Corporativo / Razón Social</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px]">NIT / RUT</label>
                <input 
                  type="text" 
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px]">Teléfono Administrativo</label>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-gray-400 uppercase text-[9px]">Dirección de Operaciones</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px]">Email de Auditoría</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px]">Impuesto Estándar (IVA %)</label>
                <input 
                  type="number" 
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink"
                  required
                />
              </div>

              <div className="space-y-1 p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <p className="font-bold text-gray-200">Recargo por Tarjeta</p>
                  <p className="text-[9px] text-gray-500">Cobro de comisión en compras Bold</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={cardFeeEnabled} 
                    onChange={e => setCardFeeEnabled(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-pink"></div>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase text-[9px]">Porcentaje Recargo por Tarjeta (%)</label>
                <input 
                  type="number" 
                  step="any"
                  value={cardFeePercentage}
                  disabled={!cardFeeEnabled}
                  onChange={e => setCardFeePercentage(parseFloat(e.target.value) || 0)}
                  className={`w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink ${
                    !cardFeeEnabled ? 'opacity-50 cursor-not-allowed border-slate-800' : ''
                  }`}
                  placeholder="e.g. 5"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-gray-400 uppercase text-[9px]">Prefijo Serie de Facturas</label>
                <input 
                  type="text" 
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white focus:outline-none glow-border-pink uppercase"
                  required
                />
              </div>

              <div className="sm:col-span-2 pt-2 flex items-center justify-between">
                {saveSuccess && (
                  <span className="text-cyber-green text-[11px] flex items-center gap-1">
                    <Check size={14} /> ¡Identidad fiscal actualizada exitosamente!
                  </span>
                )}
                
                <button
                  type="submit"
                  className="ml-auto bg-cyber-pink text-black hover:bg-cyber-accent px-5 py-2.5 rounded-lg font-bold font-mono text-xs cursor-pointer neon-shadow-pink"
                >
                  Guardar Parámetros
                </button>
              </div>
            </form>
          </div>

          {/* CONFIGURACIÓN DE ALERTAS DE SONIDO */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3 mb-4">
              <span className="text-cyber-orange">🔊</span>
              CONFIGURACIÓN DE CANAL DE AUDIO Y ALERTAS
            </h2>

            <form onSubmit={handleSoundSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-gray-200">Sonido de Sistema Habilitado</p>
                    <p className="text-[9px] text-gray-500">Activa o silencia el audio general</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={soundEnabled} 
                      onChange={e => setSoundEnabled(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-pink"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-gray-200">Alertas de Chat</p>
                    <p className="text-[9px] text-gray-500">Sonar al recibir mensajes de chat</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={chatSoundEnabled} 
                      onChange={e => setChatSoundEnabled(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-pink"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-gray-200">Alertas de Notificación</p>
                    <p className="text-[9px] text-gray-500">Sonar al emitirse advertencias/avisos</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifSoundEnabled} 
                      onChange={e => setNotifSoundEnabled(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-pink"></div>
                  </label>
                </div>

                <div className="space-y-1.5 p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <label className="text-gray-400 text-[10px] uppercase">Tono Predeterminado de Caja</label>
                  <div className="flex gap-2">
                    <select 
                      value={defaultTone} 
                      onChange={e => {
                        setDefaultTone(e.target.value);
                        playTone(e.target.value as any);
                      }}
                      className="flex-1 bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none"
                    >
                      {TONE_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => playTone(defaultTone as any)}
                      className="bg-cyber-pink/20 hover:bg-cyber-pink/40 border border-cyber-pink/30 text-cyber-pink px-3 py-1 rounded font-bold cursor-pointer transition-all"
                      title="Probar sonido"
                    >
                      🔊
                    </button>
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-between pt-2">
                {soundSaveSuccess && (
                  <span className="text-cyber-green text-[11px] flex items-center gap-1">
                    <Check size={14} /> ¡Configuración de audio guardada!
                  </span>
                )}
                <button
                  type="submit"
                  className="ml-auto bg-cyber-orange text-black hover:bg-orange-600 px-5 py-2.5 rounded-lg font-bold font-mono text-xs cursor-pointer"
                >
                  Guardar Audio
                </button>
              </div>
            </form>
          </div>

          {/* CATEGORÍAS DE PRODUCTOS Y MÉTODOS DE PAGO */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-6">
            <div className="border-b border-cyber-border pb-3">
              <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-cyber-pink" />
                MÉTODOS DE PAGO Y CATEGORÍAS
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
              
              {/* Product Categories Section */}
              <div className="space-y-3">
                <p className="text-[10px] text-cyber-pink font-bold uppercase tracking-wider flex justify-between">
                  <span>Categorías de Productos</span>
                  <span>({(config.productCategories || []).length})</span>
                </p>

                <form onSubmit={handleAddCategory} className="flex gap-1.5">
                  <input 
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                  />
                  <button 
                    type="submit"
                    className="bg-cyber-pink text-black hover:bg-cyber-accent p-2 rounded-lg font-bold font-mono text-xs flex items-center justify-center cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </form>
                {categoryError && <p className="text-red-400 text-[10px]">{categoryError}</p>}

                <div className="bg-slate-950 rounded-lg border border-slate-900 max-h-36 overflow-y-auto divide-y divide-slate-900">
                  {(config.productCategories || []).map(cat => (
                    <div key={cat} className="p-2 flex justify-between items-center text-[11px]">
                      <span className="text-gray-300 font-semibold">{cat}</span>
                      <button 
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="Eliminar categoría"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {(config.productCategories || []).length === 0 && (
                    <p className="p-3 text-center text-gray-500 text-[10px]">Sin categorías personalizadas.</p>
                  )}
                </div>
              </div>

              {/* Payment Methods Section */}
              <div className="space-y-3">
                <p className="text-[10px] text-cyber-orange font-bold uppercase tracking-wider flex justify-between">
                  <span>Métodos de Pago</span>
                  <span>({(config.paymentMethods || []).length})</span>
                </p>

                <form onSubmit={handleAddPaymentMethod} className="flex gap-1.5">
                  <input 
                    type="text"
                    value={newPaymentMethod}
                    onChange={e => setNewPaymentMethod(e.target.value)}
                    placeholder="Nuevo método..."
                    className="flex-1 bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                  />
                  <button 
                    type="submit"
                    className="bg-cyber-orange text-black hover:bg-orange-600 p-2 rounded-lg font-bold font-mono text-xs flex items-center justify-center cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </form>
                {paymentError && <p className="text-red-400 text-[10px]">{paymentError}</p>}

                <div className="bg-slate-950 rounded-lg border border-slate-900 max-h-36 overflow-y-auto divide-y divide-slate-900">
                  {(config.paymentMethods || []).map(m => (
                    <div key={m} className="p-2 flex justify-between items-center text-[11px]">
                      <span className="text-gray-300 font-semibold">{m}</span>
                      <button 
                        type="button"
                        onClick={() => handleDeletePaymentMethod(m)}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="Eliminar método de pago"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {(config.paymentMethods || []).length === 0 && (
                    <p className="p-3 text-center text-gray-500 text-[10px]">Sin métodos de pago.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* User management and roles */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3 mb-4">
              <Users size={14} className="text-cyber-pink" />
              SISTEMA DE OPERADORES Y CONTROL DE PERMISOS
            </h2>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Add / Edit User Form */}
              <form onSubmit={handleUserSubmit} className="xl:col-span-7 space-y-4 text-xs font-mono">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <p className="text-[10px] text-cyber-orange font-bold uppercase tracking-wider">
                    {selectedEditUser ? '🔧 Modificar Parámetros de Agente' : '➕ Habilitar Nuevo Agente'}
                  </p>
                  {selectedEditUser && (
                    <button
                      type="button"
                      onClick={handleCancelEditUser}
                      className="text-[9px] bg-red-950/40 hover:bg-red-900 border border-red-500/30 text-red-400 px-2 py-0.5 rounded transition-all"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 text-[10px]">Nombre de Usuario (Login)</label>
                    <input 
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. rosa_fuerte"
                      className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-400 text-[10px]">Nombre Completo y Firma</label>
                    <input 
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Agente Rosa Fuerte"
                      className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1 relative">
                    <label className="text-gray-400 text-[10px]">Contraseña / PIN de Acceso</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={selectedEditUser ? "Dejar vacío para no cambiar PIN..." : "Ingrese el PIN de acceso..."}
                        className="w-full bg-cyber-bg border border-cyber-border p-2 pr-9 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                        required={!selectedEditUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        title={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-400 text-[10px]">Rol Operativo Preestablecido</label>
                    <select 
                      value={role}
                      onChange={e => handleRoleChange(e.target.value as any)}
                      className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white focus:outline-none glow-border-pink text-xs"
                    >
                      <option value="Cajero">Cajero General</option>
                      <option value="Administrador">Administrador Fiscal</option>
                    </select>
                  </div>
                </div>

                {/* DETAILED PERMISSIONS MAP PANEL */}
                <div className="space-y-4 pt-3 border-t border-slate-900">
                  <div className="flex items-center gap-1.5 text-cyber-pink text-[10px] font-bold uppercase tracking-wider">
                    <Shield size={13} />
                    <span>Matriz de Autorizaciones y Permisos</span>
                  </div>

                  {/* Navigation Modules Row */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-400 uppercase font-mono tracking-wider block border-l-2 border-cyber-pink pl-1.5">
                      1. Acceso a Módulos y Pestañas
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {[
                        { key: 'dashboard', label: 'Dashboard', desc: 'Panel e Indicadores financieros' },
                        { key: 'facturacion', label: 'Facturación', desc: 'Punto de facturación / Ventas' },
                        { key: 'domicilios', label: 'Domicilios', desc: 'Despachos y Envíos' },
                        { key: 'clientes', label: 'Clientes', desc: 'Fichero general de clientes' },
                        { key: 'inventario', label: 'Inventario', desc: 'Existencias y Bodegas' },
                        { key: 'caja', label: 'Caja', desc: 'Aperturas y arqueos de turnos' },
                        { key: 'historial_cierres', label: 'Cierres', desc: 'Histórico de arqueos oficiales' },
                        { key: 'cartera', label: 'Cartera', desc: 'Libro de cuentas por cobrar' },
                        { key: 'gastos', label: 'Gastos', desc: 'Registro y control de egresos' },
                        { key: 'identificadortlf', label: 'Llamadas', desc: 'Visor simulador telefónico' },
                        { key: 'chatsoporte', label: 'Chat', desc: 'Portal cliente interactivo' },
                        { key: 'solicitudes_clientes', label: 'Solicitudes', desc: 'Reclamos y sugerencias' },
                        { key: 'historial_facturas', label: 'Hist. Facturas', desc: 'Ver y reimprimir facturas' },
                        { key: 'nomina', label: 'Nómina', desc: 'Cálculo de salarios y recibos' },
                        { key: 'configuraciones', label: 'Ajustes', desc: 'Parámetros fiscales y sistema' }
                      ].map(item => (
                        <label 
                          key={item.key} 
                          className="flex items-start gap-2 p-1.5 rounded bg-slate-900/40 hover:bg-slate-900 border border-slate-900/60 cursor-pointer transition-all select-none"
                        >
                          <input 
                            type="checkbox"
                            checked={!!permissions[item.key as keyof UserPermissions]}
                            onChange={e => setPermissions(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="mt-0.5 rounded border-cyber-border text-cyber-pink focus:ring-0 focus:ring-offset-0 bg-cyber-bg cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-gray-200">{item.label}</div>
                            <div className="text-[8px] text-gray-500 leading-none mt-0.5 truncate">{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actions & Critical Processes Row */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-400 uppercase font-mono tracking-wider block border-l-2 border-cyber-orange pl-1.5">
                      2. Procesos Operativos Especiales
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {[
                        { key: 'crear_factura', label: 'Firmar Facturas', desc: 'Efectuar ventas en POS' },
                        { key: 'editar_cliente', label: 'Editar Clientes', desc: 'Actualizar perfiles contacto' },
                        { key: 'eliminar_cliente', label: 'Eliminar Clientes', desc: 'Borrar permanentemente' },
                        { key: 'ajustar_stock', label: 'Ajustar Inventario', desc: 'Registrar mermas / sobrantes' },
                        { key: 'traspaso_inventario', label: 'Traspasar', desc: 'Habilitar envíos inter-sucursal' },
                        { key: 'abrir_cerrar_caja', label: 'Operar Caja', desc: 'Abrir/cerrar turnos oficiales' },
                        { key: 'registrar_gasto', label: 'Registrar Gastos', desc: 'Declarar egresos de caja' },
                        { key: 'abonar_cartera', label: 'Abonar Cartera', desc: 'Saldar deudas de cartera' },
                        { key: 'modificar_configuracion', label: 'Modificar Ajustes', desc: 'Guardar NIT, RUT o IVA' },
                        { key: 'gestionar_usuarios', label: 'Gestión Agentes', desc: 'Editar accesos y licencias' },
                        { key: 'autorizar_descuentos', label: 'Autorizar Descuentos', desc: 'Aprobar rebajas de facturas' }
                      ].map(item => (
                        <label 
                          key={item.key} 
                          className="flex items-start gap-2 p-1.5 rounded bg-slate-900/40 hover:bg-slate-900 border border-slate-900/60 cursor-pointer transition-all select-none"
                        >
                          <input 
                            type="checkbox"
                            checked={!!permissions[item.key as keyof UserPermissions]}
                            onChange={e => setPermissions(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="mt-0.5 rounded border-cyber-border text-cyber-orange focus:ring-0 focus:ring-offset-0 bg-cyber-bg cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-gray-200">{item.label}</div>
                            <div className="text-[8px] text-gray-500 leading-none mt-0.5 truncate">{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Granular Actions per Module */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-gray-400 uppercase font-mono tracking-wider block border-l-2 border-cyan-500 pl-1.5">
                      3. Acciones Detalladas por Módulo (Ver / Editar / Eliminar / Imprimir)
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-slate-900">
                      <table className="w-full text-[9px] font-mono">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-900">
                            <th className="text-left px-2 py-1.5 text-gray-500 uppercase">Módulo</th>
                            <th className="px-2 py-1.5 text-cyan-400 uppercase text-center">Ver</th>
                            <th className="px-2 py-1.5 text-cyber-orange uppercase text-center">Editar</th>
                            <th className="px-2 py-1.5 text-red-400 uppercase text-center">Eliminar</th>
                            <th className="px-2 py-1.5 text-cyber-green uppercase text-center">Imprimir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60">
                          {[
                            {
                              label: 'Facturación',
                              ver: 'facturacion',
                              editar: 'editar_facturas',
                              eliminar: 'eliminar_facturas',
                              imprimir: 'imprimir_facturas'
                            },
                            {
                              label: 'Clientes',
                              ver: 'clientes',
                              editar: 'editar_cliente',
                              eliminar: 'eliminar_cliente',
                              imprimir: 'imprimir_clientes'
                            },
                            {
                              label: 'Inventario',
                              ver: 'inventario',
                              editar: 'ajustar_stock',
                              eliminar: 'eliminar_inventario',
                              imprimir: 'imprimir_inventario'
                            },
                            {
                              label: 'Gastos',
                              ver: 'gastos',
                              editar: 'editar_gastos',
                              eliminar: 'eliminar_gastos',
                              imprimir: 'imprimir_gastos'
                            },
                            {
                              label: 'Cartera',
                              ver: 'cartera',
                              editar: 'abonar_cartera',
                              eliminar: null,
                              imprimir: 'imprimir_cartera'
                            },
                            {
                              label: 'Domicilios',
                              ver: 'domicilios',
                              editar: 'editar_domicilios',
                              eliminar: null,
                              imprimir: 'imprimir_domicilios'
                            },
                            {
                              label: 'Cierres / Caja',
                              ver: 'historial_cierres',
                              editar: null,
                              eliminar: null,
                              imprimir: 'imprimir_cierres'
                            }
                          ].map(row => (
                            <tr key={row.label} className="hover:bg-slate-900/30 transition-colors">
                              <td className="px-2 py-1.5 font-bold text-gray-300">{row.label}</td>
                              {(['ver', 'editar', 'eliminar', 'imprimir'] as const).map(action => {
                                const permKey = row[action] as string | null;
                                return (
                                  <td key={action} className="px-2 py-1.5 text-center">
                                    {permKey ? (
                                      <input
                                        type="checkbox"
                                        checked={!!permissions[permKey as keyof UserPermissions]}
                                        onChange={e => setPermissions(prev => ({ ...prev, [permKey]: e.target.checked }))}
                                        className="rounded border-cyber-border bg-cyber-bg focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                      />
                                    ) : (
                                      <span className="text-slate-800">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyber-orange text-black hover:bg-orange-600 font-bold py-2.5 rounded-lg font-mono text-xs cursor-pointer shadow-lg active:scale-95 transition-all text-center"
                >
                  {selectedEditUser ? '💾 Guardar Cambios de Autorización' : '🔑 Autorizar Agente en Sistema'}
                </button>
              </form>

              {/* Users list */}
              <div className="xl:col-span-5 space-y-3">
                <p className="text-[10px] text-cyber-pink font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
                  Agentes Habilitados ({users.length})
                </p>
                <div className="bg-slate-950 rounded-lg border border-slate-900 max-h-[580px] overflow-y-auto divide-y divide-slate-900">
                  {users.map(u => {
                    const isSelf = u.id === currentUser.id;
                    const uPerms = u.permissions || getDefaultPermissionsForRole(u.role);
                    const enabledCount = Object.values(uPerms).filter(Boolean).length;
                    
                    return (
                      <div key={u.id} className="p-3 hover:bg-slate-900/30 transition-colors flex justify-between items-start gap-3 text-[11px] font-mono">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white uppercase truncate">{u.fullName}</span>
                            {isSelf && (
                              <span className="bg-cyber-pink/20 text-cyber-pink text-[7px] border border-cyber-pink/30 px-1 rounded uppercase tracking-widest scale-90 shrink-0">
                                SESIÓN
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            @{u.username} • <span className={u.role === 'Administrador' ? 'text-cyber-pink font-semibold' : 'text-cyan-400 font-semibold'}>{u.role}</span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[8px]">
                            <span className="bg-slate-900 text-gray-400 px-1.5 py-0.5 rounded border border-slate-800">
                              PIN: <strong className="text-gray-200">{u.password || 'N/D'}</strong>
                            </span>
                            <span className="bg-slate-900 text-gray-400 px-1.5 py-0.5 rounded border border-slate-800">
                              Permisos: <strong className="text-cyber-orange">{enabledCount}/37</strong>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditUserClick(u)}
                            className="text-gray-400 hover:text-cyber-orange p-1.5 bg-slate-900/50 hover:bg-slate-900 rounded border border-slate-900 hover:border-cyber-orange/30 transition-all cursor-pointer"
                            title="Editar Agente y Permisos"
                          >
                            <Edit2 size={11} />
                          </button>
                          
                          {/* Prevents deleting themselves */}
                          {u.username !== currentUser.username ? (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(u.id)}
                              className="text-gray-500 hover:text-red-400 p-1.5 bg-slate-900/50 hover:bg-slate-900 rounded border border-slate-900 hover:border-red-500/30 transition-all cursor-pointer"
                              title="Revocar Licencia de Acceso"
                            >
                              <UserMinus size={11} />
                            </button>
                          ) : (
                            <div className="w-[27px]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT: Export Center & Emergency Reset (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Biometric Passkey Registration */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3">
              <Fingerprint size={15} className="text-cyber-pink" />
              LLAVE DE ACCESO BIOMÉTRICA (PASSKEY)
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal font-mono">
              Vincula el sensor de huellas dactilares o reconocimiento facial de este dispositivo (Windows Hello / FaceID / TouchID) para autenticarte instantáneamente en el búnker sin digitar tu PIN o contraseña.
            </p>

            {currentUser.passkeyCredential ? (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-cyber-blue/10 border border-cyber-blue/20 p-3 rounded-lg text-xs font-mono">
                <div>
                  <p className="text-[10px] text-cyber-blue font-bold">✓ SENSOR VINCULADO ACTIVAMENTE</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">ID: {currentUser.passkeyCredential.id?.substring(0, 15)}...</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveBiometric}
                  className="text-[9px] bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-400 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  Desvincular Llave
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegisterBiometric}
                className="w-full py-2.5 bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all neon-shadow-pink"
              >
                <Fingerprint size={14} />
                <span>Registrar Huella / Rostro en este Equipo</span>
              </button>
            )}
          </div>

          {/* JSON Manual Database Backup & Restore */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3">
              <Database size={15} className="text-cyber-pink" />
              RESPALDO GENERAL DE BASE DE DATOS (.JSON)
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal">
              Exporte todo el estado actual de la aplicación (configuraciones, usuarios, clientes, productos, facturas, arqueos de caja y egresos) como un único archivo JSON para realizar copias de seguridad manuales o migrar entre terminales.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={handleExportJSON}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download size={14} className="text-cyber-pink" />
                <span>Exportar DB</span>
              </button>

              <button
                type="button"
                onClick={handleImportJSONClick}
                className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Upload size={14} className="text-cyber-orange" />
                <span>Importar DB</span>
              </button>

              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".json"
                className="hidden"
              />
            </div>

            {backupSuccess && (
              <p className="text-cyber-green text-[10px] font-mono text-center bg-cyber-green/10 p-2 rounded-lg border border-cyber-green/20">
                ✔️ Base de datos importada y sincronizada correctamente. El sistema se ha actualizado.
              </p>
            )}

            {backupError && (
              <p className="text-red-400 text-[10px] font-mono text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                ❌ Error: {backupError}
              </p>
            )}
          </div>
          
          {/* Export tools */}
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-cyber-border pb-3">
              <FileSpreadsheet size={15} className="text-cyber-green" />
              CENTRAL DE EXPORTACIÓN EXCEL (.CSV)
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal">
              Extraiga la base de datos comercial instantáneamente en formato estructurado de CSV para abrir y auditar en Microsoft Excel o Google Sheets.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportInvoices}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-between px-3 cursor-pointer"
              >
                <span>Exportar Facturas de Venta</span>
                <Download size={14} className="text-cyber-green" />
              </button>

              <button
                type="button"
                onClick={handleExportClients}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-between px-3 cursor-pointer"
              >
                <span>Exportar Carteras / Deudores</span>
                <Download size={14} className="text-cyber-green" />
              </button>

              <button
                type="button"
                onClick={handleExportProducts}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-between px-3 cursor-pointer"
              >
                <span>Exportar Catálogo de Inventario</span>
                <Download size={14} className="text-cyber-green" />
              </button>

              <button
                type="button"
                onClick={handleExportShifts}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 text-xs font-mono rounded-lg flex items-center justify-between px-3 cursor-pointer"
              >
                <span>Exportar Actas de Caja</span>
                <Download size={14} className="text-cyber-green" />
              </button>
            </div>
          </div>

          {/* Emergency Reset */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-bold text-red-400 uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-red-500/20 pb-3">
              <ShieldAlert size={14} className="text-red-400" />
              MANTENIMIENTO DE DATOS
            </h2>
            <p className="text-[11px] text-gray-500 leading-normal">
              Acción crítica. Elimina los registros locales guardados en caché y carga los valores iniciales por defecto (baterías nucleares, rosas de neón, deudores de prueba).
            </p>

            <button
              onClick={() => {
                if(window.confirm("¿Confirma restablecer toda la base de datos de facturación local a los valores por defecto de la demo? Perderá los cambios no exportados.")){
                  onResetDatabase();
                }
              }}
              className="w-full py-2.5 bg-red-600/10 hover:bg-red-600 hover:text-white border border-red-600/30 text-red-400 font-bold font-mono text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <RefreshCw size={13} /> Reestablecer Registros Demo
            </button>
          </div>

        </div>

      </div>

      {/* SECCIÓN COMPLETA DE PROMOCIONES Y DESCUENTOS */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-6" id="promos-section">
        <div className="border-b border-cyber-border pb-3 flex justify-between items-center">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span className="text-cyber-pink">🏷️</span>
            GESTIÓN DE PROMOCIONES Y DESCUENTOS FIJOS / PROGRAMADOS
          </h2>
          <span className="text-[10px] bg-cyber-pink/15 text-cyber-pink px-2.5 py-0.5 rounded-full border border-cyber-pink/20 font-mono">
            {discounts.length} Promociones
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-xs font-mono">
          {/* Creator Form */}
          <form onSubmit={handleAddDiscountSubmit} className="xl:col-span-4 space-y-3.5 bg-slate-950/65 p-4 rounded-xl border border-slate-900">
            <h3 className="text-[10px] text-cyber-orange font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
              ➕ Crear Nueva Promoción / Descuento
            </h3>
            
            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Nombre de la Promoción</label>
              <input 
                type="text" 
                value={promoName} 
                onChange={e => setPromoName(e.target.value)} 
                placeholder="Ej: Descuento Fijo Rosa Fuerte"
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Tipo</label>
                <select 
                  value={promoType} 
                  onChange={e => setPromoType(e.target.value as any)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="fijo">Monto Fijo ($)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Valor</label>
                <input 
                  type="number" 
                  min={0.01} 
                  step={0.01} 
                  value={promoValue} 
                  onChange={e => setPromoValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none text-right font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Aplica En</label>
              <select 
                value={promoAppliesTo} 
                onChange={e => setPromoAppliesTo(e.target.value as any)}
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
              >
                <option value="todos">Caja y Domicilios (Todos)</option>
                <option value="facturacion">Solo Facturación de Caja</option>
                <option value="domicilios">Solo Entregas a Domicilio</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px] uppercase">Fecha Inicio (opcional)</label>
                <input 
                  type="date" 
                  value={promoStartDate} 
                  onChange={e => setPromoStartDate(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px] uppercase">Fecha Fin (opcional)</label>
                <input 
                  type="date" 
                  value={promoEndDate} 
                  onChange={e => setPromoEndDate(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px] uppercase">Hora Inicio (opcional)</label>
                <input 
                  type="time" 
                  value={promoStartTime} 
                  onChange={e => setPromoStartTime(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px] uppercase">Hora Fin (opcional)</label>
                <input 
                  type="time" 
                  value={promoEndTime} 
                  onChange={e => setPromoEndTime(e.target.value)}
                  className="w-full bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Active Days Checkboxes */}
            <div className="space-y-1.5">
              <label className="block text-gray-400 text-[9px] uppercase">Días Activos de la Semana</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 1, label: 'Lun' },
                  { value: 2, label: 'Mar' },
                  { value: 3, label: 'Mié' },
                  { value: 4, label: 'Jue' },
                  { value: 5, label: 'Vie' },
                  { value: 6, label: 'Sáb' },
                  { value: 0, label: 'Dom' }
                ].map(day => {
                  const isChecked = promoActiveDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handlePromoDayToggle(day.value)}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                        isChecked 
                          ? 'bg-cyber-pink text-black' 
                          : 'bg-slate-900 border border-slate-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1.5">
              <input 
                type="checkbox" 
                id="promo-active-chk"
                checked={promoActive} 
                onChange={e => setPromoActive(e.target.checked)}
                className="rounded border-cyber-border bg-cyber-bg text-cyber-pink"
              />
              <label htmlFor="promo-active-chk" className="text-gray-300 font-bold select-none cursor-pointer">Activar inmediatamente</label>
            </div>

            <button
              type="submit"
              className="w-full bg-cyber-pink hover:bg-cyber-accent text-black font-bold py-2.5 rounded-lg font-mono text-xs cursor-pointer text-center neon-shadow-pink"
            >
              Registrar Promoción
            </button>
          </form>

          {/* List of promotions */}
          <div className="xl:col-span-8 space-y-3">
            <h3 className="text-[10px] text-cyber-pink font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
              Listado de Promociones y Descuentos
            </h3>
            
            <div className="overflow-x-auto rounded-lg border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-gray-400 font-bold">
                    <th className="p-3">Nombre</th>
                    <th className="p-3 text-center">Descuento</th>
                    <th className="p-3">Módulo</th>
                    <th className="p-3">Vigencia Fechas</th>
                    <th className="p-3">Días Activos</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {discounts.map(d => (
                    <tr key={d.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="p-3 font-bold text-white">{d.name}</td>
                      <td className="p-3 text-center font-extrabold text-cyber-green">
                        {d.type === 'porcentaje' ? `${d.value}%` : `$${d.value.toFixed(2)}`}
                      </td>
                      <td className="p-3 capitalize text-gray-400 font-semibold">
                        {d.appliesTo === 'todos' ? 'Todos' : d.appliesTo === 'facturacion' ? 'POS Caja' : 'Domicilios'}
                      </td>
                      <td className="p-3 text-[10px] text-gray-500">
                        {d.startDate ? `Desde: ${d.startDate}` : 'Siempre'}
                        {d.endDate ? ` hasta: ${d.endDate}` : ''}
                        {d.startTime ? ` (${d.startTime} - ${d.endTime || '23:59'})` : ''}
                      </td>
                      <td className="p-3 text-[9px] text-gray-400 font-bold">
                        {d.activeDays.length === 7 ? 'Todos' : d.activeDays.map(dayNum => {
                          const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                          return labels[dayNum];
                        }).join(', ')}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleDiscountActive(d.id)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border transition-all ${
                            d.active
                              ? 'bg-green-950/60 border-green-500/30 text-green-400'
                              : 'bg-red-950/60 border-red-500/30 text-red-400'
                          }`}
                        >
                          {d.active ? 'ACTIVO' : 'INACTIVO'}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteDiscount(d.id)}
                          className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Eliminar Promoción"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {discounts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-550">
                        Sin promociones configuradas en la base de datos comercial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN COMPLETA DE RECORDATORIOS FLASH Y PUBLICIDAD */}
      <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-6" id="flash-section">
        <div className="border-b border-cyber-border pb-3 flex justify-between items-center">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
            <span className="text-cyber-pink">📢</span>
            CENTRAL DE PUBLICIDAD FLASH Y AVISOS OPERATIVOS
          </h2>
          <span className="text-[10px] bg-cyber-pink/15 text-cyber-pink px-2.5 py-0.5 rounded-full border border-cyber-pink/20 font-mono">
            {flashMessages.length} Anuncios
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 text-xs font-mono">
          {/* Form */}
          <form onSubmit={handleAddFlashSubmit} className="xl:col-span-4 space-y-3.5 bg-slate-950/65 p-4 rounded-xl border border-slate-900">
            <h3 className="text-[10px] text-cyber-orange font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
              ➕ Publicar Anuncio Flash / Campaña
            </h3>

            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Título del Aviso</label>
              <input 
                type="text" 
                value={flashTitle} 
                onChange={e => setFlashTitle(e.target.value)} 
                placeholder="Ej: Lanzamiento Sabor Neón"
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Contenido / Texto Informativo</label>
              <textarea 
                value={flashContent} 
                onChange={e => setFlashContent(e.target.value)} 
                placeholder="Redacte las instrucciones o la publicidad aquí..."
                rows={3}
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Destinatarios</label>
                <select 
                  value={flashTarget} 
                  onChange={e => setFlashTarget(e.target.value as any)}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                >
                  <option value="ambos">Ambos (Operadores y Clientes)</option>
                  <option value="operadores">Solo Operadores de Caja</option>
                  <option value="clientes">Solo Clientes del Portal</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] uppercase">Límite de Vistas</label>
                <input 
                  type="number" 
                  min={1} 
                  value={flashMaxViews} 
                  onChange={e => setFlashMaxViews(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Fecha Expiración (opcional)</label>
              <input 
                type="datetime-local" 
                value={flashExpiresAt} 
                onChange={e => setFlashExpiresAt(e.target.value)}
                className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
              />
            </div>

            {/* Base64 Upload File input */}
            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase">Adjuntar Archivo (Imagen, Video, Doc)</label>
              <input 
                type="file" 
                ref={flashFileInputRef}
                onChange={handleFlashFileChange}
                accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                className="w-full bg-cyber-bg border border-cyber-border p-1.5 rounded-lg text-white text-[11px] focus:outline-none"
              />
              {flashAttachmentName && (
                <div className="mt-1 flex items-center justify-between bg-slate-900 border border-slate-800 p-1.5 rounded text-[10px]">
                  <span className="truncate text-gray-300">📎 {flashAttachmentName}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setFlashAttachmentUrl('');
                      setFlashAttachmentType(undefined);
                      setFlashAttachmentName('');
                      if (flashFileInputRef.current) flashFileInputRef.current.value = '';
                    }} 
                    className="text-red-400 hover:text-red-300 font-bold px-1"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1.5">
              <input 
                type="checkbox" 
                id="flash-active-chk"
                checked={flashActive} 
                onChange={e => setFlashActive(e.target.checked)}
                className="rounded border-cyber-border bg-cyber-bg text-cyber-pink"
              />
              <label htmlFor="flash-active-chk" className="text-gray-300 font-bold select-none cursor-pointer">Activar inmediatamente</label>
            </div>

            <button
              type="submit"
              className="w-full bg-cyber-pink hover:bg-cyber-accent text-black font-bold py-2.5 rounded-lg font-mono text-xs cursor-pointer text-center neon-shadow-pink"
            >
              Publicar Anuncio Flash
            </button>
          </form>

          {/* List of flash messages */}
          <div className="xl:col-span-8 space-y-3">
            <h3 className="text-[10px] text-cyber-pink font-bold uppercase tracking-wider border-b border-slate-900 pb-2">
              Historial de Anuncios y Campañas Flash
            </h3>

            <div className="overflow-x-auto rounded-lg border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-gray-400 font-bold">
                    <th className="p-3">Título</th>
                    <th className="p-3">Destinatario</th>
                    <th className="p-3 text-center">Máx Vistas</th>
                    <th className="p-3">Adjunto</th>
                    <th className="p-3">Expira</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {flashMessages.map(f => (
                    <tr key={f.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="p-3 font-bold text-white max-w-xs truncate" title={f.content}>{f.title}</td>
                      <td className="p-3 text-cyan-400 capitalize font-bold">{f.target === 'ambos' ? 'Todos' : f.target}</td>
                      <td className="p-3 text-center font-bold">{f.maxViews} veces</td>
                      <td className="p-3 text-gray-300">
                        {f.attachmentUrl ? (
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[9px] font-bold text-cyber-pink">
                            {f.attachmentType === 'image' ? '🖼️ Imagen' : f.attachmentType === 'video' ? '🎥 Video' : '📎 Doc'}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-3 text-[10px] text-gray-500">
                        {f.expiresAt ? new Date(f.expiresAt).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFlashActive(f.id)}
                          className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border transition-all ${
                            f.active
                              ? 'bg-green-950/60 border-green-500/30 text-green-400'
                              : 'bg-red-950/60 border-red-500/30 text-red-400'
                          }`}
                        >
                          {f.active ? 'ACTIVO' : 'INACTIVO'}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteFlash(f.id)}
                          className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Eliminar Campaña"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {flashMessages.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-550">
                        No hay campañas publicitarias ni avisos flash registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
