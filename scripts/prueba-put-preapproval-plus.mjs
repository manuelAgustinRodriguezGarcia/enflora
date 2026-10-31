/**
 * Prueba controlada de PUT /preapproval en sandbox (PLAN 420). Independiente del cron.
 *
 * Suscripción de prueba FIJA (no se acepta otro ID). Secuencia:
 *   GET 6552 -> PUT 6804 -> GET 6804 -> PUT 6552 -> GET 6552
 *
 * Dry-run (por defecto): solo GET a Mercado Pago y lectura en Supabase. Cero PUT.
 *   node --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
 *     scripts/prueba-put-preapproval-plus.mjs
 *
 * Ejecución real (solo con autorización explícita):
 *   node --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
 *     scripts/prueba-put-preapproval-plus.mjs --autorizo-put-real=SANDBOX-d4039c16-6552-6804
 *
 * Código de salida: 0 = ok, 1 = rechazada/fallida con importe restaurado o sin PUT,
 * 2 = RESTAURACIÓN FALLIDA (intervención manual).
 */
import { ejecutarPruebaPutPreapproval } from "../lib/pagos/plus/prueba-put-preapproval.js";
import { obtenerCotizacionBilleteVendedor } from "../lib/pagos/cotizacion-bna.js";
import { clientePagos } from "../lib/pagos/datos.js";

const PREFIJO = "--autorizo-put-real";
let autorizacion = null;
for (const a of process.argv.slice(2)) {
  if (a === PREFIJO) {
    autorizacion = "";
  } else if (a.startsWith(`${PREFIJO}=`)) {
    autorizacion = a.slice(PREFIJO.length + 1);
  } else {
    console.error(`Argumento no permitido: ${a.split("=")[0]}. Solo se admite ${PREFIJO}=<clave>.`);
    process.exit(1);
  }
}

const resultado = await ejecutarPruebaPutPreapproval({
  autorizacion,
  supabase: clientePagos(),
  obtenerCotizacion: obtenerCotizacionBilleteVendedor,
});

console.log(JSON.stringify(resultado, null, 2));
if (resultado.restaurado === false && resultado.codigo === "restauracion_fallida") process.exit(2);
process.exit(resultado.ok ? 0 : 1);
