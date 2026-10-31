# Monitoreo independiente de renovaciones Plus (Better Stack)

Endpoint: `GET /api/pagos/plus/heartbeat`. Es de solo lectura: consulta una fila de `plus_cron_heartbeat`.

## Respuestas

| Estado | Cuerpo | Significado |
|---|---|---|
| 200 | `{ ok: true, motivo: "al_dia" \| "corrida_parcial", edadMin }` | Última corrida reciente y no fallida |
| 401 | `{ ok: false }` | Falta el encabezado, el secreto es incorrecto o `PLUS_MONITOR_SECRET` no está definido |
| 503 | `motivo: "ejecucion_faltante"` | Pasaron más de `PLUS_HEARTBEAT_EDAD_MAX_MIN` minutos (defecto 180) sin corrida |
| 503 | `motivo: "ultima_corrida_fallida"` | La última corrida terminó fallida |
| 503 | `motivo: "nunca_ejecutado"` | No hay fila de heartbeat para el ambiente |
| 503 | `motivo: "heartbeat_no_disponible"` | Error al leer la tabla (por ejemplo, migración ausente) |
| 503 | `motivo: "sin_servicio"` | Ambiente de pagos o cliente de base de datos no configurados |

Ninguna respuesta incluye datos de usuarios ni secretos.

## Variables de entorno (Vercel, solo el entorno que corresponda)

- `PLUS_MONITOR_SECRET`: secreto largo y aleatorio, distinto de `CRON_SECRET`.
- `PLUS_HEARTBEAT_EDAD_MAX_MIN` (opcional): antigüedad máxima tolerada; defecto 180.

## Configuración en Better Stack (cuando se autorice)

1. Uptime > Monitors > Create monitor.
2. Tipo: HTTP(S) monitor (status code). URL: `https://<dominio>/api/pagos/plus/heartbeat`.
3. Método: `GET`.
4. Request headers: `Authorization: Bearer <PLUS_MONITOR_SECRET>` (guardar el valor solo en Better Stack).
5. Estado esperado: `200` (el monitor falla ante 401, 503 o timeout).
6. Frecuencia: cada 5 minutos. El umbral de 180 minutos hace innecesario consultar más seguido.
7. Confirmación: 2 comprobaciones fallidas consecutivas antes de alertar, para evitar falsos positivos por despliegues.
8. Timeout: 15 s. Seguimiento de redirecciones: desactivado.
9. Destinatarios: un canal distinto del correo Resend del cron.
10. Prueba previa sin efectos: con el secreto correcto y antes de la primera corrida, la respuesta debe ser 503 `nunca_ejecutado`. Con un secreto incorrecto, 401.

## Garantías de solo lectura

- La ruta exporta únicamente `GET`; otros métodos reciben 405.
- Usa solo `.select(...).maybeSingle()` sobre `plus_cron_heartbeat`. No invoca el cron, Mercado Pago ni escribe en base de datos.
- `PLUS_MONITOR_SECRET` no sirve en las rutas de cron, que usan `CRON_SECRET`; y `CRON_SECRET` no sirve en el heartbeat.
- La escritura del heartbeat ocurre únicamente en el cron (`registrarHeartbeat`).

## Archivos mínimos para publicar

Imprescindibles:

- `app/api/pagos/plus/heartbeat/route.js`
- `lib/pagos/plus/heartbeat-cron.js`

Ya presentes en `main` (sin cambios): `lib/pagos/ambiente.js`, `lib/pagos/datos.js`.

Recomendados: este runbook y el test del heartbeat.

Base de datos: tabla `plus_cron_heartbeat` (bloque 2 de `supabase/pendiente/plus-auditoria-renovacion.sql`). Sin ella el endpoint responde 503 `heartbeat_no_disponible`.

El heartbeat no se publica aislado: sin el cron que lo escribe respondería 503 `nunca_ejecutado`. Se publica junto con el cron, las alertas y la auditoría (ver `RUNBOOK-PRODUCCION-MERCADOPAGO.md`).

El monitor se crea solo después de activar `PLUS_LIVE_ENABLED` y de que el cron haya escrito su primera corrida en Production.
