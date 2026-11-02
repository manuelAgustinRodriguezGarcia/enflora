import "server-only";

import { fechaHoy } from "@/lib/etapas";
import { armarPanel, especificacionesInicio } from "@/lib/inicio/resumen";

function tablaAusente(error, tabla) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (texto.toLowerCase().includes(String(tabla).toLowerCase())) return true;
  return ["PGRST200", "PGRST205", "42P01"].includes(error?.code);
}

async function ejecutar(supabase, spec) {
  let consulta = supabase.from(spec.tabla).select(spec.select);
  for (const [columna, valor] of spec.eq || []) consulta = consulta.eq(columna, valor);
  for (const [columna, valor] of spec.in || []) consulta = consulta.in(columna, valor);
  for (const [columna, valor] of spec.is || []) consulta = consulta.is(columna, valor);
  for (const [columna, opciones] of spec.orden || []) consulta = consulta.order(columna, opciones);
  if (spec.limite) consulta = consulta.limit(spec.limite);

  const { data, error } = await consulta;
  if (!error) return { ok: true, filas: data || [], ausente: false };
  return { ok: false, filas: [], ausente: tablaAusente(error, spec.tabla), codigo: error.code || "" };
}

export async function cargarPanelInicio(supabase, usuarioId, { hoy = fechaHoy() } = {}) {
  const specs = especificacionesInicio(usuarioId);
  const claves = Object.keys(specs);
  const resultados = await Promise.all(claves.map((clave) => ejecutar(supabase, specs[clave])));
  const entrada = { hoy };
  claves.forEach((clave, indice) => {
    entrada[clave] = resultados[indice];
  });
  return armarPanel(entrada);
}
