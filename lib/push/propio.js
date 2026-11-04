import { clasificarResultadoPush } from "./reglas.js";

const NO_DISPONIBLE = { status: 503, cuerpo: { ok: false, error: "No disponible" } };

function motivoSeguro(clase) {
  if (clase.expirada) return "expirada";
  if (clase.credenciales) return "credenciales";
  if (clase.temporal) return "temporal";
  return "error";
}

export async function enviarADispositivosPropios(deps, aviso) {
  const cupo = await deps.consultarCupo();
  if (!cupo) return NO_DISPONIBLE;
  if (!cupo.permitido) {
    return {
      status: 429,
      reintentarEnSeg: cupo.reintentarEnSeg,
      cuerpo: { ok: false, error: "Demasiados intentos", reintentarEn: cupo.reintentarEnSeg },
    };
  }
  if (!(await deps.registrarIntento())) return NO_DISPONIBLE;

  const lista = await deps.leerPropias();
  if (!lista.ok) return NO_DISPONIBLE;
  if (lista.suscripciones.length === 0) {
    return {
      status: 200,
      cuerpo: { ok: true, aceptados: 0, fallidos: 0, sinDispositivo: true, errores: [], entregado: false },
    };
  }

  let aceptados = 0;
  let fallidos = 0;
  const errores = [];
  for (const suscripcion of lista.suscripciones) {
    try {
      const respuesta = await deps.despachar(suscripcion, {
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        url: aviso.url,
        etiqueta: "aviso-admin",
      });
      const clase = clasificarResultadoPush(respuesta?.statusCode);
      if (clase.estado === "aceptado") {
        aceptados += 1;
        if (deps.marcarEnvioOk) await deps.marcarEnvioOk(suscripcion.id);
      } else {
        fallidos += 1;
        errores.push(motivoSeguro(clase));
        if (clase.expirada && deps.desactivar) await deps.desactivar(suscripcion.id, "expirada");
      }
    } catch (error) {
      const codigo = Number(error?.statusCode) || 0;
      const clase = clasificarResultadoPush(codigo || 500);
      fallidos += 1;
      errores.push(motivoSeguro(clase));
      if (clase.expirada && deps.desactivar) await deps.desactivar(suscripcion.id, "expirada");
    }
  }

  return {
    status: 200,
    cuerpo: { ok: true, aceptados, fallidos, sinDispositivo: false, errores, entregado: false },
  };
}
