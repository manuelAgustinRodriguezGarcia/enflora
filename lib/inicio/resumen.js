import { diaDeEtapa, etiquetaEtapa, fechaValida, formatearFecha } from "@/lib/etapas";
import { hrefHistorial } from "@/lib/historial-registros";
import { etiquetaTipoEspacio } from "@/lib/unidades";

export const LIMITE_TAREAS = 8;
export const LIMITE_LINEAS_UNIDAD = 4;

export const ACCIONES_RAPIDAS = Object.freeze([
  Object.freeze({ clave: "registrar", etiqueta: "Registrar", href: "/registros", primaria: true }),
  Object.freeze({ clave: "flora", etiqueta: "Consultar Flora", href: "/flora", primaria: false }),
  Object.freeze({ clave: "cultivos", etiqueta: "Ver cultivos", href: "/espacios", primaria: false }),
  Object.freeze({ clave: "historial", etiqueta: "Abrir historial", href: "/registros/historial", primaria: false }),
]);

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
    tareas: {
      tabla: "tareas_programadas",
      select: "id, descripcion, fecha_programada, fecha_creacion, unidad_cultivo_id",
      eq: [
        ["usuario_id", usuarioId],
        ["completada", false],
      ],
      orden: [
        ["fecha_programada", { ascending: true }],
        ["fecha_creacion", { ascending: true }],
      ],
      limite: LIMITE_TAREAS,
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

function rutaUnidad(espacioId, unidadId) {
  if (!espacioId || !unidadId) return "/espacios";
  return `/espacios/${espacioId}/unidades/${unidadId}`;
}

function diaDePlanta(planta, etapaAbierta, hoy) {
  const etapa = planta?.etapa || "";
  const inicioEtapa =
    etapaAbierta && etapaAbierta.etapa === etapa ? fechaCalendario(etapaAbierta.fecha_inicio) : "";
  const inicio = inicioEtapa || fechaCalendario(planta?.fecha_inicio);
  const dia = inicio ? diaDeEtapa(inicio, hoy) : null;
  return {
    etapa,
    etiqueta: etiquetaEtapa(etapa),
    dia: Number.isFinite(dia) ? dia : null,
  };
}

function compararNumero(a, b) {
  return (Number(a?.numero) || 0) - (Number(b?.numero) || 0);
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
      const datos = diaDePlanta(planta, etapasPorPlanta.get(planta.id), hoy);
      return {
        id: planta.id,
        nombre: planta.nombre || "Planta",
        etapa: datos.etapa,
        etiqueta: datos.etiqueta,
        dia: datos.dia,
      };
    });
    const primera = lineas[0];
    const uniforme = lineas.every((linea) => linea.etapa === primera.etapa && linea.dia === primera.dia);
    tarjetas.push({
      id: unidad.id,
      nombre: unidad.nombre || "Unidad",
      espacioId: espacio.id,
      espacioNombre: espacio.nombre || "",
      tipoEspacio: espacio.tipo || "",
      tipoEtiqueta: etiquetaTipoEspacio(espacio.tipo),
      href: rutaUnidad(espacio.id, unidad.id),
      hrefHistorial: hrefHistorial({ unidadId: unidad.id }),
      plantasActivas: lineas.length,
      uniforme,
      etapaCodigo: uniforme ? primera.etapa : "",
      diaUnico: uniforme ? primera.dia : null,
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

function armarTareas({ unidades, tareas, hoy }) {
  if (!tareas?.ok && tareas?.ausente) return { estado: "no_disponible", items: [] };
  if (!tareas?.ok) return { estado: "error", items: [] };
  const unidadesPorId = unidades?.ok ? mapaPorId(unidades.filas) : new Map();
  const items = (tareas.filas || [])
    .filter((fila) => fila?.id && fechaCalendario(fila.fecha_programada))
    .map((fila) => {
      const fecha = fechaCalendario(fila.fecha_programada);
      const unidad = unidadesPorId.get(fila.unidad_cultivo_id);
      return {
        id: fila.id,
        descripcion: String(fila.descripcion || "").trim(),
        fecha,
        textoFecha: formatearFecha(fecha),
        vencida: Boolean(hoy) && fecha < hoy,
        creacion: String(fila.fecha_creacion || ""),
        unidadNombre: unidad?.nombre || "",
        href: rutaUnidad(unidad?.espacio_id, fila.unidad_cultivo_id),
      };
    })
    .filter((fila) => fila.descripcion)
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      if (a.creacion !== b.creacion) return a.creacion < b.creacion ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, LIMITE_TAREAS)
    .map(({ creacion, ...item }) => item);

  return { estado: items.length ? "listo" : "vacio", items };
}

export function armarPanel(entrada) {
  const hoy = fechaCalendario(entrada?.hoy);
  return {
    cultivos: armarCultivos({ ...entrada, hoy }),
    tareas: armarTareas({ ...entrada, hoy }),
    acciones: ACCIONES_RAPIDAS,
    productosDisponibles: MODULO_PRODUCTOS_DISPONIBLE,
  };
}
