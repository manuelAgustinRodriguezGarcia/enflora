import "server-only";

export const TAMANO_PAGINA = 100;
/** Tope duro de suscripciones por corrida (evita lecturas sin límite). */
export const MAX_SUSCRIPCIONES_CORRIDA = 5000;

const COLUMNAS = "id, preapproval_id, estado_interno, proxima_renovacion, importe_ars, ambiente";

function fechaOrden(suscripcion) {
  const t = suscripcion.proxima_renovacion ? new Date(suscripcion.proxima_renovacion).getTime() : NaN;
  return Number.isNaN(t) ? -Infinity : t; // sin fecha local: primero (más incierta)
}

/** Más urgentes primero (fecha local ascendente, sin fecha al inicio), desempate por id. */
export function ordenarPorUrgencia(suscripciones) {
  return [...suscripciones].sort((a, b) => {
    const fa = fechaOrden(a);
    const fb = fechaOrden(b);
    if (fa !== fb) return fa < fb ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Quita ids repetidos conservando el orden. */
export function sinDuplicados(suscripciones) {
  const vistos = new Set();
  const unicas = [];
  for (const s of suscripciones) {
    if (!s || vistos.has(s.id)) continue;
    vistos.add(s.id);
    unicas.push(s);
  }
  return unicas;
}

/**
 * Lee TODAS las suscripciones elegibles del ambiente con paginación por clave (id): cada
 * consulta tiene límite, ninguna suscripción se omite ni se repite. Una página que falla se
 * reintenta una vez; si vuelve a fallar se devuelve lo leído con `parcial: true`.
 */
export async function leerSuscripcionesElegibles(
  supabase,
  { ambiente, tamanoPagina = TAMANO_PAGINA, maxTotal = MAX_SUSCRIPCIONES_CORRIDA },
) {
  const acumuladas = [];
  const vistos = new Set();
  let ultimoId = null;
  let paginas = 0;
  let parcial = false;
  let limiteAlcanzado = false;

  while (true) {
    let pagina = null;
    for (let intento = 0; intento < 2 && !pagina; intento += 1) {
      let consulta = supabase
        .from("plus_suscripciones")
        .select(COLUMNAS)
        .eq("estado_interno", "activa")
        .eq("ambiente", ambiente)
        .not("preapproval_id", "is", null)
        .order("id", { ascending: true });
      if (ultimoId) consulta = consulta.gt("id", ultimoId);
      const { data, error } = await consulta.limit(tamanoPagina);
      if (!error) pagina = data || [];
    }
    if (!pagina) {
      parcial = true;
      break;
    }
    paginas += 1;
    for (const fila of pagina) {
      if (vistos.has(fila.id)) continue;
      vistos.add(fila.id);
      acumuladas.push(fila);
    }
    if (acumuladas.length >= maxTotal) {
      limiteAlcanzado = acumuladas.length > maxTotal || pagina.length >= tamanoPagina;
      acumuladas.length = Math.min(acumuladas.length, maxTotal);
      break;
    }
    if (pagina.length < tamanoPagina) break;
    const nuevoUltimo = pagina[pagina.length - 1].id;
    if (nuevoUltimo === ultimoId) break; // sin avance: evita bucles
    ultimoId = nuevoUltimo;
  }

  return { candidatas: acumuladas, paginas, parcial, limiteAlcanzado };
}
