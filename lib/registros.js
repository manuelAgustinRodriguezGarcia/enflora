import {
  ACCIONES_SEGUIMIENTO,
  PARAMETROS_SEGUIMIENTO,
} from "@/lib/seguimiento";

export const ALCANCES_REGISTRO = [
  { valor: "planta", etiqueta: "Planta" },
  { valor: "plantas", etiqueta: "Plantas seleccionadas" },
  { valor: "genetica", etiqueta: "Genética" },
  { valor: "unidad", etiqueta: "Unidad" },
  { valor: "espacio", etiqueta: "Espacio" },
];

export const APLICACIONES_REGISTRO = [
  { valor: "plantas", etiqueta: "Plantas" },
  { valor: "ambiente", etiqueta: "Ambiente" },
];

const CLAVES_ACCION = new Set(ACCIONES_SEGUIMIENTO.map((item) => item.valor));
const CLAVES_PARAMETRO = new Set(PARAMETROS_SEGUIMIENTO.map((item) => item.valor));

export function normalizarGenetica(valor) {
  const limpia = String(valor || "").trim().toLowerCase();
  return limpia || "";
}

export function etiquetaGenetica(valor) {
  return String(valor || "").trim();
}

export function agruparPlantasPorGenetica(plantas) {
  const grupos = new Map();

  for (const planta of plantas || []) {
    const etiqueta = etiquetaGenetica(planta.genetica);
    const clave = normalizarGenetica(etiqueta);
    if (!clave) continue;

    const actual = grupos.get(clave);
    if (actual) {
      actual.plantas.push(planta);
    } else {
      grupos.set(clave, { clave, etiqueta, plantas: [planta] });
    }
  }

  return [...grupos.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export function plantasDeGenetica(plantas, genetica) {
  const clave = normalizarGenetica(genetica);
  if (!clave) return [];
  return (plantas || []).filter((planta) => normalizarGenetica(planta.genetica) === clave);
}

export function esAlcanceRegistro(valor) {
  return ALCANCES_REGISTRO.some((item) => item.valor === valor);
}

export function esAplicacionRegistro(valor) {
  return APLICACIONES_REGISTRO.some((item) => item.valor === valor);
}

function etiquetaAccionNativa(clave) {
  return ACCIONES_SEGUIMIENTO.find((item) => item.valor === clave)?.etiqueta || clave;
}

function parametroNativo(clave) {
  return PARAMETROS_SEGUIMIENTO.find((item) => item.valor === clave) || null;
}

function uuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(valor || "")
  );
}

function fechaEventoValida(valor) {
  if (!valor) return false;
  const fecha = new Date(valor);
  return !Number.isNaN(fecha.getTime());
}

export function snapshotPlanta(planta, unidad) {
  return {
    id: planta.id,
    nombre: String(planta.nombre || "").trim(),
    numero: planta.numero ?? null,
    genetica: etiquetaGenetica(planta.genetica) || null,
    unidad_cultivo_id: planta.unidad_cultivo_id || unidad?.id || null,
    nombre_unidad: unidad?.nombre ? String(unidad.nombre).trim() : null,
  };
}

export function prepararPlantasRegistro(plantas, unidad) {
  return (plantas || []).map((planta) => snapshotPlanta(planta, unidad));
}

function normalizarAcciones(acciones) {
  const lista = [];

  for (const item of acciones || []) {
    const origen = item?.origen;

    if (origen === "nativa") {
      const clave = String(item?.clave_nativa || "").trim();
      if (!CLAVES_ACCION.has(clave)) {
        return { error: "Hay una acción que no es válida." };
      }
      lista.push({
        origen: "nativa",
        clave_nativa: clave,
        opcion_id: null,
        nombre: String(item?.nombre || etiquetaAccionNativa(clave)).trim(),
      });
      continue;
    }

    if (origen === "personalizada") {
      const opcionId = String(item?.opcion_id || "").trim();
      const nombre = String(item?.nombre || "").trim();
      if (!uuidValido(opcionId) || !nombre) {
        return { error: "Hay una acción que no es válida." };
      }
      lista.push({
        origen: "personalizada",
        clave_nativa: null,
        opcion_id: opcionId,
        nombre,
      });
      continue;
    }

    return { error: "Hay una acción que no es válida." };
  }

  return { acciones: lista };
}

function normalizarParametros(parametros) {
  const lista = [];

  for (const item of parametros || []) {
    const origen = item?.origen;
    const tipoValor = String(item?.tipo_valor || "").trim();

    if (tipoValor !== "numero" && tipoValor !== "texto") {
      return { error: "Hay un parámetro con tipo inválido." };
    }

    let valorNumero = null;
    let valorTexto = null;

    if (tipoValor === "numero") {
      const crudo = item?.valor_numero;
      const numero = typeof crudo === "number" ? crudo : Number(String(crudo ?? "").trim());
      if (!Number.isFinite(numero)) {
        return { error: "Hay un parámetro numérico inválido." };
      }
      valorNumero = numero;
    } else {
      valorTexto = String(item?.valor_texto || "").trim();
      if (!valorTexto) {
        return { error: "Hay un parámetro de texto vacío." };
      }
    }

    if (origen === "nativa") {
      const clave = String(item?.clave_nativa || "").trim();
      const catalogo = parametroNativo(clave);
      if (!catalogo || !CLAVES_PARAMETRO.has(clave)) {
        return { error: "Hay un parámetro que no es válido." };
      }
      lista.push({
        origen: "nativa",
        clave_nativa: clave,
        opcion_id: null,
        nombre: String(item?.nombre || catalogo.etiqueta).trim(),
        tipo_valor: tipoValor,
        valor_numero: valorNumero,
        valor_texto: valorTexto,
        unidad: String(item?.unidad ?? catalogo.unidad ?? "").trim() || null,
      });
      continue;
    }

    if (origen === "personalizada") {
      const opcionId = String(item?.opcion_id || "").trim();
      const nombre = String(item?.nombre || "").trim();
      if (!uuidValido(opcionId) || !nombre) {
        return { error: "Hay un parámetro que no es válido." };
      }
      lista.push({
        origen: "personalizada",
        clave_nativa: null,
        opcion_id: opcionId,
        nombre,
        tipo_valor: tipoValor,
        valor_numero: valorNumero,
        valor_texto: valorTexto,
        unidad: String(item?.unidad || "").trim() || null,
      });
      continue;
    }

    return { error: "Hay un parámetro que no es válido." };
  }

  return { parametros: lista };
}

export function prepararDatosRegistro(entrada) {
  const alcance = String(entrada?.alcance || "").trim();
  const aplicaA = String(entrada?.aplica_a || "").trim();
  const observacion = String(entrada?.observacion || "").trim();
  const fechaEvento = entrada?.fecha_evento;

  if (!esAlcanceRegistro(alcance)) {
    return { error: "El alcance del registro no es válido." };
  }

  if (!esAplicacionRegistro(aplicaA)) {
    return { error: "El tipo de aplicación no es válido." };
  }

  if (aplicaA === "ambiente" && alcance !== "unidad" && alcance !== "espacio") {
    return { error: "Una medición ambiental requiere unidad o espacio." };
  }

  if (!fechaEventoValida(fechaEvento)) {
    return { error: "La fecha del evento no es válida." };
  }

  if (observacion.length > 4000) {
    return { error: "La observación es demasiado larga." };
  }

  const espacioId = entrada?.espacio_id ? String(entrada.espacio_id).trim() : null;
  const unidadId = entrada?.unidad_cultivo_id
    ? String(entrada.unidad_cultivo_id).trim()
    : null;

  if (espacioId && !uuidValido(espacioId)) {
    return { error: "No se encontró el espacio." };
  }

  if (unidadId && !uuidValido(unidadId)) {
    return { error: "No se encontró la unidad." };
  }

  if (["planta", "plantas", "genetica", "unidad"].includes(alcance) && !unidadId) {
    return { error: "La unidad es obligatoria para este alcance." };
  }

  if (alcance === "espacio" && !espacioId) {
    return { error: "El espacio es obligatorio para este alcance." };
  }

  let geneticaClave = null;
  let geneticaEtiqueta = null;

  if (alcance === "genetica") {
    geneticaEtiqueta = etiquetaGenetica(entrada?.genetica_etiqueta || entrada?.genetica);
    geneticaClave = normalizarGenetica(entrada?.genetica_clave || geneticaEtiqueta);
    if (!geneticaClave || !geneticaEtiqueta) {
      return { error: "La genética del grupo no es válida." };
    }
  }

  const plantasEntrada = Array.isArray(entrada?.plantas) ? entrada.plantas : [];
  const plantas = [];

  for (const planta of plantasEntrada) {
    const id = String(planta?.id || "").trim();
    const nombre = String(planta?.nombre || "").trim();
    if (!uuidValido(id) || !nombre) {
      return { error: "Hay una planta sin datos suficientes." };
    }
    plantas.push({
      id,
      nombre,
      numero: planta?.numero ?? null,
      genetica: etiquetaGenetica(planta?.genetica) || null,
      unidad_cultivo_id: planta?.unidad_cultivo_id
        ? String(planta.unidad_cultivo_id).trim()
        : unidadId,
      nombre_unidad: planta?.nombre_unidad
        ? String(planta.nombre_unidad).trim()
        : null,
    });
  }

  if (aplicaA === "plantas" && plantas.length < 1) {
    return { error: "Seleccioná al menos una planta." };
  }

  if (aplicaA === "ambiente" && plantas.length > 0) {
    return { error: "Una medición ambiental no asocia plantas." };
  }

  const accionesOk = normalizarAcciones(entrada?.acciones);
  if (accionesOk.error) return { error: accionesOk.error };

  const parametrosOk = normalizarParametros(entrada?.parametros);
  if (parametrosOk.error) return { error: parametrosOk.error };

  if (
    accionesOk.acciones.length === 0 &&
    parametrosOk.parametros.length === 0 &&
    !observacion
  ) {
    return { error: "El registro necesita una acción, un parámetro o una observación." };
  }

  return {
    error: "",
    datos: {
      alcance,
      aplica_a: aplicaA,
      espacio_id: espacioId,
      unidad_cultivo_id: unidadId,
      genetica_clave: geneticaClave,
      genetica_etiqueta: geneticaEtiqueta,
      observacion: observacion || null,
      fecha_evento: new Date(fechaEvento).toISOString(),
      plantas,
      acciones: accionesOk.acciones,
      parametros: parametrosOk.parametros,
    },
  };
}

export function argumentosRpcRegistro(datos) {
  return {
    p_alcance: datos.alcance,
    p_aplica_a: datos.aplica_a,
    p_espacio_id: datos.espacio_id,
    p_unidad_cultivo_id: datos.unidad_cultivo_id,
    p_genetica_clave: datos.genetica_clave,
    p_genetica_etiqueta: datos.genetica_etiqueta,
    p_observacion: datos.observacion,
    p_fecha_evento: datos.fecha_evento,
    p_plantas: datos.plantas,
    p_acciones: datos.acciones,
    p_parametros: datos.parametros,
  };
}

export function rangoDiaLocal(fecha = new Date()) {
  const base = fecha instanceof Date ? fecha : new Date(fecha);
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const fin = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
  return {
    desde: inicio.toISOString(),
    hasta: fin.toISOString(),
  };
}

export function partesFechaLocal(fecha = new Date()) {
  const base = fecha instanceof Date ? fecha : new Date(fecha);
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  const dia = String(base.getDate()).padStart(2, "0");
  const hora = String(base.getHours()).padStart(2, "0");
  const minuto = String(base.getMinutes()).padStart(2, "0");
  return {
    fecha: `${base.getFullYear()}-${mes}-${dia}`,
    hora: `${hora}:${minuto}`,
  };
}

export function combinarFechaHoraLocal(fecha, hora) {
  const textoFecha = String(fecha || "").trim();
  const textoHora = String(hora || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(textoFecha)) return "";
  if (!/^\d{2}:\d{2}$/.test(textoHora)) return "";

  const [anio, mes, dia] = textoFecha.split("-").map(Number);
  const [horas, minutos] = textoHora.split(":").map(Number);
  const local = new Date(anio, mes - 1, dia, horas, minutos, 0, 0);
  if (Number.isNaN(local.getTime())) return "";
  if (
    local.getFullYear() !== anio ||
    local.getMonth() !== mes - 1 ||
    local.getDate() !== dia ||
    local.getHours() !== horas ||
    local.getMinutes() !== minutos
  ) {
    return "";
  }
  return local.toISOString();
}

export function fechaEventoDesdeDia(fecha) {
  const textoFecha = String(fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(textoFecha)) return "";

  const hoy = partesFechaLocal().fecha;
  if (textoFecha === hoy) {
    return combinarFechaHoraLocal(textoFecha, partesFechaLocal().hora);
  }

  return combinarFechaHoraLocal(textoFecha, "00:00");
}

export function resolverAlcanceRegistro({
  aplicaA,
  plantasSeleccionadas = [],
  plantasUnidad = [],
}) {
  if (aplicaA === "ambiente") {
    return {
      alcance: "unidad",
      genetica_clave: null,
      genetica_etiqueta: null,
    };
  }

  const ids = new Set(plantasSeleccionadas.map((planta) => planta.id));
  if (ids.size < 1) return null;

  if (
    plantasUnidad.length > 0 &&
    ids.size === plantasUnidad.length &&
    plantasUnidad.every((planta) => ids.has(planta.id))
  ) {
    return {
      alcance: "unidad",
      genetica_clave: null,
      genetica_etiqueta: null,
    };
  }

  if (ids.size === 1) {
    return {
      alcance: "planta",
      genetica_clave: null,
      genetica_etiqueta: null,
    };
  }

  const grupos = agruparPlantasPorGenetica(plantasUnidad);
  for (const grupo of grupos) {
    if (
      grupo.plantas.length === ids.size &&
      grupo.plantas.every((planta) => ids.has(planta.id))
    ) {
      return {
        alcance: "genetica",
        genetica_clave: grupo.clave,
        genetica_etiqueta: grupo.etiqueta,
      };
    }
  }

  return {
    alcance: "plantas",
    genetica_clave: null,
    genetica_etiqueta: null,
  };
}

export function ordenarAccionesRegistro(prioritarias, opciones = []) {
  const prioridad = new Set(prioritarias || []);
  const nativasPrioritarias = ACCIONES_SEGUIMIENTO.filter((item) =>
    prioridad.has(item.valor)
  );
  const nativasSecundarias = ACCIONES_SEGUIMIENTO.filter(
    (item) => !prioridad.has(item.valor)
  );
  const personalizadas = (opciones || []).filter(
    (item) => item.categoria === "accion" && item.activa !== false
  );
  const personalizadasPrioritarias = personalizadas.filter((item) => item.prioritaria);
  const personalizadasSecundarias = personalizadas.filter((item) => !item.prioritaria);

  return {
    prioritarias: [
      ...nativasPrioritarias.map((item) => ({
        origen: "nativa",
        clave: item.valor,
        etiqueta: item.etiqueta,
      })),
      ...personalizadasPrioritarias.map((item) => ({
        origen: "personalizada",
        clave: item.id,
        etiqueta: item.nombre,
        opcion_id: item.id,
      })),
    ],
    secundarias: [
      ...nativasSecundarias.map((item) => ({
        origen: "nativa",
        clave: item.valor,
        etiqueta: item.etiqueta,
      })),
      ...personalizadasSecundarias.map((item) => ({
        origen: "personalizada",
        clave: item.id,
        etiqueta: item.nombre,
        opcion_id: item.id,
      })),
    ],
  };
}
