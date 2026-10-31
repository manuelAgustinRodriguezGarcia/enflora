/**
 * Verificación post-migración Plus (solo lectura).
 * Uso: node scripts/verificar-plus-supabase.mjs
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
 */
import { createClient } from "@supabase/supabase-js";

const TABLAS = [
  "plus_suscripciones",
  "plus_pagos_recurrentes",
  "plus_notificaciones",
  "plus_cotizacion_auditoria",
];

const COLUMNAS_ESPERADAS = {
  plus_suscripciones: new Set([
    "id",
    "usuario_id",
    "ambiente",
    "preapproval_id",
    "external_reference",
    "estado_interno",
    "estado_mp",
    "precio_usd",
    "importe_ars",
    "cotizacion_valor",
    "periodo_vigente_hasta",
    "proxima_renovacion",
    "vigente_hasta_fin_periodo",
    "cancelada_en",
  ]),
};

function fallo(mensaje) {
  console.error(`[plus-verificacion] FALLO: ${mensaje}`);
  process.exitCode = 1;
}

function ok(mensaje) {
  console.log(`[plus-verificacion] OK: ${mensaje}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !clave) {
  fallo("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(0);
}

const supabase = createClient(url, clave, { auth: { persistSession: false } });

for (const tabla of TABLAS) {
  const { error } = await supabase.from(tabla).select("id", { count: "exact", head: true });
  if (error) {
    fallo(`Tabla ${tabla}: ${error.message}`);
  } else {
    ok(`Tabla ${tabla} accesible (service_role)`);
  }
}

const { data: muestra, error: errorMuestra } = await supabase
  .from("plus_suscripciones")
  .select("*")
  .limit(1);
if (errorMuestra) {
  fallo(`Lectura plus_suscripciones: ${errorMuestra.message}`);
} else if (muestra?.[0]) {
  const faltantes = [...COLUMNAS_ESPERADAS.plus_suscripciones].filter((c) => !(c in muestra[0]));
  if (faltantes.length) fallo(`Columnas ausentes en fila muestra: ${faltantes.join(", ")}`);
  else ok("Columnas críticas presentes en plus_suscripciones");
} else {
  ok("plus_suscripciones vacía (columnas no contrastadas con fila)");
}

console.log("[plus-verificacion] RPC Plus: no requeridas en iteración 2 (persistencia vía service_role).");
console.log("[plus-verificacion] Fin.");
