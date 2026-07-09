export interface Client {
  id: string;
  name: string;
  documentType?: 'CC' | 'NIT' | 'CE' | 'PPT' | 'PEP' | 'TI' | 'RC' | 'Pasaporte';
  rut: string; // NIT/RUT / Número de documento
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  outstandingBalance: number;
  createdAt: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  password?: string;
  chatSoundTone?: string;
  notifSoundTone?: string;
  code?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number; // Sale price (per unit, gram, ml, or liter)
  cost: number;  // Acquisition cost (for audit/utility)
  stock: number; // Warehouse stock (Bodega Principal)
  minStock: number; // Alert threshold
  imageUrl?: string;
  unitType?: 'unidad' | 'gr' | 'ml' | 'l'; // Unit type
  specialPrice1g?: number; // Special price for exactly 1 Gr
  specialPriceHalfG?: number; // Special price for exactly 0.5 Gr (1/2 Gr)
  specialPriceQuarterG?: number; // Special price for exactly 0.25 Gr (1/4 Gr)
  userStocks?: { [userId: string]: number }; // Stock of each user
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  taxAmount: number;
  total: number;
  unitType?: 'unidad' | 'gr' | 'ml' | 'l';
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. EXP-001
  clientId: string;
  clientName: string;
  clientRut: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxRate: number; // e.g. 19 for 19%
  taxAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'Pagado' | 'Pendiente' | 'Vencido' | 'Anulada';
  dueDate: string;
  createdAt: string;
  cashierName: string; // Cashier who issued it
  isDelivery?: boolean;
  deliveryFee?: number;
  deliveryRider?: string;
  deliveryTransport?: string;
  deliveryStatus?: 'Pendiente' | 'En Camino' | 'Entregado' | 'Cancelado';
  clientSignature?: string; // Base64 dataURL of signature
  deliveryMethod?: 'oficina' | 'cliente' | 'recoge';
  guideName?: string;
  guideRut?: string;
  guidePhone?: string;
  guideAddress?: string;
  guideNotes?: string;
  cardFee?: number;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
  createdAt: string;
  cashierName: string;
}

export interface Shift {
  id: string;
  user: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  salesCash: number;
  salesCard: number;
  salesCredit: number;
  expensesTotal: number;
  expectedCash: number;
  actualCash?: number; // Counted by hand
  discrepancy?: number; // difference
  status: 'Abierta' | 'Cerrada';
  notes?: string;
}

export interface ClientRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientRut: string;
  type: 'Sugerencia' | 'Reclamo' | 'Consulta' | 'Solicitud';
  subject: string;
  description: string;
  status: 'Pendiente' | 'En Revisión' | 'Resuelto' | 'Cerrado';
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  createdAt: string;
  resolvedAt?: string;
  agentNotes?: string;
  agentId?: string;
}

export interface Discount {
  id: string;
  name: string;
  type: 'porcentaje' | 'fijo';
  value: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  activeDays: number[];
  appliesTo: 'todos' | 'facturacion' | 'domicilios';
  createdAt: string;
}

export interface FlashMessage {
  id: string;
  title: string;
  content: string;
  target: 'operadores' | 'clientes' | 'ambos';
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file';
  attachmentName?: string;
  maxViews: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface SoundSettings {
  soundEnabled: boolean;
  chatSoundEnabled: boolean;
  notifSoundEnabled: boolean;
  defaultTone: string;
}

export interface PayrollEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  period: string;
  baseSalary: number;
  overtimeHours: number;
  overtimeRate: number;
  bonuses: { concept: string; amount: number }[];
  deductions: { concept: string; amount: number }[];
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface UserPermissions {
  // Módulos (Acceso a Pestañas)
  dashboard: boolean;
  facturacion: boolean;
  compras_web?: boolean;
  domicilios: boolean;
  clientes: boolean;
  inventario: boolean;
  caja: boolean;
  historial_cierres: boolean;
  cartera: boolean;
  gastos: boolean;
  identificadortlf: boolean;
  chatsoporte: boolean;
  configuraciones: boolean;
  solicitudes_clientes: boolean;
  historial_facturas: boolean;
  nomina: boolean;

  // Procesos y Operaciones Críticas
  crear_factura: boolean;
  editar_cliente: boolean;
  eliminar_cliente: boolean;
  ajustar_stock: boolean;
  traspaso_inventario: boolean;
  abrir_cerrar_caja: boolean;
  registrar_gasto: boolean;
  abonar_cartera: boolean;
  modificar_configuracion: boolean;
  gestionar_usuarios: boolean;
  autorizar_descuentos?: boolean;

  // Acciones Detalladas por Módulo
  imprimir_facturas: boolean;
  editar_facturas: boolean;
  eliminar_facturas: boolean;
  imprimir_clientes: boolean;
  eliminar_inventario: boolean;
  imprimir_inventario: boolean;
  editar_gastos: boolean;
  eliminar_gastos: boolean;
  imprimir_gastos: boolean;
  imprimir_cartera: boolean;
  editar_domicilios: boolean;
  imprimir_domicilios: boolean;
  imprimir_cierres: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'Administrador' | 'Cajero';
  status: 'Activo' | 'Inactivo';
  password?: string;
  permissions?: UserPermissions;
}

export interface BusinessConfig {
  companyName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  taxRate: number; // Standard tax (e.g., 19% IVA)
  currency: string; // e.g. COP, USD, etc.
  paymentMethods?: string[];
  productCategories?: string[];
  cardFeePercentage?: number;
  cardFeeEnabled?: boolean;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'Ingreso' | 'Egreso' | 'Inventario Inicial' | 'Ajuste';
  quantity: number;
  reason: string;
  createdAt: string;
  user: string;
}

export interface ChatAttachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'voice';
  url: string; // Base64 or local URL
  name: string;
  size?: string;
}

export interface ChatMessage {
  id: string;
  clientId: string; // Associated client ID
  sender: 'client' | 'agent';
  senderName: string;
  text: string;
  timestamp: string; // ISO String
  attachment?: ChatAttachment;
  agentId?: string;
}

export interface PhoneRecord {
  phoneNumber: string;
  ownerName: string;
  rutOrId: string;
  address: string;
  reputation: 'Confiable' | 'Sospechoso' | 'Fraude Reportado' | 'Nuevo / No Verificado';
  carrier: string;
  location: string;
  tags: string[];
  notes: string;
  searchCount: number;
  isRegisteredClient: boolean;
  associatedClientId?: string;
}

export interface StockTransfer {
  id: string;
  origin: 'bodega' | string; // 'bodega' or userId
  destination: 'bodega' | string; // 'bodega' or userId
  originName: string; // "Bodega Principal" or User FullName
  destinationName: string; // "Bodega Principal" or User FullName
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitType?: 'unidad' | 'gr' | 'ml' | 'l';
  }[];
  status: 'pendiente' | 'aprobado' | 'rechazado';
  createdAt: string;
  resolvedAt?: string;
  supportNotes?: string; // Soportes / Notas de soporte
}


