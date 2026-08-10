# Wallet API — fase privada inicial

Esta función de Supabase crea la frontera privada del Bolsillo y de las tarjetas NFC.

## Incluido

- Login de operador y cliente con hashes bcrypt existentes.
- Sesiones opacas almacenadas como hash.
- Limitación básica de intentos de acceso.
- Consulta del perfil, saldo e historial propio.
- Consulta de clientes por operadores autenticados.
- Meta de ahorro.
- Emisión, consulta y bloqueo de tarjetas NFC.
- CORS por lista explícita de orígenes.

## No incluido todavía

- Depósitos en efectivo, transferencia o tarjeta.
- Consumos del saldo.
- Pagos Bold y webhook.
- Eliminación de contraseñas antiguas.

Las operaciones de dinero se activarán únicamente después de probar sesiones,
roles y lectura NFC.

## Secretos requeridos

Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función.
Se deben agregar estos secretos sin publicarlos en GitHub:

- `WALLET_ALLOWED_ORIGINS`
- `WALLET_SESSION_PEPPER`
- `WALLET_NFC_PEPPER`

Los dos peppers deben ser diferentes y tener como mínimo 32 caracteres.

## Configuración

La función usa `verify_jwt = false` porque valida sus propios tokens opacos.
Esto no significa que quede sin autenticación: todas las rutas privadas ejecutan
`requireSession`. Solamente salud y login son públicas.
