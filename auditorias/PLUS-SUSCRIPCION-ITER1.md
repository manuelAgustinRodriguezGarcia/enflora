# Plus — Suscripción Mercado Pago (iteración 1)

Entrega Sprint Comercial 2.2. **No ejecutar SQL ni cobros productivos en esta iteración.**

## 1. Arquitectura seleccionada

- **PreApproval sin plan MP** (`POST /preapproval`, `status: pending` → `init_point`).
- Mismo **access token** de la app actual; Orders API y Suscripciones API son endpoints distintos (compatibilidad documentada en `auditorias/AUDITORIA-MERCADOPAGO-MVP.md` §9).
- Capas:
  - **Proveedor:** `lib/pagos/plus/preapproval-api.js`
  - **Comercial / dinero:** `lib/pagos/plus/dinero.js`, `lib/pagos/plus/renovacion-ars.js`, cotización BNA existente
  - **Persistencia:** tablas en `supabase/plus-suscripciones.sql` (pendiente de aplicar)
  - **Beneficios:** `lib/pagos/plus/leer-plus-activo.js` + `plusSuscripcionHabilita`
  - **Webhooks:** `lib/pagos/webhook-entrada.js` enruta Plus vs Orders
- Alta real desactivada por defecto: `prepararAltaPlus({ ejecutarMp: false })` y `PLUS_LIVE_ENABLED` para producción.

## 2. Modelo SQL propuesto

Ver `supabase/plus-suscripciones.sql`:

- `plus_suscripciones` — preapproval, ambiente, estados, USD 4,20, ARS/cotización, vigencia, cancelación
- `plus_pagos_recurrentes` — authorized payments, importe cobrado, período
- `plus_notificaciones` — idempotencia webhook (`clave` única)
- `plus_cotizacion_auditoria` — PUT pre-renovación y cobros
- RLS lectura usuario; escritura **service_role** (webhooks/cron)

## 3. Archivos tocados / nuevos

| Archivo | Rol |
|---------|-----|
| `supabase/plus-suscripciones.sql` | Migración (no ejecutada) |
| `lib/pagos/plus/*` | API, estados, alta, renovación ARS, webhooks, leer Plus |
| `lib/pagos/evento-webhook.js` | Tópicos suscripción |
| `lib/pagos/procesar-webhook-suscripcion.js` | Handler Plus |
| `lib/pagos/webhook-entrada.js` | Router webhook |
| `app/api/mercadopago/webhook/route.js` | Usa router unificado |
| `lib/flora-beneficios-servidor.js` | `consultarPlusActivo`, `plusRegistrableEnDb` |
| `tests/pagos-plus.test.js` | Mocks iteración 1 |
| `package.json` | Incluye test Plus |

**Sin cambios** en Checkout Pro / Orders del pago único.

## 4. Estado real de PreApproval (MP)

- Flujo diseñado: **pending** → usuario autoriza en `init_point` → **authorized** + pagos en `subscription_authorized_payment`.
- Iteración 1 **no crea** preapprovals productivos; solo cuerpo validado y `gateAltaPlus`.
- Estados mapeados en `lib/pagos/plus/estados.js`; siempre confirmar con **GET** `/preapproval/{id}` en webhook.

## 5. Estrategia ARS en cada renovación

1. **Regla:** USD 4,20 × dólar billete vendedor BNA (`obtenerCotizacionBilleteVendedor`).
2. **MP no aplica BNA:** actualizar `auto_recurring.transaction_amount` vía **PUT** antes de `next_payment_date`.
3. **Ventana:** 72 h (`evaluarActualizacionArsPreRenovacion` en `renovacion-ars.js`).
4. **Confirmación:** GET post-PUT (`sincronizarImportePreapproval`).
5. **Bloqueo comercial** si cotización inválida/antigua en ventana — no cobrar ARS obsoleto en silencio.
6. **Cron productivo:** iteración 2 (no modificado en iter 1).

## 6. Riesgos pendientes (moneda / facturación)

- Cobro con ARS desactualizado si falla PUT o cron antes de renovación.
- Feriados BNA: mitigado por vigencia 7 días en cotización; renovación en ventana 72 h exige cotización válida.
- Diferencia entre importe PUT y importe efectivamente debitado → registrar en `plus_pagos_recurrentes.importe_cobrado_ars` y auditoría.
- Facturación legal / comprobantes recurrentes: fuera de alcance iter 1.
- RPC idempotentes en SQL reservadas para iter 2.

## 7. `leerPlusActivo()` / beneficios

- Implementación: `consultarPlusActivo` en `lib/pagos/plus/leer-plus-activo.js`.
- Plus activo = suscripción **activa o cancelada al fin de período** + **pago recurrente acreditado** con `periodo_hasta` vigente + **mismo ambiente** que pagos.
- Checkout pendiente **no** habilita Plus.
- `plusRegistrableEnDb`: `true` cuando la tabla responde; `false` si la migración no está aplicada.

## 8. Pruebas

- `tests/pagos-plus.test.js`: gate producción, alta simulada, cobertura estados, BNA bloqueada, PUT confirmado/fallido, consulta Plus, webhook duplicado, acreditación pago.
- Ejecutar: `pnpm test`, ESLint focalizado en archivos Plus, `pnpm build`.

## 9. Iteración 2 (pendiente)

- Aplicar SQL en Supabase + RPC `aplicar_resultado_plus_*`.
- Cron pre-renovación PUT + alertas operativas.
- UI checkout Plus + `ejecutarMp: true` en prueba.
- Webhooks en panel MP + prueba end-to-end sandbox.
- `PLUS_LIVE_ENABLED` y runbook producción.

## 10. Bloqueantes antes de cobros reales

1. Migración SQL aplicada y probada.
2. Job PUT ARS verificado contra sandbox (renovación simulada).
3. Webhooks `subscription_*` configurados y reconciliación manual probada.
4. Política explícita si BNA no disponible en ventana de cobro (pausar vs reintentar).
5. Aprobación producto + `PLUS_LIVE_ENABLED`.
6. Comunicación al usuario ante cambio de ARS mensual.
