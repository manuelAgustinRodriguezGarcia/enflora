import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_RESUMEN_ALMACENAMIENTO,
  argumentosResumenAlmacenamiento,
  clasificarErrorAlmacenamiento,
  codigoAlmacenamientoConocido,
  mensajeAlmacenamiento,
  presentarResumenAlmacenamiento,
} from "./almacenamiento-reglas.js";

const MODULO = "almacenamiento";

function fallo(estado, error = mensajeAlmacenamiento(estado)) {
  return { ok: false, estado, error };
}

export async function leerResumenAlmacenamiento(credencial, consulta) {
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
    const { data, error } = await servicio.rpc(RPC_RESUMEN_ALMACENAMIENTO, argumentosResumenAlmacenamiento(consulta));
    if (error) return fallo(clasificarErrorAlmacenamiento(error));
    const codigo = codigoAlmacenamientoConocido(data);
    if (codigo) return fallo("consulta");
    const presentado = presentarResumenAlmacenamiento(data, consulta);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", resumen: presentado.resumen };
  } catch {
    return fallo("error");
  }
}
