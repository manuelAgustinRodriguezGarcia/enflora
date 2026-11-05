import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  RPC_ALTA_CAMPANA,
  RPC_ALTA_COMERCIO,
  RPC_DETALLE_CAMPANA,
  RPC_DETALLE_COMERCIO,
  RPC_DETALLE_SOLICITUD,
  RPC_EDITAR_CAMPANA,
  RPC_EDITAR_COMERCIO,
  RPC_ESTADO_CAMPANA,
  RPC_ESTADO_COMERCIO,
  RPC_GESTIONAR_SOLICITUD,
  RPC_LISTAR_CAMPANAS,
  RPC_LISTAR_COMERCIOS,
  RPC_LISTAR_SOLICITUDES,
  RPC_RESUMEN_PARTNERS,
  argumentosAltaCampana,
  argumentosAltaComercio,
  argumentosDetalle,
  argumentosEditarCampana,
  argumentosEditarComercio,
  argumentosEstadoCampana,
  argumentosEstadoComercio,
  argumentosGestionSolicitud,
  argumentosListarCampanas,
  argumentosListarComercios,
  argumentosListarSolicitudes,
  argumentosResumenPartners,
  clasificarErrorPartners,
  codigoPartnersConocido,
  mensajePartners,
  presentarAlta,
  presentarCampanas,
  presentarComercios,
  presentarResumenPartners,
  presentarSolicitudes,
} from "./partners-reglas.js";

const MODULO = "partners";

function fallo(estado, error = mensajePartners(estado)) {
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

async function leer(credencial, nombre, argumentos, presentar) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  try {
    const { data, error } = await acceso.servicio.rpc(nombre, argumentos);
    if (error) return fallo(clasificarErrorPartners(error));
    const codigo = codigoPartnersConocido(data);
    if (codigo === "no_encontrado") return fallo("no_encontrado", "");
    if (codigo) return fallo(codigo === "consulta_invalida" ? "consulta" : "error");
    const presentado = presentar(data);
    if (!presentado.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", ...presentado };
  } catch {
    return fallo("error");
  }
}

export function leerResumenPartners(credencial, consulta) {
  return leer(credencial, RPC_RESUMEN_PARTNERS, argumentosResumenPartners(consulta), (data) => presentarResumenPartners(data, consulta));
}

export function leerComerciosPartners(credencial, consulta) {
  return leer(credencial, RPC_LISTAR_COMERCIOS, argumentosListarComercios(servicioId(credencial), consulta), (data) => presentarComercios(data, consulta));
}

export function leerSolicitudesPartners(credencial, consulta) {
  return leer(credencial, RPC_LISTAR_SOLICITUDES, argumentosListarSolicitudes(servicioId(credencial), consulta), (data) => presentarSolicitudes(data, consulta));
}

export function leerCampanasPartners(credencial, consulta) {
  return leer(credencial, RPC_LISTAR_CAMPANAS, argumentosListarCampanas(servicioId(credencial), consulta), (data) => presentarCampanas(data, consulta));
}

function servicioId(credencial) {
  try {
    return verificarCredencial(credencial, MODULO).id;
  } catch {
    return "";
  }
}

export function leerDetalleComercio(credencial, id) {
  return leer(credencial, RPC_DETALLE_COMERCIO, argumentosDetalle(servicioId(credencial), id), presentarFicha);
}

export function leerDetalleSolicitud(credencial, id) {
  return leer(credencial, RPC_DETALLE_SOLICITUD, argumentosDetalle(servicioId(credencial), id), presentarFicha);
}

export function leerDetalleCampana(credencial, id) {
  return leer(credencial, RPC_DETALLE_CAMPANA, argumentosDetalle(servicioId(credencial), id), presentarFicha);
}

function presentarFicha(data) {
  if (!data || data.ok !== true) return { ok: false };
  const serial = JSON.stringify(data).toLowerCase();
  if (serial.includes("javascript:") || serial.includes("\"ip\"") || serial.includes("usuario_id")) return { ok: false };
  return { ok: true, ficha: data };
}

async function escribir(credencial, nombre, argumentos) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  try {
    const { data, error } = await acceso.servicio.rpc(nombre, argumentos);
    if (error) return fallo(clasificarErrorPartners(error));
    const codigo = codigoPartnersConocido(data);
    if (codigo === "no_encontrado") return fallo("no_encontrado", "");
    if (codigo) return fallo(codigo === "consulta_invalida" ? "consulta" : codigo, mensajePartners(codigo === "consulta_invalida" ? "consulta" : codigo));
    const alta = presentarAlta(data);
    if (data.id && !alta.ok) return fallo("error");
    return { ok: true, estado: "listo", error: "", id: alta.ok ? alta.id : "", estadoCampana: alta.ok ? alta.estado : data.estado || "" };
  } catch {
    return fallo("error");
  }
}

export async function crearComercioPartners(credencial, comercio) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_ALTA_COMERCIO, argumentosAltaComercio(acceso.adminId, comercio));
}

export async function editarComercioPartners(credencial, comercio) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_EDITAR_COMERCIO, argumentosEditarComercio(acceso.adminId, comercio));
}

export async function cambiarEstadoComercioPartners(credencial, cambio) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_ESTADO_COMERCIO, argumentosEstadoComercio(acceso.adminId, cambio));
}

export async function gestionarSolicitudPartners(credencial, gestion) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_GESTIONAR_SOLICITUD, argumentosGestionSolicitud(acceso.adminId, gestion));
}

export async function crearCampanaPartners(credencial, campana) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_ALTA_CAMPANA, argumentosAltaCampana(acceso.adminId, campana));
}

export async function editarCampanaPartners(credencial, campana) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_EDITAR_CAMPANA, argumentosEditarCampana(acceso.adminId, campana));
}

export async function cambiarEstadoCampanaPartners(credencial, cambio) {
  const acceso = await servicioDe(credencial);
  if (!acceso.ok) return fallo("denegado", "");
  return escribir(credencial, RPC_ESTADO_CAMPANA, argumentosEstadoCampana(acceso.adminId, cambio));
}
