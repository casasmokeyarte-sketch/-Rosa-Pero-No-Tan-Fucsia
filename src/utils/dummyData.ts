import {
  Client,
  Product,
  Invoice,
  Expense,
  Shift,
  User,
  BusinessConfig,
  StockAdjustment
} from '../types';

export const INITIAL_BUSINESS_CONFIG: BusinessConfig = {
  companyName: 'Mi Empresa',
  commercialName: 'Mi Empresa',
  slogan: '',
  city: '',
  website: '',
  logoUrl: '',
  setupComplete: false,
  rut: '',
  address: '',
  phone: '',
  email: '',
  invoicePrefix: 'FAC',
  taxRate: 0,
  currency: 'COP',
  paymentMethods: ['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'],
  productCategories: ['General'],
  cardFeePercentage: 0,
  cardFeeEnabled: false
};

// Temporary bootstrap access. The setup wizard will require the new company
// to replace these credentials before the installation can be used.
export const INITIAL_USERS: User[] = [
  {
    id: 'bootstrap-admin',
    username: 'admin',
    fullName: 'Administrador inicial',
    role: 'Administrador',
    status: 'Activo',
    password: 'configurar',
    permissions: {
      dashboard: true,
      facturacion: true,
      compras_web: true,
      domicilios: true,
      clientes: true,
      wallet: true,
      inventario: true,
      caja: true,
      historial_cierres: true,
      cartera: true,
      gastos: true,
      identificadortlf: true,
      chatsoporte: true,
      configuraciones: true,
      solicitudes_clientes: true,
      historial_facturas: true,
      nomina: true,
      creditos: true,
      crear_factura: true,
      editar_cliente: true,
      eliminar_cliente: true,
      ajustar_stock: true,
      traspaso_inventario: true,
      abrir_cerrar_caja: true,
      registrar_gasto: true,
      abonar_cartera: true,
      modificar_configuracion: true,
      gestionar_usuarios: true,
      autorizar_descuentos: true,
      imprimir_facturas: true,
      editar_facturas: true,
      eliminar_facturas: true,
      imprimir_clientes: true,
      eliminar_inventario: true,
      imprimir_inventario: true,
      editar_gastos: true,
      eliminar_gastos: true,
      imprimir_gastos: true,
      imprimir_cartera: true,
      editar_domicilios: true,
      imprimir_domicilios: true,
      imprimir_cierres: true
    }
  }
];

export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_SHIFTS: Shift[] = [];
export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [];
export const INITIAL_PHONE_RECORDS = [];
