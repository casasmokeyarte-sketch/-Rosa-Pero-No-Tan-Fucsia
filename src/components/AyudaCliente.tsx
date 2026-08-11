import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  History,
  MessageSquare,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  WalletCards
} from 'lucide-react';

type HelpSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  steps: string[];
  reasons: string[];
  errors: Array<{ message: string; solution: string }>;
};

interface AyudaClienteProps {
  onNavigate: (tab: 'pedido' | 'bolsillo' | 'catalogo' | 'chat' | 'historial' | 'configuracion') => void;
}

export default function AyudaCliente({ onNavigate }: AyudaClienteProps) {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState('pedido');

  const sections: HelpSection[] = [
    {
      id: 'pedido',
      title: 'Hacer un pedido online',
      icon: <ShoppingCart size={18} />,
      summary: 'Agrega productos, elige la entrega y selecciona un medio de pago.',
      steps: [
        'Entra en Hacer pedido online.',
        'Agrega únicamente los productos disponibles y revisa las cantidades.',
        'Pulsa Siguiente: despacho y completa la dirección cuando corresponda.',
        'Elige Cupo de crédito, Bold para recargar el Bolsillo o Pagar con Bolsillo.',
        'Revisa el total y confirma. El historial mostrará si quedó pagado o con saldo pendiente.'
      ],
      reasons: [
        'El precio y la disponibilidad se verifican nuevamente en el servidor.',
        'Un pedido pendiente todavía necesita completar su pago o revisión.',
        'Los controles de identidad, edad o elegibilidad se aplican de manera independiente al saldo.'
      ],
      errors: [
        {
          message: 'El carrito está vacío',
          solution: 'Regresa al catálogo del pedido y agrega al menos un producto disponible.'
        },
        {
          message: 'Producto no habilitado para pagar con Bolsillo',
          solution: 'Ese producto no fue clasificado como apto para este medio. Elige otro medio o consulta a un administrador autorizado.'
        },
        {
          message: 'Existencias insuficientes',
          solution: 'Reduce la cantidad o solicita al asesor que confirme nuevamente el inventario.'
        }
      ]
    },
    {
      id: 'bolsillo',
      title: 'Mi Bolsillo',
      icon: <WalletCards size={18} />,
      summary: 'Consulta saldo, ahorra, recarga y revisa cada movimiento.',
      steps: [
        'Abre Mi Bolsillo y NFC e inicia la sesión segura del Bolsillo.',
        'Consulta el saldo disponible y el estado de la cuenta.',
        'Para ahorrar, define una meta con nombre y monto.',
        'Para recargar en línea, escribe un monto entero desde $1.000 COP y continúa con Bold.',
        'Para recargar en oficina, solicita apoyo a un asesor y conserva el comprobante.'
      ],
      reasons: [
        'El dinero no está guardado en la tarjeta NFC; permanece en la cuenta segura.',
        'Una pantalla de regreso desde Bold no acredita dinero por sí sola.',
        'La recarga aparece únicamente después de que el webhook firmado confirma la aprobación.'
      ],
      errors: [
        {
          message: 'Sesión inválida o vencida',
          solution: 'Cierra la sesión del Bolsillo e ingresa nuevamente con tu código y contraseña.'
        },
        {
          message: 'Saldo insuficiente',
          solution: 'Aplica un monto menor, recarga el Bolsillo o completa el valor pendiente mediante un medio autorizado.'
        },
        {
          message: 'Recarga pendiente',
          solution: 'Espera la confirmación de Bold y usa Consultar estado. No repitas el pago inmediatamente.'
        }
      ]
    },
    {
      id: 'pago-bolsillo',
      title: 'Pagar total o parcialmente con el Bolsillo',
      icon: <CreditCard size={18} />,
      summary: 'Aplica el saldo disponible al pedido sin modificarlo desde el navegador.',
      steps: [
        'Arma el pedido y llega al paso Pasarela de pago.',
        'Selecciona Pagar con Bolsillo.',
        'Si la sesión no está abierta, entra primero a Mi Bolsillo y luego regresa al carrito.',
        'Consulta el saldo y escribe cuánto deseas aplicar, sin superar el total ni el saldo disponible.',
        'Confirma una sola vez. Verás el valor aplicado y el valor restante.',
        'Si queda un saldo pendiente, podrás agregar fondos y volver a aplicarlos sobre la misma factura.'
      ],
      reasons: [
        'El servidor debita el saldo y actualiza la factura en una sola operación.',
        'La clave de idempotencia evita un cobro duplicado por doble clic o mala conexión.',
        'Solo los productos expresamente aprobados para este medio pueden pagarse con el Bolsillo.'
      ],
      errors: [
        {
          message: 'Saldo insuficiente',
          solution: 'Cambia el monto a uno igual o menor que tu saldo disponible.'
        },
        {
          message: 'La factura no está disponible',
          solution: 'Puede estar pagada, anulada o vencida. Consulta Mi historial o comunícate con un asesor.'
        },
        {
          message: 'No fue posible confirmar el pago',
          solution: 'No vuelvas a pagar de inmediato. Revisa primero Mi historial y los movimientos del Bolsillo.'
        }
      ]
    },
    {
      id: 'nfc',
      title: 'Tarjeta NFC',
      icon: <Smartphone size={18} />,
      summary: 'Identifica tu cuenta al acercar la tarjeta al lector autorizado.',
      steps: [
        'Solicita la asignación de la tarjeta en la oficina.',
        'Un asesor autorizado vincula el identificador opaco con tu cuenta.',
        'Acerca la tarjeta al lector cuando necesites consultar tu Bolsillo.',
        'Si se pierde, solicita el bloqueo inmediatamente.'
      ],
      reasons: [
        'La tarjeta no contiene nombre, documento, contraseña ni saldo.',
        'Bloquear una tarjeta no elimina el dinero de la cuenta.',
        'Nunca compartas códigos de sesión o contraseñas con otra persona.'
      ],
      errors: [
        {
          message: 'Tarjeta no encontrada',
          solution: 'Retírala, vuelve a acercarla y confirma que el lector correcto está conectado.'
        },
        {
          message: 'Tarjeta bloqueada',
          solution: 'No intentes reutilizarla. Solicita revisión o reemplazo a un asesor autorizado.'
        }
      ]
    },
    {
      id: 'historial',
      title: 'Historial y movimientos',
      icon: <History size={18} />,
      summary: 'Comprueba pedidos, pagos, abonos, recargas y estados.',
      steps: [
        'Abre Mi historial / órdenes para revisar facturas y entregas.',
        'Abre Mi Bolsillo y NFC para revisar créditos y débitos.',
        'Compara el número de factura y el monto antes de reportar un problema.',
        'Usa el chat si un pago no coincide después de actualizar.'
      ],
      reasons: [
        'Los movimientos del Bolsillo son inmutables y las correcciones se registran como reversión.',
        'Un pedido pendiente no significa que el dinero desapareció.',
        'La fecha, referencia y saldo posterior ayudan a auditar cada operación.'
      ],
      errors: [
        {
          message: 'No aparece un movimiento reciente',
          solution: 'Actualiza el módulo. Si fue una recarga Bold, espera la confirmación firmada.'
        },
        {
          message: 'El valor no coincide',
          solution: 'No repitas la operación. Envía por chat el número de factura y el valor esperado, sin compartir contraseñas.'
        }
      ]
    },
    {
      id: 'soporte',
      title: 'Chat, solicitudes y configuración',
      icon: <MessageSquare size={18} />,
      summary: 'Solicita ayuda, presenta una novedad y protege tu acceso.',
      steps: [
        'Usa Chat con operadores para dudas rápidas de un pedido.',
        'Usa Sugerencias y reclamos cuando necesites seguimiento formal.',
        'En Ajustes cambia tu contraseña y configura los avisos.',
        'Describe el problema con número de pedido, fecha y mensaje de error.'
      ],
      reasons: [
        'Nunca envíes contraseñas, códigos de sesión, claves de tarjeta ni secretos por el chat.',
        'Los datos exactos del pedido permiten resolver el caso sin repetir pagos.',
        'Cerrar sesión protege la cuenta en equipos compartidos.'
      ],
      errors: [
        {
          message: 'No llega respuesta inmediata',
          solution: 'Crea una solicitud y conserva su estado para seguimiento.'
        },
        {
          message: 'Contraseña rechazada',
          solution: 'Comprueba el código del cliente y solicita restablecimiento mediante el canal autorizado.'
        }
      ]
    }
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter((section) =>
      [section.title, section.summary, ...section.steps, ...section.reasons]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [search]);

  const destination: Record<string, Parameters<AyudaClienteProps['onNavigate']>[0]> = {
    pedido: 'pedido',
    bolsillo: 'bolsillo',
    'pago-bolsillo': 'pedido',
    nfc: 'bolsillo',
    historial: 'historial',
    soporte: 'chat'
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-cyan-950/30 via-cyber-pink/10 to-transparent border border-cyan-400/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CircleHelp className="text-cyan-300 shrink-0" size={24} />
          <div>
            <h2 className="text-lg font-black font-mono text-white">CENTRO DE AYUDA DEL CLIENTE</h2>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              Procedimientos, motivos de seguridad y soluciones para cada módulo. Busca una palabra o abre una guía.
            </p>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2">
          <Search size={15} className="text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar: saldo, Bold, NFC, pedido, contraseña..."
            className="w-full bg-transparent text-xs text-white outline-none"
          />
        </label>
      </div>

      <div className="bg-amber-500/10 border border-amber-400/25 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="text-amber-300 shrink-0" size={19} />
        <p className="text-[11px] text-amber-100/90 leading-relaxed">
          El saldo o la tarjeta NFC nunca sustituyen controles legales, de identidad, edad o elegibilidad.
          No compartas contraseñas ni códigos de sesión y no repitas un pago sin revisar primero el historial.
        </p>
      </div>

      <div className="space-y-3">
        {filtered.map((section) => {
          const isOpen = openId === section.id;
          return (
            <article key={section.id} className="bg-cyber-card border border-cyber-border rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? '' : section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-900/40 transition-colors"
              >
                <span className="text-cyber-pink">{section.icon}</span>
                <span className="flex-1">
                  <strong className="block text-sm text-white">{section.title}</strong>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{section.summary}</span>
                </span>
                <ChevronDown size={17} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="border-t border-slate-800 p-4 space-y-5">
                  <section>
                    <h3 className="text-[10px] font-black font-mono text-cyan-300 uppercase tracking-widest mb-2">
                      Paso a paso
                    </h3>
                    <ol className="space-y-2">
                      {section.steps.map((step, index) => (
                        <li key={step} className="flex gap-2 text-[11px] text-gray-300 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-cyan-400/15 text-cyan-300 flex items-center justify-center font-bold shrink-0">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section>
                    <h3 className="text-[10px] font-black font-mono text-cyber-green uppercase tracking-widest mb-2">
                      Por qué funciona así
                    </h3>
                    <ul className="space-y-2">
                      {section.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2 text-[11px] text-gray-300 leading-relaxed">
                          <CheckCircle2 size={14} className="text-cyber-green shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-[10px] font-black font-mono text-amber-300 uppercase tracking-widest mb-2">
                      Errores y soluciones
                    </h3>
                    <div className="space-y-2">
                      {section.errors.map((item) => (
                        <div key={item.message} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                          <p className="text-[11px] font-bold text-amber-200 flex items-center gap-2">
                            <AlertTriangle size={13} /> {item.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{item.solution}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <button
                    type="button"
                    onClick={() => onNavigate(destination[section.id])}
                    className="w-full py-2.5 rounded-xl bg-cyber-pink text-black font-black font-mono text-[10px] hover:bg-cyber-accent transition-colors"
                  >
                    ABRIR MÓDULO RELACIONADO
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-8 text-center">
          <Package size={24} className="mx-auto text-gray-600" />
          <p className="text-xs text-gray-400 mt-2">No encontramos una guía con esas palabras.</p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="mt-3 text-[10px] font-bold text-cyber-pink"
          >
            LIMPIAR BÚSQUEDA
          </button>
        </div>
      )}
    </div>
  );
}
