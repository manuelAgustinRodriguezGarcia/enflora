import "server-only";

import { buscarEnGuiaCultivo } from "@/lib/flora-conocimiento";
import { HERRAMIENTAS_FLORA, LIMITES_FLORA } from "@/lib/flora-contexto";
import { LIMITES_CHAT_FLORA } from "@/lib/flora-chat-limites";

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

export const NOMBRES_HERRAMIENTAS_FLORA = [
  "obtener_contexto_cultivo",
  "resumir_actividad_periodo",
  "comparar_periodos_actividad",
  "buscar_acciones_historicas",
  "consultar_parametros",
  "consultar_actividad_por_fechas",
  "consultar_historial_etapas",
  "buscar_fotos_metadatos",
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
      "Índice de espacios/unidades/plantas o contexto reciente (7-14 días) de una unidad o planta. Usar al inicio o cuando cambie el alcance.",
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
    description: "Compara dos períodos (por defecto semana actual vs anterior). Opcional: parámetro ambiental.",
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
          periodoA: presetA.valor
            ? { preset: presetA.valor }
            : { desde: args.desde_a, hasta: args.hasta_a, preset: "semana_actual" },
          periodoB: presetB.valor
            ? { preset: presetB.valor }
            : { desde: args.desde_b, hasta: args.hasta_b, preset: "semana_anterior" },
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
