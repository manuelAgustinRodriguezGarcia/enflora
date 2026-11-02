import "server-only";

import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_DETALLE_LICENCIA_PLANES,
  RPC_DETALLE_OPERACION_PLANES,
  RPC_DETALLE_SUSCRIPCION_PLANES,
  RPC_LICENCIAS_PLANES,
  RPC_OPERACIONES_PLANES,
  RPC_RESUMEN_PLANES,
  RPC_SUSCRIPCIONES_PLANES,
  argumentosOperaciones,
  argumentosResumen,
  argumentosSuscripciones,
  clasificarErrorPlanes,
  codigoPlanesConocido,
  mensajeCodigoPlanes,
  mensajePlanes,
  presentarDetalleLicencia,
  presentarDetalleOperacion,
  presentarDetalleSuscripcion,
  presentarLicenciasPlanes,
  presentarOperacionesPlanes,
  presentarResumenPlanes,
  presentarSuscripcionesPlanes,
} from "./planes-reglas.js";

const MODULO = "planes";

function fallo(estado, error = mensajePlanes(estado)) {
  return { ok: false, estado, error };
}

function traducir(data, error, presentar) {
  if (error) return fallo(clasificarErrorPlanes(error));
  const codigo = codigoPlanesConocido(data);
  if (codigo === "no_encontrada") return fallo("no_encontrada", "");
  if (codigo) return fallo("consulta", mensajeCodigoPlanes(codigo));
  const presentado = presentar(data);
  if (!presentado.ok) return fallo("error");
  return { ok: true, estado: "listo", error: "", ...presentado };
}

async function consultar(credencial, nombre, argumentos, presentar) {
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

export function leerResumenPlanes(credencial, consulta) {
  return consultar(credencial, RPC_RESUMEN_PLANES, argumentosResumen(consulta), (data) => presentarResumenPlanes(data, consulta));
}

export function leerOperacionesPlanes(credencial, consulta) {
  return consultar(credencial, RPC_OPERACIONES_PLANES, argumentosOperaciones(consulta), (data) =>
    presentarOperacionesPlanes(data, consulta),
  );
}

export function leerSuscripcionesPlanes(credencial, consulta, estado) {
  return consultar(credencial, RPC_SUSCRIPCIONES_PLANES, argumentosSuscripciones(consulta, estado), (data) =>
    presentarSuscripcionesPlanes(data, consulta),
  );
}

export function leerLicenciasPlanes(credencial, consulta, estado) {
  return consultar(credencial, RPC_LICENCIAS_PLANES, argumentosSuscripciones(consulta, estado), (data) =>
    presentarLicenciasPlanes(data, consulta),
  );
}

export function leerDetalleOperacionPlanes(credencial, origen, id) {
  return consultar(credencial, RPC_DETALLE_OPERACION_PLANES, { p_origen: origen, p_id: id }, presentarDetalleOperacion);
}

export function leerDetalleSuscripcionPlanes(credencial, id) {
  return consultar(credencial, RPC_DETALLE_SUSCRIPCION_PLANES, { p_id: id }, presentarDetalleSuscripcion);
}

export function leerDetalleLicenciaPlanes(credencial, id) {
  return consultar(credencial, RPC_DETALLE_LICENCIA_PLANES, { p_id: id }, presentarDetalleLicencia);
}
