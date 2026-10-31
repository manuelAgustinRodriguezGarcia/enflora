# PLAN 420 — Seguridad operativa de renovaciones (Plus)

Estado: implementado en código, **cron NO habilitado**, **migración NO ejecutada**.

## 1. Alertas administrativas

Infraestructura existente reutilizada: correo por Resend (`/api/partners`, `/api/contacto`).
Push queda exclusivamente para usuarios finales.

Variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, destino `PLUS_ALERT_EMAIL` (o `CONTACT_EMAIL`).
Sin configuración: log `[plus-renovacion] alerta_sin_canal_configurado` y la alerta se reintenta en la
corrida siguiente (no se marca como notificada).

| Situación | Código | Nivel |
|---|---|---|
| BNA no disponible / cotización vencida | `cotizacion_no_disponible`, `cotizacion_antigua` | por tiempo al cobro |
| PUT rechazado | `put_rechazado` | por tiempo + intentos |
| GET de confirmación inconsistente | `put_no_confirmado` (con importe esperado vs remoto) | idem |
| GET de confirmación caído | `confirmacion_get_fallida` | idem |
| Importe sin actualizar cerca del cobro | cualquiera de las anteriores con ≤ 24 h | urgente / crítico |
| Reintentos agotados | estado `agotado` | agotado |
| Cobro pasó con incidencia abierta | estado `vencida` | evento aparte |
| Auditoría sin migrar | `auditoria_no_disponible` | crítico (sistema) |

Niveles: `aviso` (> 24 h, solo si la falla se repitió ≥ 2 veces), `urgente` (≤ 24 h), `critico` (≤ 6 h o fecha
desconocida), `agotado`. Solo se notifica cuando el nivel **sube**; una falla temporal que se resuelve en
la siguiente corrida no genera correo. Se avisa también la resolución de lo ya alertado. El correo indica
si MP cobraría de más o de menos, y no incluye correos de usuarios, tokens ni ids completos de MP.

## 2. Reintentos

- Máximo `MAX_INTENTOS_PUT = 5` por renovación (suscripción + `next_payment_date` de MP).
- Espera mínima tras el intento N: 30 min, 2 h, 6 h, 12 h; con ≤ 6 h al cobro se acorta a 30 min. Después: `agotado`.
- Actualizado por el hardening final: ver `PLAN-420-HARDENING-CRON-RENOVACIONES.md` (fail-closed, fechas vencidas, paginación, heartbeat).
- Cada corrida hace GET primero: si MP ya tiene el importe → no hay PUT (cubre PUT aplicado con GET caído).
- Las fallas locales (BNA, GET inicial, sin fecha) no consumen intentos de PUT; se reevalúan en cada corrida.
- 429 o 2 errores 5xx consecutivos de MP frenan las escrituras del resto del lote (`diferido_proteccion_mp`).
- El intento se **reserva antes del PUT** (INSERT contra índice único o UPDATE condicionado a `intentos`):
  corridas simultáneas no duplican el PUT. Además el PUT usa `X-Idempotency-Key`.
- Reabrir un `agotado` es manual (SQL del archivo de migración, sección runbook).

## 3. Auditoría (`plus_cotizacion_auditoria`)

Problema: cada corrida insertaba una fila nueva por la misma incidencia, sin renovación ni intentos.
Ahora hay **una fila por (suscripción, renovación)** (`clave_incidencia`, índice único parcial) que se
actualiza: `renovacion_ref`, `importe_ars_nuevo` (esperado), `importe_remoto_ars`, cotización, `intentos`,
`evaluaciones`, `primer/ultimo/proximo_intento_en`, `codigo_error`, `detalle`, `estado_final`
(`pendiente|bloqueado|agotado|resuelto|descartado|vencida|legado`), `alerta_nivel`, `resuelta_en`.

SQL correctivo: `supabase/pendiente/plus-auditoria-renovacion.sql` (aditivo, no destructivo, **no ejecutado**).
Las filas legadas no se tocan salvo el `update … 'legado'` opcional y comentado.

## 4. Política ante fallos (PROPUESTA — requiere aprobación; nada de esto es automático)

Hecho central: **`bloqueado` en Supabase no frena a Mercado Pago**. Si no actualizamos el importe, MP
debita el `transaction_amount` vigente en `next_payment_date`.

Consecuencias de no actualizar ARS: si el dólar subió, se cobra de menos (pérdida acotada); si bajó, se
cobra **de más** al usuario respecto de US$ 4,20 (riesgo de reclamo/contracargo y de consumo).

Alternativas:

| Opción | Efecto en el usuario | Riesgo |
|---|---|---|
| A. Dejar cobrar el ARS anterior | Cobro con importe desactualizado | Sobrecobro si el dólar bajó |
| B. Aceptar solo si el desvío es a favor del usuario o ≤ umbral (p. ej. 5 %) | Cobro correcto o levemente menor | Pérdida marginal; definir umbral |
| C. Pausar en MP (T-12 h) con confirmación manual | No hay cobro hasta resolver | Reanudar puede cobrar de inmediato o mover la fecha: **no verificado en sandbox** |
| D. Cancelar | Pierde la suscripción | Irreversible; descartada |

Recomendación:

1. T-72 h a T-24 h: reintentos automáticos (ya implementado) + correo `aviso` si persiste.
2. T-24 h: correo `urgente`. Admin revisa BNA/MP y puede fijar el importe manualmente.
3. T-12 h sin resolver: decisión humana, no automática:
   - Si el importe vigente en MP es **menor o igual** al esperado y el desvío ≤ umbral aprobado → opción B (dejar cobrar y registrar la diferencia).
   - Si el importe vigente es **mayor** al esperado (sobrecobro) → opción C (pausa manual) y aviso al usuario.
4. Comunicación al usuario solo ante pausa o diferencia cobrada: correo transaccional (no push) con motivo,
   monto y cómo se corrige.
5. Resolución: PUT del importe correcto → verificar por GET → reanudar → conciliar contra el pago acreditado
   (`plus_pagos_recurrentes`) y reembolsar/ajustar la diferencia si la hubo.

Antes de adoptar C hay que probar en sandbox: efecto de `status=paused` sobre `next_payment_date`, qué
pasa al reanudar y si hay cobro inmediato. Herramienta de pausa/reanudación: no implementada; si se aprueba,
debe ser un script manual con confirmación explícita, nunca un cron.

## 5. Riesgos restantes

- (Resuelto en el hardening final) Heartbeat con ruta de monitoreo externo, paginación, fail-closed sin
  migración y bloqueo de PUT sobre renovaciones vencidas. Falta contratar/autorizar el monitor externo.
- Un PUT aplicado cuya confirmación falla se resuelve recién en la corrida siguiente.
- Alertas por correo dependen de Resend; un fallo de envío se reintenta pero no hay segundo canal.
- Política de la sección 4 sin aprobar: hoy, agotados los reintentos, MP cobrará el importe vigente.

## 6. Antes de habilitar el cron

1. Ejecutar a mano `plus-auditoria-renovacion.sql` en sandbox y luego en producción; verificar columnas e índice.
2. Configurar `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PLUS_ALERT_EMAIL` y probar un correo real de alerta.
3. Aprobar la política de la sección 4 (umbral y responsable de guardia en ventana de cobro).
4. Definir monitor externo del cron y paginación del lote.
5. Ensayo sandbox del flujo completo con fecha real próxima (PUT ya validado: 6552 → 6804 → 6552).
6. Recién entonces agregar el cron a `vercel.json` (`30 8,14 * * *`; el backoff limita las llamadas a MP
   aunque se suba la frecuencia) con `CRON_SECRET` en el proyecto.
