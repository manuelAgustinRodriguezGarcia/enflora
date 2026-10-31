/**
 * Prueba final de cancelación de Plus en sandbox, sobre la suscripción de prueba FIJA.
 *
 * Dry-run (por defecto): solo GET a Mercado Pago y lectura en Supabase. No cancela nada.
 *   node --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
 *     scripts/prueba-cancelacion-plus.mjs
 *
 * Ejecución real (IRREVERSIBLE: una suscripción cancelada en Mercado Pago no se reactiva):
 *   node --experimental-detect-module --import ./tests/register-alias.mjs --env-file=.env \
 *     scripts/prueba-cancelacion-plus.mjs --autorizo-cancelacion-real=SANDBOX-CANCELAR-d4039c16
 *
 * Verifica: cancelación en MP, sin nuevos pagos, beneficios hasta fin del período pagado,
 * filas de suscripción y pagos conservadas, licencias de pago único sin cambios.
 * Código de salida: 0 = todo verificado (o dry-run correcto), 1 = fallo.
 */
import { clientePagos } from "../lib/pagos/datos.js";
import { leerAmbientePagos } from "../lib/pagos/ambiente.js";
import { cancelarSuscripcionPlus } from "../lib/pagos/plus/gestion-servidor.js";
import { consultarPlusActivo } from "../lib/pagos/plus/leer-plus-activo.js";
import {
  buscarAuthorizedPaymentsPreapproval,
  obtenerPreapproval,
} from "../lib/pagos/plus/preapproval-api.js";

const PREAPPROVAL_ID = "d4039c1610894346925cef3997470afc";
const SUSCRIPCION_ID = "2d239f9f-2986-4c25-86ad-c31904dec8a5";
const CLAVE = "SANDBOX-CANCELAR-d4039c16";
const PREFIJO = "--autorizo-cancelacion-real";

let autorizacion = null;
for (const a of process.argv.slice(2)) {
  if (a.startsWith(`${PREFIJO}=`)) autorizacion = a.slice(PREFIJO.length + 1);
  else {
    console.error(`Argumento no permitido. Solo se admite ${PREFIJO}=<clave>.`);
    process.exit(1);
  }
}
const real = autorizacion !== null;
const verificaciones = {};
const falla = (codigo, extra = {}) => {
  console.log(JSON.stringify({ ok: false, modo: real ? "real" : "dry-run", codigo, ...extra }, null, 2));
  process.exit(1);
};

if (real && autorizacion !== CLAVE) falla("autorizacion_invalida");
if (process.env.NODE_ENV === "production") falla("produccion_rechazada");
if (String(process.env.MERCADOPAGO_ENV || "").trim() !== "prueba") falla("ambiente_no_es_prueba");
if (process.env.PAYMENTS_LIVE_ENABLED === "true") falla("cobros_reales_habilitados");
const ambiente = leerAmbientePagos();
if (!ambiente.ok) falla(ambiente.codigo);
const supabase = clientePagos();
if (!supabase) falla("sin_supabase");

async function instantanea() {
  const sub = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("id", SUSCRIPCION_ID)
    .eq("preapproval_id", PREAPPROVAL_ID)
    .maybeSingle();
  const pagos = await supabase
    .from("plus_pagos_recurrentes")
    .select("id, authorized_payment_id, estado_interno")
    .eq("suscripcion_id", SUSCRIPCION_ID);
  if (sub.error || !sub.data || pagos.error) throw new Error("lectura_supabase_fallida");
  const usuarioId = sub.data.usuario_id;
  const licencias = await supabase.from("licencias_cultivo").select("*").eq("usuario_id", usuarioId);
  const pagosUnicos = await supabase.from("pagos").select("id, estado").eq("usuario_id", usuarioId);
  if (licencias.error || pagosUnicos.error) throw new Error("lectura_licencias_fallida");
  const remoto = await obtenerPreapproval(PREAPPROVAL_ID);
  const pagosMp = await buscarAuthorizedPaymentsPreapproval(PREAPPROVAL_ID);
  const plus = await consultarPlusActivo(supabase, usuarioId);
  return {
    sub: sub.data,
    pagos: pagos.data || [],
    licencias: licencias.data || [],
    pagosUnicos: pagosUnicos.data || [],
    remoto,
    idsPagosMp: (pagosMp?.results || []).map((p) => String(p.id)).sort(),
    plus,
    usuarioId,
  };
}

let antes;
try {
  antes = await instantanea();
} catch (error) {
  falla("lectura_inicial_fallida", { detalle: error?.message || null });
}

const resumen = (s) => ({
  estadoMp: s.remoto?.status ?? null,
  proximoCobroMp: s.remoto?.next_payment_date ?? null,
  estadoLocal: s.sub.estado_interno,
  periodoVigenteHasta: s.sub.periodo_vigente_hasta,
  pagosLocales: s.pagos.length,
  pagosAutorizadosMp: s.idsPagosMp.length,
  licenciasPagoUnico: s.licencias.length,
  beneficiosPlusActivos: s.plus.activo,
});

if (!real) {
  console.log(JSON.stringify({ ok: true, modo: "dry-run", antes: resumen(antes) }, null, 2));
  process.exit(0);
}

if (String(antes.remoto?.status).toLowerCase() !== "authorized") falla("no_esta_authorized", { antes: resumen(antes) });
if (antes.sub.estado_interno !== "activa") falla("estado_local_no_activa", { antes: resumen(antes) });
if (!antes.plus.activo) falla("sin_beneficios_antes", { antes: resumen(antes) });

const resultado = await cancelarSuscripcionPlus({
  supabase,
  suscripcionId: SUSCRIPCION_ID,
  usuarioId: antes.usuarioId,
});
if (!resultado.ok) falla("cancelacion_fallida", { resultado, antes: resumen(antes) });

const despues = await instantanea();
verificaciones.canceladaEnMp = ["cancelled", "canceled"].includes(String(despues.remoto?.status).toLowerCase());
verificaciones.estadoLocalCancelada = despues.sub.estado_interno === "cancelada";
verificaciones.sinNuevosPagosMp = JSON.stringify(despues.idsPagosMp) === JSON.stringify(antes.idsPagosMp);
verificaciones.sinNuevosPagosLocales = despues.pagos.length === antes.pagos.length;
verificaciones.beneficiosHastaFinDePeriodo =
  despues.plus.activo === true && despues.sub.vigente_hasta_fin_periodo === true;
verificaciones.periodoPagadoIntacto = despues.sub.periodo_vigente_hasta === antes.sub.periodo_vigente_hasta;
verificaciones.suscripcionNoBorrada = Boolean(despues.sub.id);
verificaciones.licenciasPagoUnicoIntactas =
  JSON.stringify(despues.licencias) === JSON.stringify(antes.licencias) &&
  JSON.stringify(despues.pagosUnicos) === JSON.stringify(antes.pagosUnicos);

const ok = Object.values(verificaciones).every(Boolean);
console.log(
  JSON.stringify({ ok, modo: "real", verificaciones, antes: resumen(antes), despues: resumen(despues) }, null, 2),
);
console.log(
  "Pendiente de comprobar a mano: que a la fecha del próximo cobro original NO aparezca ningún débito nuevo.",
);
process.exit(ok ? 0 : 1);
