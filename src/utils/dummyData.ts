import { Client, Product, Invoice, Expense, Shift, User, BusinessConfig, StockAdjustment } from '../types';

export const INITIAL_BUSINESS_CONFIG: BusinessConfig = {
  companyName: "Rosa Fuerte Pero NO Tan Fucsia",
  rut: "901.884.202-6",
  address: "Búnker Comercial #77, Zona de Mitigación 3",
  phone: "+57 (601) 999-4321",
  email: "operaciones@extremecourier.com",
  invoicePrefix: "EXT",
  taxRate: 19, // 19% IVA standard
  currency: "USD",
  paymentMethods: ["Efectivo", "Tarjeta", "Crédito"],
  productCategories: ["Contenedores", "Energía", "Químicos", "Dispositivos", "Protección", "Filtros", "Botánica", "Otros"]
};

export const INITIAL_USERS: User[] = [
  { 
    id: "u-1", 
    username: "admin", 
    fullName: "Comandante Alpha", 
    role: "Administrador", 
    status: "Activo", 
    password: "admin",
    permissions: {
      dashboard: true,
      facturacion: true,
      domicilios: true,
      clientes: true,
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
  },
  { 
    id: "u-2", 
    username: "cajero1", 
    fullName: "Agente Neon-Pink", 
    role: "Cajero", 
    status: "Activo", 
    password: "1234",
    permissions: {
      dashboard: true,
      facturacion: true,
      domicilios: true,
      clientes: true,
      inventario: true,
      caja: true,
      historial_cierres: true,
      cartera: false,
      gastos: true,
      identificadortlf: true,
      chatsoporte: true,
      configuraciones: false,
      solicitudes_clientes: true,
      historial_facturas: true,
      crear_factura: true,
      editar_cliente: true,
      eliminar_cliente: false,
      ajustar_stock: false,
      traspaso_inventario: true,
      abrir_cerrar_caja: true,
      registrar_gasto: true,
      abonar_cartera: false,
      modificar_configuracion: false,
      gestionar_usuarios: false,
      imprimir_facturas: true,
      editar_facturas: false,
      eliminar_facturas: false,
      imprimir_clientes: true,
      eliminar_inventario: false,
      imprimir_inventario: true,
      editar_gastos: false,
      eliminar_gastos: false,
      imprimir_gastos: true,
      imprimir_cartera: false,
      editar_domicilios: true,
      imprimir_domicilios: true,
      imprimir_cierres: false
    }
  },
  { 
    id: "u-3", 
    username: "cajero2", 
    fullName: "Mensajero Reactor", 
    role: "Cajero", 
    status: "Activo", 
    password: "1234",
    permissions: {
      dashboard: true,
      facturacion: true,
      domicilios: true,
      clientes: true,
      inventario: true,
      caja: true,
      historial_cierres: false,
      cartera: false,
      gastos: true,
      identificadortlf: true,
      chatsoporte: true,
      configuraciones: false,
      solicitudes_clientes: true,
      historial_facturas: true,
      crear_factura: true,
      editar_cliente: false,
      eliminar_cliente: false,
      ajustar_stock: false,
      traspaso_inventario: true,
      abrir_cerrar_caja: true,
      registrar_gasto: true,
      abonar_cartera: false,
      modificar_configuracion: false,
      gestionar_usuarios: false,
      imprimir_facturas: true,
      editar_facturas: false,
      eliminar_facturas: false,
      imprimir_clientes: false,
      eliminar_inventario: false,
      imprimir_inventario: false,
      editar_gastos: false,
      eliminar_gastos: false,
      imprimir_gastos: false,
      imprimir_cartera: false,
      editar_domicilios: true,
      imprimir_domicilios: false,
      imprimir_cierres: false
    }
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "p-1",
    code: "CT-RAD-01",
    name: "Cápsula de Transporte Radiactivo",
    category: "Contenedores",
    price: 250.00,
    cost: 110.00,
    stock: 14,
    minStock: 5,
    imageUrl: "☢️"
  },
  {
    id: "p-2",
    code: "BT-FIS-99",
    name: "Batería de Fisión Portátil",
    category: "Energía",
    price: 450.00,
    cost: 200.00,
    stock: 6,
    minStock: 3,
    imageUrl: "🔋"
  },
  {
    id: "p-3",
    code: "SR-BIO-A",
    name: "Suero Bio-Modulador Alpha",
    category: "Químicos",
    price: 120.00,
    cost: 55.00,
    stock: 22,
    minStock: 10,
    imageUrl: "🧪"
  },
  {
    id: "p-4",
    code: "TJ-ACC-EN",
    name: "Tarjeta de Acceso Encriptada",
    category: "Dispositivos",
    price: 80.00,
    cost: 30.00,
    stock: 4,
    minStock: 5, // Trigger low stock alert!
    imageUrl: "💾"
  },
  {
    id: "p-5",
    code: "GT-HAZ-08",
    name: "Guantes de Mitigación de Peligro",
    category: "Protección",
    price: 65.00,
    cost: 25.00,
    stock: 35,
    minStock: 8,
    imageUrl: "🧤"
  },
  {
    id: "p-6",
    code: "FL-MEC-BIO",
    name: "Filtro de Aire Bio-Mecánico",
    category: "Filtros",
    price: 95.00,
    cost: 40.00,
    stock: 2,
    minStock: 5, // Trigger low stock alert!
    imageUrl: "🎭"
  },
  {
    id: "p-7",
    code: "RS-NEON-07",
    name: "Rosa de Neón Sintética (Fuerte)",
    category: "Botánica",
    price: 15.00,
    cost: 4.50,
    stock: 150,
    minStock: 20,
    imageUrl: "🌹"
  },
  {
    id: "p-8",
    code: "EC-GRAF-AT",
    name: "Escudo Atómico de Grafeno",
    category: "Protección",
    price: 850.00,
    cost: 420.00,
    stock: 5,
    minStock: 2,
    imageUrl: "🛡️"
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: "c-ocasional",
    name: "Cliente Ocasional",
    rut: "222.222.222-2",
    email: "ocasional@extremecourier.com",
    phone: "+57 (300) 000-0000",
    address: "Venta Directa de Caja",
    creditLimit: 0,
    outstandingBalance: 0,
    createdAt: "2026-01-01T00:00:00-05:00"
  },
  {
    id: "c-1",
    name: "Corporación CyberDyne",
    rut: "901.442.111-4",
    email: "suministros@cyberdyne.corp",
    phone: "+57 (601) 334-1122",
    address: "Torre Principal de Innovación, Piso 42",
    creditLimit: 2500.00,
    outstandingBalance: 850.00, // Credited Graphene Shield
    createdAt: "2026-01-15T08:00:00-05:00"
  },
  {
    id: "c-2",
    name: "Sindicato de Mensajeros del Páramo",
    rut: "800.512.663-9",
    email: "enlaces@paramocourier.org",
    phone: "+57 (315) 888-2910",
    address: "Hangar de Tránsito, Autopista de Ceniza Km 12",
    creditLimit: 1000.00,
    outstandingBalance: 0.00,
    createdAt: "2026-02-10T10:30:00-05:00"
  },
  {
    id: "c-3",
    name: "Laboratorios Weyland-Yutani",
    rut: "902.120.887-1",
    email: "procurement@weyland.bio",
    phone: "+57 (602) 445-5678",
    address: "Domo de Investigación Médica #3",
    creditLimit: 5000.00,
    outstandingBalance: 450.00, // Credit for fission battery
    createdAt: "2026-03-01T14:15:00-05:00"
  },
  {
    id: "c-4",
    name: "Elena Vance (Investigadora)",
    rut: "1.020.450.992-0",
    email: "elena.vance@resistencia.net",
    phone: "+57 (320) 412-9988",
    address: "Subnivel 4, Laboratorios Black Mesa",
    creditLimit: 500.00,
    outstandingBalance: 120.00, // Pending Bio-modulator serum
    createdAt: "2026-04-18T11:00:00-05:00"
  },
  {
    id: "c-5",
    name: "Nakamura Trading Ltd",
    rut: "700.334.881-2",
    email: "contact@nakamuratrading.jp",
    phone: "+57 (601) 777-8899",
    address: "Distrito Financiero de Neón, Of. 909",
    creditLimit: 3000.00,
    outstandingBalance: 0.00,
    createdAt: "2026-05-22T09:45:00-05:00"
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "EXT-0001",
    clientId: "c-1",
    clientName: "Corporación CyberDyne",
    clientRut: "901.442.111-4",
    items: [
      {
        productId: "p-8",
        productName: "Escudo Atómico de Grafeno",
        price: 850.00,
        quantity: 1,
        taxAmount: 161.50,
        total: 1011.50
      }
    ],
    subtotal: 850.00,
    discount: 0.00,
    taxRate: 19,
    taxAmount: 161.50,
    total: 1011.50,
    paymentMethod: "Crédito",
    paymentStatus: "Pendiente",
    dueDate: "2026-07-15",
    createdAt: "2026-07-01T09:30:00-05:00",
    cashierName: "Comandante Alpha"
  },
  {
    id: "inv-2",
    invoiceNumber: "EXT-0002",
    clientId: "c-3",
    clientName: "Laboratorios Weyland-Yutani",
    clientRut: "902.120.887-1",
    items: [
      {
        productId: "p-2",
        productName: "Batería de Fisión Portátil",
        price: 450.00,
        quantity: 1,
        taxAmount: 85.50,
        total: 535.50
      }
    ],
    subtotal: 450.00,
    discount: 0.00,
    taxRate: 19,
    taxAmount: 85.50,
    total: 535.50,
    paymentMethod: "Crédito",
    paymentStatus: "Vencido", // Overdue!
    dueDate: "2026-06-25",
    createdAt: "2026-06-10T11:20:00-05:00",
    cashierName: "Agente Neon-Pink"
  },
  {
    id: "inv-3",
    invoiceNumber: "EXT-0003",
    clientId: "c-2",
    clientName: "Sindicato de Mensajeros del Páramo",
    clientRut: "800.512.663-9",
    items: [
      {
        productId: "p-5",
        productName: "Guantes de Mitigación de Peligro",
        price: 65.00,
        quantity: 2,
        taxAmount: 24.70,
        total: 154.70
      },
      {
        productId: "p-7",
        productName: "Rosa de Neón Sintética (Fuerte)",
        price: 15.00,
        quantity: 10,
        taxAmount: 28.50,
        total: 178.50
      }
    ],
    subtotal: 280.00,
    discount: 10.00,
    taxRate: 19,
    taxAmount: 51.30,
    total: 321.30,
    paymentMethod: "Efectivo",
    paymentStatus: "Pagado",
    dueDate: "2026-07-02",
    createdAt: "2026-07-02T16:45:00-05:00",
    cashierName: "Agente Neon-Pink"
  },
  {
    id: "inv-4",
    invoiceNumber: "EXT-0004",
    clientId: "c-4",
    clientName: "Elena Vance (Investigadora)",
    clientRut: "1.020.450.992-0",
    items: [
      {
        productId: "p-3",
        productName: "Suero Bio-Modulador Alpha",
        price: 120.00,
        quantity: 1,
        taxAmount: 22.80,
        total: 142.80
      }
    ],
    subtotal: 120.00,
    discount: 0.00,
    taxRate: 19,
    taxAmount: 22.80,
    total: 142.80,
    paymentMethod: "Crédito",
    paymentStatus: "Pendiente",
    dueDate: "2026-07-10",
    createdAt: "2026-07-03T10:15:00-05:00",
    cashierName: "Mensajero Reactor"
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: "exp-1",
    category: "Combustible",
    amount: 80.00,
    description: "Recarga de celdas de plasma para moto repartidora #4",
    paymentMethod: "Efectivo",
    createdAt: "2026-07-03T09:00:00-05:00",
    cashierName: "Comandante Alpha"
  },
  {
    id: "exp-2",
    category: "Mantenimiento",
    amount: 45.00,
    description: "Sustitución de válvula de escape de radiación del búnker",
    paymentMethod: "Efectivo",
    createdAt: "2026-07-03T11:30:00-05:00",
    cashierName: "Agente Neon-Pink"
  }
];

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: "shift-old-1",
    user: "Agente Neon-Pink",
    startTime: "2026-07-02T08:00:00-05:00",
    endTime: "2026-07-02T18:00:00-05:00",
    initialCash: 150.00,
    salesCash: 321.30,
    salesCard: 0.00,
    salesCredit: 0.00,
    expensesTotal: 0.00,
    expectedCash: 471.30,
    actualCash: 471.30,
    discrepancy: 0.00,
    status: "Cerrada",
    notes: "Jornada del día de ayer cerrada sin novedades. Cuadre perfecto."
  },
  {
    id: "shift-current",
    user: "Agente Neon-Pink",
    startTime: "2026-07-03T07:30:00-05:00",
    initialCash: 200.00,
    salesCash: 0.00,
    salesCard: 0.00,
    salesCredit: 142.80, // Invoice #4 is credit
    expensesTotal: 125.00, // exp-1 and exp-2
    expectedCash: 75.00, // 200 initial - 125 expenses = 75 expected cash (since invoice 4 was credit)
    status: "Abierta"
  }
];

export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [
  {
    id: "adj-1",
    productId: "p-7",
    productName: "Rosa de Neón Sintética (Fuerte)",
    type: "Ingreso",
    quantity: 150,
    reason: "Carga biotecnológica directa del reactor principal",
    createdAt: "2026-07-01T08:00:00-05:00",
    user: "Comandante Alpha"
  }
];

export const INITIAL_PHONE_RECORDS = [
  {
    phoneNumber: "+57 (601) 777-8899",
    ownerName: "Nakamura Trading Ltd",
    rutOrId: "700.334.881-2",
    address: "Distrito Financiero de Neón, Of. 909",
    reputation: "Confiable",
    carrier: "NeonNet Telecom",
    location: "Distrito Central de Finanzas",
    tags: ["Cliente VIP", "Importador Oficial", "Tecnología de Punta"],
    notes: "Nivel de crédito excelente. Historial logístico limpio en todos los envíos de chips cuánticos.",
    searchCount: 14,
    isRegisteredClient: true,
    associatedClientId: "c-5"
  },
  {
    phoneNumber: "+57 (601) 334-1122",
    ownerName: "Corporación CyberDyne (División Militar)",
    rutOrId: "901.442.111-4",
    address: "Torre Principal de Innovación, Piso 42",
    reputation: "Confiable",
    carrier: "SkyNet Networks",
    location: "Complejo de Silicio Altavista",
    tags: ["Cliente Corporativo", "Suministros Estratégicos", "Alta Densidad"],
    notes: "Fabricante de hardware robótico. Exigen entregas blindadas bajo protocolo de escolta clase-2.",
    searchCount: 29,
    isRegisteredClient: true,
    associatedClientId: "c-1"
  },
  {
    phoneNumber: "+57 (320) 412-9988",
    ownerName: "Elena Vance",
    rutOrId: "1.020.450.992-0",
    address: "Subnivel 4, Laboratorios Black Mesa",
    reputation: "Confiable",
    carrier: "RebelLink Sat",
    location: "Sectores de Resistencia Subterránea",
    tags: ["Investigación", "Científico", "Soporte Logístico"],
    notes: "Miembro verificado de la red científica. Realiza pedidos de reactores de plasma e inhibidores electromagnéticos.",
    searchCount: 5,
    isRegisteredClient: true,
    associatedClientId: "c-4"
  },
  {
    phoneNumber: "+57 (300) 666-1337",
    ownerName: "Cyborg Mercenario (Clave: 'Apex-9')",
    rutOrId: "DESCONOCIDO-99-ALPHA",
    address: "Hangar de Alquiler 7A, Sector de Deshechos Nucleares #9",
    reputation: "Sospechoso",
    carrier: "ShadowLink Satellite Direct",
    location: "Perímetro Exterior de Chatarra",
    tags: ["Mercenario", "Historial de Impagos", "Sujeto Peligroso"],
    notes: "Sujeto bajo vigilancia de agentes del búnker. Reportado por intentar pagar un pedido con criptas de datos obsoletas.",
    searchCount: 88,
    isRegisteredClient: false
  },
  {
    phoneNumber: "+57 (311) 999-0000",
    ownerName: "Falsa Distribuidora de Baterías de Fisión S.A.S.",
    rutOrId: "NIT 666.111.999-0",
    address: "Estación Satelital de Señal Fantasma",
    reputation: "Fraude Reportado",
    carrier: "ProxNet Anon",
    location: "Órbita Baja de Comunicación Satelital",
    tags: ["Fraude", "Suplantación", "Cuentas Clonadas", "Spam Logístico"],
    notes: "¡ALERTA DE SEGURIDAD! Intentan clonar facturas de Rosa Fuerte con logos falsos. No autorizar despachos ni crédito.",
    searchCount: 201,
    isRegisteredClient: false
  },
  {
    phoneNumber: "+57 (315) 888-2910",
    ownerName: "Sindicato de Mensajeros del Páramo",
    rutOrId: "800.512.663-9",
    address: "Hangar de Tránsito, Autopista de Ceniza Km 12",
    reputation: "Confiable",
    carrier: "Wasteland Wireless",
    location: "Frontera del Páramo Seco",
    tags: ["Gremio Logístico", "Mensajeros Oficiales", "Soporte de Ruta"],
    notes: "Operadores aliados de ruta extrema. Autorizados para retiros en caja de insumos para motocicletas.",
    searchCount: 19,
    isRegisteredClient: true,
    associatedClientId: "c-2"
  }
];

