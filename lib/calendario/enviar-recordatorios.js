import "server-only";

import { procesarRecordatorios } from "@/lib/calendario/recordatorios";
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

async function siguePendiente(supabase, id) {
  const { data, error } = await supabase
    .from("tareas_programadas")
    .select("estado, aviso_push")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.estado === "pendiente" && data?.aviso_push === true;
}

async function reclamarConDispositivos(supabase) {
  const { data, error } = await supabase.rpc("reclamar_avisos_tareas", { p_limite: 40 });
  if (error) throw error;
  const filas = data || [];
  const usuarios = [...new Set(filas.map((fila) => fila.usuario_id).filter(Boolean))];
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

  return filas.map((fila) => ({
    id: fila.id,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    unidadNombre: fila.unidad_nombre || "",
    suscripciones: suscripciones.filter((item) => item.usuario_id === fila.usuario_id).map(suscripcionDe),
  }));
}

export async function enviarRecordatoriosConfigurados() {
  const supabase = clientePush();
  if (!supabase || !configuracionVapid()) {
    return { ok: true, omitido: "configuracion", enviados: 0, errores: 0, sinDispositivo: 0, expirados: 0, omitidos: 0 };
  }

  return procesarRecordatorios({
    configurado: true,
    reclamar: () => reclamarConDispositivos(supabase),
    vigente: (id) => siguePendiente(supabase, id),
    despachar: (suscripcion, aviso, tema) => despacharPush(suscripcion, aviso, { topic: tema }),
    desactivar: (suscripcionId) => desactivarSuscripcion(supabase, suscripcionId, "expirada"),
    liberar: async (id) => {
      await supabase.rpc("liberar_aviso_tarea", { p_id: id });
    },
  });
}
