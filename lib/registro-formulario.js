import { parametrosDesdeValores } from "@/lib/registros";

function listaCatalogo(catalogo) {
  return [...(catalogo?.prioritarias || []), ...(catalogo?.secundarias || [])];
}

export function planificarCreacionRegistros({
  valoresParametros,
  catalogoAmbiente,
  catalogoPlantas,
  cantidadAcciones,
  observacion = "",
  hayFotos = false,
  plantasSeleccionadas = 0,
  yaGuardadoAmbiente = false,
  yaGuardadoPlantas = false,
}) {
  const parametrosAmbiente = parametrosDesdeValores(valoresParametros, listaCatalogo(catalogoAmbiente));
  if (parametrosAmbiente.error) return { error: parametrosAmbiente.error };

  const parametrosPlantas = parametrosDesdeValores(valoresParametros, listaCatalogo(catalogoPlantas));
  if (parametrosPlantas.error) return { error: parametrosPlantas.error };

  const observacionLimpia = String(observacion || "").trim();
  const tieneAmbiente = parametrosAmbiente.parametros.length > 0;
  const tienePlantas =
    parametrosPlantas.parametros.length > 0 ||
    cantidadAcciones > 0 ||
    Boolean(observacionLimpia) ||
    hayFotos;

  if (!tieneAmbiente && !tienePlantas) {
    return {
      error: "El registro necesita una acción, un parámetro, una observación o una foto.",
    };
  }

  if (tienePlantas && plantasSeleccionadas < 1) {
    return { error: "Seleccioná al menos una planta." };
  }

  const tipos = [];
  if (tieneAmbiente && !yaGuardadoAmbiente) tipos.push("ambiente");
  if (tienePlantas && !yaGuardadoPlantas) tipos.push("plantas");

  if (tipos.length === 0) {
    return { error: "Este envío ya se guardó. Revisá el historial." };
  }

  return {
    error: "",
    tipos,
    tieneAmbiente,
    tienePlantas,
    parametrosAmbiente: parametrosAmbiente.parametros,
    parametrosPlantas: parametrosPlantas.parametros,
    observacionLimpia: observacionLimpia || null,
  };
}
