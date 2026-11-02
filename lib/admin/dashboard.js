import "server-only";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_DASHBOARD,
  clasificarErrorDashboard,
  mensajeDashboard,
  presentarResumen,
} from "./dashboard-reglas.js";

const MODULO = "dashboard";

function fallo(estado) {
  return { ok: false, estado, error: mensajeDashboard(estado) };
}

/**
 * Lee el resumen agregado. `credencial` tiene que ser del módulo dashboard.
 * No acepta filtros y no reenvía el JSON crudo de la base.
 */
export async function leerResumenDashboard(credencial) {
  let servicio;
  try {
    servicio = crearClienteRestringido(credencial, MODULO);
  } catch {
    return { ok: false, estado: "denegado", error: "" };
  }
  if (!servicio) return fallo("error");

  try {
    const { data, error } = await servicio.rpc(RPC_DASHBOARD, {});
    if (error) return fallo(clasificarErrorDashboard(error));
    const presentado = presentarResumen(data);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", resumen: presentado.resumen };
  } catch {
    return fallo("error");
  }
}
