import React, { useState, useEffect } from 'react';
import { Client, Product, Invoice, InvoiceItem, Shift, BusinessConfig, Discount } from '../types';
import CyberEmpty from './CyberEmpty';
import { 
  ShoppingCart, 
  UserPlus, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Download, 
  RefreshCw,
  Clock,
  ShieldAlert,
  Users,
  Truck
} from 'lucide-react';

interface FacturacionProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  shifts: Shift[];
  config: BusinessConfig;
  currentUser: any;
  onAddInvoice: (invoice: Invoice) => void;
  onAddClient: (client: Client) => void;
  discounts: Discount[];
}

export default function Facturacion({
  clients,
  products,
  invoices,
  shifts,
  config,
  currentUser,
  onAddInvoice,
  onAddClient,
  discounts = []
}: FacturacionProps) {
  // Check if there is an active shift
  const activeShift = shifts.find(s => s.status === 'Abierta');

  // Search client state
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Search product state
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Cart items state
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>(() => config.paymentMethods?.[0] || 'Efectivo');
  const [dueDate, setDueDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15); // default 15 days credit term
    return date.toISOString().split('T')[0];
  });

  // Modals / Flow states
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientRut, setQuickClientRut] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [quickClientCredit, setQuickClientCredit] = useState(1000);

  // Generated Invoice state (for receipt modal)
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [activeTicketTab, setActiveTicketTab] = useState<'invoice' | 'guide'>('invoice');

  // Form errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter valid promotions based on current date, time, day, and billing context
  const getActivePromotions = () => {
    const now = new Date();
    const day = now.getDay();
    // Time formatted as HH:MM
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetModule = isDelivery ? 'domicilios' : 'facturacion';

    return discounts.filter(d => {
      if (!d.active) return false;
      if (d.appliesTo !== 'todos' && d.appliesTo !== targetModule) return false;
      
      if (d.startDate) {
        const start = new Date(d.startDate);
        if (now < start) return false;
      }
      if (d.endDate) {
        const end = new Date(d.endDate + 'T23:59:59');
        if (now > end) return false;
      }

      if (d.startTime && timeStr < d.startTime) return false;
      if (d.endTime && timeStr > d.endTime) return false;

      if (d.activeDays && d.activeDays.length > 0 && !d.activeDays.includes(day)) return false;

      return true;
    });
  };

  const activePromos = getActivePromotions();

  const handleSelectPromo = (promoId: string) => {
    if (!promoId) {
      setDiscount(0);
      return;
    }
    const promo = activePromos.find(p => p.id === promoId);
    if (!promo) return;

    if (promo.type === 'porcentaje') {
      const calculated = parseFloat((subtotal * (promo.value / 100)).toFixed(2));
      setDiscount(calculated);
    } else {
      setDiscount(Math.min(subtotal, promo.value));
    }
  };

  // Delivery / Domicilios states
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryRider, setDeliveryRider] = useState('');
  const [deliveryTransport, setDeliveryTransport] = useState('Motocicleta');
  const [deliveryMethod, setDeliveryMethod] = useState<'oficina' | 'cliente' | 'recoge'>('oficina');

  // Shipping Guide Editable fields
  const [guideName, setGuideName] = useState('');
  const [guideRut, setGuideRut] = useState('');
  const [guidePhone, setGuidePhone] = useState('');
  const [guideAddress, setGuideAddress] = useState('');
  const [guideNotes, setGuideNotes] = useState('Suministros logísticos Rosa Fuerte');

  // Prefill guide fields when client is selected
  useEffect(() => {
    if (selectedClient) {
      setGuideName(selectedClient.name);
      setGuideRut(selectedClient.rut);
      setGuidePhone(selectedClient.phone);
      setGuideAddress(selectedClient.address);
    } else {
      setGuideName('');
      setGuideRut('');
      setGuidePhone('');
      setGuideAddress('');
    }
  }, [selectedClient]);

  // Adjust delivery info automatically based on method choice
  useEffect(() => {
    if (isDelivery) {
      if (deliveryMethod === 'cliente') {
        setDeliveryFee(0);
        setDeliveryRider('Coordinado por Cliente');
      } else if (deliveryMethod === 'recoge') {
        setDeliveryFee(0);
        setDeliveryRider('Recoge Cliente');
      } else {
        setDeliveryFee(5.00); // Default local office fee
        setDeliveryRider('');
      }
    }
  }, [deliveryMethod, isDelivery]);

  // Client Digital Signature states & handlers
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize canvas or clear it when isDelivery state changes
  useEffect(() => {
    if (isDelivery) {
      clearSignature();
    } else {
      setSignatureDataUrl('');
    }
  }, [isDelivery]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#38bdf8'; // Neon cyan color
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        setSignatureDataUrl(canvas.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureDataUrl('');
      }
    }
  };

  // Filter clients based on search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.rut.includes(clientSearch)
  );

  // Filter products based on search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Helper to get stock of the current logged-in user
  const getUserProductStock = (product: Product): number => {
    if (!product.userStocks) return 0;
    return product.userStocks[currentUser.id] !== undefined ? product.userStocks[currentUser.id] : 0;
  };

  // Helper to calculate total based on unitType and special prices
  const calculateItemTotal = (product: Product, qty: number): { price: number; total: number } => {
    if (product.unitType === 'gr') {
      // Check special prices for exact weights
      if (qty === 1 && product.specialPrice1g !== undefined && product.specialPrice1g > 0) {
        return { price: product.specialPrice1g, total: product.specialPrice1g };
      }
      if (qty === 0.5 && product.specialPriceHalfG !== undefined && product.specialPriceHalfG > 0) {
        return { price: product.specialPriceHalfG / 0.5, total: product.specialPriceHalfG };
      }
      if (qty === 0.25 && product.specialPriceQuarterG !== undefined && product.specialPriceQuarterG > 0) {
        return { price: product.specialPriceQuarterG / 0.25, total: product.specialPriceQuarterG };
      }
      // Otherwise standard calculated price
      const total = parseFloat((qty * product.price).toFixed(2));
      return { price: product.price, total };
    } else {
      // For other units (ml, l, unidad), total is qty * price
      const total = parseFloat((qty * product.price).toFixed(2));
      return { price: product.price, total };
    }
  };

  // Handle adding product to cart
  const handleAddProduct = (product: Product) => {
    const availableStock = getUserProductStock(product);
    if (availableStock <= 0) {
      setErrorMsg(`¡El producto "${product.name}" no tiene existencias disponibles en tu inventario personal!`);
      return;
    }

    const existingIndex = cartItems.findIndex(item => item.productId === product.id);
    
    if (existingIndex > -1) {
      const currentQty = cartItems[existingIndex].quantity;
      const newQty = currentQty + 1;
      if (newQty > availableStock) {
        setErrorMsg(`Alcanzaste el stock límite (${availableStock}) para "${product.name}" en tu inventario.`);
        return;
      }
      
      const newItems = [...cartItems];
      const itemTotalDetails = calculateItemTotal(product, newQty);
      
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newQty,
        price: itemTotalDetails.price,
        taxAmount: 0,
        total: itemTotalDetails.total
      };
      setCartItems(newItems);
    } else {
      const initialQty = 1;
      const itemTotalDetails = calculateItemTotal(product, initialQty);
      const newItem: InvoiceItem = {
        productId: product.id,
        productName: product.name,
        price: itemTotalDetails.price,
        quantity: initialQty,
        taxAmount: 0,
        total: itemTotalDetails.total,
        unitType: product.unitType || 'unidad'
      };
      setCartItems([...cartItems, newItem]);
    }
    setErrorMsg(null);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  // Adjust item quantity
  const handleAdjustQty = (productId: string, amount: number) => {
    const itemIndex = cartItems.findIndex(item => item.productId === productId);
    if (itemIndex === -1) return;

    const item = cartItems[itemIndex];
    const product = products.find(p => p.id === productId)!;
    const availableStock = getUserProductStock(product);
    const newQty = item.quantity + amount;

    if (newQty <= 0) {
      setCartItems(cartItems.filter(i => i.productId !== productId));
      return;
    }

    if (newQty > availableStock) {
      setErrorMsg(`No hay suficiente stock en tu inventario. Límite: ${availableStock} unidades.`);
      return;
    }

    const newItems = [...cartItems];
    const itemTotalDetails = calculateItemTotal(product, newQty);
    
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      quantity: newQty,
      price: itemTotalDetails.price,
      taxAmount: 0,
      total: itemTotalDetails.total
    };
    setCartItems(newItems);
    setErrorMsg(null);
  };

  // Direct set of quantity (for custom weight/volume typed inputs)
  const handleSetItemQty = (productId: string, value: number) => {
    const itemIndex = cartItems.findIndex(item => item.productId === productId);
    if (itemIndex === -1) return;

    const product = products.find(p => p.id === productId)!;
    const availableStock = getUserProductStock(product);
    if (value <= 0) {
      setCartItems(cartItems.filter(i => i.productId !== productId));
      return;
    }

    if (value > availableStock) {
      setErrorMsg(`El stock disponible en tu inventario para "${product.name}" es de ${availableStock}.`);
      value = availableStock;
    }

    const newItems = [...cartItems];
    const itemTotalDetails = calculateItemTotal(product, value);

    newItems[itemIndex] = {
      ...newItems[itemIndex],
      quantity: value,
      price: itemTotalDetails.price,
      total: itemTotalDetails.total
    };
    setCartItems(newItems);
    setErrorMsg(null);
  };

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    setCartItems(cartItems.filter(item => item.productId !== productId));
  };

  // Quick Client Creation
  const handleCreateQuickClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientName || !quickClientRut) {
      setErrorMsg("Nombre y RUT/NIT son requeridos para la afiliación de clientes.");
      return;
    }

    const newClient: Client = {
      id: `c-${Date.now()}`,
      name: quickClientName,
      rut: quickClientRut,
      email: quickClientEmail || "operaciones@anonimo.net",
      phone: quickClientPhone || "+57 (300) 000-0000",
      address: "Zona Franca de Tránsito",
      creditLimit: parseFloat(quickClientCredit.toString()) || 1000,
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };

    onAddClient(newClient);
    setSelectedClient(newClient);
    setClientSearch(newClient.name);
    
    // reset form fields
    setQuickClientName('');
    setQuickClientRut('');
    setQuickClientEmail('');
    setQuickClientPhone('');
    setQuickClientCredit(1000);
    setShowQuickClient(false);
    setErrorMsg(null);
  };

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = 0; // IVA eliminado de la factura
  const preDiscountTotal = subtotal;
  const total = Math.max(0, preDiscountTotal - discount) + (isDelivery ? deliveryFee : 0);

  // Check credit constraints
  const creditAvailable = selectedClient 
    ? selectedClient.creditLimit - selectedClient.outstandingBalance 
    : 0;
  
  const isCreditExceeded = selectedClient && paymentMethod.toLowerCase().includes('cred') && total > creditAvailable;

  // Process checkout & save invoice
  const handleCheckout = () => {
    // Check permission
    const hasPermission = currentUser?.permissions ? !!currentUser.permissions.crear_factura : true;
    if (!hasPermission) {
      setErrorMsg("⚠️ AUTORIZACIÓN RESTRINGIDA: Su agente de caja no cuenta con el permiso 'crear_factura' (Firmar Facturas) asignado en su ficha.");
      return;
    }

    if (!activeShift) {
      setErrorMsg("⚠️ BLOQUEO DE PROTOCOLO: No se puede facturar sin antes APERURAR LA JORNADA de caja.");
      return;
    }

    // Si el cliente no está agregado/seleccionado, que sea cliente ocasional
    let clientToUse = selectedClient;
    if (!clientToUse) {
      const ocasional = clients.find(c => c.id === 'c-ocasional') || {
        id: "c-ocasional",
        name: "Cliente Ocasional",
        rut: "222.222.222-2",
        email: "ocasional@extremecourier.com",
        phone: "+57 (300) 000-0000",
        address: "Venta Directa de Caja",
        creditLimit: 0,
        outstandingBalance: 0,
        createdAt: "2026-01-01T00:00:00-05:00"
      };
      clientToUse = ocasional;
    }

    if (cartItems.length === 0) {
      setErrorMsg("El carro de despacho está vacío. Incorpore insumos.");
      return;
    }

    if (paymentMethod.toLowerCase().includes('cred') && clientToUse.id === 'c-ocasional') {
      setErrorMsg("❌ CRÉDITO RESTRINGIDO: El Cliente Ocasional no puede realizar compras a crédito.");
      return;
    }

    const availableLimit = clientToUse.creditLimit - clientToUse.outstandingBalance;
    if (paymentMethod.toLowerCase().includes('cred') && total > availableLimit) {
      setErrorMsg(`❌ CUPO EXCEDIDO: El cliente "${clientToUse.name}" solo dispone de $${availableLimit.toFixed(2)} de crédito.`);
      return;
    }

    // Generate Invoice Number
    const lastInvoiceNum = invoices.length > 0 
      ? parseInt(invoices[invoices.length - 1].invoiceNumber.split('-')[1]) 
      : 0;
    const nextNum = String(lastInvoiceNum + 1).padStart(4, '0');
    const invoiceNumber = `${config.invoicePrefix}-${nextNum}`;

    const isCredit = paymentMethod.toLowerCase().includes('cred');

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      clientId: clientToUse.id,
      clientName: clientToUse.name,
      clientRut: clientToUse.rut,
      items: cartItems,
      subtotal,
      discount,
      taxRate: 0, // IVA eliminado
      taxAmount: 0, // IVA eliminado
      total,
      paymentMethod,
      paymentStatus: isCredit ? 'Pendiente' : 'Pagado',
      dueDate: isCredit ? dueDate : new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      cashierName: activeShift.user,
      isDelivery,
      deliveryFee: isDelivery ? deliveryFee : 0,
      deliveryRider: isDelivery ? deliveryRider.trim() : undefined,
      deliveryTransport: isDelivery ? deliveryTransport : undefined,
      deliveryStatus: isDelivery ? 'Pendiente' : undefined,
      clientSignature: isDelivery && signatureDataUrl ? signatureDataUrl : undefined,
      deliveryMethod: isDelivery ? deliveryMethod : undefined,
      guideName: isDelivery ? guideName.trim() : undefined,
      guideRut: isDelivery ? guideRut.trim() : undefined,
      guidePhone: isDelivery ? guidePhone.trim() : undefined,
      guideAddress: isDelivery ? guideAddress.trim() : undefined,
      guideNotes: isDelivery ? guideNotes.trim() : undefined
    };

    onAddInvoice(newInvoice);
    setGeneratedInvoice(newInvoice);
    
    // Clear invoice states
    setCartItems([]);
    setSelectedClient(null);
    setClientSearch('');
    setDiscount(0);
    setErrorMsg(null);
    setIsDelivery(false);
    setDeliveryFee(0);
    setDeliveryRider('');
    setDeliveryTransport('Motocicleta');
    setSignatureDataUrl('');
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="billing-module">
      
      {/* LEFT: Billing workspace (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Step 1: Link Client */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono flex items-center gap-2">
              <span className="text-cyber-orange">01.</span> VINCULAR DEUDOR / CLIENTE
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const ocasional = clients.find(c => c.id === 'c-ocasional');
                  if (ocasional) {
                    setSelectedClient(ocasional);
                    setClientSearch(ocasional.name);
                    setErrorMsg(null);
                  }
                }}
                className="bg-cyber-blue/10 hover:bg-cyber-blue text-cyber-blue hover:text-black transition-all border border-cyber-blue/30 text-xs py-1 px-3 rounded-lg flex items-center gap-1.5 font-mono cursor-pointer"
              >
                <Users size={14} /> Cliente Ocasional
              </button>
              <button 
                onClick={() => setShowQuickClient(!showQuickClient)}
                className="bg-cyber-pink/10 hover:bg-cyber-pink text-cyber-pink hover:text-black transition-all border border-cyber-pink/30 text-xs py-1 px-3 rounded-lg flex items-center gap-1.5 font-mono cursor-pointer"
              >
                <UserPlus size={14} /> Afiliación Rápida
              </button>
            </div>
          </div>

          {/* Quick Client Drawer */}
          {showQuickClient && (
            <form onSubmit={handleCreateQuickClient} className="bg-slate-900/80 border border-cyber-pink/30 rounded-xl p-4 mb-4 space-y-3 animate-pulse-once">
              <p className="text-xs text-cyber-pink font-mono font-bold tracking-wider">MODULO DE INSCRIPCIÓN EXTREMA</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="Nombre o Razón Social" 
                  value={quickClientName}
                  onChange={e => setQuickClientName(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
                  required
                />
                <input 
                  type="text" 
                  placeholder="NIT / RUT (Identificación)" 
                  value={quickClientRut}
                  onChange={e => setQuickClientRut(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
                  required
                />
                <input 
                  type="email" 
                  placeholder="Email de auditoría" 
                  value={quickClientEmail}
                  onChange={e => setQuickClientEmail(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
                />
                <input 
                  type="text" 
                  placeholder="Teléfono móvil" 
                  value={quickClientPhone}
                  onChange={e => setQuickClientPhone(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
                />
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-gray-400 font-mono mb-1">CUPO DE CRÉDITO DISPONIBLE (USD)</label>
                  <input 
                    type="number" 
                    value={quickClientCredit}
                    onChange={e => setQuickClientCredit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowQuickClient(false)}
                  className="text-xs text-gray-400 px-3 py-1.5"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-bold px-4 py-1.5 rounded-lg font-mono"
                >
                  Confirmar Registro
                </button>
              </div>
            </form>
          )}

          {/* Client selection search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search size={16} />
            </div>
            <input 
              type="text"
              placeholder="Buscar cliente por razón social, RUT o NIT..."
              value={clientSearch}
              onChange={e => {
                setClientSearch(e.target.value);
                setShowClientDropdown(true);
                if (selectedClient && e.target.value !== selectedClient.name) {
                  setSelectedClient(null);
                }
              }}
              onFocus={() => setShowClientDropdown(true)}
              className="bg-cyber-bg border border-cyber-border text-white text-sm pl-10 pr-4 py-3 rounded-xl w-full focus:outline-none glow-border-orange"
            />
            {selectedClient && (
              <span className="absolute right-3 top-3.5 bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/40 text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                VINCULADO
              </span>
            )}

            {/* Dropdown Results */}
            {showClientDropdown && clientSearch.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-cyber-card border border-cyber-border rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setClientSearch(c.name);
                      setShowClientDropdown(false);
                      setErrorMsg(null);
                    }}
                    className="w-full text-left p-3 hover:bg-slate-900 transition-all text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-white">{c.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">RUT: {c.rut}</div>
                    </div>
                    <div className="text-right font-mono text-[10px]">
                      <div className="text-gray-400">Cupo: ${c.creditLimit.toFixed(0)}</div>
                      <div className={`mt-0.5 ${c.outstandingBalance > 0 ? 'text-cyber-pink' : 'text-cyber-green'}`}>
                        Deuda: ${c.outstandingBalance.toFixed(0)}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-500 font-mono">
                    Ningún deudor registrado coincide. Use "Afiliación Rápida".
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connected Client Card Summary */}
          {selectedClient && (
            <div className="mt-3 bg-slate-900/60 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
              <div>
                <div className="font-semibold text-white">{selectedClient.name}</div>
                <div className="text-gray-400 text-[10px] mt-0.5">RUT/NIT: {selectedClient.rut} | Tel: {selectedClient.phone}</div>
                <div className="text-gray-400 text-[10px]">Dirección: {selectedClient.address}</div>
              </div>
              <div className="border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4 font-mono text-right shrink-0">
                <div className="text-gray-400">Crédito Utilizado: <span className="text-cyber-pink font-bold">${selectedClient.outstandingBalance.toFixed(2)}</span> / ${selectedClient.creditLimit.toFixed(2)}</div>
                <div className="text-cyber-green mt-0.5">Cupo Disponible: ${(selectedClient.creditLimit - selectedClient.outstandingBalance).toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Search Products */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 relative">
          <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono flex items-center gap-2 mb-4">
            <span className="text-cyber-orange">02.</span> INCORPORAR SUMINISTROS
          </h2>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search size={16} />
            </div>
            <input 
              type="text"
              placeholder="Escriba código o descripción del producto..."
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              className="bg-cyber-bg border border-cyber-border text-white text-sm pl-10 pr-4 py-3 rounded-xl w-full focus:outline-none glow-border-pink"
            />

            {/* Dropdown Results */}
            {showProductDropdown && productSearch.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-cyber-card border border-cyber-border rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800">
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddProduct(p)}
                    className="w-full text-left p-3 hover:bg-slate-900 transition-all flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.imageUrl}</span>
                      <div>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">CÓD: {p.code} | {p.category}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-white font-bold">${p.price.toFixed(2)}</div>
                      <div className={`text-[10px] ${getUserProductStock(p) <= p.minStock ? 'text-cyber-orange font-bold animate-pulse' : 'text-gray-400'}`}>
                        Mi Stock: {getUserProductStock(p)} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'L' : 'u'}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        Bodega: {p.stock} {p.unitType === 'gr' ? 'g' : p.unitType === 'ml' ? 'ml' : p.unitType === 'l' ? 'L' : 'u'}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-500 font-mono">
                    No se localizó ningún suministro activo con esa descripción.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Cart Items */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono flex items-center gap-2">
              <span className="text-cyber-orange">03.</span> CARRO DE EMBARQUE
            </h2>
            <span className="bg-slate-900 text-gray-400 text-xs px-2.5 py-1 rounded-md border border-slate-800 font-mono">
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} ítems
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-cyber-border text-gray-400 font-mono uppercase text-[10px]">
                  <th className="py-2">Suministro</th>
                  <th className="py-2 text-right">Precio Unitario</th>
                  <th className="py-2 text-center">Cantidad</th>
                  <th className="py-2 text-right">Impuesto ({config.taxRate}%)</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {cartItems.map(item => (
                  <tr key={item.productId} className="hover:bg-slate-900/40 text-white">
                    <td className="py-3 font-sans font-medium">
                      <div className="font-semibold text-white">{item.productName}</div>
                      <div className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">
                        {item.unitType === 'gr' ? '⚖️ Por Peso (Gramaje)' : item.unitType === 'ml' ? '🧪 Por Volumen (ML)' : item.unitType === 'l' ? '🍶 Por Volumen (Litros)' : '📦 Por Unidad'}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      ${item.price.toFixed(2)}
                      <span className="text-[9px] text-gray-500">/{item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : item.unitType === 'l' ? 'L' : 'u'}</span>
                    </td>
                    <td className="py-3 text-center">
                      {item.unitType && item.unitType !== 'unidad' ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 max-w-[120px]">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={item.quantity}
                              onChange={(e) => handleSetItemQty(item.productId, parseFloat(e.target.value) || 0)}
                              className="w-16 bg-transparent text-center font-bold text-cyber-orange focus:outline-none text-xs"
                            />
                            <span className="text-[10px] text-gray-400 font-mono pr-1">
                              {item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : 'L'}
                            </span>
                          </div>
                          {item.unitType === 'gr' && (
                            <div className="flex gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleSetItemQty(item.productId, 1)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                                  item.quantity === 1 
                                    ? 'bg-cyber-pink text-black border-cyber-pink' 
                                    : 'bg-slate-950 text-gray-400 border-slate-855 hover:text-white hover:border-slate-700'
                                }`}
                                title="1 Gramo"
                              >
                                1
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetItemQty(item.productId, 0.5)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                                  item.quantity === 0.5 
                                    ? 'bg-cyber-pink text-black border-cyber-pink' 
                                    : 'bg-slate-950 text-gray-400 border-slate-855 hover:text-white hover:border-slate-700'
                                }`}
                                title="Medio Gramo"
                              >
                                1/2
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetItemQty(item.productId, 0.25)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                                  item.quantity === 0.25 
                                    ? 'bg-cyber-pink text-black border-cyber-pink' 
                                    : 'bg-slate-950 text-gray-400 border-slate-855 hover:text-white hover:border-slate-700'
                                }`}
                                title="Un Cuarto de Gramo"
                              >
                                1/4
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
                          <button 
                            onClick={() => handleAdjustQty(item.productId, -1)}
                            className="p-1 text-gray-400 hover:text-white hover:bg-slate-800 rounded"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-cyber-orange">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => handleAdjustQty(item.productId, 1)}
                            className="p-1 text-gray-400 hover:text-white hover:bg-slate-800 rounded"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      ${item.taxAmount.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-bold text-white">
                      ${item.total.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-gray-500 hover:text-cyber-pink transition-all p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cartItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4">
                      <CyberEmpty 
                        title="Carro de Despacho Vacío" 
                        description="Incorpore suministros buscando en el catálogo superior." 
                        icon={ShoppingCart}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* RIGHT: Transaction summary & Checkout parameters (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Cost breakdown */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono flex items-center gap-2 border-b border-cyber-border pb-3">
            <ShoppingCart size={15} className="text-cyber-orange" />
            RESUMEN DE FACTURA
          </h2>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal:</span>
              <span className="text-white">${subtotal.toFixed(2)}</span>
            </div>
            {isDelivery && (
              <div className="flex justify-between text-cyber-orange">
                <span>Renglón Domicilio:</span>
                <span className="font-bold">+${deliveryFee.toFixed(2)}</span>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="block text-[10px] text-gray-400 uppercase tracking-wider">Descuento Global (USD):</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={discount} 
                  onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink text-right pr-6 font-mono font-bold"
                />
                <span className="absolute right-2.5 top-2 text-[10px] text-gray-500">$</span>
              </div>
            </div>

            {activePromos.length > 0 && (
              <div className="space-y-1 pt-1.5">
                <label className="block text-[9px] text-gray-500 uppercase tracking-wider">Aplicar Promoción Activa:</label>
                <select 
                  onChange={e => handleSelectPromo(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-[11px] p-2 rounded-lg w-full focus:outline-none font-mono"
                >
                  <option value="">-- Seleccionar Promoción --</option>
                  {activePromos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === 'porcentaje' ? `${p.value}%` : `$${p.value} USD`})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-white pt-3 border-t border-slate-800">
              <span>Total a Liquidar:</span>
              <span className="text-cyber-pink font-extrabold text-lg tracking-tight">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* DESPACHO A DOMICILIO CARD */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2.5">
            <h3 className="text-xs font-bold text-white tracking-wider uppercase font-mono flex items-center gap-2">
              <Truck size={14} className="text-cyber-pink" />
              DESPACHO A DOMICILIO
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isDelivery} 
                onChange={e => setIsDelivery(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-pink"></div>
            </label>
          </div>

          {isDelivery && (
            <div className="space-y-3.5 text-xs font-mono">
              {/* Delivery Mode 3-way toggle button group */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold">Modalidad de Despacho:</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('oficina')}
                    className={`py-2 px-1 rounded border text-[9px] font-bold font-mono transition-all ${
                      deliveryMethod === 'oficina'
                        ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow'
                        : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    🏢 Oficina
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('cliente')}
                    className={`py-2 px-1 rounded border text-[9px] font-bold font-mono transition-all ${
                      deliveryMethod === 'cliente'
                        ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow'
                        : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    👥 Por Cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('recoge')}
                    className={`py-2 px-1 rounded border text-[9px] font-bold font-mono transition-all ${
                      deliveryMethod === 'recoge'
                        ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow'
                        : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    🛍️ Recoge
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider">Recargo por Domicilio ($):</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={deliveryFee} 
                    onChange={e => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="Monto del domicilio..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink text-right pr-6 font-mono font-bold"
                    readOnly={deliveryMethod !== 'oficina'}
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-gray-500">$</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-gray-400 uppercase tracking-wider">Nombre del Domiciliario:</label>
                <input 
                  type="text" 
                  value={deliveryRider} 
                  onChange={e => setDeliveryRider(e.target.value)}
                  placeholder="Ej: Carlos Ortiz"
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink font-sans"
                  required={isDelivery && deliveryMethod === 'oficina'}
                  readOnly={deliveryMethod !== 'oficina'}
                />
              </div>

              {deliveryMethod === 'oficina' && (
                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wider">Medio de Transporte:</label>
                  <select 
                    value={deliveryTransport} 
                    onChange={e => setDeliveryTransport(e.target.value)}
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-sans text-xs"
                  >
                    <option value="Motocicleta">🏍️ Motocicleta</option>
                    <option value="Bicicleta">🚲 Bicicleta</option>
                    <option value="Automóvil">🚗 Automóvil</option>
                    <option value="A pie">🚶 A pie</option>
                  </select>
                </div>
              )}

              {/* Editable shipping guide details */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <h4 className="text-[10px] font-bold text-cyan-450 uppercase tracking-widest font-mono">Datos de Guía de Envío:</h4>
                
                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Destinatario:</label>
                  <input
                    type="text"
                    value={guideName}
                    onChange={e => setGuideName(e.target.value)}
                    placeholder="Nombre del destinatario..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-sans"
                    required={isDelivery}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">NIT / RUT Destino:</label>
                  <input
                    type="text"
                    value={guideRut}
                    onChange={e => setGuideRut(e.target.value)}
                    placeholder="NIT o RUT..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
                    required={isDelivery}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Teléfono de Contacto:</label>
                  <input
                    type="text"
                    value={guidePhone}
                    onChange={e => setGuidePhone(e.target.value)}
                    placeholder="Teléfono..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-sans"
                    required={isDelivery}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Dirección de Entrega:</label>
                  <input
                    type="text"
                    value={guideAddress}
                    onChange={e => setGuideAddress(e.target.value)}
                    placeholder="Dirección..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-sans"
                    required={isDelivery}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Observaciones de Envío:</label>
                  <input
                    type="text"
                    value={guideNotes}
                    onChange={e => setGuideNotes(e.target.value)}
                    placeholder="Observaciones..."
                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg w-full focus:outline-none glow-border-pink font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] text-cyan-400 uppercase tracking-wider font-bold">Firma Digital del Cliente:</label>
                  <button 
                    type="button" 
                    onClick={clearSignature} 
                    className="text-[9px] text-cyber-pink hover:underline font-mono"
                  >
                    Borrar
                  </button>
                </div>
                
                <div className="relative bg-black rounded-lg border border-slate-800 overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={110}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[110px] bg-black cursor-crosshair touch-none"
                  />
                  {!signatureDataUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-600 text-[10px] font-mono select-none">
                      Dibuje firma aquí (Pantalla Táctil)
                    </div>
                  )}
                </div>
                {signatureDataUrl && (
                  <p className="text-[9px] text-cyber-green font-mono">✓ Firma capturada correctamente</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment Term Configuration */}
        <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-white tracking-wider uppercase font-mono">MODALIDAD DE COBRO</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(config.paymentMethods || ['Efectivo', 'Tarjeta', 'Crédito']).map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`py-2 px-1 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                  paymentMethod === method 
                    ? 'bg-cyber-orange/20 border-cyber-orange text-cyber-orange neon-shadow-orange' 
                    : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          {paymentMethod.toLowerCase().includes('cred') && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80 animate-pulse-once">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-gray-400">Fecha de Vencimiento:</span>
                <span className="text-cyber-pink font-bold">Crédito a 15 días</span>
              </div>
              <input 
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink font-mono"
              />
              
              {selectedClient && (
                <div className="bg-slate-900/60 p-2.5 rounded border border-cyber-border/60 text-[10px] font-mono space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Cupo actual:</span>
                    <span>${selectedClient.creditLimit.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Saldo pendiente:</span>
                    <span className="text-cyber-pink font-semibold">${selectedClient.outstandingBalance.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 border-t border-slate-800/80 pt-1">
                    <span>Cupo deudor disponible:</span>
                    <span className={isCreditExceeded ? 'text-red-400 font-bold' : 'text-cyber-green'}>
                      ${creditAvailable.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Display general errors and warnings */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 text-red-400 text-xs animate-bounce">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-mono">{errorMsg}</span>
          </div>
        )}

        {isCreditExceeded && (
          <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg flex items-start gap-2 text-red-400 text-xs">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 animate-ping" />
            <span className="font-mono uppercase font-bold text-[10px]">ALERTA: Supera límite de crédito asignado para {selectedClient?.name}.</span>
          </div>
        )}

        {/* Dispatch Invoice Button */}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={isCreditExceeded}
          className={`w-full py-4 rounded-xl font-bold tracking-wider font-mono text-xs transition-all flex items-center justify-center gap-2 ${
            isCreditExceeded 
              ? 'bg-slate-800 border border-slate-700 text-gray-600 cursor-not-allowed'
              : 'bg-cyber-pink text-black hover:bg-cyber-accent hover:scale-[1.02] active:scale-[0.98] cursor-pointer neon-shadow-pink font-extrabold'
          }`}
        >
          <CheckCircle size={15} />
          DESPACHAR FACTURA Y COMPROBANTE
        </button>

      </div>
           {/* MODAL / OVERLAY: High-fidelity thermal invoice visualizer */}
      {generatedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white text-black p-6 rounded-2xl max-w-sm w-full font-mono text-xs shadow-2xl relative border-4 border-double border-black print-card">
            
            {/* Tab selector inside print modal */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2.5 no-print">
              <button
                type="button"
                onClick={() => setActiveTicketTab('invoice')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                  activeTicketTab === 'invoice'
                    ? 'bg-black text-white font-black'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📄 Comprobante
              </button>
              {generatedInvoice.isDelivery && (
                <button
                  type="button"
                  onClick={() => setActiveTicketTab('guide')}
                  className={`flex-1 py-1.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                    activeTicketTab === 'guide'
                      ? 'bg-black text-white font-black'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📦 Guía de Envío
                </button>
              )}
            </div>

            {activeTicketTab === 'invoice' ? (
              <>
                {/* Header */}
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-black">
                  <h3 className="text-sm font-extrabold uppercase tracking-tight">{config.companyName}</h3>
                  <p className="text-[10px]">RUT/NIT: {config.rut}</p>
                  <p className="text-[10px]">{config.address}</p>
                  <p className="text-[10px]">TEL: {config.phone}</p>
                  <p className="text-[10px]">{config.email}</p>
                </div>

                {/* Meta details */}
                <div className="py-3 space-y-1 border-b border-dashed border-black text-[10px]">
                  <div className="flex justify-between">
                    <span>REMITO DESPACHO:</span>
                    <span className="font-bold">{generatedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FECHA EMISIÓN:</span>
                    <span>{new Date(generatedInvoice.createdAt).toLocaleString()}</span>
                  </div>
                  {generatedInvoice.paymentMethod.toLowerCase().includes('cred') && (
                    <div className="flex justify-between text-red-600">
                      <span>VENCIMIENTO CARTERA:</span>
                      <span className="font-bold">{generatedInvoice.dueDate}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>OPERADOR CAJA:</span>
                    <span className="uppercase">{generatedInvoice.cashierName}</span>
                  </div>
                </div>

                {/* Client info */}
                <div className="py-3 border-b border-dashed border-black text-[10px] space-y-0.5">
                  <div className="font-bold">ADQUIRIENTE / CLIENTE:</div>
                  <div>{generatedInvoice.clientName}</div>
                  <div>NIT: {generatedInvoice.clientRut}</div>
                </div>

                {/* Delivery details on ticket */}
                {generatedInvoice.isDelivery && (
                  <div className="py-3 border-b border-dashed border-black text-[10px] space-y-0.5">
                    <div className="font-bold text-red-600 uppercase">
                      Despacho ({generatedInvoice.deliveryMethod === 'cliente' ? 'Cuenta Cliente' : generatedInvoice.deliveryMethod === 'recoge' ? 'Cliente Recoge' : 'Oficina'}):
                    </div>
                    <div className="flex justify-between">
                      <span>DOMICILIARIO:</span>
                      <span className="font-bold uppercase">{generatedInvoice.deliveryRider || 'ASIGNANDO'}</span>
                    </div>
                    {generatedInvoice.deliveryMethod === 'oficina' && (
                      <div className="flex justify-between">
                        <span>TRANSPORTE:</span>
                        <span className="font-bold uppercase">{generatedInvoice.deliveryTransport}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ESTADO:</span>
                      <span className="font-bold uppercase">{generatedInvoice.deliveryStatus}</span>
                    </div>
                  </div>
                )}

                {/* Items table */}
                <div className="py-3 border-b border-dashed border-black">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="pb-1">Cant/Descr</th>
                        <th className="pb-1 text-right">P.Unit</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedInvoice.items.map(item => (
                        <tr key={item.productId}>
                          <td className="py-1">
                            <span className="font-bold">{item.quantity} {item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : item.unitType === 'l' ? 'L' : 'u'}</span> x {item.productName}
                          </td>
                          <td className="py-1 text-right">
                            ${item.price.toFixed(2)}
                            <span className="text-[8px] text-gray-500">/{item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : item.unitType === 'l' ? 'L' : 'u'}</span>
                          </td>
                          <td className="py-1 text-right">${item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial summaries */}
                <div className="py-3 space-y-1 text-right text-[10px] border-b border-dashed border-black">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>${generatedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {generatedInvoice.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>DESCUENTO GLOBAL:</span>
                      <span>-${generatedInvoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {generatedInvoice.isDelivery && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>RECARGO DOMICILIO:</span>
                      <span>+${(generatedInvoice.deliveryFee || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-extrabold border-t border-black pt-1">
                    <span>TOTAL LIQUIDADO:</span>
                    <span>${generatedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Signature Area */}
                <div className="py-3 text-center space-y-1 border-b border-dashed border-black">
                  {generatedInvoice.clientSignature ? (
                    <div className="space-y-1">
                      <p className="text-[7px] text-gray-500 uppercase tracking-wider font-bold">Firma Digital del Cliente</p>
                      <img 
                        src={generatedInvoice.clientSignature} 
                        alt="Firma del Cliente" 
                        className="mx-auto max-h-12 bg-white border border-black/10 rounded px-1" 
                      />
                    </div>
                  ) : (
                    <div className="pt-6 border-b border-black w-2/3 mx-auto"></div>
                  )}
                  <p className="text-[8px] uppercase tracking-wider text-gray-600">Firma de Recibido / Sello de Cliente</p>
                </div>

                {/* Footer terms */}
                <div className="text-center py-4 space-y-2">
                  <p className="text-[9px] uppercase font-bold">CONDICIÓN DE COBRO: {generatedInvoice.paymentMethod}</p>
                  <div className="flex justify-center my-1.5">
                    {/* Simulated barcode */}
                    <div className="bg-black text-white px-2 py-0.5 tracking-[4px] font-mono text-[9px]">
                      ||| {generatedInvoice.invoiceNumber} |||
                    </div>
                  </div>
                  <p className="text-[8px] text-gray-500 leading-normal">
                    Esta es una copia autorizada de entrega de suministros. 
                    Gracias por confiar en Rosa Fuerte Pero NO Tan Fucsia
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* GUÍA DE ENVÍO TICKET MODE */}
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-black">
                  <h3 className="text-sm font-black uppercase tracking-tight">GUÍA DE ENVÍO / DESPACHO</h3>
                  <p className="text-[10px] font-bold">ROSA FUERTE LOGISTICS</p>
                  <p className="text-[8px] text-gray-500">Etiqueta de Destino Autorizada</p>
                </div>

                {/* Meta details */}
                <div className="py-3 border-b border-dashed border-black text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span>NÚMERO GUÍA:</span>
                    <span className="font-bold">G-{generatedInvoice.invoiceNumber.split('-')[1]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FACTURA REF:</span>
                    <span className="font-bold">{generatedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FECHA DESPACHO:</span>
                    <span>{new Date(generatedInvoice.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MODALIDAD ENVÍO:</span>
                    <span className="font-bold uppercase">{generatedInvoice.deliveryMethod === 'cliente' ? 'A Cuenta Cliente' : generatedInvoice.deliveryMethod === 'recoge' ? 'Recogida Local' : 'Despacho Oficina'}</span>
                  </div>
                </div>

                {/* Sender details */}
                <div className="py-2.5 border-b border-dashed border-black text-[10px] space-y-0.5">
                  <div className="font-bold uppercase tracking-wider text-gray-500 text-[8px]">REMITENTE:</div>
                  <div className="font-bold">{config.companyName}</div>
                  <div>NIT: {config.rut}</div>
                  <div>DIRECCIÓN: {config.address}</div>
                </div>

                {/* Destination info */}
                <div className="py-2.5 border-b border-dashed border-black text-[10px] space-y-0.5">
                  <div className="font-bold uppercase tracking-wider text-gray-500 text-[8px]">DESTINATARIO:</div>
                  <div className="font-extrabold text-xs uppercase">{generatedInvoice.guideName || generatedInvoice.clientName}</div>
                  <div>NIT/ID: {generatedInvoice.guideRut || generatedInvoice.clientRut}</div>
                  <div>TEL CONTACTO: {generatedInvoice.guidePhone}</div>
                  <div className="bg-gray-100 p-2 rounded border border-black/10 mt-1.5 font-bold leading-normal text-[10px]">
                    📍 DIRECCIÓN ENVÍO: {generatedInvoice.guideAddress}
                  </div>
                </div>

                {/* Courier info */}
                <div className="py-2.5 border-b border-dashed border-black text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span>DOMICILIARIO / MENSAJERO:</span>
                    <span className="font-bold uppercase">{generatedInvoice.deliveryRider || 'ASIGNANDO'}</span>
                  </div>
                  {generatedInvoice.deliveryMethod === 'oficina' && generatedInvoice.deliveryTransport && (
                    <div className="flex justify-between">
                      <span>TRANSPORTE / MEDIO:</span>
                      <span className="font-bold uppercase">{generatedInvoice.deliveryTransport}</span>
                    </div>
                  )}
                  {generatedInvoice.guideNotes && (
                    <div className="pt-1 mt-1 border-t border-dashed border-black/10">
                      <span className="font-bold block text-[8px] text-gray-500">OBSERVACIONES:</span>
                      <p className="text-[9px] italic leading-normal">{generatedInvoice.guideNotes}</p>
                    </div>
                  )}
                </div>

                {/* Signature conforming print */}
                <div className="py-3 text-center space-y-1 border-b border-dashed border-black">
                  {generatedInvoice.clientSignature ? (
                    <div className="space-y-1">
                      <p className="text-[7px] text-gray-500 uppercase tracking-wider font-bold">Firma Conformidad Entrega</p>
                      <img 
                        src={generatedInvoice.clientSignature} 
                        alt="Firma del Cliente" 
                        className="mx-auto max-h-12 bg-white border border-black/10 rounded px-1" 
                      />
                    </div>
                  ) : (
                    <div className="pt-8 border-b border-black w-2/3 mx-auto"></div>
                  )}
                  <p className="text-[8px] uppercase tracking-wider text-gray-600">Firma / Sello de Recibido Conforme</p>
                </div>

                {/* Guide barcode footer */}
                <div className="text-center py-4 space-y-2">
                  <div className="flex justify-center my-1.5">
                    <div className="bg-black text-white px-3 py-1 tracking-[6px] font-mono text-xs font-black">
                      G-{generatedInvoice.invoiceNumber.split('-')[1]}
                    </div>
                  </div>
                  <p className="text-[8px] text-gray-550 font-bold uppercase">ROSA FUERTE EXPRESS SECURITY TICKET</p>
                </div>
              </>
            )}

            {/* Action panel inside modal */}
            <div className="flex gap-2 mt-4 border-t border-slate-300 pt-4 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-black text-white hover:bg-slate-900 p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 font-mono text-xs cursor-pointer"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => { setGeneratedInvoice(null); setActiveTicketTab('invoice'); }}
                className="flex-1 bg-red-600 text-white hover:bg-red-700 p-2.5 rounded-lg font-bold flex items-center justify-center font-mono text-xs cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
