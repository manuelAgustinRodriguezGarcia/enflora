import { normalizarFotosNuevas, normalizarFotosQuitar } from "@/lib/fotos";
import { fusionarMedicionesMezcla, validarPayloadMezcla } from "@/lib/mezclas/reglas";
import {
  ACCIONES_NATIVAS_HISTORICAS,
  ACCIONES_SEGUIMIENTO,
  PARAMETROS_SEGUIMIENTO,
  esAccionNativaHistorica,
  etiquetaAccionNativa,
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

// Incluye las claves históricas (foto, nota) para no perder esas filas al editar un registro viejo.
const CLAVES_ACCION = new Set(
  [...ACCIONES_SEGUIMIENTO, ...ACCIONES_NATIVAS_HISTORICAS].map((item) => item.valor)
);
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

export function parsearNumeroParametro(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!texto) return null;
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export function claveParametroRegistro(item) {
  if (item?.origen === "nativa") return `nativa:${item.clave || item.clave_nativa}`;
  return `personalizada:${item.clave || item.opcion_id}`;
}

export function etiquetaCortaParametro(clave, etiqueta) {
  const cortas = {
    temperatura: "Temp.",
    humedad: "Hum.",
    ph: "pH",
    ec: "EC",
    ppm: "PPM",
    vpd: "VPD",
  };
  if (cortas[clave]) return cortas[clave];
  const base = String(etiqueta || clave || "").trim();
  return base.length > 14 ? `${base.slice(0, 13)}…` : base;
}

function normalizarParametros(parametros) {
  const lista = [];
  const vistos = new Set();

  for (const item of parametros || []) {
    const origen = item?.origen;
    const tipoValor = String(item?.tipo_valor || "").trim();

    if (tipoValor !== "numero" && tipoValor !== "texto") {
      return { error: "Hay un parámetro con tipo inválido." };
    }

    let valorNumero = null;
    let valorTexto = null;

    if (tipoValor === "numero") {
      const numero = parsearNumeroParametro(item?.valor_numero);
      if (numero === null) {
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
      const idClave = `nativa:${clave}`;
      if (vistos.has(idClave)) {
        return { error: "Hay un parámetro duplicado." };
      }
      vistos.add(idClave);
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
      const idClave = `personalizada:${opcionId}`;
      if (vistos.has(idClave)) {
        return { error: "Hay un parámetro duplicado." };
      }
      vistos.add(idClave);
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

  const fotosOk = normalizarFotosNuevas(entrada?.fotos);
  if (fotosOk.error) return { error: fotosOk.error };

  const quitarOk = normalizarFotosQuitar(entrada?.fotos_quitar);
  if (quitarOk.error) return { error: quitarOk.error };

  const mezclaOk = validarPayloadMezcla(entrada?.mezcla, {
    acciones: accionesOk.acciones,
    aplicaA,
  });
  if (mezclaOk.error) return { error: mezclaOk.error };

  const fusion = fusionarMedicionesMezcla(parametrosOk.parametros, mezclaOk.mezcla);
  if (fusion.error) return { error: fusion.error };
  parametrosOk.parametros = fusion.parametros;

  // Fotos que el registro ya tenía y conserva (solo orientativo: la base valida el total real).
  const fotosRestantes = Math.max(0, Math.floor(Number(entrada?.fotos_restantes) || 0));

  if (
    accionesOk.acciones.length === 0 &&
    parametrosOk.parametros.length === 0 &&
    fotosOk.fotos.length === 0 &&
    fotosRestantes === 0 &&
    !observacion
  ) {
    return {
      error: "El registro necesita una acción, un parámetro, una observación o una foto.",
    };
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
      fotos: fotosOk.fotos,
      fotos_quitar: quitarOk.ids,
      mezcla: mezclaOk.mezcla,
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
    // Solo se envía cuando hay fotos: así los registros sin fotos siguen funcionando con la
    // firma anterior de la RPC y no dependen de haber aplicado supabase/registro-fotos.sql.
    ...(datos.fotos?.length ? { p_fotos: datos.fotos } : {}),
    // null se omite: un cliente anterior, o una edición que no toca la mezcla,
    // no borra el snapshot. { aplicar: false } sí la quita.
    ...(datos.mezcla ? { p_mezcla: datos.mezcla } : {}),
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

export function fechaEventoAlEditar({ fechaSeleccionada, fechaOriginalIso }) {
  if (!fechaOriginalIso) return fechaEventoDesdeDia(fechaSeleccionada);
  const instante = new Date(fechaOriginalIso);
  if (Number.isNaN(instante.getTime())) return fechaEventoDesdeDia(fechaSeleccionada);
  const original = partesFechaLocal(instante);
  if (original.fecha === String(fechaSeleccionada || "").trim()) {
    return instante.toISOString();
  }
  return fechaEventoDesdeDia(fechaSeleccionada);
}

function numeroPlantaSnapshot(valor) {
  if (typeof valor === "number" && Number.isInteger(valor) && valor > 0) return valor;
  if (typeof valor === "string" && /^\d+$/.test(valor)) {
    const numero = Number(valor);
    return numero > 0 ? numero : null;
  }
  return null;
}

export function plantasDesdeSnapshot(filas) {
  return (filas || [])
    .filter((fila) => uuidValido(fila?.planta_id))
    .map((fila) => ({
      id: fila.planta_id,
      nombre: String(fila.nombre_planta || "").trim(),
      numero: numeroPlantaSnapshot(fila.numero_planta),
      genetica: etiquetaGenetica(fila.genetica_planta) || null,
      unidad_cultivo_id: fila.unidad_cultivo_id || null,
      nombre_unidad: fila.nombre_unidad ? String(fila.nombre_unidad).trim() : null,
    }));
}

export function debeConservarPlantas({
  base,
  unidadId,
  aplicaA,
  idsSeleccionados,
  idsPlantasUnidad,
}) {
  if (!base) return false;
  if (String(unidadId || "") !== String(base.unidad_cultivo_id || "")) return false;
  if (aplicaA !== base.aplica_a) return false;
  if (aplicaA === "ambiente") return true;

  const visibles = new Set(idsPlantasUnidad || []);
  const esperados = plantasDesdeSnapshot(base.registro_plantas)
    .map((planta) => planta.id)
    .filter((id) => visibles.has(id));
  if (esperados.length !== idsSeleccionados.size) return false;
  return esperados.every((id) => idsSeleccionados.has(id));
}

export function aplicarConservacionEdicion(datos, { base, idsSeleccionados, idsPlantasUnidad }) {
  if (!datos?.id || !base || datos.id !== base.id) return datos;
  if (
    !debeConservarPlantas({
      base,
      unidadId: datos.unidad_cultivo_id,
      aplicaA: datos.aplica_a,
      idsSeleccionados,
      idsPlantasUnidad,
    })
  ) {
    return datos;
  }

  return {
    ...datos,
    alcance: base.alcance,
    genetica_clave: base.genetica_clave,
    genetica_etiqueta: base.genetica_etiqueta,
    espacio_id: base.espacio_id || datos.espacio_id,
    unidad_cultivo_id: base.unidad_cultivo_id,
    plantas: datos.aplica_a === "ambiente" ? [] : plantasDesdeSnapshot(base.registro_plantas),
  };
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

export const PARAMETROS_DESTACADOS_AMBIENTE = ["temperatura", "humedad", "vpd"];
export const PARAMETROS_DESTACADOS_PLANTAS = ["ph", "ec", "ppm"];

const CLAVES_NATIVAS_AMBIENTE = new Set(PARAMETROS_DESTACADOS_AMBIENTE);
const CLAVES_NATIVAS_PLANTAS = new Set(PARAMETROS_DESTACADOS_PLANTAS);

export function filtrarCatalogoParametrosPorGrupo(items, grupo) {
  return (items || []).filter((item) => {
    if (item.origen === "personalizada") return grupo === "plantas";
    if (item.origen === "nativa") {
      if (grupo === "ambiente") return CLAVES_NATIVAS_AMBIENTE.has(item.clave);
      return CLAVES_NATIVAS_PLANTAS.has(item.clave);
    }
    return false;
  });
}

export function catalogoParametrosGrupo(prioritarios, opciones, historicos, grupo) {
  const aplicaA = grupo === "ambiente" ? "ambiente" : "plantas";
  const orden = ordenarParametrosRegistro(prioritarios, opciones, historicos, { aplicaA });
  return {
    prioritarias: filtrarCatalogoParametrosPorGrupo(orden.prioritarias, grupo),
    secundarias: filtrarCatalogoParametrosPorGrupo(orden.secundarias, grupo),
  };
}

export function seccionParametrosGrupoVisible(catalogo) {
  return catalogo.prioritarias.length > 0 || catalogo.secundarias.length > 0;
}

function ordenVisualParametros(lista, clavesDestacadas) {
  const orden = new Map(clavesDestacadas.map((clave, indice) => [clave, indice]));
  return [...lista].sort((a, b) => {
    const ia = a.origen === "nativa" && orden.has(a.clave) ? orden.get(a.clave) : 1000;
    const ib = b.origen === "nativa" && orden.has(b.clave) ? orden.get(b.clave) : 1000;
    if (ia !== ib) return ia - ib;
    return 0;
  });
}

export function ordenarParametrosRegistro(
  prioritarios,
  opciones = [],
  extrasHistoricos = [],
  { aplicaA = "plantas" } = {}
) {
  const prioridad = new Set(prioritarios || []);
  const nativasPrioritarias = PARAMETROS_SEGUIMIENTO.filter((item) =>
    prioridad.has(item.valor)
  );
  const nativasSecundarias = PARAMETROS_SEGUIMIENTO.filter(
    (item) => !prioridad.has(item.valor)
  );
  const personalizadas = (opciones || []).filter(
    (item) => item.categoria === "parametro" && item.activa !== false
  );
  const personalizadasPrioritarias = personalizadas.filter((item) => item.prioritaria);
  const personalizadasSecundarias = personalizadas.filter((item) => !item.prioritaria);
  const idsActivos = new Set(personalizadas.map((item) => item.id));

  const historicos = (extrasHistoricos || [])
    .filter((item) => item?.origen === "personalizada" && item.opcion_id)
    .filter((item) => !idsActivos.has(item.opcion_id))
    .map((item) => ({
      origen: "personalizada",
      clave: item.opcion_id,
      opcion_id: item.opcion_id,
      etiqueta: item.nombre || "Parámetro",
      etiquetaCorta: etiquetaCortaParametro(null, item.nombre),
      tipo_valor: item.tipo_valor || "texto",
      unidad: item.unidad || null,
      historico: true,
    }));

  function mapNativa(item) {
    return {
      origen: "nativa",
      clave: item.valor,
      etiqueta: item.etiqueta,
      etiquetaCorta: etiquetaCortaParametro(item.valor, item.etiqueta),
      tipo_valor: item.tipoValor || "numero",
      unidad: item.unidad || null,
    };
  }

  function mapPersonalizada(item) {
    return {
      origen: "personalizada",
      clave: item.id,
      opcion_id: item.id,
      etiqueta: item.nombre,
      etiquetaCorta: etiquetaCortaParametro(null, item.nombre),
      tipo_valor: item.tipo_valor || "numero",
      unidad: item.unidad || null,
    };
  }

  const destacadas =
    aplicaA === "ambiente" ? PARAMETROS_DESTACADOS_AMBIENTE : PARAMETROS_DESTACADOS_PLANTAS;

  return {
    prioritarias: ordenVisualParametros(
      [
        ...nativasPrioritarias.map(mapNativa),
        ...personalizadasPrioritarias.map(mapPersonalizada),
        ...historicos,
      ],
      destacadas
    ),
    secundarias: [
      ...nativasSecundarias.map(mapNativa),
      ...personalizadasSecundarias.map(mapPersonalizada),
    ],
  };
}

export function valoresDesdeRegistroParametros(filas = []) {
  const valores = {};
  for (const fila of filas || []) {
    const clave = claveParametroRegistro({
      origen: fila.origen,
      clave_nativa: fila.clave_nativa,
      opcion_id: fila.opcion_id,
    });
    if (fila.tipo_valor === "numero") {
      valores[clave] =
        fila.valor_numero === null || fila.valor_numero === undefined
          ? ""
          : String(fila.valor_numero);
    } else {
      valores[clave] = fila.valor_texto || "";
    }
  }
  return valores;
}

export function parametrosDesdeValores(valores, catalogo) {
  const lista = [];
  for (const item of catalogo || []) {
    const clave = claveParametroRegistro(item);
    const crudo = valores?.[clave];
    if (crudo === undefined || crudo === null) continue;
    const texto = String(crudo).trim();
    if (!texto) continue;

    if (item.tipo_valor === "numero") {
      const numero = parsearNumeroParametro(texto);
      if (numero === null) {
        return { error: `Revisá el valor de ${item.etiqueta}.` };
      }
      lista.push({
        origen: item.origen,
        clave_nativa: item.origen === "nativa" ? item.clave : null,
        opcion_id: item.origen === "personalizada" ? item.opcion_id : null,
        nombre: item.etiqueta,
        tipo_valor: "numero",
        valor_numero: numero,
        valor_texto: null,
        unidad: item.unidad || null,
      });
      continue;
    }

    lista.push({
      origen: item.origen,
      clave_nativa: null,
      opcion_id: item.opcion_id,
      nombre: item.etiqueta,
      tipo_valor: "texto",
      valor_numero: null,
      valor_texto: texto,
      unidad: item.unidad || null,
    });
  }
  return { parametros: lista };
}

function accionHistoricaVisible(fila) {
  // Foto y Nota ya no se ofrecen como acciones; el editor las conserva aparte.
  if (
    fila?.origen === "nativa" &&
    (esAccionNativaHistorica(fila.clave_nativa) || esAccionNativaHistorica(fila.clave))
  ) {
    return null;
  }
  if (fila?.origen === "nativa" && fila.clave_nativa) {
    return {
      origen: "nativa",
      clave: fila.clave_nativa,
      etiqueta: fila.nombre || fila.clave_nativa,
    };
  }
  if (fila?.origen === "personalizada" && fila.opcion_id) {
    return {
      origen: "personalizada",
      clave: fila.opcion_id,
      etiqueta: fila.nombre || "Acción",
      opcion_id: fila.opcion_id,
    };
  }
  if (fila?.origen === "nativa" && fila.clave) {
    return { origen: "nativa", clave: fila.clave, etiqueta: fila.etiqueta || fila.clave };
  }
  if (fila?.origen === "personalizada" && (fila.opcion_id || fila.clave)) {
    const clave = fila.opcion_id || fila.clave;
    return {
      origen: "personalizada",
      clave,
      etiqueta: fila.etiqueta || fila.nombre || "Acción",
      opcion_id: clave,
    };
  }
  return null;
}

export function ordenarAccionesRegistro(prioritarias, opciones = [], extrasHistoricos = []) {
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

  const listaPrioritaria = [
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
  ];
  const secundarias = [
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
  ];

  const claves = new Set(
    [...listaPrioritaria, ...secundarias].map((item) =>
      item.origen === "nativa" ? `nativa:${item.clave}` : `personalizada:${item.clave}`
    )
  );
  for (const fila of extrasHistoricos || []) {
    const item = accionHistoricaVisible(fila);
    if (!item?.clave) continue;
    const id = item.origen === "nativa" ? `nativa:${item.clave}` : `personalizada:${item.clave}`;
    if (claves.has(id)) continue;
    claves.add(id);
    listaPrioritaria.push(item);
  }

  return { prioritarias: listaPrioritaria, secundarias };
}
