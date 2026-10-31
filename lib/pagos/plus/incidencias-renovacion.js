import "server-only";

/**
 * Incidencias de renovación ARS de Plus (PLAN 420, seguridad operativa).
 *
 * Una incidencia = una fila de `plus_cotizacion_auditoria` identificada por
 * `clave_incidencia` = suscripción + próxima renovación (según Mercado Pago). Se ACTUALIZA en
 * cada corrida en vez de insertar una fila nueva, y concentra: intentos, último error,
 * importe esperado/remoto, cotización y estado final. Requiere la migración
 * `supabase/pendiente/plus-auditoria-renovacion.sql` (no se ejecuta automáticamente).
 *
 * La reserva de un intento de PUT es atómica: INSERT contra índice único (primer intento) o
 * UPDATE condicionado a `intentos` previos (reintentos). Dos corridas simultáneas nunca
 * hacen el mismo PUT.
 */

export const TABLA_AUDITORIA = "plus_cotizacion_auditoria";
export const OPERACION_RENOVACION = "actualizacion_pre_renovacion";

/** Intentos de PUT por renovación. Cada intento puede hacer 1 PUT + 1 GET a Mercado Pago. */
export const MAX_INTENTOS_PUT = 5;
/** Espera mínima (min) después del intento N antes de reintentar. Tras el último → agotado. */
const ESPERA_TRAS_INTENTO_MIN = { 1: 30, 2: 120, 3: 360, 4: 720 };
/** Con poco margen hasta el cobro se acorta la espera (sin superar MAX_INTENTOS_PUT). */
export const ESPERA_CERCA_COBRO_MIN = 30;
export const HORAS_NIVEL_CRITICO = 6;
export const HORAS_NIVEL_URGENTE = 24;

export const ESTADOS_ABIERTOS = ["pendiente", "bloqueado", "agotado"];
export const NIVELES_ALERTA = ["aviso", "urgente", "critico", "agotado"];

/**
 * Columnas que el cron necesita. Se piden por nombre (no `*`) para que la ausencia de una
 * columna de la migración haga fallar la lectura y el cron se detenga (fail-closed).
 */
export const COLUMNAS_AUDITORIA = [
  "id",
  "clave_incidencia",
  "suscripcion_id",
  "ambiente",
  "operacion",
  "renovacion_ref",
  "importe_ars_anterior",
  "importe_ars_nuevo",
  "importe_remoto_ars",
  "cotizacion_valor",
  "cotizacion_fuente",
  "cotizacion_publicada_en",
  "preapproval_put_ok",
  "detalle",
  "codigo_error",
  "intentos",
  "evaluaciones",
  "primer_intento_en",
  "ultimo_intento_en",
  "proximo_intento_en",
  "estado_final",
  "alerta_nivel",
  "alertada_en",
  "resuelta_en",
  "actualizada_en",
];

/** Incertidumbre sobre el período: se avisa de inmediato aunque falten más de 24 h. */
export const CODIGOS_ALERTA_INMEDIATA = [
  "renovacion_vencida",
  "cobro_inminente",
  "proxima_fecha_cambio",
  "estado_mp_cambio",
];

const VENTANA_CARGA_MS = 7 * 24 * 3600 * 1000;

export function normalizarFecha(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function claveIncidencia(suscripcionId, renovacionRef) {
  return `renov:${suscripcionId}:${normalizarFecha(renovacionRef) || "sin_fecha"}`;
}

/** Próximo instante en que se permite reintentar, o null si ya no hay más intentos. */
export function calcularProximoIntento({ intentos, ahora, horasHasta = null }) {
  let minutos = ESPERA_TRAS_INTENTO_MIN[intentos];
  if (minutos == null) return null;
  if (Number.isFinite(horasHasta) && horasHasta <= HORAS_NIVEL_CRITICO) {
    minutos = Math.min(minutos, ESPERA_CERCA_COBRO_MIN);
  }
  return new Date(ahora.getTime() + minutos * 60000).toISOString();
}

/** ¿Se puede hacer otro PUT ahora para esta incidencia? */
export function decidirReintento({ incidencia, ahora }) {
  if (!incidencia) return { permitido: true };
  if (incidencia.estado_final === "agotado" || (incidencia.intentos ?? 0) >= MAX_INTENTOS_PUT) {
    return { permitido: false, motivo: "reintentos_agotados" };
  }
  const proximo = incidencia.proximo_intento_en ? new Date(incidencia.proximo_intento_en) : null;
  if (proximo && proximo.getTime() > ahora.getTime()) {
    return { permitido: false, motivo: "espera_entre_reintentos", proximoIntentoEn: proximo.toISOString() };
  }
  return { permitido: true };
}

/**
 * Nivel de alerta administrativa. Un aviso temprano con una sola evaluación fallida no se
 * notifica (evita ruido por fallos transitorios); urgente/crítico/agotado sí, de inmediato.
 */
export function nivelCorrespondiente({ estadoFinal, horasHasta, evaluaciones = 1, codigo = null }) {
  if (estadoFinal === "agotado") return "agotado";
  if (!Number.isFinite(horasHasta)) return "urgente";
  if (horasHasta <= HORAS_NIVEL_CRITICO) return "critico";
  if (horasHasta <= HORAS_NIVEL_URGENTE || CODIGOS_ALERTA_INMEDIATA.includes(codigo)) return "urgente";
  return evaluaciones >= 2 ? "aviso" : null;
}

/** Notificar solo si el nivel sube respecto del ya notificado (sin re-alertar el mismo nivel). */
export function debeNotificar(nivel, nivelPrevio) {
  if (!nivel) return false;
  return NIVELES_ALERTA.indexOf(nivel) > NIVELES_ALERTA.indexOf(nivelPrevio ?? null);
}

export function esAbierta(incidencia) {
  return ESTADOS_ABIERTOS.includes(incidencia?.estado_final);
}

/** Carga las incidencias recientes del ambiente (una consulta por corrida). */
export async function cargarIncidencias(supabase, { ambiente, ahora }) {
  const desde = new Date(ahora.getTime() - VENTANA_CARGA_MS).toISOString();
  const { data, error } = await supabase
    .from(TABLA_AUDITORIA)
    .select(COLUMNAS_AUDITORIA.join(","))
    .eq("operacion", OPERACION_RENOVACION)
    .eq("ambiente", ambiente)
    .not("clave_incidencia", "is", null)
    .gte("actualizada_en", desde);
  if (error) return { ok: false, porClave: new Map() };
  const porClave = new Map();
  for (const fila of data || []) porClave.set(fila.clave_incidencia, fila);
  return { ok: true, porClave };
}

function esDuplicado(error) {
  return error?.code === "23505";
}

/**
 * Reserva atómica de un intento de PUT. Devuelve { ok: true, fila } si esta corrida gana,
 * { ok: false, motivo: "intento_en_curso" } si otra corrida lo reservó primero, o
 * { ok: false, motivo: "auditoria_no_disponible" } si la escritura falla.
 */
export async function reservarIntento(supabase, { incidencia, base, ahora }) {
  const marca = ahora.toISOString();
  if (!incidencia) {
    const { data, error } = await supabase
      .from(TABLA_AUDITORIA)
      .insert({
        ...base,
        operacion: OPERACION_RENOVACION,
        intentos: 1,
        evaluaciones: 1,
        estado_final: "pendiente",
        primer_intento_en: marca,
        ultimo_intento_en: marca,
        actualizada_en: marca,
      })
      .select("*");
    if (esDuplicado(error)) return { ok: false, motivo: "intento_en_curso" };
    if (error || !data?.[0]) return { ok: false, motivo: "auditoria_no_disponible" };
    return { ok: true, fila: data[0] };
  }

  const previos = incidencia.intentos ?? 0;
  const { data, error } = await supabase
    .from(TABLA_AUDITORIA)
    .update({
      intentos: previos + 1,
      evaluaciones: (incidencia.evaluaciones ?? 0) + 1,
      estado_final: "pendiente",
      primer_intento_en: incidencia.primer_intento_en || marca,
      ultimo_intento_en: marca,
      actualizada_en: marca,
    })
    .eq("id", incidencia.id)
    .eq("intentos", previos)
    .select("*");
  if (error) return { ok: false, motivo: "auditoria_no_disponible" };
  if (!data?.[0]) return { ok: false, motivo: "intento_en_curso" };
  return { ok: true, fila: data[0] };
}

/** Actualiza una incidencia existente por id. Devuelve la fila resultante o null. */
export async function actualizarIncidencia(supabase, incidencia, cambios, ahora) {
  const patch = { ...cambios, actualizada_en: ahora.toISOString() };
  const { data, error } = await supabase
    .from(TABLA_AUDITORIA)
    .update(patch)
    .eq("id", incidencia.id)
    .select("*");
  if (error) return null;
  return data?.[0] ?? { ...incidencia, ...patch };
}

/**
 * Registra una falla local (sin PUT): crea la incidencia o suma una evaluación.
 * No consume intentos de PUT. Devuelve la fila resultante o null si la auditoría falla.
 */
export async function registrarFallaLocal(supabase, { incidencia, base, ahora, codigo, detalle }) {
  const marca = ahora.toISOString();
  if (incidencia) {
    return actualizarIncidencia(
      supabase,
      incidencia,
      {
        ...base,
        estado_final: incidencia.estado_final === "agotado" ? "agotado" : "bloqueado",
        evaluaciones: (incidencia.evaluaciones ?? 0) + 1,
        ultimo_intento_en: marca,
        codigo_error: codigo,
        detalle: detalle || codigo,
        preapproval_put_ok: false,
      },
      ahora,
    );
  }
  const { data, error } = await supabase
    .from(TABLA_AUDITORIA)
    .insert({
      ...base,
      operacion: OPERACION_RENOVACION,
      intentos: 0,
      evaluaciones: 1,
      estado_final: "bloqueado",
      primer_intento_en: marca,
      ultimo_intento_en: marca,
      codigo_error: codigo,
      detalle: detalle || codigo,
      preapproval_put_ok: false,
      actualizada_en: marca,
    })
    .select("*");
  if (esDuplicado(error) || error || !data?.[0]) return null;
  return data[0];
}

/**
 * Cierra una incidencia abierta con un estado final de resolución. El UPDATE exige que siga
 * abierta: si otra corrida ya la cerró devuelve null (evita doble aviso de resolución).
 */
export async function cerrarIncidencia(supabase, incidencia, { estadoFinal, detalle, extra = {} }, ahora) {
  const { data, error } = await supabase
    .from(TABLA_AUDITORIA)
    .update({
      estado_final: estadoFinal,
      resuelta_en: ahora.toISOString(),
      proximo_intento_en: null,
      detalle,
      actualizada_en: ahora.toISOString(),
      ...extra,
    })
    .eq("id", incidencia.id)
    .in("estado_final", ESTADOS_ABIERTOS)
    .select(COLUMNAS_AUDITORIA.join(","));
  if (error) return null;
  return data?.[0] ?? null;
}

/**
 * Reserva atómica del aviso: solo una corrida pasa de `previo` a `nivel`. Evita correos
 * duplicados cuando dos ejecuciones simultáneas ven la misma incidencia.
 */
export async function reservarAlerta(supabase, incidencia, nivel, ahora) {
  let consulta = supabase
    .from(TABLA_AUDITORIA)
    .update({ alerta_nivel: nivel, alertada_en: ahora.toISOString() })
    .eq("id", incidencia.id);
  consulta =
    incidencia.alerta_nivel == null
      ? consulta.is("alerta_nivel", null)
      : consulta.eq("alerta_nivel", incidencia.alerta_nivel);
  const { data, error } = await consulta.select("id");
  return !error && Boolean(data?.[0]);
}

/** Deshace la reserva si el correo no salió, para que se reintente en la próxima corrida. */
export async function revertirAlerta(supabase, incidencia, nivelReservado) {
  await supabase
    .from(TABLA_AUDITORIA)
    .update({ alerta_nivel: incidencia.alerta_nivel ?? null, alertada_en: incidencia.alertada_en ?? null })
    .eq("id", incidencia.id)
    .eq("alerta_nivel", nivelReservado)
    .select("id");
}

/**
 * Incidencias abiertas cuya fecha de cobro ya pasó sin que esta corrida las tocara: el ciclo
 * se cobró (o venció) sin resolución registrada. Se marcan `vencida` para revisión manual.
 */
export async function marcarVencidas(supabase, { porClave, tocadas, ahora }) {
  const vencidas = [];
  for (const fila of porClave.values()) {
    if (!esAbierta(fila) || tocadas.has(fila.clave_incidencia)) continue;
    const ref = fila.renovacion_ref ? new Date(fila.renovacion_ref) : null;
    if (!ref || ref.getTime() > ahora.getTime()) continue;
    const cerrada = await cerrarIncidencia(
      supabase,
      fila,
      { estadoFinal: "vencida", detalle: "vencida_sin_resolucion_registrada" },
      ahora,
    );
    if (cerrada) vencidas.push({ ...cerrada, estado_anterior: fila.estado_final });
  }
  return vencidas;
}
