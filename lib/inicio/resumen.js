import { ETAPAS, diaDeEtapa, etiquetaEtapa, fechaValida } from "@/lib/etapas";
import { hrefHistorial } from "@/lib/historial-registros";
import { etiquetaTipoEspacio } from "@/lib/unidades";

export const LIMITE_LINEAS_UNIDAD = 4;

export const ACCIONES_RAPIDAS = Object.freeze([
  Object.freeze({ clave: "registrar", etiqueta: "Registrar", href: "/registros", icono: "registro" }),
  Object.freeze({ clave: "flora", etiqueta: "Consultar Flora", href: "/flora", icono: "flora" }),
  Object.freeze({ clave: "cultivos", etiqueta: "Ver cultivos", href: "/cultivos", icono: "cultivos" }),
  Object.freeze({ clave: "historial", etiqueta: "Abrir historial", href: "/registros/historial", icono: "historial" }),
]);

export const ACCIONES_CULTIVO = Object.freeze([
  Object.freeze({ clave: "registrar", etiqueta: "Registrar" }),
  Object.freeze({ clave: "foto", etiqueta: "Foto" }),
  Object.freeze({ clave: "riego", etiqueta: "Riego" }),
  Object.freeze({ clave: "etapa", etiqueta: "Etapa" }),
  Object.freeze({ clave: "problema", etiqueta: "Problema" }),
]);

const ACCIONES_REGISTRO_CULTIVO = new Set(["foto", "problema", "riego"]);

export function accionRegistroDesdeConsulta(valor) {
  return ACCIONES_REGISTRO_CULTIVO.has(valor) ? valor : "";
}

export function hrefAccionCultivo(unidad, clave) {
  if (clave === "etapa") {
    const base = unidad?.href || "/cultivos";
    const separador = base.includes("?") ? "&" : "?";
    return `${base}${separador}accion=etapa`;
  }
  const params = new URLSearchParams();
  if (unidad?.id) params.set("unidad", unidad.id);
  if (ACCIONES_REGISTRO_CULTIVO.has(clave)) params.set("accion", clave);
  const consulta = params.toString();
  return consulta ? `/registros?${consulta}` : "/registros";
}

/** El módulo de productos y recetas no existe en la app. */
export const MODULO_PRODUCTOS_DISPONIBLE = false;

export function especificacionesInicio(usuarioId) {
  return {
    espacios: {
      tabla: "espacios",
      select: "id, nombre, tipo",
      eq: [["usuario_id", usuarioId]],
      orden: [["fecha_creacion", { ascending: true }]],
    },
    unidades: {
      tabla: "unidades_cultivo",
      select: "id, espacio_id, nombre, tipo, tipo_personalizado, numero",
      orden: [["numero", { ascending: true }]],
    },
    plantas: {
      tabla: "plantas",
      select: "id, nombre, etapa, fecha_inicio, estado, numero, unidad_cultivo_id",
      eq: [["estado", "activa"]],
    },
    etapas: {
      tabla: "historial_etapas",
      select: "planta_id, etapa, fecha_inicio, fecha_fin",
      is: [["fecha_fin", null]],
    },
  };
}

export function textoConteo(cantidad, singular, plural) {
  const n = Number(cantidad) || 0;
  return `${n} ${n === 1 ? singular : plural}`;
}

export function textoResumenCultivos({ espacios, unidades, plantas }) {
  return [
    textoConteo(espacios, "espacio", "espacios"),
    textoConteo(unidades, "unidad", "unidades"),
    textoConteo(plantas, "planta activa", "plantas activas"),
  ].join(" · ");
}

export function fechaCalendario(valor) {
  const texto = String(valor || "").slice(0, 10);
  return fechaValida(texto) ? texto : "";
}

function mapaPorId(filas) {
  return new Map((filas || []).filter((fila) => fila?.id).map((fila) => [fila.id, fila]));
}

function rutaEspacio(espacioId) {
  if (!espacioId) return "/cultivos";
  return `/cultivos/${espacioId}`;
}

function rutaUnidad(espacioId, unidadId) {
  if (!espacioId || !unidadId) return "/cultivos";
  return `/cultivos/${espacioId}/unidades/${unidadId}`;
}

function diaNumero(inicio, hoy) {
  const dia = inicio ? diaDeEtapa(inicio, hoy) : null;
  return Number.isFinite(dia) ? dia : null;
}

function diaDePlanta(planta, etapaAbierta, hoy, historialDisponible) {
  const etapa = planta?.etapa || "";
  const inicioPlanta = fechaCalendario(planta?.fecha_inicio);
  const inicioEtapa =
    historialDisponible && etapaAbierta && etapaAbierta.etapa === etapa
      ? fechaCalendario(etapaAbierta.fecha_inicio)
      : "";
  const inicio = inicioEtapa || (historialDisponible ? "" : inicioPlanta);
  return {
    etapa,
    etiqueta: etiquetaEtapa(etapa),
    dia: diaNumero(inicio, hoy),
    diaTotal: diaNumero(inicioPlanta, hoy),
  };
}

function compararNumero(a, b) {
  return (Number(a?.numero) || 0) - (Number(b?.numero) || 0);
}

function etapasConPlantas(lineas) {
  const grupos = new Map();
  for (const linea of lineas) {
    const etapa = linea?.etapa || "";
    const grupo = grupos.get(etapa) || { cantidad: 0, dias: new Set() };
    grupo.cantidad += 1;
    if (Number.isFinite(linea?.dia)) grupo.dias.add(linea.dia);
    grupos.set(etapa, grupo);
  }
  const orden = ETAPAS.map((item) => item.valor);
  return [...grupos.entries()]
    .sort((a, b) => {
      const indiceA = orden.indexOf(a[0]);
      const indiceB = orden.indexOf(b[0]);
      return (indiceA === -1 ? orden.length : indiceA) - (indiceB === -1 ? orden.length : indiceB);
    })
    .map(([etapa, grupo]) => ({
      etapa,
      cantidad: grupo.cantidad,
      dias: [...grupo.dias].sort((a, b) => a - b),
    }));
}

function armarCultivos({ espacios, unidades, plantas, etapas, hoy }) {
  const fallo = !espacios?.ok || !unidades?.ok || !plantas?.ok;
  if (fallo) {
    return {
      estado: "error",
      resumen: "",
      unidades: [],
      avisoEtapas: "",
    };
  }

  const espaciosPorId = mapaPorId(espacios.filas);
  const historialDisponible = Boolean(etapas?.ok);
  const etapasPorPlanta = new Map();
  if (etapas?.ok || etapas?.ausente) {
    for (const fila of etapas.filas || []) {
      if (fila?.planta_id && !etapasPorPlanta.has(fila.planta_id)) {
        etapasPorPlanta.set(fila.planta_id, fila);
      }
    }
  }

  const plantasPorUnidad = new Map();
  for (const planta of plantas.filas || []) {
    if (!planta?.id || !planta.unidad_cultivo_id) continue;
    if (planta.estado && planta.estado !== "activa") continue;
    const lista = plantasPorUnidad.get(planta.unidad_cultivo_id) || [];
    lista.push(planta);
    plantasPorUnidad.set(planta.unidad_cultivo_id, lista);
  }

  const ordenEspacios = new Map((espacios.filas || []).map((espacio, indice) => [espacio.id, indice]));
  const unidadesOrdenadas = [...(unidades.filas || [])].sort((a, b) => {
    const espacio = (ordenEspacios.get(a.espacio_id) ?? 0) - (ordenEspacios.get(b.espacio_id) ?? 0);
    if (espacio !== 0) return espacio;
    return compararNumero(a, b);
  });

  const tarjetas = [];
  for (const unidad of unidadesOrdenadas) {
    const activas = (plantasPorUnidad.get(unidad.id) || []).sort(compararNumero);
    if (!activas.length) continue;
    const espacio = espaciosPorId.get(unidad.espacio_id);
    if (!espacio) continue;
    const lineas = activas.map((planta) => {
      const datos = diaDePlanta(planta, etapasPorPlanta.get(planta.id), hoy, historialDisponible);
      return {
        id: planta.id,
        nombre: planta.nombre || "Planta",
        etapa: datos.etapa,
        etiqueta: datos.etiqueta,
        dia: datos.dia,
        diaTotal: datos.diaTotal,
      };
    });
    const primera = lineas[0];
    const uniforme = lineas.every((linea) => linea.etapa === primera.etapa && linea.dia === primera.dia);
    const diasUnidad = lineas.map((linea) => linea.diaTotal).filter((dia) => Number.isFinite(dia));
    tarjetas.push({
      id: unidad.id,
      nombre: unidad.nombre || "Unidad",
      espacioId: espacio.id,
      espacioNombre: espacio.nombre || "",
      tipoEspacio: espacio.tipo || "",
      tipoEtiqueta: etiquetaTipoEspacio(espacio.tipo),
      href: rutaUnidad(espacio.id, unidad.id),
      hrefEspacio: rutaEspacio(espacio.id),
      hrefHistorial: hrefHistorial({ unidadId: unidad.id }),
      plantasActivas: lineas.length,
      uniforme,
      etapaCodigo: uniforme ? primera.etapa : "",
      diaUnico: uniforme ? primera.dia : null,
      diaUnidad: diasUnidad.length ? Math.max(...diasUnidad) : null,
      etapasConPlantas: etapasConPlantas(lineas),
      lineas: uniforme ? [] : lineas.slice(0, LIMITE_LINEAS_UNIDAD),
      lineasOcultas: uniforme ? 0 : Math.max(0, lineas.length - LIMITE_LINEAS_UNIDAD),
    });
  }

  const espaciosActivos = new Set(tarjetas.map((tarjeta) => tarjeta.espacioId));
  const plantasActivas = tarjetas.reduce((total, tarjeta) => total + tarjeta.plantasActivas, 0);

  return {
    estado: tarjetas.length ? "listo" : "vacio",
    resumen: tarjetas.length
      ? textoResumenCultivos({
          espacios: espaciosActivos.size,
          unidades: tarjetas.length,
          plantas: plantasActivas,
        })
      : "",
    unidades: tarjetas,
    avisoEtapas:
      etapas?.ok || etapas?.ausente
        ? ""
        : "No se pudo leer el historial de etapas. El día se calcula con la fecha de inicio de cada planta.",
  };
}

export function armarPanel(entrada) {
  const hoy = fechaCalendario(entrada?.hoy);
  return {
    cultivos: armarCultivos({ ...entrada, hoy }),
    acciones: ACCIONES_RAPIDAS,
    productosDisponibles: MODULO_PRODUCTOS_DISPONIBLE,
  };
}
