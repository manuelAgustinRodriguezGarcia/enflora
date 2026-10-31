# Plus — iteración 2 (funcional sandbox)

## Cron (no desplegado)

Agregar manualmente a `vercel.json` **solo después** de probar sandbox:

```json
{
  "path": "/api/pagos/plus/renovar-importe",
  "schedule": "30 8,14 * * *"
}
```

Endpoint: `GET /api/pagos/plus/renovar-importe` con `Authorization: Bearer $CRON_SECRET`.

## Mercado Pago (manual)

1. Webhooks en la app de MP (misma URL que Orders): `subscription_preapproval`, `subscription_authorized_payment`.
2. Credenciales de **prueba** (`MERCADOPAGO_ENV=prueba`, `MERCADOPAGO_PRUEBAS_CONFIRMADAS=true`).
3. `MERCADOPAGO_TEST_BUYER_EMAIL` con usuario de prueba MP.
4. No activar `PLUS_LIVE_ENABLED` ni cambiar a producción hasta E2E validado.

## Verificación Supabase

- SQL: `supabase/pendiente/plus-verificacion-post-migracion.sql`
- Script: `node --env-file=.env scripts/verificar-plus-supabase.mjs`

## E2E sandbox pendiente

Alta en `/pagos/plus` → `init_point` → retorno → webhook → primer cobro acreditado → beneficios → cancelación → fin de período.

**Plus no está listo para producción** hasta completar ese recorrido al menos una vez.

## Renovación ARS (realidad MP)

- `next_payment_date` en GET `/preapproval/{id}` define la referencia de próximo cobro.
- El importe debitado es el `transaction_amount` vigente en el preapproval al momento del ciclo; MP **no** aplica BNA.
- PUT + GET confirmación en ventana 72 h (`lib/pagos/plus/cron-renovacion-ars.js`).
- Si BNA o PUT fallan en ventana: bloqueo registrado en `plus_cotizacion_auditoria` (no cobro silencioso con ARS obsoleto).
