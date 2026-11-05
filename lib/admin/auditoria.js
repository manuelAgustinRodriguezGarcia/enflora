import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_DETALLE_AUDITORIA,
  RPC_RESUMEN_AUDITORIA,
  argumentosDetalleAuditoria,
  argumentosResumenAuditoria,
  clasificarErrorAuditoria,
  codigoAuditoriaConocido,
  mensajeAuditoria,
  presentarDetalleAuditoria,
  presentarResumenAuditoria,
} from "./auditoria-reglas.js";

const MODULO = "auditoria";

function fallo(estado, error = mensajeAuditoria(estado)) {
  return { ok: false, estado, error };
}

async function servicioDe(credencial) {
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return { ok: false, adminId: "", servicio: null };
  }
  try {
    const servicio = crearClienteRestringido(credencial, MODULO);
    return servicio ? { ok: true, adminId, servicio } : { ok: false, adminId: "", servicio: null };
  } catch {
    return { ok: false, adminId: "", servicio: null };
  }
}

async function consultar(acceso, nombre, argumentos, presentar) {
  try {
    const { data, error } = await acceso.servicio.rpc(nombre, argumentos);
    if (error) return fallo(clasificarErrorAuditoria(error));
    const codigo = codigoAuditoriaConocido(data);
    if (codigo === "no_encontrado") return fallo("no_encontrado", "");
    if (codigo) return fallo(codigo === "consulta_invalida" ? "consulta" : "error");
    const presentado = presentar(data);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", ...presentado };
  } catch {
    return fallo("error");
  }
}

export async function leerResumenAuditoria(credencial, consulta) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return consultar(
    acceso,
    RPC_RESUMEN_AUDITORIA,
    argumentosResumenAuditoria(acceso.adminId, consulta),
    (data) => presentarResumenAuditoria(data, consulta),
  );
}

export async function leerDetalleAuditoria(credencial, id) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return consultar(acceso, RPC_DETALLE_AUDITORIA, argumentosDetalleAuditoria(acceso.adminId, id), presentarDetalleAuditoria);
}
