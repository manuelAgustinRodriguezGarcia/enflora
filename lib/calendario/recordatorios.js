import { fechaValida } from "@/lib/etapas";
import { horaValida } from "@/lib/calendario/modelo";
import { interpretarDespachoPush, payloadAviso, rutaDestino } from "@/lib/push/reglas";

export const GRACIA_AVISO_MS = 30 * 60 * 1000;
export const MAX_INTENTOS_AVISO = 5;
export const ETIQUETA_AVISO_TAREA = "tarea-cultivo";
export const TITULO_AVISO_TAREA = "Flora te recuerda una tarea";
export const ZONA_TAREA = "America/Argentina/Buenos_Aires";
export const CRON_RECORDATORIOS = "* * * * *";

const RESULTADOS_CIERRE = new Set([
  "aceptado",
  "reintentar",
  "sin_dispositivo",
  "liberar",
  "credenciales",
  "rechazado",
  "indeterminado",
]);

function offsetMinutos(zona, instanteMs) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instanteMs));
  const mapa = {};
  for (const parte of partes) {
    if (parte.type !== "literal") mapa[parte.type] = parte.value;
  }
  const hora = Number(mapa.hour) % 24;
  const comoUtc = Date.UTC(
    Number(mapa.year),
    Number(mapa.month) - 1,
    Number(mapa.day),
    hora,
    Number(mapa.minute),
    Number(mapa.second),
  );
  return Math.round((comoUtc - instanteMs) / 60000);
}

// La hora guardada es hora de pared. El contrato vigente la interpreta en Argentina,
// que no tiene horario de verano: 14:03 en el calendario son las 17:03 UTC.
export function instanteProgramadoMs(fecha, hora, zona = ZONA_TAREA) {
  const horaCorta = String(hora || "").slice(0, 5);
  if (!fechaValida(fecha) || !horaValida(horaCorta)) return NaN;
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [hh, mm] = horaCorta.split(":").map(Number);
  const pared = Date.UTC(anio, mes - 1, dia, hh, mm, 0);
  let instante = pared - offsetMinutos(zona, pared) * 60000;
  instante = pared - offsetMinutos(zona, instante) * 60000;
  return instante;
}

export function conservarAvisoEnviado(previa, siguiente) {
  const mismaFecha = previa?.fecha === siguiente?.fecha;
  const mismaHora = String(previa?.hora || "").slice(0, 5) === String(siguiente?.hora || "").slice(0, 5);
  if (!mismaFecha || !mismaHora) return null;
  return previa?.avisoEnviadoEn || null;
}

export function tareaListaParaAviso(tarea, ahoraMs, graciaMs = GRACIA_AVISO_MS) {
  if (!tarea || tarea.estado !== "pendiente") return false;
  if (tarea.avisoPush === false || tarea.aviso_push === false) return false;
  if (tarea.avisoEnviadoEn || tarea.aviso_enviado_en) return false;
  if (tarea.avisoCierre || tarea.aviso_cierre) return false;
  const cuando = instanteProgramadoMs(tarea.fecha || tarea.fecha_programada, tarea.hora || tarea.hora_programada);
  if (!Number.isFinite(cuando)) return false;
  if (cuando > ahoraMs) return false;
  if (ahoraMs - cuando > graciaMs) return false;
  return true;
}

function textoPlano(valor, maximo) {
  return String(valor || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo);
}

export function etiquetaAvisoTarea(id) {
  const limpio = String(id || "").replace(/-/g, "").toLowerCase();
  return /^[a-f0-9]{32}$/.test(limpio) ? limpio : ETIQUETA_AVISO_TAREA;
}

export function temaAvisoTarea(id) {
  const etiqueta = etiquetaAvisoTarea(id);
  if (etiqueta === ETIQUETA_AVISO_TAREA) return "tarea-cultivo";
  return `t${etiqueta.slice(0, 20)}`;
}

export function resultadoCierre({
  alguno,
  temporal,
  expirada,
  credenciales,
  sinEstado,
  rechazo,
  sinDispositivo,
}) {
  if (alguno) return "aceptado";
  if (sinDispositivo) return "sin_dispositivo";
  if (temporal) return "reintentar";
  if (sinEstado) return "indeterminado";
  if (rechazo) return "rechazado";
  if (credenciales) return "credenciales";
  if (expirada) return "sin_dispositivo";
  return "reintentar";
}

export function mensajeAvisoTarea(tarea) {
  const nombre = textoPlano(tarea?.descripcion, 180);
  if (!nombre) return "";
  const unidad = textoPlano(tarea?.unidadNombre || tarea?.unidad_nombre, 80);
  const base = `Es momento de realizar: ${nombre}.`;
  return textoPlano(unidad ? `${base} Unidad: ${unidad}.` : base, 280);
}

export function avisoDeTarea(tarea) {
  const mensaje = mensajeAvisoTarea(tarea);
  const ruta = rutaDestino(`/calendario?tarea=${tarea?.id || ""}`);
  if (!mensaje || !ruta) return null;
  return {
    ...payloadAviso(TITULO_AVISO_TAREA, mensaje, ruta),
    etiqueta: etiquetaAvisoTarea(tarea?.id),
  };
}

export function suscripcionesDelUsuario(filas, usuarioId) {
  if (typeof usuarioId !== "string" || !usuarioId) return [];
  return (filas || []).filter((item) => item?.usuario_id === usuarioId);
}

export function interpretarReclamo(data) {
  if (!data || Array.isArray(data) || typeof data !== "object" || !Array.isArray(data.tareas)) {
    return { incompatible: true, examinadas: 0, tareas: [] };
  }
  const examinadas = Number(data.examinadas);
  return {
    incompatible: false,
    examinadas: Number.isFinite(examinadas) && examinadas >= 0 ? examinadas : data.tareas.length,
    tareas: data.tareas,
  };
}

export function clasificarFalloRecordatorios(error) {
  const codigo = String(error?.code || error?.codigo || "");
  const mensaje = String(error?.message || "");
  if (
    codigo === "PGRST202" ||
    codigo === "42883" ||
    codigo === "migracion" ||
    /could not find the function|schema cache|reclamar_avisos_calendario|cerrar_intento_aviso_calendario|registrar_ejecucion_recordatorios/i.test(
      mensaje,
    )
  ) {
    return "migracion";
  }
  return "excepcion";
}

export function resumenEjecucion(resultado) {
  const omitido = resultado?.omitido;
  const motivo = resultado?.motivo || (typeof omitido === "string" ? omitido : null);
  return {
    estado: resultado?.estado || (motivo ? "omitido" : "ok"),
    motivo,
    examinadas: numeroCorto(resultado?.examinadas),
    elegibles: numeroCorto(resultado?.elegibles),
    procesadas: numeroCorto(resultado?.procesadas),
    aceptadas: numeroCorto(resultado?.aceptadas),
    errores: numeroCorto(resultado?.errores),
    sin_dispositivo: numeroCorto(resultado?.sinDispositivo),
    expiradas: numeroCorto(resultado?.expirados),
    omitidas: numeroCorto(resultado?.omitidos),
  };
}

function numeroCorto(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.min(1_000_000, Math.trunc(numero));
}

export function proximaEjecucionEstimada(ultimaIso, ahoraMs = Date.now()) {
  const ultima = Date.parse(ultimaIso || "");
  if (!Number.isFinite(ultima)) {
    return { estimada: null, fiable: false, motivo: "sin_ejecucion" };
  }
  const atrasoMs = ahoraMs - ultima;
  if (atrasoMs < 0 || atrasoMs > 90_000) {
    return { estimada: null, fiable: false, motivo: "atraso", atrasoMs };
  }
  const minuto = 60_000;
  const siguiente = Math.ceil(ahoraMs / minuto) * minuto;
  const estimada = siguiente <= ahoraMs ? ahoraMs + minuto : siguiente;
  return { estimada: new Date(estimada).toISOString(), fiable: true, motivo: "cron_reciente", atrasoMs };
}

function mismoReclamo(a, b) {
  const ta = Date.parse(a || "");
  const tb = Date.parse(b || "");
  return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) < 1500;
}

function horaCorta(valor) {
  return String(valor || "").slice(0, 5);
}

export function tareaSigueVigente(reclamada, actual) {
  if (!actual || actual.estado !== "pendiente" || actual.aviso_push !== true) return false;
  if (!mismoReclamo(reclamada?.reclamadoEn, actual.aviso_reclamado_en)) return false;
  const fechaReclamada = String(reclamada?.fecha || reclamada?.fecha_programada || "").slice(0, 10);
  const fechaActual = String(actual.fecha_programada || "").slice(0, 10);
  return fechaReclamada === fechaActual && horaCorta(reclamada?.hora || reclamada?.hora_programada) === horaCorta(actual.hora_programada);
}

async function anotarIntento(deps, fila) {
  if (!deps.registrarIntento) return true;
  try {
    await deps.registrarIntento(fila);
    return true;
  } catch {
    return false;
  }
}

async function cerrar(deps, item, resultado) {
  if (!deps.cerrar || !RESULTADOS_CIERRE.has(resultado) || !item?.id || !item?.reclamadoEn) return false;
  try {
    await deps.cerrar(item.id, item.reclamadoEn, resultado);
    return true;
  } catch {
    await anotarIntento(deps, {
      tareaId: item.id,
      suscripcionId: null,
      reclamadoEn: item.reclamadoEn,
      numeroIntento: item.intento || null,
      codigo: null,
      categoria: "cierre",
      estado: "error",
      aceptadoEn: null,
    });
    return false;
  }
}

function filaIntento(item, suscripcionId, clase, extra = {}) {
  const aceptado = clase?.estado === "aceptado";
  let estado = "error";
  if (aceptado) estado = "aceptado";
  else if (clase?.estado === "expirado") estado = "expirado";
  else if (extra.estado) estado = extra.estado;
  return {
    tareaId: item.id,
    suscripcionId: suscripcionId || null,
    reclamadoEn: item.reclamadoEn,
    numeroIntento: item.intento || null,
    codigo: clase?.codigo ?? null,
    categoria: extra.categoria || clase?.categoria || "otro",
    estado,
    aceptadoEn: aceptado ? new Date().toISOString() : null,
  };
}

async function desactivarSiCorresponde(deps, suscripcion, clase) {
  if (!suscripcion?.id || !deps.desactivar) return;
  const motivo = clase.expirada ? "expirada" : clase.credenciales ? "credenciales" : "";
  if (!motivo) return;
  try {
    await deps.desactivar(suscripcion.id, motivo);
  } catch {
    // Un token inválido no frena al resto del lote.
  }
}

function resumenVacio(extra) {
  return {
    ok: true,
    omitido: null,
    estado: "ok",
    motivo: null,
    enviados: 0,
    aceptadas: 0,
    errores: 0,
    sinDispositivo: 0,
    expirados: 0,
    omitidos: 0,
    examinadas: 0,
    elegibles: 0,
    procesadas: 0,
    ...extra,
  };
}

export async function procesarRecordatorios(deps) {
  if (!deps?.configurado) {
    const resumen = resumenVacio({ omitido: "configuracion", estado: "omitido", motivo: "configuracion" });
    if (deps?.registrar) {
      try {
        await deps.registrar(resumen);
      } catch {
        // El diagnóstico no debe tapar el resultado.
      }
    }
    return resumen;
  }

  const reclamo = await deps.reclamar();
  const interpretado = Array.isArray(reclamo?.tareas) ? { examinadas: reclamo.examinadas, tareas: reclamo.tareas } : interpretarReclamo(reclamo);
  if (interpretado.incompatible) {
    const error = new Error("migracion");
    error.codigo = "migracion";
    throw error;
  }

  const lote = interpretado.tareas || [];
  const vistos = new Set();
  let enviados = 0;
  let aceptadas = 0;
  let errores = 0;
  let sinDispositivo = 0;
  let expirados = 0;
  let omitidos = 0;
  let procesadas = 0;

  for (const item of lote) {
    if (!item?.id || vistos.has(item.id)) continue;
    vistos.add(item.id);

    if (deps.vigente) {
      let actual = null;
      try {
        actual = await deps.vigente(item);
      } catch {
        errores += 1;
        procesadas += 1;
        await anotarIntento(deps, filaIntento(item, null, null, { categoria: "lectura", estado: "error" }));
        await cerrar(deps, item, "reintentar");
        continue;
      }
      if (!tareaSigueVigente(item, actual)) {
        omitidos += 1;
        procesadas += 1;
        await cerrar(deps, item, "liberar");
        continue;
      }
    }

    if (deps.aceptadoPrevio) {
      let previo = false;
      try {
        previo = await deps.aceptadoPrevio(item.id);
      } catch {
        errores += 1;
        procesadas += 1;
        await anotarIntento(deps, filaIntento(item, null, null, { categoria: "lectura", estado: "error" }));
        await cerrar(deps, item, "reintentar");
        continue;
      }
      if (previo) {
        enviados += 1;
        aceptadas += 1;
        procesadas += 1;
        await cerrar(deps, item, "aceptado");
        continue;
      }
    }

    const suscripciones = (item.suscripciones || []).filter((suscripcion) => suscripcion?.endpoint);
    if (!suscripciones.length) {
      sinDispositivo += 1;
      procesadas += 1;
      await anotarIntento(deps, filaIntento(item, null, null, { categoria: "sin_dispositivo", estado: "omitido" }));
      await cerrar(deps, item, "sin_dispositivo");
      continue;
    }

    const aviso = avisoDeTarea(item);
    if (!aviso) {
      errores += 1;
      procesadas += 1;
      await anotarIntento(deps, filaIntento(item, null, null, { categoria: "payload", estado: "error" }));
      await cerrar(deps, item, "rechazado");
      continue;
    }

    let alguno = false;
    let temporal = false;
    let expirada = false;
    let credenciales = false;
    let sinEstado = false;
    let rechazo = false;
    for (const suscripcion of suscripciones) {
      if (suscripcion.id && deps.yaAceptado) {
        let ya = false;
        try {
          ya = await deps.yaAceptado(item.id, suscripcion.id);
        } catch {
          temporal = true;
          await anotarIntento(deps, filaIntento(item, suscripcion.id, null, { categoria: "lectura", estado: "error" }));
          continue;
        }
        if (ya) {
          alguno = true;
          aceptadas += 1;
          continue;
        }
      }

      let clase;
      try {
        const respuesta = await deps.despachar(suscripcion, aviso, temaAvisoTarea(item.id));
        clase = interpretarDespachoPush({ respuesta });
      } catch (error) {
        clase = interpretarDespachoPush({ error });
      }
      const guardado = await anotarIntento(deps, filaIntento(item, suscripcion.id, clase));
      if (clase.expirada) {
        expirados += 1;
        expirada = true;
        await desactivarSiCorresponde(deps, suscripcion, clase);
      } else if (clase.credenciales) {
        credenciales = true;
        await desactivarSiCorresponde(deps, suscripcion, clase);
      } else if (clase.estado === "aceptado") {
        alguno = true;
        aceptadas += 1;
        if (!guardado) {
          await cerrar(deps, item, "aceptado");
        }
      } else if (clase.temporal) {
        temporal = true;
      } else if (clase.categoria === "sin_estado") {
        sinEstado = true;
      } else {
        rechazo = true;
      }
    }

    procesadas += 1;
    const cierre = resultadoCierre({
      alguno,
      temporal,
      expirada,
      credenciales,
      sinEstado,
      rechazo,
      sinDispositivo: false,
    });
    if (alguno) enviados += 1;
    else errores += 1;
    await cerrar(deps, item, cierre);
  }

  const resumen = resumenVacio({
    enviados,
    aceptadas,
    errores,
    sinDispositivo,
    expirados,
    omitidos,
    examinadas: numeroCorto(interpretado.examinadas),
    elegibles: vistos.size,
    procesadas,
  });
  if (deps.registrar) {
    try {
      await deps.registrar(resumen);
    } catch {
      resumen.registro = false;
    }
  }
  return resumen;
}
