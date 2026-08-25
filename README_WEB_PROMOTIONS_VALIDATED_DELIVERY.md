# Promociones web y domicilio validado

## Funcionalidad

- Agrega los alcances `web` y `primera_compra_web` al administrador de promociones.
- Aplica automáticamente el mayor descuento válido sin acumular promociones.
- La primera compra se determina con facturas reales de `Portal Online`, excluyendo anuladas.
- Las promociones automáticas solo calculan productos revisados y habilitados para Bolsillo.
- Elimina el domicilio fijo de $15.000 del portal.
- Informa un rango estimado de $10.000 a $30.000 COP.
- Obliga a seleccionar una dirección colombiana desde Google Places.
- El asesor define la tarifa definitiva al revisar la compra web.

## Configuración de Google

Crear una llave pública de navegador con Maps JavaScript API y Places API. Restringirla por los dominios de producción y vista previa. Guardarla como `VITE_GOOGLE_MAPS_API_KEY` en Vercel; no escribirla directamente en el código.

## Orden de instalación

1. Copiar los archivos sobre el repositorio.
2. Ejecutar `202608130001_web_promotions_validated_delivery.sql` en Supabase SQL Editor.
3. Ejecutar `verify_web_promotions_validated_delivery.sql`.
4. Configurar `VITE_GOOGLE_MAPS_API_KEY` en Vercel.
5. Ejecutar `npm run build`.

## Seguridad comercial

La promoción no habilita productos ni omite controles legales, de identidad o de edad. Los productos no revisados quedan fuera del cálculo automático.
