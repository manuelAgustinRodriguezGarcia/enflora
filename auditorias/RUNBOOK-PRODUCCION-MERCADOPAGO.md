# Puesta en producción de Mercado Pago (Pago único y Plus)

Procedimiento único. Ningún paso activa cobros reales hasta el paso 7.

## Estado del código

- Pago único, Plus, beneficios, webhooks y reconciliación: ya en `main`.
- Rama `integracion/mercadopago-cierre` (pendiente de publicar): cron de renovación endurecido, auditoría por incidencia, alertas por correo, heartbeat, monitor, cron horario en `vercel.json`, variables nuevas en `.env.example`, script de prueba de cancelación.
- La migración `supabase/pendiente/plus-auditoria-renovacion.sql` ya está aplicada. El código la usa tal cual; no hay que repetirla.

## Requisitos de Production

| Requisito | Valor / acción |
|---|---|
| `MERCADOPAGO_ENV` | `produccion` |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial productiva de la aplicación (no la de prueba) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Public Key productiva |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto de firma productivo (el de pruebas queda solo en local) |
| `MERCADOPAGO_PRUEBAS_CONFIRMADAS`, `MERCADOPAGO_TEST_BUYER_EMAIL` | No definir |
| Webhooks en el panel de MP (modo productivo) | Orders y Suscripciones apuntando a las rutas de `lib/pagos/rutas.js` en `https://enflora.com.ar` |
| `PAYMENTS_LIVE_ENABLED` | Dejar vacío hasta el paso 7 |
| `PLUS_LIVE_ENABLED` | Dejar vacío hasta el paso 7. Mientras no sea `true`, el cron responde `ignorado` y no escribe heartbeat |
| `CRON_SECRET` | Ya definido; Vercel lo envía como Bearer a los crons |
| `PLUS_MONITOR_SECRET` | Nuevo, aleatorio y distinto de `CRON_SECRET` |
| `PLUS_ALERT_EMAIL` | Correo que recibe las alertas |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Ya probados; copiar a Production |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | Mismo proyecto de la migración |
| `APP_URL` | `https://enflora.com.ar` |
| Cotización BNA | Sin credenciales; el cron falla de forma cerrada y alerta si BNA no responde |
| RLS y permisos | Verificar con `plus-auditoria-renovacion-verificacion.sql` (solo lectura): solo `service_role`, RLS activo, sin políticas |
| Cancelaciones | Cancelar desde `/pagos/plus` (usa `cancelarSuscripcionPlus`) |
| Reembolsos | Manuales desde el panel de Mercado Pago; el sistema no reembolsa solo |

## Pasos

1. Revisar el diff de la rama, abrir PR a `main` y esperar el Preview.
2. En Preview, con credenciales de prueba, comprobar: heartbeat 401 sin encabezado, 401 con `CRON_SECRET`, y 200 o 503 con `PLUS_MONITOR_SECRET`.
3. Fusionar el PR. Vercel despliega a Production con los flags apagados. Verificar que el cron horario aparece en Vercel > Settings > Cron Jobs.
4. Cargar en Production las variables productivas de la tabla (sin los dos flags). Redesplegar.
5. En el panel de MP, configurar los webhooks productivos y copiar su secreto a `MERCADOPAGO_WEBHOOK_SECRET`.
6. Con los flags apagados, comprobar que el cron devuelve `ignorado`, que `/pagos/plus` no permite contratar y que los crons existentes siguen respondiendo.
7. Activar los flags: `PLUS_LIVE_ENABLED=true` y `PAYMENTS_LIVE_ENABLED=true`. Redesplegar. Hacer un cobro real mínimo propio, y revisar el webhook y los beneficios.
8. Esperar la primera corrida del cron (minuto 45). El heartbeat debe pasar a 200.
9. Solo entonces crear el monitor de Better Stack (ver `RUNBOOK-MONITOREO-RENOVACIONES-PLUS.md`).

Reversión: quitar `PLUS_LIVE_ENABLED` y `PAYMENTS_LIVE_ENABLED` y redesplegar apaga cobros nuevos y el cron. No se pierde ningún dato.

## Renovación efectiva: lo probado y lo pendiente

Probado en sandbox: cobro inicial, acreditación, beneficios, GET y PUT del importe con restauración, y webhooks.

No probado: un débito recurrente real del mes siguiente. El PUT y el GET no demuestran que Mercado Pago cobre el nuevo importe en `next_payment_date`.

La suscripción sandbox tiene el próximo cobro el 30 de noviembre de 2026. No se conoce un mecanismo oficial para adelantar un débito sin alterar la suscripción, y no se debe forzar la fecha. La prueba de renovación efectiva consiste en dejar correr el cron hasta esa fecha y comparar el importe cobrado con el esperado en `plus_pagos_recurrentes`.

Cancelar esa suscripción antes impide esa observación. Para probar ambas cosas hay que crear una segunda suscripción sandbox para la cancelación, o cancelar después del 30 de noviembre.

El riesgo restante hasta observar ese débito es el primer cobro real recurrente de un usuario. Mitigación: el cron emite alertas por importe discordante y el procedimiento manual del hardening cubre la corrección antes del cobro.

## Prueba final de cancelación (requiere autorización)

Script `scripts/prueba-cancelacion-plus.mjs`. El dry-run solo hace GET y ya se ejecutó. La cancelación real es irreversible y exige el argumento `--autorizo-cancelacion-real=SANDBOX-CANCELAR-d4039c16`. Verifica automáticamente: cancelación en MP, ausencia de pagos nuevos, beneficios hasta fin de período, suscripción y pagos conservados, licencias de pago único sin cambios. La ausencia de un débito futuro solo se comprueba esperando la fecha original.
