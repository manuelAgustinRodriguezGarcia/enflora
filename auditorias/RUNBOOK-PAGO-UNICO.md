# Runbook — Pago único (licencia por ciclo)

Procedimientos de soporte para ENFLORA. No reemplaza el panel de Mercado Pago. No incluye Plus.

## Referencias técnicas

- Checkout: `/pagos/licencia` → Mercado Pago Orders → `/pagos/resultado/[pagoId]`
- Webhook: `POST /api/mercadopago/webhook` (evento **Order**)
- Reconciliación: `GET /api/pagos/reconciliar` (cron horario + Bearer `CRON_SECRET`)
- Acreditación: RPC `aplicar_resultado_pago` (solo tras consultar order en MP)
- Cotización cobro: BNA billete vendedor (`lib/pagos/cotizacion-bna.js`), máximo **7 días** de antigüedad

## 1. Pago acreditado en Mercado Pago sin webhook recibido

**Síntomas:** MP muestra order `processed` / `accredited`; en Supabase el pago sigue `pendiente` y no hay licencia.

**Causas habituales:** `MERCADOPAGO_WEBHOOK_SECRET` vacío o incorrecto, URL webhook mal configurada, localhost sin túnel.

**Pasos:**

1. Confirmar en MP el `order_id` y el `external_reference` (debe ser el UUID de `pagos.id`).
2. Verificar que `pagos.ambiente` coincide con `MERCADOPAGO_ENV`.
3. Pedir al usuario que abra `/pagos/resultado/[pagoId]` (dispara reconciliación con MP).
4. Si persiste, ejecutar reconciliación autorizada:  
   `GET /api/pagos/reconciliar` con header `Authorization: Bearer <CRON_SECRET>` o cron Vercel.
5. Revisar logs `[mercadopago]` (códigos sin secretos).

**No** marcar manualmente `pagos.estado = acreditado` ni insertar licencias sin pasar por `aplicar_resultado_pago` con order verificada.

## 2. Pago pendiente demasiado tiempo

**Síntomas:** Order en MP `pending` / `in_process`; usuario espera licencia.

**Acción:** Explicar que la licencia se activa solo al acreditarse. Reconciliación actualizará a `pendiente` o `rechazado` según MP. No activar por URL de retorno.

Si supera 48 h en `pendiente`, revisar order en MP y medios de pago; opcional cancelar order en MP y permitir nueva compra si el ciclo no tiene licencia activa.

## 3. Error al acreditar licencia (importe, vendedor, referencia)

**Síntomas:** Log/RPC `importe`, `referencia`, `vendedor`, `inconsistente`; `mp_estado_detalle` = `importe_no_coincide`.

**Pasos:**

1. Comparar `pagos.importe_ars` con `order.total_amount` en MP.
2. Si la cotización cambió **después** de crear la order pero **antes** de pagar, el importe puede no coincidir → reembolso/cancelación en MP y nueva compra (nuevo checkout con cotización congelada en reserva).
3. No ajustar importe en Supabase para “forzar” acreditación.

## 4. Reembolso

**En MP:** reembolso total o parcial según política comercial.

**En ENFLORA:** reembolso **confirmado** en order (`resolverEstadoOrden` → `reembolsado`) revoca licencia del ciclo vía RPC. Reembolso pendiente en MP no revoca.

Tras revocación, el usuario puede recomprar el mismo ciclo si no hay otra licencia activa.

## 5. Contracargo

Mismo efecto que reembolso confirmado: estado `contracargo`, licencia revocada. Escalar según política Mercado Pago.

## 6. Error al consultar Banco Nación

**Síntomas:** `/pagos/licencia?error=cotizacion_no_disponible` o `cotizacion_antigua`.

**Acción:** No se crea order. Reintentar cuando BNA publique (incluye días no hábiles con última cotización). Cron `/api/cotizacion/actualizar` refresca cache de landing; el checkout vuelve a leer BNA al confirmar compra.

No usar cotización de la landing si el checkout la rechaza.

## 7. Reconciliación manual autorizada

Solo personal con `CRON_SECRET` o acceso cron Vercel.

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" "https://enflora.com.ar/api/pagos/reconciliar"
```

Respuesta: `revisados`, `actualizados`. Procesa hasta 20 pagos `creada`/`pendiente` con `order_id` por invocación. Repetir si hay cola.

En local (sin secreto en dev): permitido fuera de producción según código.

## 8. Webhook falso o firma inválida

El endpoint responde **401** y no acredita. Revisar que el secreto sea el de la pestaña (prueba/producción) que envía el evento y que `data.id` en query coincida con el body.

## 9. Compra duplicada mismo ciclo

Índice único impide dos pagos abiertos; licencia activa bloquea nueva reserva. Si hay dos orders en MP por error operativo, solo la que coincida en importe/referencia acreditará; investigar filas duplicadas en `pagos`.

## Checklist rápido operador

| Dato | Dónde |
|------|--------|
| Pago interno | `pagos.id`, `external_reference` |
| Order MP | `pagos.order_id` |
| Ciclo | `pagos.ciclo_cultivo_id` |
| Licencia | `licencias_cultivo` por `pago_id` |
| Idempotencia webhook | `pagos_notificaciones.clave` = `x-request-id` |
