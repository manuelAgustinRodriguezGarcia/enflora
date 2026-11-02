import { diaDeEtapa, etiquetaEtapa, fechaValida, formatearFecha } from "@/lib/etapas";
import { hrefHistorial } from "@/lib/historial-registros";
import { etiquetaAccionNativa } from "@/lib/seguimiento";
import { etiquetaTipoEspacio } from "@/lib/unidades";

export const LIMITE_RECIENTES = 6;
export const LIMITE_CUIDADOS = 5;
export const LIMITE_TAREAS = 8;
export const LIMITE_LINEAS_UNIDAD = 4;

const CLAVES_CUIDADO = new Set(["riego", "fertilizacion"]);
const ZONA = "America/Argentina/Buenos_Aires";

export const ACCIONES_RAPIDAS = Object.freeze([
  Object.freeze({ clave: "registrar", etiqueta: "Registrar", href: "/registros", primaria: true }),
  Object.freeze({ clave: "flora", etiqueta: "Consultar Flora", href: "/flora", primaria: false }),
  Object.freeze({ clave: "cultivos", etiqueta: "Ver cultivos", href: "/espacios", primaria: false }),
  Object.freeze({ clave: "historial", etiqueta: "Abrir historial", href: "/registros/historial", primaria: false }),
]);

/** El módulo de productos y recetas no existe en la app. */
export const MODULO_PRODUCTOS_DISPONIBLE = false;

/** No hay coordenadas de cultivo ni fuente meteorológica en el esquema. */
export const CLIMA_DISPONIBLE = false;

export const SELECT_RECIENTES =
  "id, fecha_evento, unidad_cultivo_id, espacio_id, observacion, registro_acciones(clave_nativa, nombre), registro_plantas(nombre_unidad, unidad_cultivo_id)";

export const SELECT_CUIDADOS =
  "id, fecha_evento, unidad_cultivo_id, espacio_id, filtro_cuidado:registro_acciones!inner(clave_nativa, nombre), registro_plantas(nombre_unidad, unidad_cultivo_id)";

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
    recientes: {
      tabla: "registros",
      select: SELECT_RECIENTES,
      eq: [["usuario_id", usuarioId]],
      orden: [
        ["fecha_evento", { ascending: false }],
        ["id", { ascending: false }],
      ],
      limite: LIMITE_RECIENTES,
    },
    cuidados: {
      tabla: "registros",
      select: SELECT_CUIDADOS,
      eq: [["usuario_id", usuarioId]],
      in: [["filtro_cuidado.clave_nativa", ["riego", "fertilizacion"]]],
      orden: [
        ["fecha_evento", { ascending: false }],
        ["id", { ascending: false }],
      ],
      limite: LIMITE_CUIDADOS,
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

export function partesInstante(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONA,
  }).formatToParts(fecha);
  const mapa = {};
  for (const parte of partes) {
    if (parte.type !== "literal") mapa[parte.type] = parte.value;
  }
  return mapa;
}

export function textoInstanteCultivo(iso) {
  const partes = partesInstante(iso);
  if (!partes?.day || !partes.hour || !partes.minute) return "";
  const mes = partes.month ? ` ${partes.month}` : "";
  return `${partes.day}${mes} · ${partes.hour}:${partes.minute}`;
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

function accionesDe(registro, cuidado) {
  const filas = cuidado ? registro?.filtro_cuidado || registro?.registro_acciones : registro?.registro_acciones;
  return Array.isArray(filas) ? filas : [];
}

function tituloDe(registro, cuidado) {
  const nombres = [];
  for (const accion of accionesDe(registro, cuidado)) {
    if (cuidado && !CLAVES_CUIDADO.has(accion?.clave_nativa)) continue;
    const nombre = String(accion?.nombre || "").trim() || etiquetaAccionNativa(accion?.clave_nativa);
    if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
  }
  if (nombres.length) return nombres.join(", ");
  if (!cuidado && String(registro?.observacion || "").trim()) return "Nota";
  return cuidado ? "" : "Registro";
}

function presentarRegistro(registro, unidades, espacios, cuidado) {
  const titulo = tituloDe(registro, cuidado);
  if (!titulo) return null;
  const planta = (registro.registro_plantas || [])[0];
  const unidadId = registro.unidad_cultivo_id || planta?.unidad_cultivo_id || "";
  const unidad = unidades.get(unidadId);
  const espacioId = registro.espacio_id || unidad?.espacio_id || "";
  const espacio = espacios.get(espacioId);
  return {
    id: registro.id,
    titulo,
    textoFecha: textoInstanteCultivo(registro.fecha_evento),
    unidadNombre: unidad?.nombre || planta?.nombre_unidad || "",
    espacioNombre: espacio?.nombre || "",
    href: unidadId ? hrefHistorial({ unidadId }) : "/registros/historial",
  };
}

function ordenarRecientes(filas) {
  return [...(filas || [])].sort((a, b) => {
    const fecha = String(b?.fecha_evento || "").localeCompare(String(a?.fecha_evento || ""));
    if (fecha !== 0) return fecha;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });
}

function unicos(filas) {
  const vistos = new Set();
  const salida = [];
  for (const fila of filas || []) {
    if (!fila?.id || vistos.has(fila.id)) continue;
    vistos.add(fila.id);
    salida.push(fila);
  }
  return salida;
}

function armarListaActividad(resultado, unidades, espacios, cuidado, limite) {
  if (!resultado?.ok) return { estado: "error", items: [] };
  const items = [];
  for (const fila of ordenarRecientes(unicos(resultado.filas)).slice(0, limite)) {
    const item = presentarRegistro(fila, unidades, espacios, cuidado);
    if (item) items.push(item);
  }
  return { estado: items.length ? "listo" : "vacio", items };
}

function armarActividad({ espacios, unidades, recientes, cuidados }) {
  const unidadesPorId = unidades?.ok ? mapaPorId(unidades.filas) : new Map();
  const espaciosPorId = espacios?.ok ? mapaPorId(espacios.filas) : new Map();
  return {
    recientes: armarListaActividad(recientes, unidadesPorId, espaciosPorId, false, LIMITE_RECIENTES),
    cuidados: armarListaActividad(cuidados, unidadesPorId, espaciosPorId, true, LIMITE_CUIDADOS),
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

function armarExterior({ espacios, unidades }) {
  if (!espacios?.ok || !unidades?.ok) return { estado: "error", unidades: [] };
  const espaciosPorId = mapaPorId(espacios.filas);
  const unidadesExterior = [];
  for (const unidad of unidades.filas || []) {
    const espacio = espaciosPorId.get(unidad.espacio_id);
    if (espacio?.tipo !== "exterior") continue;
    unidadesExterior.push({
      id: unidad.id,
      nombre: unidad.nombre || "Unidad",
      espacioNombre: espacio.nombre || "",
      href: rutaUnidad(espacio.id, unidad.id),
    });
  }
  return { estado: "listo", unidades: unidadesExterior };
}

export function armarPanel(entrada) {
  const hoy = fechaCalendario(entrada?.hoy);
  return {
    cultivos: armarCultivos({ ...entrada, hoy }),
    actividad: armarActividad(entrada),
    tareas: armarTareas({ ...entrada, hoy }),
    exterior: armarExterior(entrada),
    clima: { disponible: CLIMA_DISPONIBLE, motivo: "sin_ubicacion_ni_fuente" },
    acciones: ACCIONES_RAPIDAS,
    productosDisponibles: MODULO_PRODUCTOS_DISPONIBLE,
  };
}
