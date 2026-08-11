# Wallet checkout + Centro de ayuda

## Archivos

- `src/components/PortalCliente.tsx`: pago total/parcial desde el carrito y pestaña de ayuda.
- `src/components/AyudaCliente.tsx`: manual interactivo por módulos, errores y soluciones.
- `src/lib/walletApi.ts`: cliente para `POST /wallet/purchase`.
- `src/types.ts`: campos de elegibilidad y pago aplicado.

## Requisitos previos

- Migración `202608110003_wallet_checkout.sql` instalada.
- Edge Function `wallet-api` desplegada en versión 4.
- Productos legalmente aptos clasificados por un administrador autorizado.

## Seguridad

- El navegador no modifica el saldo directamente.
- La factura y el débito se publican atómicamente en el servidor.
- Los productos no clasificados permanecen bloqueados para pagos con Bolsillo.
- El saldo nunca sustituye controles de identidad, edad o elegibilidad.
