import {
  esAlcanceRegistro,
  esAplicacionRegistro,
  parsearNumeroParametro,
  partesFechaLocal,
  rangoDiaLocal,
  resolverAlcanceRegistro,
  snapshotPlanta,
} from "@/lib/registros";
import { ACCIONES_SEGUIMIENTO, PARAMETROS_SEGUIMIENTO, presetDe } from "@/lib/seguimiento";

export const LIMITE_REGISTROS_DEMO = 50;
export const LIMITE_OBSERVACION_DEMO = 4000;
export const TIPO_SEGUIMIENTO_DEMO = "profesional";
export const ACCIONES_OCULTAS_DEMO = ["foto"];
export const AVISO_FOTOS_DEMO = "Las fotos están disponibles en la aplicación completa.";

export function seguimientoDemo() {
  const preset = presetDe(TIPO_SEGUIMIENTO_DEMO);
  return {
    tipo: TIPO_SEGUIMIENTO_DEMO,
    acciones: preset.acciones,
    parametros: preset.parametros,
    opciones: [],
  };
}

function esObjeto(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

export function unidadesParaRegistro(estado) {
  const ordenEspacios = new Map(estado.espacios.map((espacio, indice) => [espacio.id, indice]));
  const nombres = new Map(estado.espacios.map((espacio) => [espacio.id, espacio.nombre]));
  return estado.unidades
    .filter((unidad) => nombres.has(unidad.espacio_id))
    .slice()
    .sort(
      (a, b) =>
        ordenEspacios.get(a.espacio_id) - ordenEspacios.get(b.espacio_id) || a.numero - b.numero
    )
    .map((unidad) => ({
      id: unidad.id,
      nombre: unidad.nombre,
      tipo: unidad.tipo,
      tipo_personalizado: unidad.tipo_personalizado,
      numero: unidad.numero,
      espacio_id: unidad.espacio_id,
      espacio_nombre: nombres.get(unidad.espacio_id),
      plantas: estado.plantas
        .filter((planta) => planta.unidad_cultivo_id === unidad.id)
        .sort((a, b) => a.numero - b.numero)
        .map((planta) => ({
          id: planta.id,
          nombre: planta.nombre,
          genetica: planta.genetica,
          numero: planta.numero,
          unidad_cultivo_id: planta.unidad_cultivo_id,
          estado: planta.estado,
        })),
    }));
}

export function leerRegistroFormulario(formulario) {
  if (!formulario || typeof formulario.get !== "function") return null;
  try {
    const valor = JSON.parse(String(formulario.get("registro") || ""));
    return esObjeto(valor) ? valor : null;
  } catch {
    return null;
  }
}

function normalizarAccionesDemo(acciones) {
  const lista = [];
  const vistas = new Set();
  for (const item of Array.isArray(acciones) ? acciones : []) {
    const clave = String(item?.clave_nativa || "").trim();
    if (ACCIONES_OCULTAS_DEMO.includes(clave)) return { error: AVISO_FOTOS_DEMO };
    const catalogo = ACCIONES_SEGUIMIENTO.find((accion) => accion.valor === clave);
    if (item?.origen !== "nativa" || !catalogo || vistas.has(clave)) {
      return { error: "Hay una acción que no es válida." };
    }
    vistas.add(clave);
    lista.push({ origen: "nativa", clave_nativa: clave, opcion_id: null, nombre: catalogo.etiqueta });
  }
  return { acciones: lista };
}

function normalizarParametrosDemo(parametros) {
  const lista = [];
  const vistos = new Set();
  for (const item of Array.isArray(parametros) ? parametros : []) {
    const clave = String(item?.clave_nativa || "").trim();
    const catalogo = PARAMETROS_SEGUIMIENTO.find((parametro) => parametro.valor === clave);
    if (item?.origen !== "nativa" || !catalogo) return { error: "Hay un parámetro que no es válido." };
    if (vistos.has(clave)) return { error: "Hay un parámetro duplicado." };
    if (item.tipo_valor !== "numero") return { error: "Hay un parámetro con tipo inválido." };
    const numero = parsearNumeroParametro(item.valor_numero);
    if (numero === null) return { error: "Hay un parámetro numérico inválido." };
    vistos.add(clave);
    lista.push({
      origen: "nativa",
      clave_nativa: clave,
      opcion_id: null,
      nombre: catalogo.etiqueta,
      tipo_valor: "numero",
      valor_numero: numero,
      valor_texto: null,
      unidad: catalogo.unidad || null,
    });
  }
  return { parametros: lista };
}

export function prepararRegistroDemo(entrada, estado) {
  if (!esObjeto(entrada)) return { error: "No se pudo leer el registro." };

  const alcance = String(entrada.alcance || "").trim();
  const aplicaA = String(entrada.aplica_a || "").trim();
  if (!esAlcanceRegistro(alcance) || alcance === "espacio") {
    return { error: "El alcance del registro no es válido." };
  }
  if (!esAplicacionRegistro(aplicaA)) return { error: "El tipo de aplicación no es válido." };

  const fecha = new Date(entrada.fecha_evento);
  if (!entrada.fecha_evento || Number.isNaN(fecha.getTime())) {
    return { error: "La fecha del evento no es válida." };
  }

  const observacion = String(entrada.observacion || "").trim();
  if (observacion.length > LIMITE_OBSERVACION_DEMO) return { error: "La observación es demasiado larga." };

  const unidad = estado.unidades.find((item) => item.id === entrada.unidad_cultivo_id);
  if (!unidad) return { error: "No se encontró la unidad." };
  const espacio = estado.espacios.find((item) => item.id === unidad.espacio_id);
  if (!espacio || (entrada.espacio_id && entrada.espacio_id !== espacio.id)) {
    return { error: "No se encontró el espacio." };
  }

  const plantasUnidad = estado.plantas.filter((planta) => planta.unidad_cultivo_id === unidad.id);
  const idsEntrada = (Array.isArray(entrada.plantas) ? entrada.plantas : []).map((planta) =>
    String(planta?.id || "")
  );
  if (new Set(idsEntrada).size !== idsEntrada.length) {
    return { error: "Las plantas del registro no son válidas." };
  }
  const seleccionadas = idsEntrada.map((id) => plantasUnidad.find((planta) => planta.id === id));
  if (seleccionadas.some((planta) => !planta)) {
    return { error: "Las plantas del registro no son válidas." };
  }
  if (aplicaA === "plantas" && seleccionadas.length < 1) return { error: "Seleccioná al menos una planta." };
  if (aplicaA === "ambiente" && seleccionadas.length > 0) {
    return { error: "Una medición ambiental no asocia plantas." };
  }

  const resuelto = resolverAlcanceRegistro({
    aplicaA,
    plantasSeleccionadas: seleccionadas,
    plantasUnidad,
  });
  if (!resuelto || resuelto.alcance !== alcance) return { error: "El alcance del registro no es válido." };

  const accionesOk = normalizarAccionesDemo(entrada.acciones);
  if (accionesOk.error) return { error: accionesOk.error };
  if (aplicaA === "ambiente" && accionesOk.acciones.length) {
    return { error: "Hay una acción que no es válida." };
  }
  const parametrosOk = normalizarParametrosDemo(entrada.parametros);
  if (parametrosOk.error) return { error: parametrosOk.error };

  if (!accionesOk.acciones.length && !parametrosOk.parametros.length && !observacion) {
    return { error: "El registro necesita una acción, un parámetro o una observación." };
  }

  const id = entrada.id ? String(entrada.id) : "";
  if (id && !estado.registros.some((registro) => registro.id === id)) {
    return { error: "No se encontró el registro." };
  }

  return {
    datos: {
      id,
      alcance,
      aplica_a: aplicaA,
      espacio_id: espacio.id,
      unidad_cultivo_id: unidad.id,
      genetica_clave: resuelto.genetica_clave,
      genetica_etiqueta: resuelto.genetica_etiqueta,
      observacion: observacion || null,
      fecha_evento: fecha.toISOString(),
      plantas: seleccionadas.map((planta) => snapshotPlanta(planta, unidad)),
      acciones: accionesOk.acciones,
      parametros: parametrosOk.parametros,
    },
  };
}

export function construirRegistroDemo(datos, { id, ahora, anterior = null }) {
  return {
    id,
    alcance: datos.alcance,
    aplica_a: datos.aplica_a,
    espacio_id: datos.espacio_id,
    unidad_cultivo_id: datos.unidad_cultivo_id,
    genetica_clave: datos.genetica_clave,
    genetica_etiqueta: datos.genetica_etiqueta,
    observacion: datos.observacion,
    fecha_evento: datos.fecha_evento,
    fecha_creacion: anterior?.fecha_creacion || ahora,
    fecha_actualizacion: anterior ? ahora : null,
    registro_plantas: datos.plantas.map((planta) => ({
      planta_id: planta.id,
      nombre_planta: planta.nombre,
      numero_planta: planta.numero,
      genetica_planta: planta.genetica,
      unidad_cultivo_id: planta.unidad_cultivo_id,
      nombre_unidad: planta.nombre_unidad,
    })),
    registro_acciones: datos.acciones.map((accion) => ({ ...accion })),
    registro_parametros: datos.parametros.map((parametro) => ({ ...parametro })),
  };
}

export function registroDemoValido(registro, estado) {
  if (!esObjeto(registro) || !/^demo-registro-[a-z0-9-]+$/.test(String(registro.id || ""))) return false;
  if (Number.isNaN(new Date(registro.fecha_evento).getTime())) return false;
  if (Number.isNaN(new Date(registro.fecha_creacion).getTime())) return false;
  const entrada = {
    id: "",
    alcance: registro.alcance,
    aplica_a: registro.aplica_a,
    espacio_id: registro.espacio_id,
    unidad_cultivo_id: registro.unidad_cultivo_id,
    observacion: registro.observacion,
    fecha_evento: registro.fecha_evento,
    plantas: (Array.isArray(registro.registro_plantas) ? registro.registro_plantas : []).map((fila) => ({
      id: fila?.planta_id,
    })),
    acciones: registro.registro_acciones,
    parametros: registro.registro_parametros,
  };
  return !prepararRegistroDemo(entrada, estado).error;
}

export function idRegistroDemo(marca, secuencia) {
  return `demo-registro-${Math.max(0, Math.trunc(marca)).toString(36)}-${secuencia}`;
}

function tiempo(registro) {
  return new Date(registro.fecha_evento).getTime();
}

export function ordenarPorEvento(registros) {
  return [...registros].sort(
    (a, b) => tiempo(b) - tiempo(a) || String(b.fecha_creacion).localeCompare(String(a.fecha_creacion))
  );
}

export function registrosDelDia(registros, fecha = new Date()) {
  const { desde, hasta } = rangoDiaLocal(fecha);
  const inicio = new Date(desde).getTime();
  const fin = new Date(hasta).getTime();
  return ordenarPorEvento(registros.filter((registro) => tiempo(registro) >= inicio && tiempo(registro) <= fin));
}

export function registrosDeUnidad(registros, unidadId) {
  return ordenarPorEvento(registros.filter((registro) => registro.unidad_cultivo_id === unidadId));
}

export function registrosDePlanta(registros, plantaId) {
  return ordenarPorEvento(
    registros.filter((registro) =>
      (registro.registro_plantas || []).some((fila) => fila.planta_id === plantaId)
    )
  );
}

export function textoAlcanceRegistro(registro) {
  if (registro.aplica_a === "ambiente") return "Ambiente";
  const cantidad = (registro.registro_plantas || []).length;
  if (registro.alcance === "unidad") return "Toda la unidad";
  if (registro.alcance === "genetica") return registro.genetica_etiqueta || "Genética";
  if (registro.alcance === "planta") return registro.registro_plantas?.[0]?.nombre_planta || "1 planta";
  return cantidad === 1 ? "1 planta" : `${cantidad} plantas`;
}

export function textoParametro(fila) {
  if (fila.tipo_valor === "numero") {
    return `${fila.nombre} ${fila.valor_numero}${fila.unidad ? ` ${fila.unidad}` : ""}`;
  }
  return `${fila.nombre}: ${fila.valor_texto}`;
}

export function resumenRegistroDemo(registro) {
  const partes = [
    ...(registro.registro_acciones || []).map((fila) => fila.nombre),
    ...(registro.registro_parametros || []).map(textoParametro),
  ];
  if (!partes.length) return registro.observacion ? "Observación" : "Registro";
  return partes.join(" · ");
}

export function fechaHoraRegistro(fechaIso) {
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "";
  const { fecha: dia, hora } = partesFechaLocal(fecha);
  const [anio, mes, numero] = dia.split("-");
  const texto = `${numero}/${mes}/${anio}`;
  return hora === "00:00" ? texto : `${texto} · ${hora}`;
}
