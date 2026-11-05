import "server-only";

import { verificarCredencial } from "@/lib/admin/autorizacion";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import { registrarFalloFeedback } from "@/lib/feedback/reglas";
import {
  RPC_DETALLE_FEEDBACK,
  RPC_GESTION_FEEDBACK,
  RPC_LISTADO_FEEDBACK,
  argumentosDetalleFeedback,
  argumentosGestionFeedback,
  argumentosListadoFeedback,
  clasificarErrorFeedback,
  codigoFeedbackConocido,
  mensajeCodigoFeedback,
  mensajeFeedback,
  mensajeGestionFeedback,
  presentarDetalleFeedback,
  presentarGestionFeedback,
  presentarListadoFeedback,
  validarGestionFeedback,
} from "./feedback-reglas.js";

const MODULO = "feedback";

function fallo(estado, error = mensajeFeedback(estado)) {
  return { ok: false, estado, error };
}

function traducir(data, error, presentar, alCodigo) {
  if (error) return fallo(clasificarErrorFeedback(error));
  const codigo = codigoFeedbackConocido(data);
  if (codigo === "no_encontrado") return fallo("no_encontrado", "");
  if (codigo) return fallo(codigo === "consulta_invalida" ? "consulta" : "error", alCodigo(codigo));
  const presentado = presentar(data);
  if (!presentado.ok) return fallo("error");
  return { ok: true, estado: "listo", error: "", ...presentado };
}

async function consultar(credencial, nombre, argumentos, presentar, alCodigo = mensajeCodigoFeedback) {
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
    if (error) registrarFalloFeedback(nombre, error);
    return traducir(data, error, presentar, alCodigo);
  } catch (error) {
    registrarFalloFeedback(nombre, error);
    return fallo("error");
  }
}

export function leerListadoFeedback(credencial, consulta) {
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return Promise.resolve(fallo("denegado", ""));
  }
  return consultar(
    credencial,
    RPC_LISTADO_FEEDBACK,
    argumentosListadoFeedback(adminId, consulta),
    (data) => presentarListadoFeedback(data, consulta),
  );
}

export function leerDetalleFeedback(credencial, id) {
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return Promise.resolve(fallo("denegado", ""));
  }
  return consultar(credencial, RPC_DETALLE_FEEDBACK, argumentosDetalleFeedback(adminId, id), presentarDetalleFeedback);
}

export function guardarFeedbackAdmin(credencial, entrada) {
  const gestion = validarGestionFeedback(entrada);
  if (!gestion.ok) return Promise.resolve(fallo("consulta", gestion.error));
  let adminId = "";
  try {
    adminId = verificarCredencial(credencial, MODULO).id;
  } catch {
    return Promise.resolve({ ok: false, estado: "denegado", error: mensajeGestionFeedback("denegado") });
  }
  return consultar(
    credencial,
    RPC_GESTION_FEEDBACK,
    argumentosGestionFeedback(adminId, gestion),
    presentarGestionFeedback,
    (codigo) => (codigo === "consulta_invalida" ? mensajeGestionFeedback("consulta") : mensajeGestionFeedback(codigo)),
  ).then((resultado) => {
    if (resultado.ok || resultado.estado === "consulta") return resultado;
    if (resultado.estado === "migracion") return { ...resultado, error: mensajeGestionFeedback("migracion") };
    if (resultado.estado === "permiso") return { ...resultado, error: mensajeGestionFeedback("permiso") };
    if (resultado.estado === "denegado") return { ...resultado, error: mensajeGestionFeedback("denegado") };
    return { ...resultado, error: mensajeGestionFeedback("error") };
  });
}
