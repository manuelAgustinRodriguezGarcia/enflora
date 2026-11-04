import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_DETALLE_USUARIO,
  RPC_LISTADO_USUARIOS,
  argumentosDetalleUsuario,
  argumentosListadoUsuarios,
  clasificarErrorUsuarios,
  codigoUsuariosConocido,
  mensajeCodigoUsuarios,
  mensajeUsuarios,
  presentarDetalleUsuario,
  presentarListadoUsuarios,
} from "./usuarios-reglas.js";

const MODULO = "usuarios";

function fallo(estado, error = mensajeUsuarios(estado)) {
  return { ok: false, estado, error };
}

function traducir(data, error, presentar) {
  if (error) return fallo(clasificarErrorUsuarios(error));
  const codigo = codigoUsuariosConocido(data);
  if (codigo === "no_encontrada") return fallo("no_encontrada", "");
  if (codigo) return fallo(codigo === "consulta_invalida" ? "consulta" : "error", mensajeCodigoUsuarios(codigo));
  const presentado = presentar(data);
  if (!presentado.ok) return fallo("error");
  return { ok: true, estado: "listo", error: "", ...presentado };
}

async function consultar(credencial, nombre, argumentos, presentar) {
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
    const { data, error } = await servicio.rpc(nombre, argumentos);
    return traducir(data, error, presentar);
  } catch {
    return fallo("error");
  }
}

export function leerListadoUsuarios(credencial, consulta) {
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return Promise.resolve(fallo("denegado", ""));
  }
  return consultar(
    credencial,
    RPC_LISTADO_USUARIOS,
    argumentosListadoUsuarios(adminId, consulta),
    (data) => presentarListadoUsuarios(data, consulta),
  );
}

export function leerDetalleUsuario(credencial, id) {
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return Promise.resolve(fallo("denegado", ""));
  }
  return consultar(credencial, RPC_DETALLE_USUARIO, argumentosDetalleUsuario(adminId, id), presentarDetalleUsuario);
}
