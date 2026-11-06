import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_DETALLE_CAMPANA,
  RPC_LISTAR_CAMPANAS,
  RPC_RECORDATORIOS_CALENDARIO,
  RPC_RESUMEN_NOTIFICACIONES,
  MENSAJE_MIGRACION_RECORDATORIOS,
  argumentosDetalleCampana,
  argumentosListarCampanas,
  argumentosResumenNotificaciones,
  clasificarErrorNotificaciones,
  codigoNotificacionesConocido,
  idCampanaValido,
  mensajeNotificaciones,
  presentarCampanasNotificaciones,
  presentarDetalleCampana,
  presentarRecordatoriosCalendario,
  presentarResumenNotificaciones,
} from "./notificaciones-reglas.js";

const MODULO = "notificaciones";

function fallo(estado, error = mensajeNotificaciones(estado)) {
  return { ok: false, estado, error };
}

async function servicioDe(credencial) {
  try {
    verificarCredencial(credencial, MODULO);
  } catch {
    return { ok: false, servicio: null };
  }
  try {
    const servicio = crearClienteRestringido(credencial, MODULO);
    return servicio ? { ok: true, servicio } : { ok: false, servicio: null };
  } catch {
    return { ok: false, servicio: null };
  }
}

export async function leerPanelNotificaciones(credencial, consulta) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  try {
    const resumen = await acceso.servicio.rpc(RPC_RESUMEN_NOTIFICACIONES, argumentosResumenNotificaciones(consulta));
    if (resumen.error) return fallo(clasificarErrorNotificaciones(resumen.error));
    if (codigoNotificacionesConocido(resumen.data)) return fallo("consulta");
    const presentado = presentarResumenNotificaciones(resumen.data, consulta);
    if (!presentado.ok) return fallo("error");

    const lista = await acceso.servicio.rpc(RPC_LISTAR_CAMPANAS, argumentosListarCampanas(consulta));
    if (lista.error) return fallo(clasificarErrorNotificaciones(lista.error));
    if (codigoNotificacionesConocido(lista.data)) return fallo("consulta");
    const campanas = presentarCampanasNotificaciones(lista.data, consulta);
    if (!campanas.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", resumen: presentado.resumen, lista: campanas.lista };
  } catch {
    return fallo("error");
  }
}

export async function leerDetalleCampana(credencial, id) {
  if (!idCampanaValido(id)) return { ok: false, estado: "no_encontrada", error: "" };
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  try {
    const { data, error } = await acceso.servicio.rpc(RPC_DETALLE_CAMPANA, argumentosDetalleCampana(id));
    if (error) return fallo(clasificarErrorNotificaciones(error));
    const codigo = codigoNotificacionesConocido(data);
    if (codigo === "no_encontrada") return { ok: false, estado: "no_encontrada", error: "" };
    if (codigo) return fallo("consulta");
    const presentado = presentarDetalleCampana(data);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", campana: presentado.campana };
  } catch {
    return fallo("error");
  }
}

export async function leerRecordatoriosCalendario(credencial) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  try {
    const { data, error } = await acceso.servicio.rpc(RPC_RECORDATORIOS_CALENDARIO);
    if (error) {
      const estado = clasificarErrorNotificaciones(error);
      if (estado === "migracion") return { ok: false, estado, error: MENSAJE_MIGRACION_RECORDATORIOS };
      return fallo(estado);
    }
    if (data?.ok === false && data?.codigo === "no_autorizado") return fallo("denegado", "");
    const presentado = presentarRecordatoriosCalendario(data);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", recordatorios: presentado.recordatorios };
  } catch {
    return fallo("error");
  }
}
