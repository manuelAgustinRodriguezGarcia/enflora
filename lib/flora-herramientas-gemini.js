import "server-only";

import { esTipoTarea, fechaMasDias } from "@/lib/calendario/modelo";
import { fechaHoy } from "@/lib/etapas";
import { LIMITES_CHAT_FLORA } from "@/lib/flora-chat-limites";
import { periodoExplicitoOPreset } from "@/lib/flora-periodos";
import { buscarEnGuiaCultivo } from "@/lib/flora-conocimiento";
import { HERRAMIENTAS_FLORA, LIMITES_FLORA } from "@/lib/flora-contexto";
import { buscarSolucionesGuardadasGemini } from "@/lib/flora-soluciones";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRESETS_PERIODO = new Set([
  "hoy",
  "ayer",
  "ultimos_7",
  "ultimos_14",
  "semana_actual",
  "semana_anterior",
]);

const MODOS_ACCION = new Set(["ultimo", "primero", "listar", "contar"]);
const MODOS_NUTRIENTES = new Set(["ultimo", "listar", "contar", "productos"]);
const MODOS_CRUCE = new Set(["despues_de_accion", "antes_de_variacion", "durante_etapa", "entre_etapas"]);
const ACCIONES_CRUCE = new Set(["riego", "fertilizacion"]);
const VISTAS_TAREA = new Set(["pendientes", "vencidas", "proximas", "completadas", "fecha"]);

export const NOMBRES_HERRAMIENTAS_FLORA = [
  "obtener_contexto_cultivo",
  "resumir_actividad_periodo",
  "comparar_periodos_actividad",
  "buscar_acciones_historicas",
  "consultar_parametros",
  "consultar_actividad_por_fechas",
  "consultar_historial_etapas",
  "buscar_fotos_metadatos",
  "consultar_aplicaciones_nutrientes",
  "relacionar_evolucion_cultivo",
  "consultar_tareas_programadas",
  "consultar_clima_exterior",
  "buscar_soluciones_guardadas",
  "buscar_en_guia_cultivo",
];

function textoCorto(valor, max = 200) {
  const s = String(valor ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function uuidOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return { ok: true, valor: "" };
  const s = String(valor).trim();
  if (!UUID_RE.test(s)) return { ok: false, error: `${campo} no es un identificador válido.` };
  return { ok: true, valor: s };
}

function stringOpcional(valor, campo, max = 120) {
  if (valor === undefined || valor === null || valor === "") return { ok: true, valor: "" };
  const s = String(valor).trim();
  if (!s) return { ok: true, valor: "" };
  if (s.length > max) return { ok: false, error: `${campo} es demasiado largo.` };
  return { ok: true, valor: s };
}

function presetOpcional(valor) {
  if (valor === undefined || valor === null || valor === "") return { ok: true, valor: "" };
  const s = String(valor).trim();
  if (!PRESETS_PERIODO.has(s)) return { ok: false, error: "El preset de período no es válido." };
  return { ok: true, valor: s };
}

function fechaOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return { ok: true, valor: "" };
  const s = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: `${campo} debe ser YYYY-MM-DD.` };
  return { ok: true, valor: s };
}

function truncarResultado(objeto) {
  let serializado = JSON.stringify(objeto);
  const max = LIMITES_CHAT_FLORA.maxCaracteresResultadoHerramienta;
  if (serializado.length <= max) return objeto;
  return {
    ...objeto,
    datos: null,
    error: objeto.error || "Resultado truncado por límite de tamaño.",
    metadatos: {
      ...(objeto.metadatos || {}),
      truncado: true,
      bytesOriginales: serializado.length,
    },
  };
}

const periodoSchema = {
  type: "object",
  properties: {
    preset: {
      type: "string",
      description:
        "hoy, ayer, ultimos_7, ultimos_14, semana_actual, semana_anterior. Alternativa: desde/hasta (YYYY-MM-DD).",
    },
    desde: { type: "string", description: "Fecha inicio YYYY-MM-DD (zona Argentina)." },
    hasta: { type: "string", description: "Fecha fin YYYY-MM-DD (zona Argentina)." },
  },
};

export const DECLARACIONES_HERRAMIENTAS_GEMINI = [
  {
    name: "obtener_contexto_cultivo",
    description:
      "Índice de espacios, unidades y plantas, o contexto reciente de 7 a 14 días. No la repitas si el índice compacto ya está en el mensaje, ni antes de relacionar_evolucion_cultivo.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        nombre_unidad: { type: "string", description: "Nombre de la unidad de cultivo (ej. Carpa 1)." },
        nombre_planta: { type: "string", description: "Nombre o alias de la planta." },
        unidad_id: { type: "string", description: "UUID de unidad si ya se conoce." },
        planta_id: { type: "string", description: "UUID de planta si ya se conoce." },
        genetica: { type: "string", description: "Filtrar por genética/cepa." },
        dias_recientes: { type: "integer", description: "7 (default) o 14." },
      },
    },
  },
  {
    name: "resumir_actividad_periodo",
    description: "Resumen de actividad (riegos, acciones, mediciones) en un período.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        ...periodoSchema.properties,
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
      },
    },
  },
  {
    name: "comparar_periodos_actividad",
    description:
      "Compara dos períodos y ya incluye ambos resúmenes. Si la pregunta trae fechas, pasá desde_a/hasta_a y desde_b/hasta_b, sin preset. No la combines con resumir_actividad_periodo ni consultar_actividad_por_fechas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
        preset_periodo_a: { type: "string" },
        preset_periodo_b: { type: "string" },
        desde_a: { type: "string" },
        hasta_a: { type: "string" },
        desde_b: { type: "string" },
        hasta_b: { type: "string" },
        clave_parametro: {
          type: "string",
          description: "Clave nativa del parámetro (ph, ec, temperatura, etc.).",
        },
      },
    },
  },
  {
    name: "buscar_acciones_historicas",
    description:
      "Busca acciones (ej. riego). modo: ultimo (default), primero, listar, contar. Sin período busca en todo el historial cargado.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        modo: { type: "string", enum: ["ultimo", "primero", "listar", "contar"] },
        clave_nativa: { type: "string", description: "Ej. riego, fertilizacion." },
        nombre_accion: { type: "string" },
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
        preset: { type: "string" },
        desde: { type: "string" },
        hasta: { type: "string" },
      },
    },
  },
  {
    name: "consultar_parametros",
    description: "Mediciones y estadísticas de un parámetro en un período.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        ...periodoSchema.properties,
        clave_nativa: { type: "string" },
        nombre: { type: "string" },
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
      },
    },
  },
  {
    name: "consultar_actividad_por_fechas",
    description: "Actividad agrupada por día en un período.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        ...periodoSchema.properties,
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
      },
    },
  },
  {
    name: "consultar_historial_etapas",
    description: "Etapas de una planta o resumen por unidad.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        planta_id: { type: "string" },
        unidad_id: { type: "string" },
        etapa: { type: "string", description: "Si se indica, lista acciones en esa etapa." },
      },
    },
  },
  {
    name: "buscar_fotos_metadatos",
    description: "Metadatos de fotos (sin archivos ni URLs).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        ...periodoSchema.properties,
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        genetica: { type: "string" },
      },
    },
  },
  {
    name: "consultar_aplicaciones_nutrientes",
    description:
      "Mezclas realmente aplicadas, con snapshot histórico. Una llamada por período o por registro_id. No la repitas por cada planta de la misma unidad. modo: ultimo, listar, contar, productos. El volumen es agua preparada. ml/L, g/L y gotas/L son dosis; ml, g, L y gotas son cantidades absolutas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        modo: { type: "string", enum: ["ultimo", "listar", "contar", "productos"] },
        clave_nativa: { type: "string", description: "riego o fertilizacion, si corresponde." },
        nombre_producto: { type: "string", description: "Nombre guardado en el registro, no el catálogo actual." },
        nombre_receta: { type: "string", description: "Nombre de la mezcla guardado en el registro." },
        registro_id: { type: "string" },
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        nombre_unidad: { type: "string" },
        nombre_planta: { type: "string" },
        genetica: { type: "string" },
        preset: { type: "string" },
        desde: { type: "string" },
        hasta: { type: "string" },
      },
    },
  },
  {
    name: "relacionar_evolucion_cultivo",
    description:
      "Llamala directo, sin obtener_contexto_cultivo. Una sola lectura que cruza riegos o fertilizaciones, productos del registro y un parámetro, y verifica la sesión y la pertenencia. modo: despues_de_accion, antes_de_variacion, durante_etapa, entre_etapas. No afirma causalidad. Un valor sospechoso trae valor_almacenado y correccion no_aplicada: no hay valor corregido. cobertura dice si se puede afirmar que no hay más eventos. No la combines con consultar_parametros ni consultar_aplicaciones_nutrientes para el mismo cruce.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        modo: {
          type: "string",
          enum: ["despues_de_accion", "antes_de_variacion", "durante_etapa", "entre_etapas"],
        },
        clave_nativa_accion: { type: "string", description: "riego o fertilizacion. Obligatoria en despues_de_accion." },
        cantidad: { type: "integer", description: "Últimos eventos, de 1 a 8. Default 3." },
        clave_parametro: { type: "string", description: "ph, ec, ppm, temperatura, humedad o vpd." },
        etapa: { type: "string", description: "Código de etapa, por ejemplo vegetativo o enflora." },
        etapa_b: { type: "string", description: "Segunda etapa para entre_etapas." },
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        nombre_unidad: { type: "string" },
        nombre_planta: { type: "string" },
        genetica: { type: "string" },
        desde: { type: "string" },
        hasta: { type: "string" },
      },
    },
  },
  {
    name: "consultar_tareas_programadas",
    description:
      "Solo lectura del calendario. Una sola vista por pregunta. Si piden pendientes, no consultes también vencidas ni próximas. Una tarea no es un registro de cultivo. vista: pendientes, vencidas, proximas, completadas, fecha.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        vista: { type: "string", enum: ["pendientes", "vencidas", "proximas", "completadas", "fecha"] },
        fecha: { type: "string", description: "YYYY-MM-DD. Obligatoria si vista es fecha." },
        preset: { type: "string", description: "hoy, manana o un preset de período para completadas." },
        tipo: { type: "string", description: "riego, fertilizacion, poda, revision o personalizada." },
        unidad_id: { type: "string" },
        planta_id: { type: "string" },
        nombre_unidad: { type: "string" },
        nombre_planta: { type: "string" },
        desde: { type: "string" },
        hasta: { type: "string" },
      },
    },
  },
  {
    name: "consultar_clima_exterior",
    description:
      "Observación, pronóstico y alertas de un espacio exterior con localidad ya guardada. Usa la caché meteorológica existente. No inventa datos. Separa observación, pronóstico, alertas oficiales y avisos calculados por ENFLORA.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        espacio_id: { type: "string" },
        nombre_espacio: { type: "string" },
      },
    },
  },
  {
    name: "buscar_soluciones_guardadas",
    description:
      "Busca chats y respuestas que el usuario guardó antes en su biblioteca privada. Solo lectura; contenido histórico. Usar cuando pida retomar una consulta anterior o recuperar algo que ya le respondiste en el pasado. No sustituye consultar registros actuales.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description: "Texto para buscar por título, pregunta o contenido de chats guardados.",
        },
        limite: {
          type: "integer",
          description: "Cantidad máxima de coincidencias (default 5, máx. 8).",
        },
        id: {
          type: "string",
          description:
            "UUID opcional de un chat o solución guardada para recuperar ese registro concreto (sin búsqueda amplia).",
        },
      },
      required: [],
    },
  },
  {
    name: "buscar_en_guia_cultivo",
    description: "Fragmentos de la guía interna editorial (no es búsqueda web).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Términos o pregunta técnica." },
        temas: { type: "array", items: { type: "string" } },
      },
      required: ["consulta"],
    },
  },
];

function validarArgsContexto(raw) {
  const unidadId = uuidOpcional(raw.unidad_id, "unidad_id");
  if (!unidadId.ok) return unidadId;
  const plantaId = uuidOpcional(raw.planta_id, "planta_id");
  if (!plantaId.ok) return plantaId;
  const nombreUnidad = stringOpcional(raw.nombre_unidad, "nombre_unidad");
  if (!nombreUnidad.ok) return nombreUnidad;
  const nombrePlanta = stringOpcional(raw.nombre_planta, "nombre_planta");
  if (!nombrePlanta.ok) return nombrePlanta;
  const genetica = stringOpcional(raw.genetica, "genetica", 80);
  if (!genetica.ok) return genetica;
  let diasRecientes = LIMITES_FLORA.diasRecientesDefault;
  if (raw.dias_recientes === 14) diasRecientes = 14;
  return {
    ok: true,
    opciones: {
      unidadId: unidadId.valor,
      plantaId: plantaId.valor,
      nombreUnidad: nombreUnidad.valor,
      nombrePlanta: nombrePlanta.valor,
      genetica: genetica.valor,
      diasRecientes,
    },
  };
}

function validarFiltrosCultivo(raw) {
  const unidadId = uuidOpcional(raw.unidad_id, "unidad_id");
  if (!unidadId.ok) return unidadId;
  const plantaId = uuidOpcional(raw.planta_id, "planta_id");
  if (!plantaId.ok) return plantaId;
  const genetica = stringOpcional(raw.genetica, "genetica", 80);
  if (!genetica.ok) return genetica;
  const preset = presetOpcional(raw.preset);
  if (!preset.ok) return preset;
  const desde = fechaOpcional(raw.desde, "desde");
  if (!desde.ok) return desde;
  const hasta = fechaOpcional(raw.hasta, "hasta");
  if (!hasta.ok) return hasta;
  return {
    ok: true,
    opciones: {
      unidadId: unidadId.valor,
      plantaId: plantaId.valor,
      genetica: genetica.valor,
      preset: preset.valor,
      desde: desde.valor,
      hasta: hasta.valor,
    },
  };
}

export async function ejecutarHerramientaFlora(supabase, nombre, argsRaw = {}) {
  if (!NOMBRES_HERRAMIENTAS_FLORA.includes(nombre)) {
    return truncarResultado({
      error: "Herramienta no autorizada.",
      fuente: "sistema",
      tipoConsulta: nombre,
      datos: null,
    });
  }

  const args = argsRaw && typeof argsRaw === "object" ? argsRaw : {};

  try {
    switch (nombre) {
      case "obtener_contexto_cultivo": {
        const v = validarArgsContexto(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.obtenerContextoCultivo(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          nombreUnidad: v.opciones.nombreUnidad,
          nombrePlanta: v.opciones.nombrePlanta,
          genetica: v.opciones.genetica,
          diasRecientes: v.opciones.diasRecientes,
        });
        return truncarResultado(r);
      }
      case "resumir_actividad_periodo": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.resumirActividadPeriodo(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
        });
        return truncarResultado(r);
      }
      case "comparar_periodos_actividad": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const presetA = presetOpcional(args.preset_periodo_a);
        const presetB = presetOpcional(args.preset_periodo_b);
        if (!presetA.ok || !presetB.ok) {
          return truncarResultado({ error: "Preset de período inválido.", fuente: "sistema", datos: null });
        }
        const clave = stringOpcional(args.clave_parametro, "clave_parametro", 60);
        if (!clave.ok) return truncarResultado({ error: clave.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.compararPeriodosActividad(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          periodoA: periodoExplicitoOPreset(presetA.valor, args.desde_a, args.hasta_a, "semana_actual"),
          periodoB: periodoExplicitoOPreset(presetB.valor, args.desde_b, args.hasta_b, "semana_anterior"),
          parametro: clave.valor ? { claveNativa: clave.valor } : undefined,
        });
        return truncarResultado(r);
      }
      case "buscar_acciones_historicas": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const modo = args.modo ? String(args.modo).trim() : "ultimo";
        if (!MODOS_ACCION.has(modo)) {
          return truncarResultado({ error: "Modo de búsqueda inválido.", fuente: "sistema", datos: null });
        }
        const claveNativa = stringOpcional(args.clave_nativa, "clave_nativa", 60);
        const nombreAccion = stringOpcional(args.nombre_accion, "nombre_accion", 80);
        if (!claveNativa.ok || !nombreAccion.ok) {
          return truncarResultado({ error: claveNativa.error || nombreAccion.error, fuente: "sistema", datos: null });
        }
        const r = await HERRAMIENTAS_FLORA.buscarAccionesHistoricas(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
          modo,
          claveNativa: claveNativa.valor,
          nombreAccion: nombreAccion.valor,
        });
        return truncarResultado(r);
      }
      case "consultar_parametros": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const claveNativa = stringOpcional(args.clave_nativa, "clave_nativa", 60);
        const nombre = stringOpcional(args.nombre, "nombre", 80);
        if (!claveNativa.ok || !nombre.ok) {
          return truncarResultado({ error: claveNativa.error || nombre.error, fuente: "sistema", datos: null });
        }
        const r = await HERRAMIENTAS_FLORA.consultarParametros(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
          claveNativa: claveNativa.valor,
          nombre: nombre.valor,
        });
        return truncarResultado(r);
      }
      case "consultar_actividad_por_fechas": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.consultarActividadPorFechas(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
        });
        return truncarResultado(r);
      }
      case "consultar_historial_etapas": {
        const unidadId = uuidOpcional(args.unidad_id, "unidad_id");
        const plantaId = uuidOpcional(args.planta_id, "planta_id");
        if (!unidadId.ok || !plantaId.ok) {
          return truncarResultado({ error: unidadId.error || plantaId.error, fuente: "sistema", datos: null });
        }
        const etapa = stringOpcional(args.etapa, "etapa", 40);
        if (!etapa.ok) return truncarResultado({ error: etapa.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.consultarHistorialEtapas(supabase, {
          unidadId: unidadId.valor,
          plantaId: plantaId.valor,
          etapa: etapa.valor,
        });
        return truncarResultado(r);
      }
      case "buscar_fotos_metadatos": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const r = await HERRAMIENTAS_FLORA.buscarFotosMetadatos(supabase, {
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
        });
        return truncarResultado(r);
      }
      case "consultar_aplicaciones_nutrientes": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const nombreUnidad = stringOpcional(args.nombre_unidad, "nombre_unidad");
        const nombrePlanta = stringOpcional(args.nombre_planta, "nombre_planta");
        const claveNativa = stringOpcional(args.clave_nativa, "clave_nativa", 60);
        const nombreProducto = stringOpcional(args.nombre_producto, "nombre_producto", 80);
        const nombreReceta = stringOpcional(args.nombre_receta, "nombre_receta", 80);
        const registroId = uuidOpcional(args.registro_id, "registro_id");
        if (!nombreUnidad.ok || !nombrePlanta.ok || !claveNativa.ok || !nombreProducto.ok || !nombreReceta.ok || !registroId.ok) {
          return truncarResultado({
            error: nombreUnidad.error || nombrePlanta.error || claveNativa.error || nombreProducto.error || nombreReceta.error || registroId.error,
            fuente: "sistema",
            datos: null,
          });
        }
        const modo = args.modo ? String(args.modo).trim() : "ultimo";
        if (!MODOS_NUTRIENTES.has(modo)) {
          return truncarResultado({ error: "Modo de consulta inválido.", fuente: "sistema", datos: null });
        }
        const r = await HERRAMIENTAS_FLORA.consultarAplicacionesNutrientes(supabase, {
          modo,
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          genetica: v.opciones.genetica,
          preset: v.opciones.preset,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
          nombreUnidad: nombreUnidad.valor,
          nombrePlanta: nombrePlanta.valor,
          claveNativa: claveNativa.valor,
          nombreProducto: nombreProducto.valor,
          nombreReceta: nombreReceta.valor,
          registroId: registroId.valor,
        });
        return truncarResultado(r);
      }
      case "relacionar_evolucion_cultivo": {
        const v = validarFiltrosCultivo(args);
        if (!v.ok) return truncarResultado({ error: v.error, fuente: "sistema", datos: null });
        const nombreUnidad = stringOpcional(args.nombre_unidad, "nombre_unidad");
        const nombrePlanta = stringOpcional(args.nombre_planta, "nombre_planta");
        const claveParametro = stringOpcional(args.clave_parametro, "clave_parametro", 60);
        const claveAccion = stringOpcional(args.clave_nativa_accion, "clave_nativa_accion", 40);
        const etapa = stringOpcional(args.etapa, "etapa", 40);
        const etapaB = stringOpcional(args.etapa_b, "etapa_b", 40);
        if (!nombreUnidad.ok || !nombrePlanta.ok || !claveParametro.ok || !claveAccion.ok || !etapa.ok || !etapaB.ok) {
          return truncarResultado({
            error: nombreUnidad.error || nombrePlanta.error || claveParametro.error || claveAccion.error || etapa.error || etapaB.error,
            fuente: "sistema",
            datos: null,
          });
        }
        const modo = String(args.modo || "").trim();
        if (!MODOS_CRUCE.has(modo)) {
          return truncarResultado({ error: "Modo de análisis inválido.", fuente: "sistema", datos: null });
        }
        if (!claveParametro.valor) {
          return truncarResultado({ error: "Indicá el parámetro a relacionar.", fuente: "sistema", datos: null });
        }
        if (modo === "despues_de_accion" && !ACCIONES_CRUCE.has(claveAccion.valor)) {
          return truncarResultado({ error: "Indicá riego o fertilizacion.", fuente: "sistema", datos: null });
        }
        if (modo === "durante_etapa" && !etapa.valor) {
          return truncarResultado({ error: "Indicá la etapa.", fuente: "sistema", datos: null });
        }
        if (modo === "entre_etapas" && (!etapa.valor || !etapaB.valor)) {
          return truncarResultado({ error: "Indicá las dos etapas.", fuente: "sistema", datos: null });
        }
        let cantidad = 3;
        if (args.cantidad !== undefined && args.cantidad !== null && args.cantidad !== "") {
          const numero = Number(args.cantidad);
          if (!Number.isInteger(numero) || numero < 1 || numero > 8) {
            return truncarResultado({ error: "La cantidad debe ser entre 1 y 8.", fuente: "sistema", datos: null });
          }
          cantidad = numero;
        }
        const r = await HERRAMIENTAS_FLORA.relacionarEvolucionCultivo(supabase, {
          modo,
          claveParametro: claveParametro.valor,
          claveAccion: claveAccion.valor,
          cantidad,
          etapa: etapa.valor,
          etapaB: etapaB.valor,
          unidadId: v.opciones.unidadId,
          plantaId: v.opciones.plantaId,
          nombreUnidad: nombreUnidad.valor,
          nombrePlanta: nombrePlanta.valor,
          genetica: v.opciones.genetica,
          desde: v.opciones.desde,
          hasta: v.opciones.hasta,
        });
        return truncarResultado(r);
      }
      case "consultar_tareas_programadas": {
        const unidadId = uuidOpcional(args.unidad_id, "unidad_id");
        const plantaId = uuidOpcional(args.planta_id, "planta_id");
        const nombreUnidad = stringOpcional(args.nombre_unidad, "nombre_unidad");
        const nombrePlanta = stringOpcional(args.nombre_planta, "nombre_planta");
        const tipo = stringOpcional(args.tipo, "tipo", 40);
        const desde = fechaOpcional(args.desde, "desde");
        const hasta = fechaOpcional(args.hasta, "hasta");
        if (!unidadId.ok || !plantaId.ok || !nombreUnidad.ok || !nombrePlanta.ok || !tipo.ok || !desde.ok || !hasta.ok) {
          return truncarResultado({
            error: unidadId.error || plantaId.error || nombreUnidad.error || nombrePlanta.error || tipo.error || desde.error || hasta.error,
            fuente: "sistema",
            datos: null,
          });
        }
        if (tipo.valor && !esTipoTarea(tipo.valor)) {
          return truncarResultado({ error: "El tipo de tarea no es válido.", fuente: "sistema", datos: null });
        }
        const presetTexto = args.preset ? String(args.preset).trim() : "";
        let fecha = "";
        let preset = "";
        if (presetTexto === "hoy") fecha = fechaHoy();
        else if (presetTexto === "manana") fecha = fechaMasDias(fechaHoy(), 1);
        else if (presetTexto) {
          const presetValido = presetOpcional(presetTexto);
          if (!presetValido.ok) return truncarResultado({ error: presetValido.error, fuente: "sistema", datos: null });
          preset = presetValido.valor;
        }
        let vista = args.vista ? String(args.vista).trim() : "";
        if (!vista && fecha) vista = "fecha";
        if (!vista) vista = "pendientes";
        if (!VISTAS_TAREA.has(vista)) {
          return truncarResultado({ error: "La vista de tareas no es válida.", fuente: "sistema", datos: null });
        }
        if (!fecha && args.fecha) {
          const fechaValida = fechaOpcional(args.fecha, "fecha");
          if (!fechaValida.ok) return truncarResultado({ error: fechaValida.error, fuente: "sistema", datos: null });
          fecha = fechaValida.valor;
        }
        if (vista === "fecha" && !fecha) {
          return truncarResultado({ error: "La fecha de la tarea no es válida.", fuente: "sistema", datos: null });
        }
        const r = await HERRAMIENTAS_FLORA.consultarTareasProgramadas(supabase, {
          vista,
          fecha,
          tipo: tipo.valor,
          unidadId: unidadId.valor,
          plantaId: plantaId.valor,
          nombreUnidad: nombreUnidad.valor,
          nombrePlanta: nombrePlanta.valor,
          preset,
          desde: desde.valor,
          hasta: hasta.valor,
        });
        return truncarResultado(r);
      }
      case "consultar_clima_exterior": {
        const espacioId = uuidOpcional(args.espacio_id, "espacio_id");
        const nombreEspacio = stringOpcional(args.nombre_espacio, "nombre_espacio");
        if (!espacioId.ok || !nombreEspacio.ok) {
          return truncarResultado({
            error: espacioId.error || nombreEspacio.error,
            fuente: "sistema",
            datos: null,
          });
        }
        const r = await HERRAMIENTAS_FLORA.consultarClimaExterior(supabase, {
          espacioId: espacioId.valor,
          nombreEspacio: nombreEspacio.valor,
        });
        return truncarResultado(r);
      }
      case "buscar_soluciones_guardadas": {
        const idOpcional = args.id ? uuidOpcional(args.id, "id") : { ok: true, valor: null };
        if (!idOpcional.ok) {
          return truncarResultado({ error: idOpcional.error, fuente: "sistema", datos: null });
        }
        if (idOpcional.valor) {
          const r = await buscarSolucionesGuardadasGemini(supabase, {
            consulta: "",
            id: idOpcional.valor,
          });
          return truncarResultado(r);
        }
        const consulta = stringOpcional(args.consulta, "consulta", 300);
        if (!consulta.ok) return truncarResultado({ error: consulta.error, fuente: "sistema", datos: null });
        if (!consulta.valor) {
          return truncarResultado({
            error: "La consulta no puede estar vacía.",
            fuente: "sistema",
            datos: null,
          });
        }
        let limite = 5;
        if (args.limite !== undefined && args.limite !== null && args.limite !== "") {
          const n = Number(args.limite);
          if (!Number.isFinite(n) || n < 1 || n > 8) {
            return truncarResultado({ error: "El límite debe ser entre 1 y 8.", fuente: "sistema", datos: null });
          }
          limite = Math.floor(n);
        }
        const r = await buscarSolucionesGuardadasGemini(supabase, {
          consulta: consulta.valor,
          limite,
        });
        return truncarResultado(r);
      }
      case "buscar_en_guia_cultivo": {
        const consulta = stringOpcional(args.consulta, "consulta", 500);
        if (!consulta.ok) return truncarResultado({ error: consulta.error, fuente: "sistema", datos: null });
        if (!consulta.valor) {
          return truncarResultado({
            error: "La consulta a la guía no puede estar vacía.",
            fuente: "sistema",
            datos: null,
          });
        }
        const temas = Array.isArray(args.temas)
          ? args.temas.map((t) => textoCorto(t, 80)).filter(Boolean).slice(0, 8)
          : [];
        const r = await buscarEnGuiaCultivo({
          consulta: consulta.valor,
          temas,
          supabase,
        });
        return truncarResultado(r);
      }
      default: {
        return truncarResultado({
          error: "Herramienta no autorizada.",
          fuente: "sistema",
          tipoConsulta: nombre,
          datos: null,
        });
      }
    }
  } catch {
    return truncarResultado({
      error: "No se pudo completar la consulta.",
      fuente: "sistema",
      tipoConsulta: nombre,
      datos: null,
    });
  }
}
