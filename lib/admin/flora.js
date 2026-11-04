import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_RESUMEN_FLORA,
  argumentosResumenFlora,
  clasificarErrorFlora,
  codigoFloraConocido,
  mensajeFlora,
  presentarResumenFlora,
} from "./flora-reglas.js";

const MODULO = "flora_ia";

function fallo(estado, error = mensajeFlora(estado)) {
  return { ok: false, estado, error };
}

export async function leerResumenFlora(credencial, consulta) {
  try {
    verificarCredencial(credencial, MODULO);
  } catch {
    return fallo("denegado", "");
  }
  let servicio;
  try {
    servicio = crearClienteRestringido(credencial, MODULO);
  } catch {
    return fallo("denegado", "");
  }
  if (!servicio) return fallo("error");
  try {
    const { data, error } = await servicio.rpc(RPC_RESUMEN_FLORA, argumentosResumenFlora(consulta));
    if (error) return fallo(clasificarErrorFlora(error));
    const codigo = codigoFloraConocido(data);
    if (codigo) return fallo("consulta");
    const presentado = presentarResumenFlora(data, consulta);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", resumen: presentado.resumen };
  } catch {
    return fallo("error");
  }
}
