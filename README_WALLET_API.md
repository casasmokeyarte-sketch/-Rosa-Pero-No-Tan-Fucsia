# Wallet API versión 3 — intención de recarga Bold

Esta actualización crea la orden de recarga del Bolsillo en el servidor antes
de abrir el checkout oficial de Bold.

## Seguridad del flujo

- Solo un cliente con sesión privada vigente puede crear una intención propia.
- El monto se fija en pesos colombianos enteros, desde $1.000 COP.
- Cada solicitud usa una clave de idempotencia y una referencia única.
- La firma SHA-256 se genera en `wallet-api`; la llave secreta no llega al código
  fuente ni al almacenamiento del navegador.
- La redirección de Bold sirve únicamente para mostrar el estado pendiente.
- Solo `bold-wallet-webhook`, tras validar la firma del evento, puede acreditar
  dinero en el libro contable del Bolsillo.
- El saldo del Bolsillo nunca sustituye los controles legales y de edad que
  correspondan al producto comprado.

## Rutas nuevas

- `POST /wallet/topup-intent`
  - Requiere sesión de cliente.
  - Entrada: `amount` e `idempotency_key`.
  - Devuelve los parámetros públicos del checkout y la firma generada.
- `GET /wallet/topup-intent/status?order_reference=...`
  - Requiere la misma sesión del cliente.
  - Consulta el estado almacenado; no confía en parámetros de redirección.

## Secretos

Además de los secretos existentes, `wallet-api` requiere:

- `BOLD_IDENTITY_KEY`: llave de identidad correspondiente al Botón de pagos.
- `BOLD_WEBHOOK_SECRET`: llave secreta correspondiente a esa identidad; ya la
  utiliza el webhook firmado.
- `WALLET_BOLD_REDIRECT_URL`: URL HTTPS permitida a la que Bold puede regresar.

Los valores se configuran únicamente en Supabase Edge Function Secrets.

## Instalación

1. Ejecutar `202608110002_wallet_bold_topup_intents.sql` en Supabase.
2. Ejecutar `verify_wallet_bold_topup_intents.sql`.
3. Agregar los secretos faltantes.
4. actualizar la Edge Function `wallet-api` con `index.ts`.
5. Confirmar que `/wallet-api/health` responde con versión 3.

La interfaz visual del Portal Cliente se integra en una fase posterior, después
de comprobar esta frontera privada.
