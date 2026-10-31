# PLAN 420 — Cron de renovación ARS (auditoría y dry-run)

## Dry-run

```
node --no-warnings --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
  scripts/dry-run-renovacion-plus.mjs --preapproval <id> --sub <uuid> \
  [--ahora 2026-11-28T12:00:00-03:00] [--bna-simulada "1.620,00"] [--simular-put ok|fallo] [--importe-get N]
```

- Solo GET reales (MP y BNA). El fetch real rechaza cualquier método ≠ GET. No crea cliente Supabase.
- `--ahora` solo mueve el reloj de la ventana de 72 h. No cambia nada en MP.
- `--simular-put` / `--importe-get` ejecutan PUT y GET de confirmación contra un fetch falso (sin red).
- En código: `ejecutarCronRenovacionImportePlus({ dryRun: true, ahora, simulacion, candidatas, obtenerCotizacion })`.

## Riesgo crítico: "bloqueado" en Supabase NO frena a Mercado Pago

`accion: "bloqueado"` solo inserta una fila en `plus_cotizacion_auditoria`. La suscripción en MP sigue
`authorized` y MP debitará `auto_recurring.transaction_amount` vigente en `next_payment_date`.
Si BNA falla, o el PUT falla, el usuario paga el ARS anterior (puede ser menor al US$4,20 real).

### Solución segura propuesta (NO implementada)

1. Alerta humana inmediata (mail/push al admin) cuando haya `bloqueado`/`put_fallido` con renovación < 48 h.
   Hoy solo queda una fila de auditoría que nadie mira.
2. Reintentos del cron cada pocas horas dentro de la ventana (ya corre 2 veces/día; subir a cada 3-4 h
   solo en ventana) y con cotización BNA "última válida" ≤ 7 días (ya soportado).
3. Decisión de negocio para el residual, en orden de preferencia:
   a. Aceptar el cobro al ARS vigente si la diferencia es ≤ umbral (p. ej. 5 %) y registrar la diferencia.
   b. Pausar la suscripción en MP (`PUT status=paused`) T-12 h **solo con confirmación manual** del admin
      y aviso al usuario; reanudar al corregir el importe. Nunca automático.
   c. Reembolso/ajuste posterior si se cobró de menos/más (requiere proceso manual).
4. Estado local distinto: `renovacion_importe_pendiente` (flag) para que la UI avise y soporte lo vea,
   sin tocar `estado_interno`.
5. No usar cancelación automática como "freno": pierde al cliente y es irreversible.

## Hallazgos de la auditoría

| # | Hallazgo | Estado |
|---|---|---|
| 1 | El cron usaba `proxima_renovacion` de Supabase, no el GET a MP | Corregido: GET por suscripción, fecha/estado/importe de MP |
| 2 | No filtraba por `ambiente` (prueba/producción) | Corregido: `.eq("ambiente", actual)` + omisión por fila |
| 3 | Sin idempotencia: cada corrida en ventana repetía PUT | Corregido: omite si MP ya tiene el importe (`importe_ya_vigente`) |
| 4 | MP `paused/cancelled` no se consideraba (solo estado local) | Corregido: omite si MP ≠ `authorized` |
| 5 | `actualizado_en` usaba `new Date()` en vez del reloj inyectado | Corregido |
| 6 | Fallos en GET/PUT lanzaban excepción y cortaban el lote | Corregido: se captura por suscripción |
| 7 | Cálculo ARS: `420 × venta(escala 4) / 10000` en centavos → `6552.00` | Sin error ×100 (test 2-3) |
| 8 | `x-vercel-cron: 1` se acepta sin secreto; es un header falsificable | Corregido: solo `Authorization: Bearer <CRON_SECRET>` (`cron-auth.js`). Mismo patrón sigue en `reconciliar` y `cotizacion/actualizar` (fuera de alcance) |
| 9 | Cada corrida en ventana con BNA caído inserta otra fila de auditoría | Corregido: una fila por renovación (ver `PLAN-420-SEGURIDAD-OPERATIVA-RENOVACIONES.md`; requiere migración pendiente) |
| 10 | Cron no registrado en `vercel.json` | Intencional |
