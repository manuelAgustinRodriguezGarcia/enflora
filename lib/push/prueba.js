import {
  LIMITE_PRUEBAS_ADMIN,
  LIMITE_PRUEBAS_PUBLICAS,
  clasificarResultadoPush,
  payloadAviso,
} from "./reglas.js";

export const AVISO_PRUEBA = payloadAviso(
  "Prueba de Enflora",
  "Este aviso solo llega al dispositivo de prueba.",
  "/",
);

export function limitePrueba(admin) {
  return admin === true ? LIMITE_PRUEBAS_ADMIN : LIMITE_PRUEBAS_PUBLICAS;
}

const NO_DISPONIBLE = { status: 503, cuerpo: { ok: false, error: "No disponible" } };

export async function ejecutarPrueba(deps, admin) {
  const cupo = await deps.consultarCupo(limitePrueba(admin));
  if (!cupo) return NO_DISPONIBLE;
  if (!cupo.permitido) {
    return {
      status: 429,
      reintentarEnSeg: cupo.reintentarEnSeg,
      cuerpo: { ok: false, error: "Demasiados intentos", reintentarEn: cupo.reintentarEnSeg },
    };
  }
  if (!(await deps.registrarIntento())) return NO_DISPONIBLE;

  const leida = await deps.leerSuscripcion();
  if (!leida.ok) return NO_DISPONIBLE;
  if (!leida.suscripcion) {
    return { status: 404, cuerpo: { ok: false, error: "No encontrada", motivo: "inexistente" } };
  }
  if (!leida.suscripcion.activa) {
    return { status: 409, cuerpo: { ok: false, error: "Suscripción inactiva", motivo: "inactiva" } };
  }

  const suscripcion = leida.suscripcion;
  const envioId = deps.nuevoId();
  const recibo = deps.nuevoRecibo();
  if (!(await deps.crearEnvio(envioId, suscripcion.id, recibo.hash))) return NO_DISPONIBLE;

  let codigo = 0;
  let detalle = null;
  try {
    const respuesta = await deps.despachar(
      suscripcion,
      { ...AVISO_PRUEBA, etiqueta: "push-prueba", prueba: envioId, recibo: recibo.token },
      { topic: "push-prueba" },
    );
    codigo = Number(respuesta?.statusCode) || 0;
  } catch (error) {
    codigo = Number(error?.statusCode) || 0;
    detalle = typeof error?.body === "string" ? error.body.slice(0, 180) : "error";
  }

  const clase = clasificarResultadoPush(codigo || 500);
  await deps.guardarResultado({ id: envioId, estado: clase.estado, codigo: codigo || null, error: detalle });
  const modo = admin === true ? "admin" : "publico";

  if (clase.estado === "aceptado") {
    await deps.marcarEnvioOk(suscripcion.id);
    return {
      status: 200,
      cuerpo: { ok: true, estado: "aceptado", recibido: false, envioId, modo },
    };
  }
  if (clase.expirada) {
    await deps.desactivar(suscripcion.id, "expirada");
    return { status: 410, cuerpo: { ok: false, estado: "expirado", motivo: "expirada", modo } };
  }
  if (clase.credenciales) {
    await deps.desactivar(suscripcion.id, "credenciales");
    return { status: 409, cuerpo: { ok: false, estado: "error", motivo: "credenciales", modo } };
  }
  return { status: 502, cuerpo: { ok: false, estado: "error", motivo: "proveedor", modo } };
}
