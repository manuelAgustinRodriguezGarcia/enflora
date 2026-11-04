import { fechaValida } from "@/lib/etapas";
import { etiquetaTipo, horaValida } from "@/lib/calendario/modelo";
import { clasificarResultadoPush, payloadAviso, rutaDestino } from "@/lib/push/reglas";

export const GRACIA_AVISO_MS = 12 * 60 * 60 * 1000;
export const ETIQUETA_AVISO_TAREA = "tarea-cultivo";
export const ZONA_TAREA = "America/Argentina/Buenos_Aires";

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

// La hora que eligió el usuario es hora de pared en Argentina, sin horario de verano.
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

export function temaAvisoTarea(id) {
  return `t${String(id || "").replace(/-/g, "").slice(0, 31)}`;
}

export function avisoDeTarea(tarea) {
  const titulo = textoPlano(etiquetaTipo(tarea?.tipo), 120);
  const mensaje = textoPlano(
    [tarea?.descripcion, tarea?.unidadNombre || tarea?.unidad_nombre].filter(Boolean).join(" · "),
    280,
  );
  const ruta = rutaDestino(`/calendario?tarea=${tarea?.id || ""}`);
  if (!titulo || !mensaje || !ruta) return null;
  return {
    ...payloadAviso(titulo, mensaje, ruta),
    etiqueta: ETIQUETA_AVISO_TAREA,
  };
}

async function liberar(deps, id) {
  if (!deps.liberar) return;
  try {
    await deps.liberar(id);
  } catch {
    // Si no se puede soltar, queda reservada y el próximo minuto no la duplica.
  }
}

async function clasificarEnvio(deps, suscripcion, aviso, id) {
  try {
    const respuesta = await deps.despachar(suscripcion, aviso, temaAvisoTarea(id));
    const codigo = Number(respuesta?.statusCode);
    return clasificarResultadoPush(Number.isFinite(codigo) && codigo > 0 ? codigo : 201);
  } catch (error) {
    return clasificarResultadoPush(Number(error?.statusCode) || 500);
  }
}

export async function procesarRecordatorios(deps) {
  if (!deps?.configurado) {
    return { ok: true, omitido: "configuracion", enviados: 0, errores: 0, sinDispositivo: 0, expirados: 0, omitidos: 0 };
  }

  const lote = (await deps.reclamar()) || [];
  const vistos = new Set();
  let enviados = 0;
  let errores = 0;
  let sinDispositivo = 0;
  let expirados = 0;
  let omitidos = 0;

  for (const item of lote) {
    if (!item?.id || vistos.has(item.id)) continue;
    vistos.add(item.id);

    if (deps.vigente) {
      let sigue = false;
      try {
        sigue = await deps.vigente(item.id);
      } catch {
        errores += 1;
        await liberar(deps, item.id);
        continue;
      }
      if (!sigue) {
        omitidos += 1;
        continue;
      }
    }

    const suscripciones = item.suscripciones || [];
    if (!suscripciones.length) {
      sinDispositivo += 1;
      continue;
    }

    const aviso = avisoDeTarea(item);
    if (!aviso) {
      errores += 1;
      continue;
    }

    let alguno = false;
    let falloTransitorio = false;
    let huboExpirada = false;
    for (const suscripcion of suscripciones) {
      const clase = await clasificarEnvio(deps, suscripcion, aviso, item.id);
      if (clase.expirada) {
        expirados += 1;
        huboExpirada = true;
        if (suscripcion.id && deps.desactivar) {
          try {
            await deps.desactivar(suscripcion.id);
          } catch {
            // Un token inválido no frena al resto del lote.
          }
        }
      } else if (clase.estado === "aceptado") {
        alguno = true;
      } else {
        falloTransitorio = true;
      }
    }

    if (alguno) {
      enviados += 1;
      continue;
    }

    errores += 1;
    if (falloTransitorio || huboExpirada) await liberar(deps, item.id);
  }

  return { ok: true, omitido: null, enviados, errores, sinDispositivo, expirados, omitidos };
}
