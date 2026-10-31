/**
 * Dry-run del cron de renovación ARS de Plus (PLAN 420).
 *
 * Solo hace GET reales a Mercado Pago y a BNA. NO ejecuta PUT, NO escribe en Supabase
 * (ni siquiera se crea el cliente). El fetch real rechaza cualquier método distinto de GET.
 *
 * Uso:
 *   node --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
 *     scripts/dry-run-renovacion-plus.mjs --preapproval <id> [--sub <uuid>] [--importe-actual 6552.00]
 *     [--ahora 2026-11-28T12:00:00-03:00] [--simular-put ok|fallo] [--importe-get 6552]
 *
 * --ahora: reloj simulado SOLO para evaluar la ventana de 72 h (no cambia nada en MP).
 *          La cotización BNA se evalúa con la hora real.
 * --bna-simulada: reemplaza el billete vendedor (ej. "1.620,00") para ver un PUT previsto.
 */
import { ejecutarCronRenovacionImportePlus } from "../lib/pagos/plus/cron-renovacion-ars.js";
import { obtenerCotizacionBilleteVendedor } from "../lib/pagos/cotizacion-bna.js";
import { textoArAEscala4 } from "../lib/pagos/dinero.js";

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const preapprovalId = arg("preapproval");
if (!preapprovalId) {
  console.error("Falta --preapproval <id>");
  process.exit(1);
}

const ahoraTexto = arg("ahora");
const ahora = ahoraTexto ? new Date(ahoraTexto) : new Date();
if (Number.isNaN(ahora.getTime())) {
  console.error("--ahora inválido");
  process.exit(1);
}

const simularPut = arg("simular-put");
const simulacion = simularPut
  ? {
      putOk: simularPut !== "fallo",
      importeGet: arg("importe-get") !== undefined ? Number(arg("importe-get")) : undefined,
    }
  : null;

const bnaSimulada = arg("bna-simulada");

const resultado = await ejecutarCronRenovacionImportePlus({
  supabase: null,
  dryRun: true,
  ahora,
  simulacion,
  obtenerCotizacion: () => {
    if (!bnaSimulada) return obtenerCotizacionBilleteVendedor(new Date());
    const venta = textoArAEscala4(bnaSimulada);
    if (!venta) throw new Error("--bna-simulada inválido (ej. 1.620,00)");
    return Promise.resolve({
      ok: true,
      edadDias: 0,
      cotizacion: {
        venta,
        tipo: "billete_vendedor",
        punta: "vendedor",
        publicadaEn: new Date().toISOString(),
        fuente: "SIMULADA",
      },
    });
  },
  candidatas: [
    {
      id: arg("sub") || "local-desconocido",
      preapproval_id: preapprovalId,
      estado_interno: "activa",
      ambiente: "prueba",
      importe_ars: arg("importe-actual") || null,
    },
  ],
});

console.log(JSON.stringify({ relojUsado: ahora.toISOString(), resultado }, null, 2));
