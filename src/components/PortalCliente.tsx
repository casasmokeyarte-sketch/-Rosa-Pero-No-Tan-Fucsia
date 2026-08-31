import React, { useState, useEffect, useRef, useMemo } from 'react';
import BolsilloCliente, { OfficialBoldButton } from './BolsilloCliente';
import AyudaCliente from './AyudaCliente';
import { BoldCheckout, createDirectBoldPaymentIntent, fetchWallet, getWalletSession, purchaseWithWallet } from '../lib/walletApi';
import { Client, Product, Invoice, InvoiceItem, BusinessConfig, ChatMessage, ChatAttachment, ClientRequest, Discount, FlashMessage, getClientBillingBlockReason } from '../types';
import { playTone, TONE_NAMES } from '../utils/soundService';
import { 
  Truck, 
  ShoppingCart, 
  Package, 
  MessageSquare, 
  LogOut, 
  Search, 
  Check, 
  MapPin, 
  Send, 
  ArrowRight, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  RefreshCw,
  Maximize2,
  Flag,
  Inbox,
  PlusCircle,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  Printer,
  FileText,
  Calendar,
  CircleHelp
} from 'lucide-react';
import AtomBubble from './AtomBubble';

interface PortalClienteProps {
  client: Client;
  products: Product[];
  invoices: Invoice[];
  config: BusinessConfig;
  discounts: Discount[];
  onAddInvoice: (invoice: Invoice) => void;
  onLogout: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (
    clientId: string, 
    text: string, 
    sender: 'client' | 'agent', 
    senderName: string, 
    attachment?: ChatAttachment
  ) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  clientRequests: ClientRequest[];
  onSubmitRequest: (req: ClientRequest) => void;
  onDeleteClient: (clientId: string) => void;
  flashMessages: FlashMessage[];
  flashViews: Record<string, Record<string, number>>;
  onIncrementFlashView: (flashId: string, viewerId: string) => void;
  onUpdateClient: (client: Client) => void;
}

export default function PortalCliente({ 
  client, 
  products, 
  invoices, 
  config, 
  discounts = [],
  onAddInvoice, 
  onLogout,
  chatMessages,
  onSendMessage,
  showToast,
  clientRequests,
  onSubmitRequest,
  onDeleteClient,
  flashMessages = [],
  flashViews = {},
  onIncrementFlashView,
  onUpdateClient
}: PortalClienteProps) {
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'pedido' | 'bolsillo' | 'trayectoria' | 'catalogo' | 'chat' | 'solicitudes' | 'configuracion' | 'historial' | 'ayuda'>('pedido');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  // Sound and Alerter preferences state
  const [chatTone, setChatTone] = useState(client.chatSoundTone || 'Predeterminado');
  const [notifTone, setNotifTone] = useState(client.notifSoundTone || 'Predeterminado');
  const [soundSaveSuccess, setSoundSaveSuccess] = useState(false);

  // Password force change & settings states
  const [mustChangePassword, setMustChangePassword] = useState(client.password === '1234');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Settings voluntary password change states
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState<string | null>(null);
  const [settingsPasswordSuccess, setSettingsPasswordSuccess] = useState(false);

  const handleSettingsPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsPasswordError(null);
    setSettingsPasswordSuccess(false);

    if (!settingsNewPassword.trim()) {
      setSettingsPasswordError("La contraseña no puede estar vacía.");
      return;
    }
    if (settingsNewPassword.trim() === '1234') {
      setSettingsPasswordError("Debe elegir una contraseña diferente a 1234.");
      return;
    }
    if (settingsNewPassword !== settingsConfirmPassword) {
      setSettingsPasswordError("Las contraseñas no coinciden.");
      return;
    }

    const updatedClient: Client = {
      ...client,
      password: settingsNewPassword.trim()
    };
    onUpdateClient(updatedClient);
    setSettingsPasswordSuccess(true);
    setSettingsNewPassword('');
    setSettingsConfirmPassword('');
    setTimeout(() => setSettingsPasswordSuccess(false), 4000);
  };

  const handleRegisterBiometric = async () => {
    try {
      if (!window.PublicKeyCredential) {
        alert("Tu navegador o dispositivo no soporta biometría/Passkeys.");
        return;
      }
      
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: { name: "Rosa Pero No Tan Fucsia" },
          user: {
            id: new TextEncoder().encode(client.id),
            name: client.code || client.rut,
            displayName: client.name
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          }
        }
      };

      const credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential;
      if (credential) {
        const rawId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        const updatedClient: Client = {
          ...client,
          passkeyCredential: {
            id: credential.id,
            rawId: rawId,
            type: credential.type
          }
        };
        onUpdateClient(updatedClient);
        alert("🔒 ¡Sensor biométrico registrado con éxito en este dispositivo!");
      }
    } catch (err: any) {
      console.error(err);
      if (confirm("No se pudo completar el registro biométrico real (esto puede ocurrir en entornos locales HTTP). ¿Desea registrar una credencial biométrica simulada para probar el diseño visual de acceso rápido?")) {
        const updatedClient: Client = {
          ...client,
          passkeyCredential: {
            id: "simulated-passkey-" + Date.now(),
            rawId: "simulated",
            type: "public-key-simulated"
          }
        };
        onUpdateClient(updatedClient);
      }
    }
  };

  const handleRemoveBiometric = () => {
    if (confirm("¿Está seguro de eliminar la llave de acceso biométrica de este dispositivo?")) {
      const updatedClient: Client = {
        ...client,
        passkeyCredential: null
      };
      onUpdateClient(updatedClient);
    }
  };

  // Client Flash message popup modal trigger state
  const [activeFlashPopup, setActiveFlashPopup] = useState<FlashMessage | null>(null);

  // Trigger client advertisement / flash reminder popup on startup or updates
  useEffect(() => {
    const activeFlashes = flashMessages.filter(f => 
      f.active && 
      (f.target === 'clientes' || f.target === 'ambos') &&
      (!f.expiresAt || new Date(f.expiresAt) > new Date())
    );

    const flashToShow = activeFlashes.find(f => {
      const views = (flashViews[f.id]?.[client.id]) || 0;
      return views < f.maxViews;
    });

    if (flashToShow) {
      setActiveFlashPopup(flashToShow);
      onIncrementFlashView(flashToShow.id, client.id);
    }
  }, [client.id, flashMessages]);

  const handleSaveTones = () => {
    const updatedClient: Client = {
      ...client,
      chatSoundTone: chatTone,
      notifSoundTone: notifTone
    };
    onUpdateClient(updatedClient);
    setSoundSaveSuccess(true);
    setTimeout(() => setSoundSaveSuccess(false), 3000);
    showToast("¡Configuración de sonido guardada exitosamente!", "success");
  };

  // Solicitudes form state
  const [reqType, setReqType] = useState<ClientRequest['type']>('Consulta');
  const [reqPriority, setReqPriority] = useState<ClientRequest['priority']>('Media');
  const [reqSubject, setReqSubject] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqSubmitSuccess, setReqSubmitSuccess] = useState(false);

  // Danger Zone state
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [dangerStep, setDangerStep] = useState<0 | 1 | 2>(0);
  const [dangerConfirm, setDangerConfirm] = useState('');

  // Order Cart state
  const [cart, setCart] = useState<{ product: Product; quantity: number; note: string }[]>([]);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  
  // Delivery config for the online order
  const [deliveryRider, setDeliveryRider] = useState('Mensajero Central');
  const [deliveryTransport, setDeliveryTransport] = useState('Motocicleta');
  const [deliveryAddress, setDeliveryAddress] = useState(client.address || 'Hangar Principal de Enlace');

  // Delivery and Payment configurations
  const [deliveryMethod, setDeliveryMethod] = useState<'oficina' | 'cliente' | 'recoge'>('oficina');
  const [paymentOption, setPaymentOption] = useState<'credit' | 'bold' | 'wallet'>('credit');
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'payment'>('cart');
  const [walletCheckoutBalance, setWalletCheckoutBalance] = useState<number | null>(null);
  const [walletCheckoutAmount, setWalletCheckoutAmount] = useState(0);
  const [walletCheckoutLoading, setWalletCheckoutLoading] = useState(false);
  const [walletCheckoutError, setWalletCheckoutError] = useState<string | null>(null);
  const walletPurchaseAttemptRef = useRef<{
    fingerprint: string;
    invoiceId: string;
    invoiceNumber: string;
    idempotencyKey: string;
  } | null>(null);

  const [directBoldCheckout, setDirectBoldCheckout] =
    useState<BoldCheckout | null>(null);
  const [directBoldLoading, setDirectBoldLoading] = useState(false);
  const [directBoldError, setDirectBoldError] = useState<string | null>(null);
  const directBoldAttemptRef = useRef<{
    fingerprint: string;
    invoiceId: string;
    invoiceNumber: string;
    idempotencyKey: string;
  } | null>(null);
  const directBoldAddedInvoicesRef = useRef<Set<string>>(new Set());
  // Filter messages for this client
  const clientChatMessages = chatMessages.filter(msg => msg.clientId === client.id);
  const blockReason = useMemo(() => getClientBillingBlockReason(client, invoices), [client, invoices]);
  const displayMessages = clientChatMessages.length > 0 ? clientChatMessages : [
    {
      id: 'default-welcome',
      clientId: client.id,
      sender: 'agent' as const,
      senderName: 'Agente Neon-Pink',
      text: `Hola, representante de ${client.name}. Conexión encriptada establecida de manera exitosa. ¿En qué podemos colaborar con tu despacho hoy?`,
      timestamp: new Date(Date.now() - 5 * 60000).toISOString()
    }
  ];

  const [userInputMessage, setUserInputMessage] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Search filter for order & catalog
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('Todos');

  // Cart math
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartTax = 0; // IVA de 19% eliminado para compras web
  const deliveryCost = deliveryMethod === 'oficina' ? 15000.00 : 0.00; // Surcharge only applies if delivery is by office

  // Dynamic card payment fee
  const cardFee = 0;

  // Administrator-configured unique client discount (non-cumulative)
  const clientDiscount = useMemo(() => {
    if (!client.specialDiscountPercentage || client.specialDiscountPercentage <= 0) return 0;
    const pct = client.specialDiscountPercentage;
    const isSpecific = client.discountedProductIds && client.discountedProductIds.length > 0;
    
    if (!isSpecific) {
      return cartSubtotal * (pct / 100);
    } else {
      const discountableSum = cart
        .filter(item => client.discountedProductIds?.includes(item.product.id))
        .reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      return discountableSum * (pct / 100);
    }
  }, [client, cart, cartSubtotal]);

  const activeWebPromotion = useMemo(() => {
    if (clientDiscount > 0) return null;

    const now = new Date();
    const day = now.getDay();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return discounts
      .filter(discount => {
        if (!discount.active) return false;
        if (discount.appliesTo !== 'todos' && discount.appliesTo !== 'compras_web') return false;
        if (discount.startDate && now < new Date(`${discount.startDate}T00:00:00`)) return false;
        if (discount.endDate && now > new Date(`${discount.endDate}T23:59:59`)) return false;
        if (discount.startTime && time < discount.startTime) return false;
        if (discount.endTime && time > discount.endTime) return false;
        if (discount.activeDays?.length && !discount.activeDays.includes(day)) return false;
        return true;
      })
      .map(discount => ({
        discount,
        amount: discount.type === 'porcentaje'
          ? Math.min(cartSubtotal, Math.round(cartSubtotal * (discount.value / 100)))
          : Math.min(cartSubtotal, Math.round(discount.value))
      }))
      .sort((a, b) => b.amount - a.amount)[0] ?? null;
  }, [clientDiscount, discounts, cartSubtotal]);

  const generalWebDiscount = activeWebPromotion?.amount ?? 0;
  const effectiveDiscount = clientDiscount > 0 ? clientDiscount : generalWebDiscount;
  const cartTotal = Math.max(0, cartSubtotal - effectiveDiscount) + cartTax + deliveryCost + cardFee;

  const prepareWalletCheckout = async () => {
    setPaymentOption('wallet');
    setWalletCheckoutError(null);
    const token = getWalletSession(client.id);

    if (!token) {
      setWalletCheckoutBalance(null);
      setWalletCheckoutAmount(0);
      setWalletCheckoutError(
        'Primero inicia la sesión segura en Pagar con Bolsillo y luego regresa al carrito.'
      );
      return;
    }

    setWalletCheckoutLoading(true);
    try {
      const result = await fetchWallet(token);
      const balance = Number(result.wallet.balance || 0);
      setWalletCheckoutBalance(balance);
      setWalletCheckoutAmount(Math.min(balance, cartTotal));
    } catch (error) {
      setWalletCheckoutBalance(null);
      setWalletCheckoutAmount(0);
      setWalletCheckoutError(
        error instanceof Error ? error.message : 'No fue posible consultar el saldo.'
      );
    } finally {
      setWalletCheckoutLoading(false);
    }
  };

  const returnToPendingWalletPurchase = () => {
    setActiveTab('pedido');
    setCheckoutStep('payment');
    void prepareWalletCheckout();
  };

  // Auto scroll chat to bottom with rendering yield
  useEffect(() => {
    if (activeTab === 'chat') {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chatMessages, isAgentTyping, activeTab]);

  // Handle client adding to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, { product, quantity: 1, note: '' }];
    });
  };

  // Update cart item quantity
  const updateCartQty = (productId: string, qty: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const finalQty = Math.max(1, Math.min(prod.stock, qty));
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: finalQty } : item));
  };

  // Update cart item custom note
  const updateCartNote = (productId: string, note: string) => {
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, note } : item));
  };

  // Remove item from cart
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Helper to submit the invoice and request to Bunker Portal
  const submitInvoice = (method: string, status: 'Pagado' | 'Pendiente' | 'Orden de Compra') => {
    const invoiceItems: InvoiceItem[] = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      taxAmount: 0,
      total: item.product.price * item.quantity,
      note: item.note
    }));

    const orderNum = `WEB-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalPaymentMethod = method === 'credit' ? 'Crédito' : (method === 'Bold' ? 'Bold' : 'Transferencia');

    const newInvoice: Invoice = {
      id: `inv-client-${Date.now()}`,
      invoiceNumber: orderNum,
      clientId: client.id,
      clientName: client.name,
      clientRut: client.rut,
      items: invoiceItems,
      subtotal: cartSubtotal,
      discount: effectiveDiscount,
      taxRate: 0,
      taxAmount: 0,
      total: cartTotal,
      paymentMethod: finalPaymentMethod,
      paymentStatus: status,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      cashierName: 'Portal Online',
      isDelivery: deliveryMethod !== 'recoge',
      deliveryFee: deliveryCost,
      deliveryRider: deliveryMethod === 'recoge' ? 'N/A' : (deliveryMethod === 'cliente' ? 'Asignado por Cliente' : deliveryRider),
      deliveryTransport: deliveryMethod === 'recoge' ? 'N/A' : deliveryTransport,
      deliveryStatus: 'Pendiente',
      deliveryMethod: deliveryMethod,
      guideAddress: deliveryMethod === 'recoge' ? 'N/A (Retira en Oficina)' : deliveryAddress,
      cardFee: cardFee > 0 ? cardFee : undefined
    };

    onAddInvoice(newInvoice);

    setCart([]);
    setCheckoutStep('cart');
    const msgText = status === 'Pagado' 
      ? `¡COMPRA WEB EXITOSA! Tu orden de compra #${orderNum} por $${cartTotal.toLocaleString('es-CO')} COP ha sido procesada y pagada correctamente.`
      : `¡SOLICITUD EXITOSA! Tu orden de compra #${orderNum} ha sido registrada y está en espera de revisión.`;
    setOrderSuccess(msgText);
    
    // Add auto message to chat about order
    setTimeout(() => {
      onSendMessage(
        client.id,
        `🚨 [NOTIFICACIÓN DEL SISTEMA]: Hemos recibido tu pedido online #${orderNum} por $${cartTotal.toLocaleString('es-CO')} COP. Estado: ${status}. Modalidad: ${
          deliveryMethod === 'recoge' ? 'Retiro en persona' : 'Envío programado'
        }. Pago: ${finalPaymentMethod}. Un asesor preparará tu despacho.`,
        'agent',
        'Asistente Digital'
      );
    }, 1500);

    // Switch view to history
    setTimeout(() => {
      setOrderSuccess(null);
      setActiveTab('historial');
    }, 4500);
  };

  const submitWalletPurchase = async () => {
    const token = getWalletSession(client.id);
    if (!token) {
      setWalletCheckoutError('Primero inicia la sesión segura en Pagar con Bolsillo.');
      return;
    }

    const ineligibleProducts = cart.filter((item) => item.product.walletEligible !== true);
    if (ineligibleProducts.length > 0) {
      setWalletCheckoutError(
        'Uno o más productos todavía no están habilitados para pagar con el Bolsillo.'
      );
      return;
    }

    const requestedAmount = Math.round(Number(walletCheckoutAmount) * 100) / 100;
    const available = walletCheckoutBalance ?? 0;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setWalletCheckoutError('Escribe un monto mayor que cero.');
      return;
    }
    if (requestedAmount > cartTotal || requestedAmount > available) {
      setWalletCheckoutError('El monto no puede superar el total ni el saldo disponible.');
      return;
    }

    setWalletCheckoutLoading(true);
    setWalletCheckoutError(null);

    const fingerprint = JSON.stringify({
      clientId: client.id,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note
      })),
      deliveryMethod,
      deliveryAddress,
      deliveryCost,
      requestedAmount
    });

    let attempt = walletPurchaseAttemptRef.current;
    if (!attempt || attempt.fingerprint !== fingerprint) {
      const invoiceId = `inv-client-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      attempt = {
        fingerprint,
        invoiceId,
        invoiceNumber: `WEB-${Math.floor(100000 + Math.random() * 900000)}`,
        idempotencyKey: `wallet-purchase-${invoiceId}-${crypto.randomUUID()}`
      };
      walletPurchaseAttemptRef.current = attempt;
    }

    try {
      const result = await purchaseWithWallet(token, {
        invoice_id: attempt.invoiceId,
        invoice_number: attempt.invoiceNumber,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          note: item.note
        })),
        delivery_fee: deliveryCost,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        wallet_amount: requestedAmount,
        idempotency_key: attempt.idempotencyKey
      });

      const serverInvoice = result.invoice;
      const newInvoice: Invoice = {
        id: serverInvoice.id,
        invoiceNumber: serverInvoice.invoice_number,
        clientId: serverInvoice.client_id,
        clientName: serverInvoice.client_name,
        clientRut: serverInvoice.client_rut,
        items: serverInvoice.items as InvoiceItem[],
        subtotal: Number(serverInvoice.subtotal),
        discount: Number(serverInvoice.discount),
        taxRate: Number(serverInvoice.tax_rate),
        taxAmount: Number(serverInvoice.tax_amount),
        total: Number(serverInvoice.total),
        paymentMethod: serverInvoice.payment_method,
        paymentStatus: serverInvoice.payment_status as Invoice['paymentStatus'],
        dueDate: serverInvoice.due_date,
        createdAt: serverInvoice.created_at,
        cashierName: serverInvoice.cashier_name,
        isDelivery: serverInvoice.is_delivery,
        deliveryFee: Number(serverInvoice.delivery_fee || 0),
        deliveryRider: deliveryMethod === 'recoge' ? 'N/A' : deliveryRider,
        deliveryTransport: deliveryMethod === 'recoge' ? 'N/A' : deliveryTransport,
        deliveryStatus: 'Pendiente',
        deliveryMethod,
        guideAddress: deliveryMethod === 'recoge' ? 'N/A (Retira en Oficina)' : deliveryAddress,
        walletPaidAmount: Number(serverInvoice.wallet_paid_amount),
        amountDue: Number(serverInvoice.amount_due)
      };

      onAddInvoice(newInvoice);
      walletPurchaseAttemptRef.current = null;
      setCart([]);
      setCheckoutStep('cart');
      setWalletCheckoutBalance(
        Math.max(0, available - Number(result.transaction.amount || requestedAmount))
      );

      const remaining = Number(serverInvoice.amount_due || 0);
      const message = remaining === 0
        ? `Pedido #${serverInvoice.invoice_number} pagado completamente con el Bolsillo.`
        : `Se aplicaron ${requestedAmount.toLocaleString('es-CO')} COP al pedido #${serverInvoice.invoice_number}. Quedan ${remaining.toLocaleString('es-CO')} COP pendientes.`;

      setOrderSuccess(message);
      showToast(message, remaining === 0 ? 'success' : 'info');

      onSendMessage(
        client.id,
        `[BOLSILLO]: Pedido #${serverInvoice.invoice_number}. Aplicado: ${requestedAmount.toLocaleString('es-CO')} COP. Pendiente: ${remaining.toLocaleString('es-CO')} COP.`,
        'agent',
        'Asistente Digital'
      );

      setTimeout(() => {
        setOrderSuccess(null);
        setActiveTab('historial');
      }, 5000);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'No fue posible aplicar el saldo del Bolsillo.';
      setWalletCheckoutError(message);
      showToast(message, 'error');
    } finally {
      setWalletCheckoutLoading(false);
    }
  };

  const prepareDirectBoldPayment = async () => {
    const token = getWalletSession(client.id);

    if (!token) {
      setDirectBoldError(
        'La sesión segura del cliente venció. Cierra sesión e ingresa nuevamente antes de pagar con Bold.'
      );
      return;
    }

    const ineligibleProducts = cart.filter(
      item => item.product.walletEligible !== true
    );

    if (ineligibleProducts.length > 0) {
      setDirectBoldError(
        'Uno o más productos no están autorizados para pago en línea.'
      );
      return;
    }

    const fingerprint = JSON.stringify({
      clientId: client.id,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note
      })),
      deliveryMethod,
      deliveryAddress,
      deliveryCost
    });

    let attempt = directBoldAttemptRef.current;

    if (!attempt || attempt.fingerprint !== fingerprint) {
      const invoiceId =
        `inv-bold-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      attempt = {
        fingerprint,
        invoiceId,
        invoiceNumber:
          `WEB-${Math.floor(100000 + Math.random() * 900000)}`,
        idempotencyKey:
          `web-bold-${invoiceId}-${crypto.randomUUID()}`
      };

      directBoldAttemptRef.current = attempt;
    }

    setDirectBoldLoading(true);
    setDirectBoldError(null);
    setDirectBoldCheckout(null);

    try {
      const result = await createDirectBoldPaymentIntent(token, {
        invoice_id: attempt.invoiceId,
        invoice_number: attempt.invoiceNumber,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          note: item.note
        })),
        delivery_fee: deliveryCost,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        idempotency_key: attempt.idempotencyKey
      });

      setDirectBoldCheckout(result.checkout);

      if (!directBoldAddedInvoicesRef.current.has(result.invoice.id)) {
        const serverInvoice = result.invoice;

        const newInvoice: Invoice = {
          id: serverInvoice.id,
          invoiceNumber: serverInvoice.invoice_number,
          clientId: serverInvoice.client_id,
          clientName: serverInvoice.client_name,
          clientRut: serverInvoice.client_rut,
          items: serverInvoice.items as InvoiceItem[],
          subtotal: Number(serverInvoice.subtotal),
          discount: Number(serverInvoice.discount),
          taxRate: Number(serverInvoice.tax_rate),
          taxAmount: Number(serverInvoice.tax_amount),
          total: Number(serverInvoice.total),
          paymentMethod: 'Bold',
          paymentStatus: 'Pendiente',
          dueDate: serverInvoice.due_date,
          createdAt: serverInvoice.created_at,
          cashierName: serverInvoice.cashier_name,
          isDelivery: serverInvoice.is_delivery,
          deliveryFee: Number(serverInvoice.delivery_fee || 0),
          deliveryRider:
            deliveryMethod === 'recoge' ? 'N/A' : deliveryRider,
          deliveryTransport:
            deliveryMethod === 'recoge' ? 'N/A' : deliveryTransport,
          deliveryStatus: 'Pendiente',
          deliveryMethod,
          guideAddress:
            deliveryMethod === 'recoge'
              ? 'N/A (Retira en Oficina)'
              : deliveryAddress,
          walletPaidAmount: 0,
          amountDue: Number(
            serverInvoice.amount_due ?? serverInvoice.total
          )
        };

        onAddInvoice(newInvoice);
        directBoldAddedInvoicesRef.current.add(result.invoice.id);
      }

      showToast(
        'Orden creada como pendiente. Continúa con el botón oficial de Bold.',
        'info'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible preparar el pago directo con Bold.';

      setDirectBoldError(message);
      showToast(message, 'error');
    } finally {
      setDirectBoldLoading(false);
    }
  };
  // Submit client online order checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || walletCheckoutLoading || directBoldLoading) return;

    if (paymentOption === 'credit') {
      const availableCredit = client.creditLimit - client.outstandingBalance;
      if (cartTotal > availableCredit) {
        showToast("Cupo de crédito insuficiente para esta orden corporativa.", "error");
        return;
      }
      submitInvoice('Crédito', 'Pendiente');
      return;
    }

    if (paymentOption === 'wallet') {
      await submitWalletPurchase();
      return;
    }

    await prepareDirectBoldPayment();
  };

  // Send message chat simulation
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInputMessage.trim()) return;

    onSendMessage(
      client.id,
      userInputMessage.trim(),
      'client',
      client.name
    );
    
    const inputCopy = userInputMessage.trim().toLowerCase();
    setUserInputMessage('');
    setIsAgentTyping(true);

    // Dynamic responses representing cyberpunk characters
    setTimeout(() => {
      let replyText = '';
      if (inputCopy.includes('pedido') || inputCopy.includes('despacho') || inputCopy.includes('orden')) {
        replyText = `Entendido. Verificamos que tu cuenta registra ${invoices.filter(i => i.clientId === client.id).length} remisiones en base de datos. Si acabas de emitir una orden online, su estatus está como 'Pendiente' y el domiciliario asignado procederá de inmediato.`;
      } else if (inputCopy.includes('precio') || inputCopy.includes('costo') || inputCopy.includes('stock') || inputCopy.includes('inventario')) {
        replyText = `El inventario operativo está sincronizado con el búnker de carga en tiempo real. Puedes consultar la pestaña 'Stock e Insumos' para ver cantidades exactas antes de consolidar el pedido.`;
      } else if (inputCopy.includes('hola') || inputCopy.includes('buenos') || inputCopy.includes('saludos')) {
        replyText = `Conexión establecida con éxito. Aquí reporta el Agente Neon-Pink. Listo para agilizar la logística de tus pedidos corporativos. ¿Hay algún requerimiento especial con la ruta de hoy?`;
      } else if (inputCopy.includes('demora') || inputCopy.includes('tarde') || inputCopy.includes('retraso')) {
        replyText = `Nuestras unidades de transporte blindado y motocicletas cibernéticas operan bajo el protocolo de máxima prioridad. Por favor verifica la pestaña 'Trayectoria' para monitorear el estado 'En Camino' del mensajero.`;
      } else {
        replyText = `Solicitud procesada por los servidores de Rosa Fuerte S.A.S. Tomamos nota de tu mensaje. Procederemos a coordinar con la tripulación para brindarte el soporte prioritario que requiere tu facción.`;
      }

      onSendMessage(
        client.id,
        replyText,
        'agent',
        'Agente Neon-Pink'
      );
      setIsAgentTyping(false);
    }, 1500);
  };

  // Get active deliveries for this client
  const clientDeliveries = invoices.filter(inv => inv.clientId === client.id && inv.isDelivery);

  // Filtered available products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(catalogSearch.toLowerCase()) || p.code.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCat = catalogCategory === 'Todos' || p.category === catalogCategory;
    return matchesSearch && matchesCat;
  });

  if (mustChangePassword) {
    const handleForceChangePassword = (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);

      if (!newPassword.trim()) {
        setPasswordError("La contraseña no puede estar vacía.");
        return;
      }
      if (newPassword.trim() === '1234') {
        setPasswordError("Debe elegir una contraseña diferente a la clave de apertura temporal (1234).");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPasswordError("Las contraseñas no coinciden. Verifique e intente de nuevo.");
        return;
      }

      const updatedClient: Client = {
        ...client,
        password: newPassword.trim()
      };
      onUpdateClient(updatedClient);
      showToast("🔒 ¡Contraseña actualizada con éxito! Bienvenido al portal.", "success");
      setMustChangePassword(false);
    };

    return (
      <div className="min-h-screen bg-cyber-bg text-gray-200 font-sans flex items-center justify-center relative overflow-hidden scanlines p-4">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-[0.12] mix-blend-lighten"
          style={{ backgroundImage: `url('/images/logo_cyberpunk_1783131526095.jpg')` }}
        ></div>

        <div className="bg-cyber-card/95 border border-cyber-border rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6 relative z-10 shadow-2xl neon-shadow-pink font-mono text-xs">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-cyber-pink/20 border border-cyber-pink/40 flex items-center justify-center mx-auto text-cyber-pink text-xl animate-pulse">🔒</div>
            <h2 className="text-sm font-black text-white tracking-widest uppercase">CAMBIO OBLIGATORIO DE CONTRASEÑA</h2>
            <p className="text-[9px] text-gray-400">Por motivos de seguridad, debe cambiar la contraseña de apertura antes de ingresar por primera vez.</p>
          </div>

          <form onSubmit={handleForceChangePassword} className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1">
              <p className="text-[10px] text-gray-500"><strong>Código Único de Cliente:</strong></p>
              <p className="text-sm font-bold text-white tracking-wider">{client.code || 'N/D'}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Nueva Contraseña Personal:</label>
              <input
                type="password"
                placeholder="Escribe tu nueva clave personal..."
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordError(null); }}
                className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink tracking-wide font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Confirmar Contraseña:</label>
              <input
                type="password"
                placeholder="Repite tu nueva clave personal..."
                value={confirmNewPassword}
                onChange={e => { setConfirmNewPassword(e.target.value); setPasswordError(null); }}
                className="bg-cyber-bg border border-cyber-border text-white text-xs p-3 rounded-lg w-full focus:outline-none glow-border-pink tracking-wide font-mono"
                required
              />
            </div>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-red-400 text-[10px] leading-relaxed font-sans">
                🚨 {passwordError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="submit"
                className="py-3 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent font-bold font-mono text-xs transition-all cursor-pointer neon-shadow-pink"
              >
                CAMBIAR Y ENTRAR
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-gray-400 hover:text-white font-bold font-mono text-xs transition-all cursor-pointer"
              >
                CERRAR SESIÓN
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-gray-200 font-sans flex flex-col relative overflow-x-hidden scanlines">
      {blockReason && activeTab !== 'chat' && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-cyber-card border-2 border-red-500 rounded-3xl max-w-md w-full p-6 text-center space-y-5 relative shadow-[0_0_50px_rgba(239,68,68,0.25)] font-mono">
            <div className="text-5xl text-red-500 animate-pulse">🛑</div>
            <div>
              <h2 className="text-sm font-black text-red-500 tracking-widest uppercase">
                CUENTA SUSPENDIDA / BLOQUEADA
              </h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Estimado cliente, los servidores de Rosa Fuerte han suspendido temporalmente la facturación y los despachos online de tu facción debido al siguiente reporte de riesgo:
              </p>
            </div>
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 text-[10px] text-red-400 leading-normal text-left font-bold bg-black/50">
              {blockReason}
            </div>
            <p className="text-[9px] text-gray-500">
              Para restablecer tu conexión operativa, comunícate con la central de soporte o realiza tus abonos correspondientes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('chat')}
                className="flex-1 py-2.5 bg-cyber-pink hover:bg-cyber-accent text-black font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md neon-shadow-pink uppercase"
              >
                💬 Hablar con Soporte
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-gray-400 font-bold text-xs rounded-xl cursor-pointer transition-all border border-slate-800 uppercase"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Background visual art element */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-[0.10] mix-blend-lighten"
        style={{ backgroundImage: `url('/images/logo_cyberpunk_1783131526095.jpg')` }}
      ></div>

      {/* Cyber Grid pattern */}
      <div className="absolute inset-0 cyber-grid pointer-events-none opacity-20"></div>

      {/* TOP HEADER */}
      <header className="bg-cyber-card/90 border-b border-cyber-border py-4 px-6 flex justify-between items-center z-40 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-cyber-pink">
            <img 
              src="/images/logo_cyberpunk_1783131526095.jpg" 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-widest font-mono uppercase flex items-center gap-1">
              ROSA FUERTE <span className="text-cyber-pink text-xs font-bold">[CLIENT PORTAL]</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider">
              Autenticado como: <span className="text-cyber-pink font-bold">{client.name}</span> <span className="text-gray-500 font-mono text-[9px]">({client.code || 'N/D'})</span>
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1 bg-cyber-pink/10 border border-cyber-pink/20 text-cyber-pink px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest animate-pulse">
            <Sparkles size={10} /> Conexión Segura SSL-Cyber
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-400 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer hover:neon-shadow-red"
          >
            <LogOut size={13} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER CONTENT WITH SIDEBAR */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
        
        {/* CLIENT INFO & TABS NAVIGATION SIDEBAR */}
        <div className="lg:col-span-1 space-y-5">
          
          {/* CLIENT FILE CARD */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-cyber-pink text-black font-mono font-extrabold text-[9px] px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
              CLIENTE VIP
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-[9px] text-gray-500 font-mono block uppercase">CÓDIGO ÚNICO DE CLIENTE</span>
                <span className="text-xs font-mono font-bold text-cyber-pink select-all">{client.code || 'N/D'}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 font-mono block uppercase">RUT/NIT IDENTIDAD</span>
                <span className="text-xs font-mono font-bold text-white">{client.rut}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 font-mono block uppercase">RAZÓN SOCIAL</span>
                <span className="text-sm font-extrabold text-white">{client.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3 text-[11px] font-mono">
                <div>
                  <span className="text-[9px] text-gray-500 block">LÍMITE CRÉDITO</span>
                  <span className="text-white font-bold text-xs">${client.creditLimit.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 block">DEUDA CARTERA</span>
                  <span className="text-cyber-pink font-bold text-xs">${client.outstandingBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-slate-800/80 pt-3 text-[10px] space-y-1 text-gray-400">
                <div>📍 <strong>Ubicación:</strong> {client.address || 'Hangar Central'}</div>
                <div>📞 <strong>Teléfono:</strong> {client.phone}</div>
                <div>✉️ <strong>Email:</strong> {client.email}</div>
              </div>
            </div>
          </div>

          {/* SIDEBAR NAVIGATION BUTTONS */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-2 space-y-1.5 font-mono">
            <button
              onClick={() => setActiveTab('pedido')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'pedido'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <ShoppingCart size={15} />
              <span>HACER PEDIDO ONLINE</span>
            </button>

            <button
              onClick={() => setActiveTab('bolsillo')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'bolsillo'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <span className="text-base">👛</span>
              <span>MI BOLSILLO Y NFC</span>
            </button>

            <button
              onClick={() => setActiveTab('trayectoria')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'trayectoria'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Truck size={15} />
              <span>TRAYECTORIA DOMICILIO</span>
              {clientDeliveries.filter(d => d.deliveryStatus === 'En Camino').length > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('catalogo')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'catalogo'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Package size={15} />
              <span>STOCK Y PRODUCTOS</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer relative ${
                activeTab === 'chat'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <MessageSquare size={15} />
              <span>CHAT CON OPERADORES</span>
            </button>

            <button
              onClick={() => setActiveTab('solicitudes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'solicitudes'
                  ? 'bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Inbox size={15} />
              <span>SUGERENCIAS Y RECLAMOS</span>
              {clientRequests.filter(r => r.status === 'Resuelto').length > 0 && (
                <span className="ml-auto bg-cyber-green text-black text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {clientRequests.filter(r => r.status === 'Resuelto').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('historial')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'historial'
                  ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Clock size={15} />
              <span>MI HISTORIAL / ÓRDENES</span>
            </button>

            <button
              onClick={() => setActiveTab('ayuda')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'ayuda'
                  ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <CircleHelp size={15} />
              <span>CÓMO USAR LA APP</span>
            </button>

            <button
              onClick={() => setActiveTab('configuracion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === 'configuracion'
                  ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/30 shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <span>🔊</span>
              <span>AJUSTES DE TONO</span>
            </button>
          </div>

          {/* ── ZONA DE PELIGRO ── */}
          <div className="bg-red-950/20 border border-red-500/20 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowDangerZone(p => !p); setDangerStep(0); setDangerConfirm(''); }}
              className="w-full flex items-center justify-between px-4 py-3 text-red-400 hover:text-red-300 text-xs font-bold font-mono transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2"><ShieldAlert size={14} /> ZONA DE PELIGRO</span>
              <ChevronDown size={13} className={`transition-transform ${showDangerZone ? 'rotate-180' : ''}`} />
            </button>

            {showDangerZone && (
              <div className="px-4 pb-4 space-y-3 border-t border-red-500/20 pt-3">
                {dangerStep === 0 && (
                  <>
                    <p className="text-[10px] text-red-300/80 font-mono leading-relaxed">
                      Esta acción <strong>eliminará tu cuenta</strong> del sistema, borrará todos tus datos locales y desinstalará la app del dispositivo. Es <strong>irreversible</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDangerStep(1)}
                      className="w-full py-2 bg-red-900/40 hover:bg-red-900/70 border border-red-500/40 text-red-400 text-[10px] font-bold font-mono rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} /> Eliminar mi cuenta y datos
                    </button>
                  </>
                )}

                {dangerStep === 1 && (
                  <>
                    <p className="text-[10px] text-red-300 font-mono leading-relaxed">
                      Escribe <strong className="text-white">ELIMINAR</strong> para confirmar:
                    </p>
                    <input
                      type="text"
                      value={dangerConfirm}
                      onChange={e => setDangerConfirm(e.target.value)}
                      placeholder="ELIMINAR"
                      className="w-full bg-red-950/40 border border-red-500/50 p-2 rounded-lg text-white text-xs font-mono focus:outline-none tracking-widest text-center uppercase"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setDangerStep(0); setDangerConfirm(''); }}
                        className="py-2 bg-slate-900 border border-slate-700 text-gray-400 text-[10px] font-mono rounded-lg cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={dangerConfirm.trim().toUpperCase() !== 'ELIMINAR'}
                        onClick={async () => {
                          // 1. Delete client from system
                          onDeleteClient(client.id);
                          // 2. Clear all localStorage
                          localStorage.clear();
                          // 3. Unregister service workers & clear caches
                          if ('serviceWorker' in navigator) {
                            const regs = await navigator.serviceWorker.getRegistrations();
                            for (const reg of regs) await reg.unregister();
                          }
                          if ('caches' in window) {
                            const keys = await caches.keys();
                            for (const key of keys) await caches.delete(key);
                          }
                          // 4. Reload → clean state
                          window.location.reload();
                        }}
                        className="py-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed border border-red-500 text-white text-[10px] font-bold font-mono rounded-lg cursor-pointer transition-all"
                      >
                        ⚠️ Confirmar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        {/* CENTRAL PANEL PORTLET (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-6">

          {/* CLIENT HELP CENTER */}
          {activeTab === 'ayuda' && (
            <AyudaCliente onNavigate={setActiveTab} />
          )}

          {/* SECURE WALLET VIEW */}
          {activeTab === 'bolsillo' && (
            <BolsilloCliente
              client={client}
              hasPendingPurchase={cart.length > 0}
              onContinuePurchase={returnToPendingWalletPurchase}
            />
          )}
          
          {/* ORDER ONLINE SUB-VIEW */}
          {activeTab === 'pedido' && (
            <div className="space-y-6">
              
              <div className="bg-gradient-to-r from-cyber-pink/10 to-transparent p-4 rounded-xl border border-cyber-pink/20">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <ShoppingCart className="text-cyber-pink animate-pulse" size={18} />
                  SISTEMA DE PEDIDO ONLINE EXTREMO
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Agregue insumos de la base de datos al carrito de despacho y solicite transporte inmediato. El cobro se debitará automáticamente de su cupo corporativo.
                </p>
              </div>

              {orderSuccess && (
                <div className="bg-cyber-green/10 border border-cyber-green/30 p-4 rounded-xl text-cyber-green font-mono text-xs flex items-center gap-2.5 animate-bounce">
                  <CheckCircle2 size={16} />
                  <span>{orderSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                
                {/* SELECTOR DE PRODUCTOS (Left 3 columns) */}
                <div className="md:col-span-3 space-y-4">
                  <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-cyber-border">
                    <Search className="text-gray-500" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar por código o insumo..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="bg-transparent border-none text-white text-xs focus:outline-none w-full font-mono"
                    />
                  </div>

                  {/* PRODUCTS MINI LIST */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {filteredProducts.map(prod => {
                      const isLowStock = prod.stock <= prod.minStock;
                      const hasItemsInCart = cart.find(c => c.product.id === prod.id);

                      return (
                        <div 
                          key={prod.id} 
                          className={`bg-cyber-card border rounded-xl p-3 flex flex-col justify-between hover:scale-[1.01] transition-all relative ${
                            isLowStock ? 'border-amber-500/20 hover:border-amber-500/50' : 'border-cyber-border hover:border-cyber-pink/50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <span className="text-[8px] font-mono text-gray-500 block">{prod.code}</span>
                              <h3 className="text-xs font-bold text-white font-sans line-clamp-2 mt-0.5">{prod.name}</h3>
                              <span className="text-[9px] text-cyber-pink font-mono block mt-1">{prod.category}</span>
                              {prod.note && (
                                <div className="text-[8px] text-amber-400 font-mono mt-1 flex items-start gap-1 bg-amber-950/20 px-1.5 py-1 rounded border border-amber-500/20 max-w-[200px]">
                                  <span className="shrink-0">⚠️</span>
                                  <span className="line-clamp-2" title={prod.note}>{prod.note}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xl bg-slate-900 w-8 h-8 rounded-lg flex items-center justify-center border border-slate-800 shrink-0">{prod.imageUrl || '📦'}</span>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-2">
                            <div>
                              <span className="text-[10px] text-gray-400 font-mono">P.U: </span>
                              <span className="text-xs font-extrabold text-white font-mono">${prod.price.toFixed(2)}</span>
                            </div>

                            <div className="text-right">
                              {prod.stock > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(prod)}
                                  className={`px-2 py-1 rounded text-[9px] font-bold font-mono uppercase cursor-pointer flex items-center gap-1 transition-all ${
                                    hasItemsInCart 
                                      ? 'bg-cyber-pink/10 text-cyber-pink border border-cyber-pink/30' 
                                      : 'bg-cyber-pink text-black hover:bg-cyber-accent'
                                  }`}
                                >
                                  <span>{hasItemsInCart ? `AGREGADO (${hasItemsInCart.quantity})` : '+ AGREGAR'}</span>
                                </button>
                              ) : (
                                <span className="text-red-500 text-[9px] font-mono font-bold bg-red-950/20 px-2 py-0.5 rounded border border-red-500/10">AGOTADO</span>
                              )}
                            </div>
                          </div>

                          {/* Stock amount tooltip */}
                          <div className="absolute top-2.5 right-2.5">
                            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-extrabold ${
                              isLowStock ? 'bg-amber-400/10 text-amber-400' : 'bg-cyber-green/10 text-cyber-green'
                            }`}>
                              Cant: {prod.stock}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div className="col-span-full py-12 text-center text-gray-500 font-mono text-xs">
                        No hay productos disponibles con el criterio de búsqueda.
                      </div>
                    )}
                  </div>
                </div>

                {/* RESUMEN DEL CARRITO & ENVÍO (Right 2 columns Step-by-Step Wizard) */}
                <form onSubmit={handleCheckoutSubmit} className="md:col-span-2 bg-cyber-card border border-cyber-border rounded-xl p-4 flex flex-col justify-between space-y-4 min-h-[400px]">
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    
                    {/* Wizard Steps indicator */}
                    <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 uppercase border-b border-cyber-border pb-2.5">
                      <span className={checkoutStep === 'cart' ? 'text-cyber-pink font-extrabold' : ''}>1. Carrito</span>
                      <ChevronRight size={10} className="text-gray-600" />
                      <span className={checkoutStep === 'shipping' ? 'text-cyber-pink font-extrabold' : ''}>2. Despacho</span>
                      <ChevronRight size={10} className="text-gray-600" />
                      <span className={checkoutStep === 'payment' ? 'text-cyber-pink font-extrabold' : ''}>3. Pago</span>
                    </div>

                    {/* STEP 1: CART SUMMARY */}
                    {checkoutStep === 'cart' && (
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-white tracking-widest font-mono uppercase pb-1 flex items-center gap-1.5">
                            <ShoppingCart size={13} className="text-cyber-pink" />
                            Carrito de Carga
                          </h3>

                          {cart.length === 0 ? (
                            <div className="py-12 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center gap-2">
                              <ShoppingCart size={22} className="text-gray-600 animate-bounce" />
                              <span>El carrito está vacío. Agregue insumos de la lista.</span>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              {cart.map(item => (
                                <div key={item.product.id} className="flex flex-col gap-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                                  <div className="flex justify-between items-center">
                                    <div className="max-w-[120px] truncate">
                                      <span className="text-[8px] text-gray-500 block">{item.product.code}</span>
                                      <span className="font-bold text-white block truncate">{item.product.name}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      <input 
                                        type="number" 
                                        value={item.quantity}
                                        onChange={e => updateCartQty(item.product.id, parseInt(e.target.value) || 1)}
                                        className="w-10 bg-cyber-bg border border-slate-800 text-center text-xs text-white p-1 rounded focus:outline-none font-mono"
                                        min="1"
                                        max={item.product.stock}
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => removeFromCart(item.product.id)}
                                        className="text-red-400 hover:text-red-300 px-1 font-bold cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <span className="font-extrabold text-white text-right">${(item.product.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                  
                                  {/* Custom item note */}
                                  <div className="flex items-center gap-1.5 w-full">
                                    <span className="text-[8px] text-cyber-pink font-bold uppercase tracking-wider shrink-0">Nota:</span>
                                    <input 
                                      type="text"
                                      placeholder="P. ej. empaque original, etc."
                                      value={item.note || ''}
                                      onChange={e => updateCartNote(item.product.id, e.target.value)}
                                      className="flex-1 bg-cyber-bg border border-slate-850 px-2 py-0.5 rounded text-[10px] text-white focus:outline-none focus:border-cyber-pink font-mono"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {cart.length > 0 && (
                          <div className="pt-4 mt-auto">
                            <div className="flex justify-between text-xs font-mono text-gray-400 border-t border-slate-800/80 pt-2 mb-3">
                              <span>Subtotal Parcial:</span>
                              <span className="text-white font-extrabold">${cartSubtotal.toLocaleString('es-CO')} COP</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCheckoutStep('shipping')}
                              className="w-full py-2.5 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent font-bold tracking-wider font-mono text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              Siguiente: Despacho <ArrowRight size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 2: SHIPPING METHOD */}
                    {checkoutStep === 'shipping' && (
                      <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                            <span>📦</span> Modalidad de Entrega
                          </h4>
                          
                          <div className="grid grid-cols-3 gap-1">
                            {(['oficina', 'cliente', 'recoge'] as const).map(method => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setDeliveryMethod(method)}
                                className={`py-2 rounded-lg border text-[9px] font-bold transition-all text-center cursor-pointer uppercase ${
                                  deliveryMethod === method
                                    ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink'
                                    : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                                }`}
                              >
                                {method === 'oficina' ? 'Oficina' : (method === 'cliente' ? 'Propia' : 'Retiro')}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-3 font-mono text-[11px] pt-1">
                            {deliveryMethod !== 'recoge' && (
                              <div className="space-y-1">
                                <label className="block text-[9px] text-gray-400 uppercase tracking-wider">📍 Dirección de Despacho:</label>
                                <input 
                                  type="text" 
                                  value={deliveryAddress}
                                  onChange={e => setDeliveryAddress(e.target.value)}
                                  className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink font-sans text-xs"
                                  placeholder="Ingrese dirección destino..."
                                  required
                                />
                              </div>
                            )}

                            {deliveryMethod === 'oficina' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Transporte:</label>
                                  <select 
                                    value={deliveryTransport}
                                    onChange={e => setDeliveryTransport(e.target.value)}
                                    className="bg-cyber-bg border border-cyber-border text-white text-xs p-2 rounded-lg w-full focus:outline-none glow-border-pink text-xs"
                                  >
                                    <option value="Motocicleta">🏍️ Motocicleta</option>
                                    <option value="Bicicleta">🚲 Bicicleta</option>
                                    <option value="Automóvil">🚗 Automóvil</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] text-gray-400 uppercase tracking-wider">Tarifa Envío:</label>
                                  <div className="bg-slate-900 border border-slate-800 text-white text-xs p-2 rounded-lg w-full text-center font-bold">
                                    $15.000 COP
                                  </div>
                                </div>
                              </div>
                            )}
                            {effectiveDiscount > 0 && (
                              <div className="flex justify-between text-cyber-green">
                                <span>
                                  {clientDiscount > 0
                                    ? `Descuento especial (${client.specialDiscountPercentage}%)`
                                    : `Promoción: ${activeWebPromotion?.discount.name}`}
                                </span>
                                <span className="font-bold">-${effectiveDiscount.toLocaleString('es-CO')} COP</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setCheckoutStep('cart')}
                            className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-gray-400 hover:text-white text-xs font-mono font-bold cursor-pointer"
                          >
                            Atrás
                          </button>
                          <button
                            type="button"
                            disabled={deliveryMethod !== 'recoge' && !deliveryAddress.trim()}
                            onClick={() => setCheckoutStep('payment')}
                            className="py-2.5 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-mono font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            Continuar <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: PAYMENT METHOD */}
                    {checkoutStep === 'payment' && (
                      <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                            <span>💳</span> Pasarela de Pago
                          </h4>
                          
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPaymentOption('credit')}
                              className={`py-2 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer uppercase ${
                                paymentOption === 'credit'
                                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink'
                                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              Cupo de Crédito
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentOption('bold')}
                              className={`py-2 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer uppercase ${
                                paymentOption === 'bold'
                                  ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink'
                                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              Recargar con Bold
                            </button>
                            <button
                              type="button"
                              onClick={prepareWalletCheckout}
                              className={`py-2 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer uppercase ${
                                paymentOption === 'wallet'
                                  ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                                  : 'bg-slate-900 border-slate-800 text-gray-400 hover:text-white'
                              }`}
                            >
                              Pagar con Bolsillo
                            </button>
                          </div>

                          {paymentOption === 'credit' && (
                            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-[10px] font-mono flex justify-between">
                              <span className="text-gray-500">Cupo Disponible:</span>
                              <span className="text-white font-bold">${(client.creditLimit - client.outstandingBalance).toLocaleString('es-CO')} COP</span>
                            </div>
                          )}

                          {paymentOption === 'wallet' && (
                            <div className="space-y-2">
                              <div className="bg-cyan-500/10 border border-cyan-500/25 p-3 rounded-xl space-y-2">
                                <div className="flex justify-between text-[10px] font-mono">
                                  <span className="text-cyan-100">Saldo disponible:</span>
                                  <span className="font-bold text-white">
                                    {walletCheckoutBalance === null
                                      ? 'Sesión pendiente'
                                      : `${walletCheckoutBalance.toLocaleString('es-CO')} COP`}
                                  </span>
                                </div>
                                {walletCheckoutBalance !== null && (
                                  <>
                                    <label className="block text-[9px] text-gray-300 uppercase tracking-wider">
                                      Monto que deseas aplicar
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      step="0.01"
                                      max={Math.min(walletCheckoutBalance, cartTotal)}
                                      value={walletCheckoutAmount || ''}
                                      onChange={(event) =>
                                        setWalletCheckoutAmount(Number(event.target.value))
                                      }
                                      className="w-full bg-slate-950 border border-cyan-400/30 rounded-lg p-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-300"
                                    />
                                    <div className="flex justify-between text-[10px] font-mono">
                                      <span className="text-gray-400">Quedaría pendiente:</span>
                                      <span className="font-bold text-amber-200">
                                        ${Math.max(0, cartTotal - Number(walletCheckoutAmount || 0)).toLocaleString('es-CO')} COP
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {walletCheckoutError && (
                                <div className="bg-red-500/10 border border-red-500/25 text-red-200 p-2.5 rounded-lg text-[10px] leading-relaxed">
                                  {walletCheckoutError}
                                </div>
                              )}

                              {!getWalletSession(client.id) && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('bolsillo')}
                                  className="w-full py-2 rounded-lg border border-cyan-400/30 text-cyan-200 text-[10px] font-bold"
                                >
                                  DESBLOQUEAR BOLSILLO PARA PAGAR
                                </button>
                              )}
                            </div>
                          )}

                          {/* Cost Breakdown */}
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 font-mono text-[10px]">
                            <div className="flex justify-between">
                              <span>Subtotal Insumos:</span>
                              <span className="text-white">${cartSubtotal.toLocaleString('es-CO')} COP</span>
                            </div>
                            <div className="flex justify-between">
                              <span>IVA (0%):</span>
                              <span className="text-white">$0 COP</span>
                            </div>
                            {deliveryMethod === 'oficina' && (
                              <div className="flex justify-between text-cyber-orange">
                                <span>Recargo Domicilio:</span>
                                <span className="font-bold">+$15.000 COP</span>
                              </div>
                            )}
                            {cardFee > 0 && paymentOption === 'bold' && (
                              <div className="flex justify-between text-cyber-pink">
                                <span>Comisión Tarjeta ({config.cardFeePercentage}%):</span>
                                <span className="font-bold">+${cardFee.toLocaleString('es-CO')} COP</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-1.5 text-xs text-white font-extrabold">
                              <span>TOTAL A LIQUIDAR:</span>
                              <span className="text-cyber-pink">${cartTotal.toLocaleString('es-CO')} COP</span>
                            </div>
                          </div>
                        </div>

                        {/* Payments are confirmed only by server-side flows. */}
                        <div className="space-y-3 pt-2 border-t border-slate-800/80">
                          {paymentOption === 'bold' ? (
                            <div className="space-y-3">
                              <div className="bg-cyan-500/10 border border-cyan-500/25 p-3 rounded-xl text-[10px] text-cyan-100 leading-relaxed">
                                Bold paga esta factura directamente. No utiliza ni descuenta el saldo del Bolsillo. La factura solo cambia a Pagado cuando llega la confirmación segura del webhook.
                              </div>

                              {directBoldError && (
                                <div className="bg-red-500/10 border border-red-500/25 text-red-200 p-2.5 rounded-lg text-[10px] leading-relaxed">
                                  {directBoldError}
                                </div>
                              )}

                              {directBoldCheckout ? (
                                <div className="space-y-3">
                                  <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl text-[10px] text-amber-100 leading-relaxed">
                                    La orden quedó Pendiente. Continúa con el botón oficial para pagar directamente con Bold.
                                  </div>
                                  <OfficialBoldButton checkout={directBoldCheckout} />
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCheckoutStep('shipping')}
                                    className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-gray-400 hover:text-white text-xs font-mono font-bold cursor-pointer"
                                  >
                                    Atrás
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={directBoldLoading}
                                    className="py-2.5 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-mono font-bold cursor-pointer neon-shadow-pink disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {directBoldLoading
                                      ? 'PREPARANDO...'
                                      : 'PAGAR DIRECTO CON BOLD'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setCheckoutStep('shipping')}
                                className="py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-gray-400 hover:text-white text-xs font-mono font-bold cursor-pointer"
                              >
                                Atrás
                              </button>
                              <button
                                type="submit"
                                disabled={
                                  walletCheckoutLoading ||
                                  (paymentOption === 'wallet' && (
                                    walletCheckoutBalance === null ||
                                    walletCheckoutAmount <= 0
                                  ))
                                }
                                className="py-2.5 rounded-xl bg-cyber-pink text-black hover:bg-cyber-accent text-xs font-mono font-bold cursor-pointer neon-shadow-pink disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {walletCheckoutLoading
                                  ? 'PROCESANDO...'
                                  : paymentOption === 'wallet'
                                  ? 'PAGAR Y CONTINUAR'
                                  : 'CONFIRMAR Y DESPACHAR ORDEN'}
                              </button>
                            </div>
                          )}
                          <p className="text-[9px] text-amber-200/80 leading-relaxed">
                            El saldo del Bolsillo no reemplaza validaciones legales, de identidad o de edad aplicables a una compra.
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                </form>

              </div>

            </div>
          )}

          {/* TRAYECTORIA DOMICILIO VIEW */}
          {activeTab === 'trayectoria' && (
            <div className="space-y-6">
              
              <div className="bg-gradient-to-r from-cyan-950/20 to-transparent p-4 rounded-xl border border-cyber-cyan/20">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <Truck className="text-cyan-400 animate-bounce" size={18} />
                  MONITOR DE LOGÍSTICA Y TRAYECTORIA
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Consulte el estado exacto de sus remisiones programadas y el progreso de los mensajeros corporativos asignados a su ruta.
                </p>
              </div>

              {clientDeliveries.length === 0 ? (
                <div className="bg-cyber-card border border-cyber-border rounded-2xl p-12 text-center text-gray-500 font-mono text-xs">
                  <Truck size={36} className="mx-auto mb-3 text-gray-600" />
                  <span>Aún no registra órdenes a domicilio en esta sesión operativa.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {clientDeliveries.map(del => {
                    // Progress bar calculate
                    let progressPercent = 10;
                    let progressLabel = 'Registro Exitoso';
                    if (del.deliveryStatus === 'En Camino') {
                      progressPercent = 60;
                      progressLabel = 'Unidad en Ruta de Tránsito';
                    } else if (del.deliveryStatus === 'Entregado') {
                      progressPercent = 100;
                      progressLabel = 'Carga Entregada con Éxito';
                    } else if (del.deliveryStatus === 'Cancelado') {
                      progressPercent = 0;
                      progressLabel = 'Despacho Cancelado';
                    }

                    return (
                      <div key={del.id} className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
                        
                        {/* Meta header of individual track */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3 font-mono text-xs">
                          <div>
                            <span className="text-cyber-pink font-extrabold uppercase">REMITO: {del.invoiceNumber}</span>
                            <span className="text-gray-500 block text-[10px] mt-0.5">REGISTRO: {new Date(del.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 block text-[10px]">TOTAL DESPACHADO:</span>
                            <span className="text-white font-extrabold text-sm">${del.total.toLocaleString('es-CO')} COP</span>
                          </div>
                        </div>

                        {/* Visual tracking timeline stepper */}
                        <div className="space-y-4">
                          <div className="flex justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                            <span className={del.deliveryStatus !== 'Cancelado' ? 'text-cyber-pink font-bold' : ''}>1. PENDIENTE</span>
                            <span className={del.deliveryStatus === 'En Camino' || del.deliveryStatus === 'Entregado' ? 'text-cyan-400 font-bold' : ''}>2. EN CAMINO</span>
                            <span className={del.deliveryStatus === 'Entregado' ? 'text-cyber-green font-bold' : ''}>3. ENTREGADO</span>
                          </div>

                          {/* Progress slider bar */}
                          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                            <div 
                              className={`h-full transition-all duration-700 ${
                                del.deliveryStatus === 'Cancelado' 
                                  ? 'bg-red-500 w-full' 
                                  : del.deliveryStatus === 'Entregado'
                                  ? 'bg-cyber-green'
                                  : 'bg-gradient-to-r from-cyber-pink to-cyan-400'
                              }`} 
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between items-center text-xs font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-900 leading-relaxed">
                            <div className="space-y-0.5">
                              <span className="text-gray-500 text-[9px] block">ESTATUS DINÁMICO:</span>
                              <span className="text-white font-bold flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full inline-block ${
                                  del.deliveryStatus === 'Entregado' ? 'bg-cyber-green' : del.deliveryStatus === 'Cancelado' ? 'bg-red-500' : 'bg-amber-400 animate-ping'
                                }`}></span>
                                {progressLabel.toUpperCase()}
                              </span>
                            </div>

                            <div className="text-right space-y-0.5">
                              <span className="text-gray-500 text-[9px] block">DOMICILIARIO / COURIER:</span>
                              <span className="text-cyber-orange font-bold uppercase">{del.deliveryRider || 'ASIGNANDO MENSAJERO'}</span>
                              <span className="text-[10px] text-gray-400 block font-normal">Vehículo: {del.deliveryTransport || 'No definido'}</span>
                            </div>
                          </div>

                        </div>

                        {/* Items table summary */}
                        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 text-[11px] font-mono">
                          <span className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Resumen de Insumos:</span>
                          <div className="space-y-1">
                            {del.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-gray-300">{it.productName} (x{it.quantity})</span>
                                <span className="text-white">${it.total.toLocaleString('es-CO')} COP</span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* STOCK CATALOG SUB-VIEW */}
          {activeTab === 'catalogo' && (
            <div className="space-y-6">
              
              <div className="bg-gradient-to-r from-cyber-blue/15 to-transparent p-4 rounded-xl border border-cyber-blue/20">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <Package className="text-cyber-blue" size={18} />
                  CATÁLOGO INTEGRAL DE STOCK
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Consulte los niveles reales del búnker y almacén de insumos de Rosa Fuerte S.A.S. Cantidades en tiempo real.
                </p>
              </div>

              {/* Advanced search and filter */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 relative">
                  <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Buscar producto..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="w-full bg-cyber-card border border-cyber-border rounded-xl text-white text-xs pl-9 pr-4 py-2.5 focus:outline-none glow-border-pink font-mono"
                  />
                </div>
                <div>
                  <select 
                    value={catalogCategory}
                    onChange={e => setCatalogCategory(e.target.value)}
                    className="w-full bg-cyber-card border border-cyber-border rounded-xl text-white text-xs p-2.5 focus:outline-none glow-border-pink font-mono"
                  >
                    <option value="Todos">Todas las Categorías</option>
                    {config.productCategories?.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Catalog list in bento grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {filteredProducts.map(prod => {
                  const isLowStock = prod.stock <= prod.minStock;

                  return (
                    <div 
                      key={prod.id} 
                      className={`bg-cyber-card border rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-cyber-blue/50 transition-all ${
                        isLowStock ? 'border-amber-500/20' : 'border-cyber-border'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-gray-500 font-mono uppercase block">{prod.code}</span>
                          <h3 className="text-xs font-bold text-white mt-1 font-sans">{prod.name}</h3>
                        </div>
                        <span className="text-2xl w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">{prod.imageUrl || '📦'}</span>
                      </div>

                      <div className="space-y-2 border-t border-slate-800/80 pt-3">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-gray-500">Categoría:</span>
                          <span className="text-cyber-blue font-bold">{prod.category}</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-gray-500">Precio Unitario:</span>
                          <span className="text-white font-extrabold">${prod.price.toLocaleString('es-CO')} COP</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono items-center">
                          <span className="text-gray-500">Disponibilidad Almacén:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isLowStock ? 'bg-amber-400/10 text-amber-400' : 'bg-cyber-green/10 text-cyber-green'
                          }`}>
                            {prod.stock} UNIDADES
                          </span>
                        </div>
                        {prod.note && (
                          <div className="text-[9px] text-amber-400 font-mono mt-2 flex items-start gap-1 bg-amber-950/20 px-2 py-1 rounded border border-amber-500/20">
                            <span className="shrink-0 mt-0.5">⚠️</span>
                            <span>{prod.note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* SUPPORT CHAT SUB-VIEW */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              
              <div className="bg-gradient-to-r from-cyber-pink/10 to-transparent p-4 rounded-xl border border-cyber-pink/20">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <MessageSquare className="text-cyber-pink" size={18} />
                  BÚNKER DE CHAT CON AGENTES
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Canal directo de comunicación codificada con nuestros despachadores y tripulación en ruta.
                </p>
              </div>

              {/* CHAT WINDOW BOX */}
              <div className="bg-cyber-card border border-cyber-border rounded-2xl flex flex-col h-[400px] overflow-hidden">
                
                {/* Chat header bar */}
                <div className="bg-slate-950 p-3 border-b border-cyber-border flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyber-green animate-ping"></div>
                  <span className="text-xs font-bold font-mono text-white">CONEXIÓN LOGÍSTICA ACTIVA: Agente Neon-Pink</span>
                </div>

                {/* Messages Container */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                  {displayMessages.map(msg => {
                    const isMyMsg = msg.sender === 'client';
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col max-w-[80%] ${isMyMsg ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <span className="text-[9px] text-gray-500 font-mono mb-0.5">{msg.senderName} • {new Date(msg.timestamp).toLocaleDateString('es-CO')} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className={`p-3 rounded-xl text-xs font-mono leading-relaxed ${
                          isMyMsg 
                            ? 'bg-cyber-pink/20 text-white border border-cyber-pink/30 rounded-tr-none' 
                            : 'bg-slate-900 text-gray-200 border border-slate-800 rounded-tl-none'
                        }`}>
                          {msg.attachment && (
                            <div className="mb-2">
                              {msg.attachment.type === 'image' && (
                                <img src={msg.attachment.url} alt={msg.attachment.name} className="max-w-[200px] max-h-[150px] rounded border border-slate-850 object-cover" />
                              )}
                              {msg.attachment.type === 'video' && (
                                <video src={msg.attachment.url} controls className="max-w-[200px] max-h-[150px] rounded border border-slate-850" />
                              )}
                              {msg.attachment.type === 'audio' && (
                                <audio src={msg.attachment.url} controls className="max-w-[200px] h-9" />
                              )}
                              {msg.attachment.type === 'voice' && (
                                <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded text-[9px] text-gray-300">
                                  <span>🎙️ Audio Grabado</span>
                                  <audio src={msg.attachment.url} controls className="w-[120px] h-6" />
                                </div>
                              )}
                              {msg.attachment.type === 'file' && (
                                <a href={msg.attachment.url} download={msg.attachment.name} className="text-cyber-blue hover:underline font-bold block truncate max-w-[200px]">
                                  📎 {msg.attachment.name} ({msg.attachment.size || 'Archivo'})
                                </a>
                              )}
                            </div>
                          )}
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}

                  {isAgentTyping && (
                    <div className="flex flex-col items-start max-w-[80%] mr-auto">
                      <span className="text-[9px] text-gray-500 font-mono mb-0.5">Agente Neon-Pink</span>
                      <div className="bg-slate-900 text-gray-400 border border-slate-800 p-2.5 rounded-xl rounded-tl-none text-[10px] font-mono animate-pulse">
                        Sincronizando respuesta con satélite...
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef}></div>
                </div>

                {/* Input Text Form */}
                <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-cyber-border flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Escriba su mensaje encriptado..."
                    value={userInputMessage}
                    onChange={e => setUserInputMessage(e.target.value)}
                    className="flex-1 bg-cyber-bg border border-cyber-border text-white text-xs p-2.5 rounded-lg focus:outline-none glow-border-pink font-mono"
                  />
                  <button 
                    type="submit"
                    className="bg-cyber-pink hover:bg-cyber-accent text-black font-bold p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                    title="Enviar Mensaje"
                  >
                    <Send size={14} />
                  </button>
                </form>

              </div>

            </div>
          )}

          {/* SOLICITUDES Y RECLAMOS SUB-VIEW */}
          {activeTab === 'solicitudes' && (
            <div className="space-y-6">

              <div className="bg-gradient-to-r from-cyber-orange/10 to-transparent p-4 rounded-xl border border-cyber-orange/20">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <Inbox className="text-cyber-orange animate-pulse" size={18} />
                  SUGERENCIAS, RECLAMOS Y SOLICITUDES
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Envía reclamos, sugerencias o solicitudes al equipo de operaciones. Recibirás respuesta a través de este portal.
                </p>
              </div>

              {reqSubmitSuccess && (
                <div className="bg-cyber-green/10 border border-cyber-green/30 p-4 rounded-xl text-cyber-green font-mono text-xs flex items-center gap-2.5">
                  <CheckCircle2 size={16} />
                  <span>¡Solicitud enviada correctamente! El equipo la revisará a la brevedad.</span>
                </div>
              )}

              {/* SUBMIT FORM */}
              <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-white font-mono uppercase flex items-center gap-1.5 border-b border-cyber-border pb-3">
                  <PlusCircle size={13} className="text-cyber-orange" />
                  Nueva Solicitud
                </h3>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!reqSubject.trim() || !reqDescription.trim()) return;
                    const newReq: ClientRequest = {
                      id: `req-${Date.now()}`,
                      clientId: client.id,
                      clientName: client.name,
                      clientRut: client.rut,
                      type: reqType,
                      subject: reqSubject.trim(),
                      description: reqDescription.trim(),
                      status: 'Pendiente',
                      priority: reqPriority,
                      createdAt: new Date().toISOString()
                    };
                    onSubmitRequest(newReq);
                    setReqSubject('');
                    setReqDescription('');
                    setReqType('Consulta');
                    setReqPriority('Media');
                    setReqSubmitSuccess(true);
                    setTimeout(() => setReqSubmitSuccess(false), 4000);
                  }}
                  className="space-y-3 text-xs font-mono"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-gray-400 text-[10px] uppercase">Tipo</label>
                      <select
                        value={reqType}
                        onChange={e => setReqType(e.target.value as ClientRequest['type'])}
                        className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                      >
                        <option value="Consulta">Consulta</option>
                        <option value="Sugerencia">Sugerencia</option>
                        <option value="Reclamo">Reclamo</option>
                        <option value="Solicitud">Solicitud</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-gray-400 text-[10px] uppercase">Prioridad</label>
                      <select
                        value={reqPriority}
                        onChange={e => setReqPriority(e.target.value as ClientRequest['priority'])}
                        className="w-full bg-cyber-bg border border-cyber-border p-2 rounded-lg text-white text-xs focus:outline-none"
                      >
                        <option value="Baja">Baja</option>
                        <option value="Media">Media</option>
                        <option value="Alta">Alta</option>
                        <option value="Urgente">Urgente</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 text-[10px] uppercase">Asunto</label>
                    <input
                      type="text"
                      value={reqSubject}
                      onChange={e => setReqSubject(e.target.value)}
                      placeholder="Título breve del requerimiento..."
                      className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 text-[10px] uppercase">Descripción Detallada</label>
                    <textarea
                      value={reqDescription}
                      onChange={e => setReqDescription(e.target.value)}
                      placeholder="Describe con detalle el reclamo, sugerencia o consulta..."
                      rows={4}
                      className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none glow-border-orange resize-none font-sans"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyber-orange text-black hover:bg-orange-500 font-bold py-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer"
                  >
                    📨 Enviar Solicitud
                  </button>
                </form>
              </div>

              {/* HISTORY OF OWN REQUESTS */}
              {clientRequests.length > 0 && (
                <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-3">
                  <h3 className="text-xs font-bold text-white font-mono uppercase flex items-center gap-1.5 border-b border-cyber-border pb-3">
                    <Clock size={13} className="text-gray-400" />
                    Mis Solicitudes Anteriores ({clientRequests.length})
                  </h3>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {[...clientRequests].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => (
                      <div key={req.id} className="bg-slate-950 border border-slate-900 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-gray-300 uppercase font-mono border border-slate-700 px-1.5 py-0.5 rounded">
                            {req.type}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                            req.status === 'Pendiente'    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                            req.status === 'En Revisión' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                            req.status === 'Resuelto'    ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                           'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white">{req.subject}</p>
                        {req.agentNotes && (
                          <div className="bg-slate-900 rounded p-2 text-[10px] text-gray-300 font-sans leading-relaxed border-l-2 border-cyber-orange">
                            <span className="text-cyber-orange text-[9px] font-mono font-bold block mb-0.5">Respuesta del equipo:</span>
                            {req.agentNotes}
                          </div>
                        )}
                        <p className="text-[9px] text-gray-600 font-mono">
                          {new Date(req.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          {req.resolvedAt && ` · Resuelto: ${new Date(req.resolvedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* CLIENT AUDIO CUSTOMIZATION TAB */}
          {activeTab === 'configuracion' && (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-6">
              <div className="border-b border-cyber-border pb-3">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <span>🔊</span>
                  CONFIGURACIÓN DE TONOS PERSONALIZADOS
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Elige y prueba los tonos de audio que escucharás en tu cuenta al recibir mensajes del chat de soporte o alertas del búnker logístico.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                {/* Chat message tone */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 space-y-3">
                  <label className="block text-[11px] text-cyber-pink font-bold uppercase tracking-wider">
                    Tono de Mensajes del Chat:
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={chatTone} 
                      onChange={e => {
                        const val = e.target.value;
                        setChatTone(val);
                        playTone(val as any);
                      }}
                      className="flex-1 bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none"
                    >
                      {TONE_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => playTone(chatTone as any)}
                      className="bg-cyber-pink/20 hover:bg-cyber-pink/40 border border-cyber-pink/30 text-cyber-pink px-4 rounded-lg font-bold cursor-pointer transition-all"
                      title="Probar sonido"
                    >
                      🔊
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-normal">
                    Este sonido se reproducirá cuando los operadores o el sistema te envíen un nuevo mensaje en el chat.
                  </p>
                </div>

                {/* System notification tone */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 space-y-3">
                  <label className="block text-[11px] text-cyber-orange font-bold uppercase tracking-wider">
                    Tono de Notificaciones / Alertas:
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={notifTone} 
                      onChange={e => {
                        const val = e.target.value;
                        setNotifTone(val);
                        playTone(val as any);
                      }}
                      className="flex-1 bg-cyber-bg border border-cyber-border p-2.5 rounded-lg text-white text-xs focus:outline-none"
                    >
                      {TONE_NAMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => playTone(notifTone as any)}
                      className="bg-cyber-orange/20 hover:bg-cyber-orange/40 border border-cyber-orange/30 text-cyber-orange px-4 rounded-lg font-bold cursor-pointer transition-all"
                      title="Probar sonido"
                    >
                      🔊
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-normal">
                    Este sonido se reproducirá cuando se completen tus pedidos online o se emitan anuncios flash.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-900/60">
                {/* Change password card */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 space-y-3">
                  <label className="block text-[11px] text-cyber-pink font-bold uppercase tracking-wider">
                    Cambiar Contraseña del Portal:
                  </label>
                  <form onSubmit={handleSettingsPasswordChange} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-500 font-mono">Nueva Contraseña Personal:</span>
                        <input
                          type="password"
                          placeholder="Nueva contraseña..."
                          value={settingsNewPassword}
                          onChange={e => setSettingsNewPassword(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded text-white text-xs focus:outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-500 font-mono">Confirmar Nueva Contraseña:</span>
                        <input
                          type="password"
                          placeholder="Confirmar contraseña..."
                          value={settingsConfirmPassword}
                          onChange={e => setSettingsConfirmPassword(e.target.value)}
                          className="w-full bg-cyber-bg border border-cyber-border p-2.5 rounded text-white text-xs focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    {settingsPasswordError && (
                      <p className="text-red-400 text-[10px]">🚨 {settingsPasswordError}</p>
                    )}
                    {settingsPasswordSuccess && (
                      <p className="text-cyber-green text-[10px]">✓ Contraseña actualizada correctamente.</p>
                    )}
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white border border-cyber-border px-4 py-2 rounded text-[10px] font-bold font-mono transition-all cursor-pointer"
                    >
                      Actualizar Contraseña
                    </button>
                  </form>
                </div>

                {/* Biometric Passkey Registration */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 space-y-3">
                  <label className="block text-[11px] text-cyber-orange font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Fingerprint size={14} className="text-cyber-orange" />
                    Llave de Acceso Biométrica (Passkey):
                  </label>
                  <p className="text-[10px] text-gray-500 leading-normal font-mono">
                    Vincula el sensor de huellas dactilares o reconocimiento facial (FaceID / Windows Hello) de este dispositivo para iniciar sesión automáticamente sin contraseñas.
                  </p>
                  
                  {client.passkeyCredential ? (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-cyber-blue/10 border border-cyber-blue/20 p-2.5 rounded-lg text-xs font-mono">
                      <div>
                        <p className="text-[10px] text-cyber-blue font-bold">✓ DISPOSITIVO REGISTRADO</p>
                        <p className="text-[9px] text-gray-400 mt-0.5 font-mono">Credencial: {client.passkeyCredential.id?.substring(0, 15)}...</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveBiometric}
                        className="text-[9px] bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded cursor-pointer transition-all"
                      >
                        Quitar Llave
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegisterBiometric}
                      className="bg-cyber-orange text-black hover:bg-amber-400 px-4 py-2 rounded text-[10px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95 hover:neon-shadow-orange"
                    >
                      <Fingerprint size={12} />
                      Registrar Sensor de este Dispositivo
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-900">
                <button
                  onClick={handleSaveTones}
                  className="bg-cyber-pink text-black hover:bg-cyber-accent px-5 py-2.5 rounded-lg font-bold font-mono text-xs cursor-pointer shadow-lg transition-all active:scale-95 neon-shadow-pink"
                >
                  Guardar Configuración de Sonido
                </button>
              </div>
            </div>
          )}

          {/* CLIENT INVOICE/TRANSACTION HISTORY TAB */}
          {activeTab === 'historial' && (
            <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 space-y-6">
              <div className="border-b border-cyber-border pb-3">
                <h2 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-cyber-blue" />
                  AUDITORÍA DE COMPRAS Y HISTORIAL
                </h2>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Historial consolidado de tus pre-pedidos y compras procesadas. Aquí puedes ver los estados de aprobación, facturas finales y realizar tus pagos.
                </p>
              </div>

              {/* Historial Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyber-border text-gray-500 uppercase text-[9px] font-bold">
                      <th className="py-3 px-2">Pedido / Fecha</th>
                      <th className="py-3 px-2">Insumos</th>
                      <th className="py-3 px-2">Tipo / Canal</th>
                      <th className="py-3 px-2 text-right">Total</th>
                      <th className="py-3 px-2 text-center">Estado</th>
                      <th className="py-3 px-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-gray-300">
                    {invoices
                      .filter(inv => inv.clientId === client.id)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(inv => {
                        let statusText = '';
                        let statusColor = '';
                        let detailBlock = null;

                        if (inv.paymentStatus === 'Orden de Compra') {
                          statusText = 'Pre-pedido (En Revisión)';
                          statusColor = 'text-amber-400 bg-amber-400/10 border border-amber-400/20';
                          detailBlock = (
                            <div className="text-[10px] text-gray-400 bg-slate-950/60 p-2.5 rounded mt-2 border border-slate-900 leading-normal">
                              ⌛ Tu pedido está siendo verificado por un asesor para confirmar el stock físico en la bodega. Te notificaremos cuando se apruebe.
                            </div>
                          );
                        } else if (inv.paymentStatus === 'Pendiente') {
                          statusText = 'Aprobado - Pendiente de Pago';
                          statusColor = 'text-cyber-orange bg-cyber-orange/10 border border-cyber-orange/20 animate-pulse';
                          detailBlock = (
                            <div className="text-[10px] text-gray-300 bg-cyber-orange/5 p-3.5 rounded-lg mt-2 border border-cyber-orange/20 space-y-2 leading-relaxed">
                              <p className="font-bold text-white uppercase text-[10px] tracking-wide flex items-center gap-1.5">
                                💳 INSTRUCCIONES DE PAGO HABILITADAS:
                              </p>
                              <p>El asesor ha verificado la disponibilidad y aprobado tu orden. Realiza la transferencia del total exacto a cualquiera de los siguientes medios:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] pt-1">
                                <div className="bg-slate-950/80 p-2 rounded border border-slate-900">
                                  <strong>Bancolombia (Ahorros):</strong><br/>
                                  Nº 225-0000-2534<br/>
                                  Titular: Oliver Torres
                                </div>
                                <div className="bg-slate-950/80 p-2 rounded border border-slate-900">
                                  <strong>Daviplata:</strong><br/>
                                  Nº 302 278 49 38<br/>
                                  Titular: Oliver Torres
                                </div>
                                <div className="bg-slate-950/80 p-2 rounded border border-slate-900 sm:col-span-2">
                                  <strong>Bre-B (Transferencias Inmediatas):</strong> 3022784938 / @OLIVER915<br/>
                                  <strong>PayPal / Tarjetas / Enlaces:</strong> Visa, MasterCard, Amex, Codensa
                                </div>
                              </div>
                              <p className="font-bold text-cyber-orange text-[9px] uppercase tracking-wider pt-1">
                                ⚠️ IMPORTANTE: Por favor, envía una captura del comprobante por la pestaña de "Chat con Operadores" para confirmar tu pago y proceder con el despacho.
                              </p>
                            </div>
                          );
                        } else if (inv.paymentStatus === 'Pagado') {
                          statusText = 'Pagado - En Despacho';
                          statusColor = 'text-cyber-green bg-cyber-green/10 border border-cyber-green/20';
                        } else if (inv.paymentStatus === 'Anulada') {
                          statusText = 'Anulada';
                          statusColor = 'text-red-400 bg-red-400/10 border border-red-400/20';
                        } else {
                          statusText = inv.paymentStatus;
                          statusColor = 'text-gray-400 bg-gray-400/10 border border-gray-400/20';
                        }

                        return (
                          <tr key={inv.id} className="hover:bg-slate-900/30 text-gray-300">
                            <td className="py-3 px-2">
                              <div className="font-bold text-white">{inv.invoiceNumber}</div>
                              <div className="text-[9px] text-gray-500 mt-0.5">{new Date(inv.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td className="py-3 px-2 max-w-xs">
                              <div className="truncate text-gray-400">
                                {inv.items.map(it => `${it.productName} (x${it.quantity})`).join(', ')}
                              </div>
                              {detailBlock}
                            </td>
                            <td className="py-3 px-2 text-gray-400 uppercase text-[10px]">
                              {inv.cashierName === 'Portal Online' ? '🛍️ Portal Web' : '🏪 Venta Directa'}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-white">
                              ${inv.total.toLocaleString('es-CO')}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded ${statusColor}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                onClick={() => setSelectedInvoiceForPrint(inv)}
                                className="bg-slate-900 hover:bg-slate-800 text-gray-300 p-1.5 rounded border border-slate-800 cursor-pointer inline-flex items-center gap-1.5 transition-all text-[9px] border-none"
                                title="Imprimir PDF Recibo"
                              >
                                <Printer size={11} /> Imprimir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {invoices.filter(inv => inv.clientId === client.id).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                          No tienes pre-pedidos ni compras registradas en este momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Atom Bubble Support Chat (Atom shape in motion) */}
      <AtomBubble 
        type="client"
        client={client}
        chatMessages={chatMessages}
        onSendMessage={onSendMessage}
        showToast={showToast}
      />

      {/* FOOTER COURIER TRIBUTE */}
      <footer className="bg-cyber-card/60 border-t border-cyber-border/40 py-4 text-center text-[10px] font-mono text-gray-500 mt-auto">
        Sistema Rosa Fuerte S.A.S. • Protocolo Portal de Clientes v1.2 • Todos los Derechos Reservados 2026.
      </footer>

      {/* Client Advertisement / Flash Message Modal Popup */}
      {activeFlashPopup && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-cyber-card border-2 border-cyber-pink/85 rounded-2xl max-w-lg w-full p-6 space-y-4 relative shadow-[0_0_50px_rgba(236,72,153,0.35)] font-mono text-xs select-text">
            
            {/* Title banner */}
            <div className="border-b border-cyber-border pb-3 flex justify-between items-center">
              <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                ✨ CAMPAÑA EXCLUSIVA / AVISO CORPORATIVO
              </h2>
              <button 
                onClick={() => setActiveFlashPopup(null)} 
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-cyber-pink font-bold text-sm tracking-wide uppercase">
                {activeFlashPopup.title}
              </h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {activeFlashPopup.content}
              </p>

              {/* Attachment layout */}
              {activeFlashPopup.attachmentUrl && (
                <div className="pt-2 border-t border-slate-900 flex justify-center">
                  {activeFlashPopup.attachmentType === 'image' && (
                    <img 
                      src={activeFlashPopup.attachmentUrl} 
                      alt={activeFlashPopup.attachmentName || 'Publicidad'} 
                      className="max-w-full rounded-lg border border-cyber-border max-h-60 object-contain shadow-lg"
                    />
                  )}
                  {activeFlashPopup.attachmentType === 'video' && (
                    <video 
                      src={activeFlashPopup.attachmentUrl} 
                      controls 
                      className="max-w-full rounded-lg border border-cyber-border max-h-60 shadow-lg"
                    />
                  )}
                  {activeFlashPopup.attachmentType === 'file' && (
                    <a 
                      href={activeFlashPopup.attachmentUrl} 
                      download={activeFlashPopup.attachmentName || 'anuncio_adjunto'}
                      className="flex items-center gap-2.5 p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-900 hover:border-cyber-pink rounded-xl text-white hover:text-cyber-pink transition-all w-full truncate"
                    >
                      <span>📎</span>
                      <span className="truncate">{activeFlashPopup.attachmentName || 'Descargar archivo promocional'}</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-900 flex justify-end">
              <button
                onClick={() => setActiveFlashPopup(null)}
                className="bg-cyber-pink text-black hover:bg-cyber-accent px-5 py-2.5 rounded-lg font-bold font-mono text-xs cursor-pointer shadow-lg active:scale-95 transition-all text-center neon-shadow-pink"
              >
                ENTENDIDO / EMPEZAR
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
