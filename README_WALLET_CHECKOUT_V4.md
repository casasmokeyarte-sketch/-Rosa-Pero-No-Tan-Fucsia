# Wallet checkout backend v4

Este paquete agrega el débito seguro, total o parcial, del Bolsillo contra una factura.

## Orden de instalación

1. Ejecutar `supabase/migrations/202608110003_wallet_checkout.sql` en Supabase SQL Editor dentro de `begin;` y `commit;`.
2. Ejecutar `verify_wallet_checkout.sql`.
3. Reemplazar el código de la Edge Function `wallet-api` con `supabase/functions/wallet-api/index.ts`.
4. Mantener **Verify JWT with legacy secret** apagado y desplegar.
5. Probar `/health`; debe responder versión 4.

## Control de elegibilidad

Todos los productos empiezan con `wallet_eligible = false`. Solamente un administrador autorizado debe habilitar productos que sean legalmente aptos para este medio de pago. El saldo del Bolsillo nunca sustituye verificaciones de identidad, edad o elegibilidad.

## Propiedades de seguridad

- Débito y actualización de factura en una misma transacción.
- Libro contable inmutable.
- Idempotencia contra doble clic.
- Propiedad de factura y sesión verificadas.
- Saldo nunca negativo.
- Pago parcial o total.
- Precios tomados desde la base de datos, no desde el navegador.
