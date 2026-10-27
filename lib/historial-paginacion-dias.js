import { compararEventos, diaArgentina } from "@/lib/historial-registros";

export const DIAS_POR_PAGINA_HISTORIAL = 10;

/** Agrupa registros hidratados por día civil (Argentina), del más reciente al más antiguo. */
export function agruparRegistrosPorDia(registros) {
  const mapa = new Map();
  const ordenados = [...(registros || [])].sort(compararEventos);
  for (const registro of ordenados) {
    const dia = diaArgentina(registro.fecha_evento);
    if (!dia) continue;
    const lista = mapa.get(dia);
    if (lista) lista.push(registro);
    else mapa.set(dia, [registro]);
  }
  const dias = [...mapa.keys()].sort((a, b) => (a < b ? 1 : -1));
  return dias.map((fecha) => ({ fecha, registros: mapa.get(fecha) || [] }));
}

/**
 * Deja solo los N días calendario más recientes presentes en la lista.
 * Si sobran registros de un día que quedaría fuera, se eliminan (ese día no se muestra incompleto al borde).
 */
export function recortarRegistrosPorDias(registros, diasMaximo) {
  if (!diasMaximo || diasMaximo <= 0) return { registros: [], diasCompletos: 0, hayDiasOmitidos: false };
  const grupos = agruparRegistrosPorDia(registros);
  const visibles = grupos.slice(0, diasMaximo);
  const fechas = new Set(visibles.map((grupo) => grupo.fecha));
  const recortados = registros.filter((registro) => fechas.has(diaArgentina(registro.fecha_evento)));
  return {
    registros: recortados,
    diasCompletos: visibles.length,
    hayDiasOmitidos: grupos.length > visibles.length,
  };
}

/**
 * Acumula páginas de registros hasta cubrir al menos `diasObjetivo` días completos
 * o agotar el historial. Devuelve el cursor para la siguiente carga (último registro incluido).
 */
export function fusionarLotePorDias(lotes, diasObjetivo) {
  const mapa = new Map();
  for (const registro of lotes) {
    if (!registro?.id) continue;
    mapa.set(registro.id, registro);
  }
  const todos = [...mapa.values()].sort(compararEventos);
  const grupos = agruparRegistrosPorDia(todos);
  const hayMasEnLote = grupos.length > diasObjetivo;
  const { registros, diasCompletos, hayDiasOmitidos } = recortarRegistrosPorDias(todos, diasObjetivo);
  const ultimo = registros[registros.length - 1];
  const cursor =
    ultimo && (hayDiasOmitidos || hayMasEnLote)
      ? { fecha: ultimo.fecha_evento, id: ultimo.id }
      : null;
  return {
    registros,
    diasCargados: diasCompletos,
    hayMas: Boolean(cursor),
    cursor,
  };
}
