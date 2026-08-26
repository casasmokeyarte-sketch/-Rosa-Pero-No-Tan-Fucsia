import React, { useState, useEffect, useRef } from 'react';
import { Client, Product, Invoice, InvoiceItem, Shift, BusinessConfig, Discount, User, getClientBillingBlockReason } from '../types';
import CyberEmpty from './CyberEmpty';
import {
  fetchWallet,
  getWalletOperatorSession,
  getWalletSession,
  operatorPurchaseWithWallet,
  WalletPurchaseInvoice
} from '../lib/walletApi';
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
  Truck,
  X
} from 'lucide-react';

interface FacturacionProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  shifts: Shift[];
  config: BusinessConfig;
  currentUser: any;
  onAddInvoice: (
    invoice: Invoice,
    options?: { skipPersistence?: boolean }
  ) => Promise<void> | void;
  discounts: Discount[];
  users: User[];
}

export default function Facturacion({
  clients,
  products,
  invoices,
  shifts,
  config,
  currentUser,
  onAddInvoice,
  discounts = [],
  users = []
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

  // Generated Invoice state (for receipt modal)
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [activeTicketTab, setActiveTicketTab] = useState<'invoice' | 'guide'>('invoice');

  const guideBlockedItems = generatedInvoice
    ? generatedInvoice.items.filter(item => {
        const product = products.find(
          candidate => candidate.id === item.productId
        );

        return product?.dispatchEligibilityStatus !== 'allowed';
      })
    : [];

  const canPrintDispatchGuide =
    Boolean(generatedInvoice?.isDelivery) &&
    guideBlockedItems.length === 0;

  const updateGeneratedGuideField = (
    field: 'guideName' | 'guideRut' | 'guidePhone' | 'guideAddress' | 'guideNotes',
    value: string
  ) => {
    setGeneratedInvoice(current =>
      current ? { ...current, [field]: value } : current
    );
  };

  // Form errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const isSavingInvoiceRef = useRef(false);
  const walletCheckoutAttemptRef = useRef<{
    invoiceId: string;
    invoiceNumber: string;
    idempotencyKey: string;
  } | null>(null);

  // Operator-assisted wallet payment
  const [useWalletPayment, setUseWalletPayment] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletClientPassword, setWalletClientPassword] = useState('');
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setUseWalletPayment(false);
    setWalletAmount('');
    setWalletClientPassword('');
    setWalletBalance(null);
    setWalletStatus(null);

    if (
      !selectedClient ||
      selectedClient.id === 'c-ocasional' ||
      !currentUser?.id
    ) {
      return () => {
        cancelled = true;
      };
    }

    const operatorToken =
      getWalletOperatorSession(currentUser.id) ||
      getWalletSession(currentUser.id);

    if (!operatorToken) {
      setWalletStatus('operator_session_required');
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingWallet(true);

    void fetchWallet(operatorToken, selectedClient.id)
      .then(result => {
        if (cancelled) return;

        setWalletBalance(Number(result.wallet?.balance || 0));
        setWalletStatus(result.wallet?.status || 'unavailable');
      })
      .catch(error => {
        if (cancelled) return;

        console.error('Wallet balance lookup failed:', error);
        setWalletBalance(null);
        setWalletStatus('unavailable');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingWallet(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClient?.id, currentUser?.id]);

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

  // Client Digital Signature states & handlers
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Discount authorization state
  const [showDiscountAuthModal, setShowDiscountAuthModal] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [discountAuthError, setDiscountAuthError] = useState('');
  const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState<string | null>(null);

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
    c.id !== 'c-ocasional' && (
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.rut.includes(clientSearch)
    )
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

  // Set custom note for an item in cart
  const handleSetItemNote = (productId: string, note: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, note };
      }
      return item;
    }));
  };

  // Calculate block reason
  const blockReason = selectedClient ? getClientBillingBlockReason(selectedClient, invoices) : null;

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = 0; // IVA eliminado de la factura
  const preDiscountTotal = subtotal;

  // Special discount math (non-cumulative)
  const specialDiscount = React.useMemo(() => {
    if (!selectedClient || !selectedClient.specialDiscountPercentage || selectedClient.specialDiscountPercentage <= 0) return 0;
    const pct = selectedClient.specialDiscountPercentage;
    const isSpecific = selectedClient.discountedProductIds && selectedClient.discountedProductIds.length > 0;
    
    if (!isSpecific) {
      return parseFloat((subtotal * (pct / 100)).toFixed(2));
    } else {
      const discountableSum = cartItems
        .filter(item => selectedClient.discountedProductIds?.includes(item.productId))
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return parseFloat((discountableSum * (pct / 100)).toFixed(2));
    }
  }, [selectedClient, cartItems, subtotal]);

  const effectiveDiscount = specialDiscount > 0 ? specialDiscount : discount;
  const total = Math.max(0, preDiscountTotal - effectiveDiscount) + (isDelivery ? deliveryFee : 0);

  const walletAmountValue = Math.max(
    0,
    Number(walletAmount || 0)
  );

  const availableWalletBalance = Math.max(
    0,
    Number(walletBalance || 0)
  );

  const maximumWalletPayment = Math.min(
    total,
    availableWalletBalance
  );

  const appliedWalletAmount = useWalletPayment
    ? Math.min(walletAmountValue, maximumWalletPayment)
    : 0;

  const remainingAfterWallet = Math.max(
    0,
    total - appliedWalletAmount
  );

  const walletCanBeUsed =
    walletStatus === 'active' &&
    availableWalletBalance > 0;
  // Check credit constraints
  const creditAvailable = selectedClient 
    ? selectedClient.creditLimit - selectedClient.outstandingBalance 
    : 0;
  
  const isCreditExceeded = selectedClient && paymentMethod.toLowerCase().includes('cred') && total > creditAvailable;

  // Process checkout & save invoice
  const handleCheckout = async () => {
    if (isSavingInvoice) return;
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

    if (!selectedClient || selectedClient.id === 'c-ocasional') {
      setErrorMsg("❌ CLIENTE REQUERIDO: Selecciona un cliente registrado antes de facturar.");
      return;
    }

    const clientToUse = selectedClient;

    if (cartItems.length === 0) {
      setErrorMsg("El carro de despacho está vacío. Incorpore insumos.");
      return;
    }

    let operatorToken: string | null = null;

    if (useWalletPayment) {
      operatorToken =
        getWalletOperatorSession(currentUser?.id || '') ||
        getWalletSession(currentUser?.id || '');

      if (!operatorToken) {
        setErrorMsg(
          "La sesión segura del operador venció. Cierra sesión e ingresa nuevamente."
        );
        return;
      }

      if (!clientToUse.code?.trim()) {
        setErrorMsg(
          "El cliente seleccionado no tiene un código válido para autorizar el Bolsillo."
        );
        return;
      }

      if (!walletCanBeUsed) {
        setErrorMsg(
          "El Bolsillo del cliente no está activo o no tiene saldo disponible."
        );
        return;
      }

      if (
        appliedWalletAmount <= 0 ||
        appliedWalletAmount > maximumWalletPayment ||
        !Number.isInteger(appliedWalletAmount)
      ) {
        setErrorMsg(
          "Ingresa un valor válido en pesos para abonar desde el Bolsillo."
        );
        return;
      }

      if (!walletClientPassword) {
        setErrorMsg(
          "El cliente debe ingresar su contraseña para autorizar este abono."
        );
        return;
      }
    }

    const amountPaidOutsideWallet = useWalletPayment
      ? remainingAfterWallet
      : total;

    const remainingUsesCredit =
      amountPaidOutsideWallet > 0 &&
      paymentMethod.toLowerCase().includes('cred');

    if (remainingUsesCredit) {
      if (!clientToUse.hasCredit) {
        setErrorMsg(
          `CRÉDITO RESTRINGIDO: El cliente "${clientToUse.name}" no tiene una línea de crédito autorizada.`
        );
        return;
      }

      const availableLimit =
        clientToUse.creditLimit -
        clientToUse.outstandingBalance;

      if (amountPaidOutsideWallet > availableLimit) {
        setErrorMsg(
          `CUPO EXCEDIDO: El cliente solamente dispone de $${availableLimit.toFixed(2)} de crédito.`
        );
        return;
      }
    }

    const blockCheck = getClientBillingBlockReason(clientToUse, invoices);
    if (blockCheck) {
      setErrorMsg(`❌ FACTURACIÓN BLOQUEADA: ${blockCheck}`);
      return;
    }

    // Reuse the same identifiers when retrying a wallet operation.
    const createIdentifiers = () => {
      const timestamp = Date.now();
      const randomToken =
        globalThis.crypto?.randomUUID?.()
          .replace(/-/g, '')
          .slice(0, 12) ??
        Math.random().toString(36).slice(2, 14);

      return {
        invoiceId: `inv-${timestamp}-${randomToken}`,
        invoiceNumber:
          `${config.invoicePrefix}-` +
          `${timestamp.toString(36).toUpperCase()}-` +
          `${randomToken.slice(0, 4).toUpperCase()}`,
        idempotencyKey:
          `operator-wallet-${timestamp}-${randomToken}`
      };
    };

    const identifiers = useWalletPayment
      ? (
          walletCheckoutAttemptRef.current ??
          createIdentifiers()
        )
      : createIdentifiers();

    if (
      useWalletPayment &&
      !walletCheckoutAttemptRef.current
    ) {
      walletCheckoutAttemptRef.current = identifiers;
    }

    const {
      invoiceId,
      invoiceNumber,
      idempotencyKey
    } = identifiers;

    const normalizedPaymentMethod = paymentMethod
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const isCredit =
      normalizedPaymentMethod.includes('credito');

    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      clientId: clientToUse.id,
      clientName: clientToUse.name,
      clientRut: clientToUse.rut,
      items: cartItems,
      subtotal,
      discount: effectiveDiscount,
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

    // React state does not update synchronously. The ref closes the small window
    // where a rapid second click could create another invoice with a new ID.
    if (isSavingInvoiceRef.current) return;
    isSavingInvoiceRef.current = true;
    setIsSavingInvoice(true);
    try {
      let confirmedInvoice = newInvoice;

      if (useWalletPayment) {
        if (!operatorToken) {
          throw new Error('OPERATOR_SESSION_REQUIRED');
        }

        const result = await operatorPurchaseWithWallet(
          operatorToken,
          {
            client_id: clientToUse.id,
            client_code: clientToUse.code!.trim(),
            client_password: walletClientPassword,
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            items: cartItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              note: item.note
            })),
            delivery_fee: isDelivery ? deliveryFee : 0,
            delivery_method: isDelivery
              ? deliveryMethod
              : 'recoge',
            delivery_address: isDelivery
              ? guideAddress.trim()
              : undefined,
            wallet_amount: appliedWalletAmount,
            remaining_payment_method:
              remainingAfterWallet > 0
                ? paymentMethod
                : '',
            idempotency_key: idempotencyKey
          }
        );

        const serverInvoice: WalletPurchaseInvoice =
          result.invoice;

        confirmedInvoice = {
          ...newInvoice,
          id: serverInvoice.id,
          invoiceNumber: serverInvoice.invoice_number,
          clientId: serverInvoice.client_id,
          clientName: serverInvoice.client_name,
          clientRut: serverInvoice.client_rut,
          items: serverInvoice.items.map(item => ({
            ...item,
            unitType:
              item.unitType as InvoiceItem['unitType']
          })),
          subtotal: Number(serverInvoice.subtotal),
          discount: Number(serverInvoice.discount),
          taxRate: Number(serverInvoice.tax_rate),
          taxAmount: Number(serverInvoice.tax_amount),
          total: Number(serverInvoice.total),
          paymentMethod: serverInvoice.payment_method,
          paymentStatus:
            serverInvoice.payment_status as
              Invoice['paymentStatus'],
          dueDate: serverInvoice.due_date,
          createdAt: serverInvoice.created_at,
          cashierName: serverInvoice.cashier_name,
          isDelivery: serverInvoice.is_delivery,
          deliveryFee: Number(serverInvoice.delivery_fee),
          deliveryStatus: serverInvoice.is_delivery
            ? (
                serverInvoice.delivery_status as
                  Invoice['deliveryStatus']
              )
            : undefined,
          deliveryMethod: serverInvoice.delivery_method,
          walletPaidAmount: Number(
            serverInvoice.wallet_paid_amount
          ),
          amountDue: Number(
            serverInvoice.amount_due ??
            (
              Number(serverInvoice.total) -
              Number(serverInvoice.wallet_paid_amount)
            )
          )
        };
      }

      // Supabase already created a wallet invoice. The upsert is
      // idempotent and this callback applies inventory and shift updates.
      await onAddInvoice(
        confirmedInvoice,
        { skipPersistence: useWalletPayment }
      );
      setGeneratedInvoice(confirmedInvoice);

      setCartItems([]);
      setSelectedClient(null);
      setClientSearch('');
      setDiscount(0);
      setDiscountAuthorizedBy(null);
      setErrorMsg(null);
      setIsDelivery(false);
      setDeliveryFee(0);
      setDeliveryRider('');
      setDeliveryTransport('Motocicleta');
      setSignatureDataUrl('');
      setUseWalletPayment(false);
      setWalletAmount('');
      setWalletBalance(null);
      setWalletStatus(null);
      walletCheckoutAttemptRef.current = null;
    } catch (error) {
      console.error('Invoice checkout failed:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible confirmar la factura.';

      if (
        message.includes('ONLINE_PRODUCT_NOT_ELIGIBLE') ||
        message.toLowerCase().includes(
          'not eligible for wallet'
        )
      ) {
        setErrorMsg(
          "Uno o más productos no están autorizados para pago desde el Bolsillo."
        );
      } else if (
        message.includes(
          'El cliente no autorizó el uso de su Bolsillo'
        ) ||
        message.includes(
          'Valid client authorization required'
        )
      ) {
        setErrorMsg(
          "El cliente no autorizó el abono. Verifica su contraseña."
        );
      } else if (
        message.toLowerCase().includes(
          'insufficient wallet balance'
        )
      ) {
        setErrorMsg(
          "El Bolsillo no tiene saldo suficiente para aplicar ese valor."
        );
      } else {
        setErrorMsg(
          `NO CONFIRMADA: ${message} El formulario sigue intacto para reintentar.`
        );
      }
    } finally {
      // Never retain the client's password after an attempt.
      setWalletClientPassword('');
      isSavingInvoiceRef.current = false;
      setIsSavingInvoice(false);
    }
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
            <div className="text-[10px] text-cyber-orange font-mono text-right">
              Selecciona un cliente previamente registrado.
            </div>
          </div>

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
                    Ningún cliente registrado coincide con la búsqueda.
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
                        {p.note && (
                          <div className="text-[9px] text-amber-400 font-mono mt-1 flex items-center gap-1 bg-amber-950/20 px-1 py-0.5 rounded border border-amber-500/20 max-w-[220px]">
                            <span>⚠️ {p.note}</span>
                          </div>
                        )}
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
                      
                      {/* Custom note for item */}
                      <div className="mt-1.5 flex items-center gap-1.5 max-w-[200px] no-print">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => handleSetItemNote(item.productId, e.target.value)}
                          placeholder="Agregar nota / especificación..."
                          className="w-full bg-slate-950 border border-slate-800 text-[10px] px-2 py-1 rounded text-white focus:outline-none focus:border-cyber-pink font-mono"
                        />
                      </div>
                      {item.note && (
                        <div className="text-[9px] text-cyber-pink font-mono mt-1 hidden print:block">
                          * Nota: {item.note}
                        </div>
                      )}
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
        {blockReason ? (
          <div className="bg-red-950/20 border-2 border-red-500 rounded-xl p-6 text-center space-y-4 shadow-[0_0_30px_rgba(239,68,68,0.25)] font-mono">
            <div className="text-4xl text-red-500 animate-bounce">⚠️</div>
            <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">BLOQUEO CRÍTICO: FACTURACIÓN SUSPENDIDA</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed max-w-sm mx-auto">
              El sistema de seguridad ha bloqueado la emisión de nuevas facturas para este cliente por políticas de riesgo:
            </p>
            <div className="bg-black/40 border border-red-950/80 p-3.5 rounded-xl text-[10px] text-red-400 font-bold leading-normal text-left">
              {blockReason}
            </div>
            <p className="text-[9px] text-gray-500 italic">
              Por favor contacte al Administrador del Búnker para habilitar cupo o registrar los abonos en la cartera de Cuentas por Cobrar.
            </p>
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-red-900/20"
            >
              Deseleccionar Cliente Bloqueado
            </button>
          </div>
        ) : (
          <>
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
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] text-gray-400 uppercase tracking-wider">Descuento Global (COP):</label>
                    {!(currentUser.role === 'Administrador' || currentUser.permissions?.autorizar_descuentos === true) && !discountAuthorizedBy && !(selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0) && (
                      <button
                        type="button"
                        onClick={() => setShowDiscountAuthModal(true)}
                        className="text-[9px] bg-cyber-pink/15 hover:bg-cyber-pink/25 border border-cyber-pink/30 text-cyber-pink px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        🔑 Autorizar
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={effectiveDiscount} 
                      disabled={(selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0) || !(currentUser.role === 'Administrador' || currentUser.permissions?.autorizar_descuentos === true || discountAuthorizedBy)}
                      onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className={`bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink text-right pr-6 font-mono font-bold ${
                        (selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0) || !(currentUser.role === 'Administrador' || currentUser.permissions?.autorizar_descuentos === true || discountAuthorizedBy)
                          ? 'opacity-60 cursor-not-allowed border-slate-800'
                          : ''
                      }`}
                      placeholder={(selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0) ? "Auto" : !(currentUser.role === 'Administrador' || currentUser.permissions?.autorizar_descuentos === true || discountAuthorizedBy) ? "Bloqueado" : "0"}
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-gray-500">$</span>
                  </div>
                  {selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0 ? (
                    <div className="text-[9px] text-cyber-pink font-mono mt-1">
                      ✓ Descuento especial de cliente ({selectedClient.specialDiscountPercentage}%) aplicado. No acumulable.
                    </div>
                  ) : discountAuthorizedBy && (
                    <div className="text-[9px] text-cyber-green font-mono flex items-center justify-between">
                      <span>✓ Autorizado por {discountAuthorizedBy}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setDiscountAuthorizedBy(null);
                          setDiscount(0);
                        }} 
                        className="text-[8px] text-red-400 hover:underline cursor-pointer"
                      >
                        Revocar
                      </button>
                    </div>
                  )}
                </div>

                {activePromos.length > 0 && !(selectedClient && selectedClient.specialDiscountPercentage && selectedClient.specialDiscountPercentage > 0) && (
                  <div className="space-y-1 pt-1.5">
                    <label className="block text-[9px] text-gray-500 uppercase tracking-wider">Aplicar Promoción Activa:</label>
                    <select 
                      onChange={e => handleSelectPromo(e.target.value)}
                      className="bg-cyber-bg border border-cyber-border text-white text-[11px] p-2 rounded-lg w-full focus:outline-none font-mono"
                    >
                      <option value="">-- Seleccionar Promoción --</option>
                      {activePromos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type === 'porcentaje' ? `${p.value}%` : `$${p.value} COP`})
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

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono font-bold text-white">
                  ABONAR DESDE BOLSILLO
                </p>
                <p className="text-[9px] text-gray-500">
                  Opción voluntaria. El cliente debe autorizarla con su contraseña.
                </p>
              </div>

              <button
                type="button"
                disabled={!walletCanBeUsed || isLoadingWallet}
                onClick={() => {
                  const nextValue = !useWalletPayment;
                  setUseWalletPayment(nextValue);
                  setWalletClientPassword('');
                  setErrorMsg(null);

                  if (nextValue) {
                    setWalletAmount(
                      String(Math.floor(maximumWalletPayment))
                    );
                  } else {
                    setWalletAmount('');
                  }
                }}
                className={`px-3 py-2 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                  useWalletPayment
                    ? 'bg-cyber-green/20 border-cyber-green text-cyber-green'
                    : walletCanBeUsed
                      ? 'bg-slate-900 border-cyber-border text-gray-300 hover:text-white'
                      : 'bg-slate-950 border-slate-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {useWalletPayment ? 'BOLSILLO ACTIVADO' : 'USAR BOLSILLO'}
              </button>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-[10px] font-mono space-y-1.5">
              <div className="flex justify-between text-gray-400">
                <span>Saldo disponible:</span>
                <span className="text-cyber-green font-bold">
                  {isLoadingWallet
                    ? 'Consultando...'
                    : walletBalance === null
                      ? 'No disponible'
                      : `$${availableWalletBalance.toLocaleString('es-CO')} COP`}
                </span>
              </div>

              {walletStatus === 'operator_session_required' && (
                <p className="text-amber-400">
                  La sesión segura del operador venció. Cierra sesión e ingresa nuevamente.
                </p>
              )}

              {walletStatus === 'unavailable' && (
                <p className="text-amber-400">
                  No fue posible consultar el Bolsillo de este cliente.
                </p>
              )}

              {walletStatus && walletStatus !== 'active' &&
                walletStatus !== 'unavailable' &&
                walletStatus !== 'operator_session_required' && (
                  <p className="text-amber-400">
                    El Bolsillo no está activo para realizar pagos.
                  </p>
                )}
            </div>

            {useWalletPayment && (
              <div className="space-y-3 bg-cyber-green/5 border border-cyber-green/30 rounded-lg p-3">
                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase">
                    Valor que se abonará desde el Bolsillo
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={maximumWalletPayment}
                    value={walletAmount}
                    onChange={event => {
                      const requested = Math.max(
                        0,
                        Number(event.target.value || 0)
                      );

                      setWalletAmount(
                        String(Math.min(requested, maximumWalletPayment))
                      );
                      setErrorMsg(null);
                    }}
                    className="bg-cyber-bg border border-cyber-green/50 text-white text-xs p-2.5 rounded-lg w-full focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-slate-950/60 rounded p-2">
                    <span className="block text-gray-500">Desde Bolsillo</span>
                    <span className="text-cyber-green font-bold">
                      ${appliedWalletAmount.toLocaleString('es-CO')} COP
                    </span>
                  </div>

                  <div className="bg-slate-950/60 rounded p-2">
                    <span className="block text-gray-500">Saldo por pagar</span>
                    <span className="text-cyber-orange font-bold">
                      ${remainingAfterWallet.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>

                {remainingAfterWallet > 0 && (
                  <p className="text-[9px] text-gray-400">
                    El saldo restante se registrará con la modalidad seleccionada arriba:
                    {' '}
                    <strong className="text-white">{paymentMethod}</strong>.
                  </p>
                )}


                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-400 uppercase">
                    Contraseña del cliente para autorizar este abono
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={walletClientPassword}
                    onChange={event => {
                      setWalletClientPassword(event.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="El cliente ingresa su contraseña"
                    className="bg-cyber-bg border border-cyber-green/50 text-white text-xs p-2.5 rounded-lg w-full focus:outline-none font-mono"
                  />
                </div>

                <p className="text-[9px] text-gray-500">
                  La contraseña solamente se envía para autorizar esta factura y se elimina al terminar el intento.
                </p>
              </div>
            )}
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
          disabled={isCreditExceeded || isSavingInvoice}
          className={`w-full py-4 rounded-xl font-bold tracking-wider font-mono text-xs transition-all flex items-center justify-center gap-2 ${
            isCreditExceeded || isSavingInvoice
              ? 'bg-slate-800 border border-slate-700 text-gray-600 cursor-not-allowed'
              : 'bg-cyber-pink text-black hover:bg-cyber-accent hover:scale-[1.02] active:scale-[0.98] cursor-pointer neon-shadow-pink font-extrabold'
          }`}
        >
          <CheckCircle size={15} />
          DESPACHAR FACTURA Y COMPROBANTE
        </button>
          </>
        )}
      </div>

      {/* MODAL / OVERLAY: Supervisor Discount Authorization */}
      {showDiscountAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <span>🔑</span> Autorización de Descuento
              </h3>
              <button 
                onClick={() => {
                  setShowDiscountAuthModal(false);
                  setSupervisorPassword('');
                  setDiscountAuthError('');
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <p className="text-[10px] text-gray-400 leading-normal font-sans">
              Se requiere la autorización de un administrador o supervisor para aplicar descuentos a esta factura.
            </p>

            {discountAuthError && (
              <div className="bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg text-red-400 text-[10px] flex items-center gap-1.5 font-mono leading-tight">
                <AlertCircle size={12} className="shrink-0 animate-pulse" />
                <span>{discountAuthError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[9px] text-gray-500 uppercase tracking-wider">Supervisor / Administrador:</label>
                <select
                  value={selectedSupervisorId}
                  onChange={e => setSelectedSupervisorId(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none font-mono"
                >
                  <option value="">-- Seleccionar Supervisor --</option>
                  {(users || []).filter(u => u.role === 'Administrador' || u.permissions?.autorizar_descuentos === true).map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] text-gray-500 uppercase tracking-wider">PIN / Contraseña de Autorización:</label>
                <input
                  type="password"
                  placeholder="Ingrese contraseña"
                  value={supervisorPassword}
                  onChange={e => setSupervisorPassword(e.target.value)}
                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none text-center font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiscountAuthModal(false);
                  setSupervisorPassword('');
                  setDiscountAuthError('');
                }}
                className="flex-1 py-2 bg-slate-900 border border-slate-800 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold font-mono cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const supervisor = (users || []).find(u => u.id === selectedSupervisorId);
                  if (!supervisor) {
                    setDiscountAuthError("Seleccione un supervisor de la lista");
                    return;
                  }
                  if (supervisor.password !== supervisorPassword) {
                    setDiscountAuthError("Contraseña/PIN incorrecto");
                    return;
                  }
                  
                  setDiscountAuthorizedBy(supervisor.fullName);
                  setShowDiscountAuthModal(false);
                  setSupervisorPassword('');
                  setDiscountAuthError('');
                }}
                className="flex-1 py-2 bg-cyber-pink text-black hover:bg-cyber-accent rounded-lg text-[10px] font-bold font-mono cursor-pointer neon-shadow-pink"
              >
                Autorizar
              </button>
            </div>
          </div>
        </div>
      )}
           {/* MODAL / OVERLAY: High-fidelity thermal invoice visualizer */}
      {generatedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print-modal-container">
          <div className={`bg-white text-black p-6 rounded-2xl w-full font-mono text-xs shadow-2xl relative border-4 border-double border-black print-card ${activeTicketTab === 'guide' ? 'max-w-5xl' : 'max-w-sm'}`}>
            
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
                        <React.Fragment key={item.productId}>
                          <tr>
                            <td className="py-1">
                              <span className="font-bold">{item.quantity} {item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : item.unitType === 'l' ? 'L' : 'u'}</span> x {item.productName}
                            </td>
                            <td className="py-1 text-right">
                              ${item.price.toFixed(2)}
                              <span className="text-[8px] text-gray-500">/{item.unitType === 'gr' ? 'g' : item.unitType === 'ml' ? 'ml' : item.unitType === 'l' ? 'L' : 'u'}</span>
                            </td>
                            <td className="py-1 text-right">${item.total.toFixed(2)}</td>
                          </tr>
                          {item.note && (
                            <tr>
                              <td colSpan={3} className="pb-1.5 pl-2 text-[9px] text-gray-600 italic">
                                * Nota: {item.note}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
                {/* GUÍA A4 EDITABLE: solo artículos autorizados */}
                <div className="no-print mb-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-black uppercase">
                      Editar destinatario antes de imprimir
                    </h3>
                    <p className="text-[10px] text-slate-600">
                      Los cambios se aplican inmediatamente a esta guía.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-[10px] font-bold">
                      Nombre o razón social
                      <input
                        type="text"
                        value={generatedInvoice.guideName || generatedInvoice.clientName}
                        onChange={event =>
                          updateGeneratedGuideField('guideName', event.target.value)
                        }
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                      />
                    </label>

                    <label className="text-[10px] font-bold">
                      Documento / NIT
                      <input
                        type="text"
                        value={generatedInvoice.guideRut || generatedInvoice.clientRut}
                        onChange={event =>
                          updateGeneratedGuideField('guideRut', event.target.value)
                        }
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                      />
                    </label>

                    <label className="text-[10px] font-bold">
                      Teléfono
                      <input
                        type="text"
                        value={generatedInvoice.guidePhone || ''}
                        onChange={event =>
                          updateGeneratedGuideField('guidePhone', event.target.value)
                        }
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                      />
                    </label>

                    <label className="text-[10px] font-bold">
                      Dirección completa
                      <input
                        type="text"
                        value={generatedInvoice.guideAddress || ''}
                        onChange={event =>
                          updateGeneratedGuideField('guideAddress', event.target.value)
                        }
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs"
                      />
                    </label>

                    <label className="text-[10px] font-bold md:col-span-2">
                      Observaciones e instrucciones
                      <textarea
                        value={generatedInvoice.guideNotes || ''}
                        onChange={event =>
                          updateGeneratedGuideField('guideNotes', event.target.value)
                        }
                        rows={2}
                        className="mt-1 w-full resize-y rounded border border-slate-300 bg-white p-2 text-xs"
                      />
                    </label>
                  </div>
                </div>

                {!canPrintDispatchGuide ? (
                  <div className="no-print rounded-xl border-2 border-red-600 bg-red-50 p-5 text-red-800">
                    <h3 className="font-black uppercase">
                      Guía bloqueada
                    </h3>
                    <p className="mt-1 text-xs">
                      Todos los artículos deben estar revisados y autorizados
                      expresamente para despacho.
                    </p>

                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                      {guideBlockedItems.map(item => (
                        <li key={item.productId}>
                          {item.productName}: pendiente o restringido
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <article className="dispatch-guide-sheet mx-auto w-full bg-white text-black">
                    <header className="border-b-2 border-black pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase">
                            Guía de despacho
                          </div>
                          <h2 className="text-2xl font-black">
                            G-{generatedInvoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}
                          </h2>
                        </div>

                        <div className="border border-black px-3 py-1 text-[10px] font-bold">
                          COPIA CONTROL
                        </div>
                      </div>
                    </header>

                    <section className="grid grid-cols-[90px_1fr] gap-3 border-b border-black py-3">
                      <div className="flex h-16 items-center justify-center border border-slate-300 text-center text-[9px] font-black">
                        LOGO
                      </div>

                      <div className="text-[10px] leading-tight">
                        <h3 className="text-sm font-black uppercase">
                          {config.companyName}
                        </h3>
                        <div>NIT: {config.rut}</div>
                        <div>{config.address}</div>
                        <div>Teléfono: {config.phone}</div>
                        <div>{config.email}</div>
                      </div>
                    </section>

                    <section className="flex flex-wrap gap-2 border-b border-black py-2 text-[10px]">
                      <div className="border border-black px-2 py-1 font-black uppercase">
                        {generatedInvoice.paymentMethod}
                      </div>
                      <div className="border border-slate-400 bg-slate-50 px-2 py-1">
                        Factura: {generatedInvoice.invoiceNumber}
                      </div>
                      <div className="border border-slate-400 bg-slate-50 px-2 py-1">
                        Fecha: {new Date(generatedInvoice.createdAt).toLocaleDateString()}
                      </div>
                    </section>

                    <section className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
                      <div className="min-h-32 border border-black p-2 text-[10px]">
                        <h3 className="mb-2 font-black uppercase">
                          Destinatario
                        </h3>
                        <div className="font-bold uppercase">
                          {generatedInvoice.guideName || generatedInvoice.clientName}
                        </div>
                        <div>
                          Documento: {generatedInvoice.guideRut || generatedInvoice.clientRut}
                        </div>
                        <div>Teléfono: {generatedInvoice.guidePhone || 'No registrado'}</div>
                        <div className="mt-1">
                          Dirección: {generatedInvoice.guideAddress || 'No registrada'}
                        </div>
                      </div>

                      <div className="min-h-32 border border-black p-2 text-[10px]">
                        <h3 className="mb-2 font-black uppercase">
                          Datos del envío
                        </h3>
                        <div>Remitente: {config.companyName}</div>
                        <div>Responsable: {generatedInvoice.cashierName}</div>
                        <div>
                          Mensajero: {generatedInvoice.deliveryRider || 'Pendiente de asignar'}
                        </div>
                        <div>
                          Modalidad: {
                            generatedInvoice.deliveryMethod === 'cliente'
                              ? 'A cuenta del cliente'
                              : generatedInvoice.deliveryMethod === 'recoge'
                                ? 'Recogida local'
                                : 'Despacho por oficina'
                          }
                        </div>
                        {generatedInvoice.deliveryTransport && (
                          <div>Transporte: {generatedInvoice.deliveryTransport}</div>
                        )}
                        <div>Estado: {generatedInvoice.deliveryStatus}</div>
                      </div>
                    </section>

                    <section className="border border-black">
                      <h3 className="border-b border-black p-2 text-[10px] font-black uppercase">
                        Artículos autorizados
                      </h3>

                      <table className="w-full border-collapse text-left text-[10px]">
                        <thead>
                          <tr className="border-b border-black">
                            <th className="p-2">Artículo</th>
                            <th className="w-24 p-2 text-right">Cantidad</th>
                            <th className="w-24 p-2 text-right">Unidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedInvoice.items.map(item => (
                            <tr key={item.productId} className="border-b border-slate-300 last:border-0">
                              <td className="p-2">
                                <div className="font-bold">{item.productName}</div>
                                {item.note && (
                                  <div className="text-[9px] italic text-slate-600">
                                    {item.note}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-right font-bold">
                                {item.quantity}
                              </td>
                              <td className="p-2 text-right">
                                {item.unitType === 'gr'
                                  ? 'g'
                                  : item.unitType === 'ml'
                                    ? 'ml'
                                    : item.unitType === 'l'
                                      ? 'L'
                                      : 'unidad'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>

                    <section className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2">
                      <div className="min-h-24 border border-black p-2 text-[10px]">
                        <h3 className="mb-2 font-black uppercase">
                          Contenido declarado
                        </h3>
                        <p>
                          {generatedInvoice.items
                            .map(item => `${item.productName} x${item.quantity}`)
                            .join(', ')}
                        </p>
                      </div>

                      <div className="min-h-24 border border-black p-2 text-[10px]">
                        <h3 className="mb-2 font-black uppercase">
                          Nota / instrucciones
                        </h3>
                        <p>{generatedInvoice.guideNotes || 'Sin observaciones.'}</p>
                      </div>
                    </section>

                    <section className="border border-black p-2 text-[10px]">
                      <h3 className="font-black uppercase">Código de guía</h3>
                      <div
                        aria-label={`Código de guía G-${generatedInvoice.invoiceNumber}`}
                        className="mx-auto mt-3 h-14 max-w-sm border-x-8 border-black"
                        style={{
                          background:
                            'repeating-linear-gradient(90deg, #000 0, #000 2px, #fff 2px, #fff 5px)'
                        }}
                      />
                      <div className="mt-1 text-center font-black">
                        G-{generatedInvoice.invoiceNumber.replace(/[^A-Za-z0-9]/g, '')}
                      </div>
                    </section>

                    <section className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="min-h-28 border border-black p-2 text-[10px]">
                        <h3 className="mb-2 font-black uppercase">
                          Políticas operativas
                        </h3>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>Verificar destinatario y estado del paquete.</li>
                          <li>Registrar novedades de la entrega.</li>
                          <li>No entregar a terceros sin autorización.</li>
                        </ul>
                      </div>

                      <div className="min-h-28 border border-black p-2 text-[10px]">
                        <h3 className="mb-3 font-black uppercase">
                          Control de entrega
                        </h3>
                        <div className="mb-3 border-b border-black">Recibe:</div>
                        <div className="mb-3 border-b border-black">Documento:</div>
                        <div className="mb-3 border-b border-black">Fecha:</div>
                        <div className="border-b border-black">Observaciones:</div>
                      </div>
                    </section>
                  </article>
                )}
              </>
            )}

            {/* Action panel inside modal */}
            <div className="flex gap-2 mt-4 border-t border-slate-300 pt-4 no-print">
              <button
                type="button"
                onClick={() => {
                  if (
                    activeTicketTab === 'guide' &&
                    !canPrintDispatchGuide
                  ) {
                    setErrorMsg(
                      "GUÍA BLOQUEADA: Todos los artículos deben estar autorizados para despacho."
                    );
                    return;
                  }

                  handlePrint();
                }}
                disabled={
                  activeTicketTab === 'guide' &&
                  !canPrintDispatchGuide
                }
                aria-disabled={
                  activeTicketTab === 'guide' &&
                  !canPrintDispatchGuide
                }
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
