import {
  CONCURRENCIA_PUSH,
  clasificarResultadoPush,
  claveIdempotenciaCampana,
  decisionCampana,
  mapaConcurrencia,
  payloadAviso,
  resumirResultados,
} from "./reglas.js";

export async function procesarCampana(deps, ahoraMs) {
  if (deps.activacion !== true) {
    return {
      ok: true,
      omitido: "activacion",
      aceptados: 0,
      errores: 0,
      expirados: 0,
      omitidos: 0,
      repetidos: 0,
      completada: false,
    };
  }

  const campana = await deps.leerCampana();
  const decision = decisionCampana(
    campana ? { ...campana, origenExtra: deps.origenExtra || "" } : null,
    ahoraMs,
    deps.activacion === true,
  );

  if (!decision.ejecutar) {
    return {
      ok: true,
      omitido: decision.motivo,
      aceptados: 0,
      errores: 0,
      expirados: 0,
      omitidos: 0,
      repetidos: 0,
      completada: false,
    };
  }

  await deps.marcarEnCurso(campana);
  await deps.liberarInterrumpidos(campana.id);
  const lote = await deps.leerLote(campana.id);
  const resultados = await mapaConcurrencia(lote, CONCURRENCIA_PUSH, (item) =>
    enviarUna(campana, item, decision.ruta, deps, ahoraMs),
  );
  const resumen = resumirResultados(resultados);
  const quedan = await deps.quedanPendientes(campana.id);
  if (!quedan) await deps.marcarCompletada(campana.id);

  return { ok: true, omitido: null, ...resumen, completada: !quedan };
}

export async function enviarUna(campana, suscripcion, ruta, deps, ahoraMs) {
  const clave = claveIdempotenciaCampana(campana.id, suscripcion.id);
  const expira = suscripcion.expira_en ? Date.parse(suscripcion.expira_en) : NaN;
  if (Number.isFinite(expira) && expira <= ahoraMs) {
    const envioId = await deps.reclamar(campana.id, suscripcion.id, clave);
    if (envioId) {
      await deps.guardarResultado({ id: envioId, estado: "omitido", codigo: null, error: "expirada" });
    }
    await deps.desactivar(suscripcion.id, "expirada");
    return { estado: "omitido" };
  }

  const envioId = await deps.reclamar(campana.id, suscripcion.id, clave);
  if (!envioId) return { estado: "ya-registrado" };

  try {
    const aviso = payloadAviso(campana.titulo, campana.mensaje, ruta);
    const respuesta = await deps.despachar(
      suscripcion,
      { ...aviso, etiqueta: "lanzamiento-2026-11" },
      { topic: "lanzamiento-2026-11" },
    );
    const clase = clasificarResultadoPush(respuesta.statusCode);
    await deps.guardarResultado({
      id: envioId,
      estado: clase.estado,
      codigo: respuesta.statusCode,
      error: null,
    });
    if (clase.estado === "aceptado" && deps.marcarEnvioOk) await deps.marcarEnvioOk(suscripcion.id);
    if (clase.expirada) await deps.desactivar(suscripcion.id, "expirada");
    return { estado: clase.estado, visualizado: clase.visualizado };
  } catch (error) {
    const codigo = Number(error && error.statusCode) || 0;
    const clase = clasificarResultadoPush(codigo || 500);
    const texto = typeof error?.body === "string" ? error.body.slice(0, 180) : "error";
    await deps.guardarResultado({
      id: envioId,
      estado: clase.estado,
      codigo: codigo || null,
      error: texto,
    });
    if (clase.expirada) await deps.desactivar(suscripcion.id, "expirada");
    return { estado: clase.estado, visualizado: false };
  }
}
