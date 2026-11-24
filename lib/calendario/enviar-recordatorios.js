import "server-only";

import {
  clasificarFalloRecordatorios,
  interpretarReclamo,
  procesarRecordatorios,
  resumenEjecucion,
  suscripcionesDelUsuario,
} from "@/lib/calendario/recordatorios";
import { clientePush, desactivarSuscripcion } from "@/lib/push/datos";
import { configuracionVapid, despacharPush } from "@/lib/push/vapid";

function suscripcionDe(fila) {
  return {
    id: fila.id,
    endpoint: fila.endpoint,
    p256dh: fila.p256dh,
    auth: fila.auth,
  };
}

function vacio(motivo) {
  return {
    ok: true,
    omitido: motivo,
    estado: "omitido",
    motivo,
    enviados: 0,
    aceptadas: 0,
    errores: 0,
    sinDispositivo: 0,
    expirados: 0,
    omitidos: 0,
    examinadas: 0,
    elegibles: 0,
    procesadas: 0,
  };
}

function tablaAusente(error) {
  return error?.code === "PGRST205" || error?.code === "42P01" || error?.code === "PGRST204";
}

async function registrarIntentoAviso(supabase, fila) {
  const { error } = await supabase.from("calendario_aviso_intentos").insert({
    tarea_id: fila.tareaId,
    suscripcion_id: fila.suscripcionId,
    reclamado_en: fila.reclamadoEn,
    numero_intento: fila.numeroIntento,
    codigo_estado: fila.codigo,
    categoria: fila.categoria,
    estado: fila.estado,
    aceptado_en: fila.aceptadoEn,
  });
  if (!error || error.code === "23505" || tablaAusente(error)) return;
  throw error;
}

async function aceptadoPrevio(supabase, tareaId, suscripcionId) {
  let consulta = supabase
    .from("calendario_aviso_intentos")
    .select("id")
    .eq("tarea_id", tareaId)
    .eq("estado", "aceptado")
    .limit(1);
  if (suscripcionId) consulta = consulta.eq("suscripcion_id", suscripcionId);
  const { data, error } = await consulta;
  if (tablaAusente(error)) return false;
  if (error) throw error;
  return (data || []).length > 0;
}

async function registrar(supabase, resumen) {
  const { error } = await supabase.rpc("registrar_ejecucion_recordatorios_calendario", {
    p_resumen: resumenEjecucion(resumen),
  });
  if (error) throw error;
}

async function leerVigente(supabase, item) {
  const { data, error } = await supabase
    .from("tareas_programadas")
    .select("estado, aviso_push, fecha_programada, hora_programada, aviso_reclamado_en")
    .eq("id", item.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function reclamarConDispositivos(supabase) {
  const { data, error } = await supabase.rpc("reclamar_avisos_calendario", { p_limite: 40 });
  if (error) throw error;
  const reclamo = interpretarReclamo(data);
  if (reclamo.incompatible) {
    const fallo = new Error("migracion");
    fallo.codigo = "migracion";
    throw fallo;
  }

  const filas = reclamo.tareas;
  const usuarios = [...new Set(filas.map((fila) => fila.usuario_id).filter((id) => typeof id === "string" && id))];
  let suscripciones = [];
  if (usuarios.length) {
    const lectura = await supabase
      .from("push_suscripciones")
      .select("id, usuario_id, endpoint, p256dh, auth")
      .in("usuario_id", usuarios)
      .eq("activa", true);
    if (lectura.error) throw lectura.error;
    suscripciones = lectura.data || [];
  }

  return {
    examinadas: reclamo.examinadas,
    tareas: filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      descripcion: fila.descripcion,
      unidadNombre: fila.unidad_nombre || "",
      fecha: String(fila.fecha_programada || "").slice(0, 10),
      hora: String(fila.hora_programada || "").slice(0, 5),
      reclamadoEn: fila.reclamado_en,
      intento: Number.isInteger(Number(fila.intento)) ? Number(fila.intento) : null,
      suscripciones: suscripcionesDelUsuario(suscripciones, fila.usuario_id).map(suscripcionDe),
    })),
  };
}

export async function registrarFalloRecordatorios(motivo) {
  const supabase = clientePush();
  if (!supabase) return;
  const resumen = vacio(motivo);
  if (motivo !== "configuracion") resumen.estado = "error";
  await registrar(supabase, resumen);
}

export async function enviarRecordatoriosConfigurados() {
  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    const resumen = vacio("configuracion");
    if (supabase) {
      try {
        await registrar(supabase, resumen);
      } catch (error) {
        resumen.registro = false;
        resumen.motivoRegistro = clasificarFalloRecordatorios(error);
      }
    }
    return resumen;
  }

  return procesarRecordatorios({
    configurado: true,
    reclamar: () => reclamarConDispositivos(supabase),
    vigente: (item) => leerVigente(supabase, item),
    aceptadoPrevio: (tareaId) => aceptadoPrevio(supabase, tareaId),
    yaAceptado: (tareaId, suscripcionId) => aceptadoPrevio(supabase, tareaId, suscripcionId),
    registrarIntento: (fila) => registrarIntentoAviso(supabase, fila),
    despachar: (suscripcion, aviso, tema) => despacharPush(suscripcion, aviso, { topic: tema }),
    desactivar: (suscripcionId, motivo) =>
      desactivarSuscripcion(supabase, suscripcionId, motivo === "credenciales" ? "credenciales" : "expirada"),
    cerrar: async (id, reclamadoEn, resultado) => {
      const { error } = await supabase.rpc("cerrar_intento_aviso_calendario", {
        p_id: id,
        p_reclamado_en: reclamadoEn,
        p_resultado: resultado,
      });
      if (error) throw error;
    },
    registrar: (resumen) => registrar(supabase, resumen),
  });
}
