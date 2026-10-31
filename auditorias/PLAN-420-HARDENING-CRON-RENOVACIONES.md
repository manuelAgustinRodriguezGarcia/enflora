# PLAN 420 — Hardening final del cron de renovaciones (Plus)

Estado: código listo y probado. **Cron NO habilitado, SQL NO ejecutado, `vercel.json` sin cambios.**
Complementa `PLAN-420-SEGURIDAD-OPERATIVA-RENOVACIONES.md`.

## 1. Comportamiento sin migración (fail-closed)

Antes de leer suscripciones o llamar a Mercado Pago, el cron lee las incidencias pidiendo **cada columna
por nombre**. Si falta la tabla o cualquier columna, la corrida termina así:

- Respuesta `503` con `{ ok: false, codigo: "auditoria_no_disponible" }`.
- **Cero PUT y cero lecturas a MP.**
- Log `[plus-renovacion] auditoria_no_disponible_cron_detenido` y correo de alerta `[SISTEMA]`
  (Resend; no consulta la BD).
- Heartbeat `fallida` (si su tabla existe; si no, el monitor externo ya detecta el problema).
- No hay lógica alternativa: la reserva de intentos es obligatoria.
- Si la lectura funciona pero la **reserva** de un intento falla, no se hace ese PUT, se frenan los PUT del
  resto de la corrida (`detenido_por_auditoria`) y se avisa (`reserva_fallida`).
- Solo afecta a `/api/pagos/plus/renovar-importe`; el resto de ENFLORA no usa estas tablas.

## 2. Después de la fecha de cobro

- `next_payment_date` alcanzada o superada → **no hay PUT** (`renovacion_vencida`).
- Menos de 15 min al cobro → no hay PUT (`cobro_inminente`, `MARGEN_MINIMO_PUT_MIN`).
- Si el importe ya es el correcto no hay nada que hacer ni incidencia, aunque el cobro sea inminente.
- Justo antes de cada PUT se vuelve a leer la suscripción en MP. Si cambió el estado
  (`estado_mp_cambio`), la próxima fecha (`proxima_fecha_cambio`) o ya venció/está inminente, se bloquea:
  no se consume un intento, queda incidencia atada al período original y se alerta de inmediato
  (nivel mínimo `urgente`).
- Si tras ese GET el importe ya coincide, se resuelve sin PUT.
- Nunca se modifican fechas ni estados.
- Una incidencia abierta cuyo cobro pasó sin resolución se marca `vencida` y se avisa (no se marca si
  la corrida fue parcial o truncada).

## 3. Paginación

- Lectura por clave (`id`), páginas de 100, tope duro de 5000 por corrida (`limiteAlcanzado` → alerta).
  Cada consulta lleva `limit`; no hay lecturas sin límite.
- Ids repetidos se descartan (también en entradas inyectadas); cada suscripción se procesa una vez.
- Orden de procesamiento: más urgentes primero (fecha local ascendente, sin fecha primero).
- Presupuesto de 40 s (`PRESUPUESTO_MS_DEFECTO`) con `maxDuration = 60` en la ruta. Al agotarse: se
  informa `truncada` y `sinProcesar`, alerta `[SISTEMA] corrida_truncada`, y lo pendiente se procesa en
  la corrida siguiente (primero lo más urgente).
- Una página que falla se reintenta una vez; si vuelve a fallar se procesa lo leído, con alerta
  `lectura_parcial`.
- Un error inesperado en una suscripción se cuenta y registra; el lote continúa.
- Concurrencia: reserva atómica por suscripción (índice único / UPDATE condicionado); alertas reservadas
  atómicamente (no hay correos duplicados entre corridas simultáneas).

## 4. Frecuencia recomendada

Hechos:
- Vercel interpreta los crons en **UTC**. Los reintentos son 30 min, 2 h, 6 h, 12 h (5 intentos; con ≤ 6 h
  al cobro la espera baja a 30 min). Se amplió de 4 a 5 intentos para que la última espera de 12 h
  cubra mejor una caída prolongada.
- Simulación en `tests/pagos-plus-renovacion-hardening.test.js` (falla persistente, ventana de 72 h):

| Frecuencia | Intentos de PUT (horas antes del cobro) | Agotado con |
|---|---|---|
| Cada hora | 71, 70, 68, 62, 50 | 50 h de margen |
| 2 veces por día (`30 8,14 * * *`) | 71, 59, 47, 35, 23 | 23 h de margen |
| Cada 30 min | igual que horario, nunca < 30 min entre PUT | — |

**Recomendación: una vez por hora, minuto 45** (`45 * * * *`; no coincide con :07/:22/:37/:52 de push
ni :15 de reconciliación). Con la espera mínima de 30 min, ir más seguido no agrega intentos.
Dos corridas por día no sirven: el margen restante al agotarse sería de 23 h.

Costo por corrida: 1 consulta BNA, ⌈N/100⌉ + 1 consultas a Supabase y **N GET a MP** (+2 GET y 1 PUT por
suscripción dentro de ventana). Sin lógica de corte previo, 24 corridas/día = 24·N GET por día.
Se procesa en serie: con ~0,3 s por GET, 40 s alcanzan para ~100–130 suscripciones por corrida. Por encima
de eso hay que paralelizar con tope o evitar el GET de las suscripciones lejanas; hoy se prioriza por
urgencia y se informa la truncada. Un cron horario exige plan Vercel que lo permita (los crons existentes
de `vercel.json` ya son más frecuentes que diarios; confirmar el plan).

## 5. Monitoreo independiente (heartbeat)

Implementado, sin servicios externos instalados:

- Cada corrida real escribe en `plus_cron_heartbeat` (job `renovacion-ars:<ambiente>`): última ejecución,
  último estado (`ok`, `parcial`, `fallida`) y resumen. También lo escribe la corrida fail-closed.
- `GET /api/pagos/plus/heartbeat` (Bearer `PLUS_MONITOR_SECRET`, **distinto de `CRON_SECRET`**; sin el
  secreto la ruta devuelve 401 siempre):
  - `200` al día (o parcial) · `503` con `ejecucion_faltante` (> `PLUS_HEARTBEAT_EDAD_MAX_MIN`, por defecto
    180 min = 3 corridas horarias), `ultima_corrida_fallida`, `nunca_ejecutado` o `heartbeat_no_disponible`.
  - La respuesta no incluye datos de usuarios ni secretos.
- Un monitor externo que consulta la URL cada 5–10 min detecta la falta de corridas aunque el cron no
  pueda enviar nada.

Propuesta (requiere autorización; no instalado ni contratado): un monitor de uptime que permita header
`Authorization` (p. ej. Better Stack, UptimeRobot o cron-job.org) o un workflow programado en GitHub
Actions con el secreto guardado como secret del repositorio. Si el servicio no admite headers, usar la
consulta SQL de verificación (`select ultima_ejecucion_en, ultimo_estado from plus_cron_heartbeat`) como
control manual diario durante las primeras semanas.
Variables nuevas (las carga la persona responsable en Vercel; no se modificaron):
`PLUS_MONITOR_SECRET`, opcional `PLUS_HEARTBEAT_EDAD_MAX_MIN`.

## 6. Validación del SQL pendiente

`supabase/pendiente/plus-auditoria-renovacion.sql` fue revisado contra las consultas del cron:

| Punto | Resultado |
|---|---|
| Tablas existentes | `plus_cotizacion_auditoria` ya existe con `suscripcion_id not null`, `operacion` con check que incluye `actualizacion_pre_renovacion`. Las columnas nuevas son aditivas. |
| Columnas del cron | `COLUMNAS_AUDITORIA` (25) coincide con la migración y con el bloque 1b de la verificación. |
| Reserva atómica | Primer intento: INSERT contra índice único parcial (`23505` para quien pierde). Siguientes: `UPDATE … WHERE id AND intentos = previo` (un statement con bloqueo de fila; en READ COMMITTED el segundo ve 0 filas). |
| Restricciones | Se corrigió la búsqueda de constraints por `conrelid` (antes solo por nombre) y se agregó check de `ambiente`. |
| RLS/permisos | Se reafirman RLS + `revoke` a anon/authenticated + `grant` a service_role en auditoría y heartbeat; sin políticas. |
| Idempotencia | `add column if not exists`, `create … if not exists`, constraints condicionales: se puede repetir. |
| Heartbeat | Tabla nueva incluida en la misma migración. |

Verificación posterior: `supabase/pendiente/plus-auditoria-renovacion-verificacion.sql` (solo lectura, con el
resultado esperado de cada bloque). **No se ejecutó ningún SQL.**

## 7. Procedimiento manual: actualización imposible antes del cobro

Sin tolerancia automática y sin pausas ni cancelaciones automáticas. Cuando llegue una alerta
`urgente`/`critico`/`agotado` o `renovacion_vencida`/`cobro_inminente`:

1. **Verificar en Mercado Pago** (panel o API de solo lectura): estado, `next_payment_date` y
   `transaction_amount` vigentes. Anotar la hora.
2. **Calcular el importe esperado**: US$ 4,20 × billete vendedor BNA vigente (misma lógica del cron).
   Anotar fuente y hora de la cotización.
3. **Si la causa es transitoria** (BNA/MP caídos y ya volvieron): reabrir la incidencia agotada con el SQL
   del runbook de la migración y esperar la corrida siguiente (no hacer PUT a mano si el cron puede).
4. **Si no hay forma de corregir antes del cobro**, decide una persona responsable (no el sistema):
   - Importe en MP **mayor** al esperado (el usuario pagaría de más): pausar a mano en MP antes del
     cobro, avisar al usuario por correo (motivo, nuevo plazo), corregir importe, verificar con GET,
     reanudar y conciliar. El efecto de pausar/reanudar sobre `next_payment_date` **no está verificado**
     en sandbox: probarlo antes de depender de este paso.
   - Importe **menor** al esperado: el dueño decide entre dejar cobrar (registrar la diferencia) o
     pausar. No se aplica ninguna tolerancia porcentual por defecto.
5. **Después del cobro**: comparar `plus_pagos_recurrentes` con el importe esperado; si hubo
   diferencia en contra del usuario, reembolsar la diferencia desde MP.
6. **Cerrar la incidencia** (SQL manual, ejemplo): `update public.plus_cotizacion_auditoria set
   estado_final = 'descartado', detalle = 'resuelto_manual', resuelta_en = now()
   where clave_incidencia = 'renov:<SUSCRIPCION_UUID>:<FECHA_ISO_UTC>';`
7. Registrar causa, decisión y responsable.

## 8. Aplicar y verificar la migración (manual)

1. **Confirmar cuántos proyectos Supabase hay.** El `.env` local apunta al proyecto cuyo identificador es
   `ymjioirldwsenwcsfpsy`. En Vercel (Production y Preview) comparar el subdominio de
   `NEXT_PUBLIC_SUPABASE_URL`. Si es el mismo proyecto: **aplicar una sola vez** (sandbox y producción se
   distinguen por la columna `ambiente`). Si son distintos: aplicar en cada uno, una vez cada uno.
2. En el panel de Supabase del proyecto, SQL Editor → pegar el contenido completo de
   `supabase/pendiente/plus-auditoria-renovacion.sql` (sin las secciones comentadas) → Run. Es seguro repetirlo.
3. Pegar y ejecutar `supabase/pendiente/plus-auditoria-renovacion-verificacion.sql` bloque a bloque y
   comprobar el resultado esperado indicado en cada uno (1b y 8 devuelven 0 filas; permisos solo
   `service_role`; RLS `true`; sin políticas).
4. Cargar en Vercel (persona responsable): `PLUS_MONITOR_SECRET`, `PLUS_ALERT_EMAIL`,
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`. Probar un correo real de alerta y la ruta
   `heartbeat` (debe dar 503 `nunca_ejecutado` antes de la primera corrida).
5. Primera ejecución del cron: solo de forma deliberada y supervisada, sobre sandbox, con el dry-run
   previo (`scripts/dry-run-renovacion-plus.mjs`). Verificar `plus_cron_heartbeat` y que no haya filas
   nuevas inesperadas en `plus_cotizacion_auditoria`.
6. Recién entonces, y con autorización, agregar a `vercel.json` el cron `45 * * * *`.

## 9. Riesgos que persisten

- Procesamiento en serie: unas ~100–130 suscripciones por corrida de 40 s; más allá se trunca (informado).
- Los GET a MP crecen linealmente con las suscripciones activas (24·N por día).
- Pausa/reanudación en MP no verificada en sandbox.
- Alertas solo por correo (Resend); el monitor externo es la segunda línea y falta contratarlo.
- La alerta de esquema ausente se repite en cada corrida mientras no se migre (no hay BD donde deduplicar).
- Si sandbox y producción son proyectos distintos, hay que migrar ambos.
