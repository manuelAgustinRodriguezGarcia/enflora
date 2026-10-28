import path from "node:path";
import { PARAMETROS_HISTORIAL } from "@/lib/demo/historial/normalizar-historial";
import { rutaFotoRegistro } from "@/lib/fotos";
import { prepararDatosRegistro, snapshotPlanta } from "@/lib/registros";
import { PARAMETROS_SEGUIMIENTO } from "@/lib/seguimiento";
import {
  FECHA_CORTE,
  HORA_TECNICA,
  TIPO_DEMO_A_OPCION,
  ZONA_HORARIA,
} from "@/lib/import/rdwc1-constantes";

const UNIDAD_EC = "µS/cm";

function parametroCatalogo(clave) {
  return PARAMETROS_SEGUIMIENTO.find((item) => item.valor === clave) || null;
}

function unidadParametro(clave) {
  const historial = PARAMETROS_HISTORIAL.find((item) => item.clave === clave);
  if (historial?.unidad) return historial.unidad;
  const nativo = parametroCatalogo(clave);
  return nativo?.unidad || null;
}

/** ISO timestamptz con hora técnica 12:00 ART (no es hora medida en campo). */
export function fechaEventoTecnica(fechaCalendario, desplazamientoSegundos = 0) {
  const base = new Date(
    `${fechaCalendario}T${String(HORA_TECNICA.hora).padStart(2, "0")}:${String(HORA_TECNICA.minuto).padStart(2, "0")}:00-03:00`
  );
  base.setSeconds(base.getSeconds() + desplazamientoSegundos);
  return base.toISOString();
}

export function parametrosDesdeMediciones(mediciones = []) {
  const lista = [];
  for (const fila of mediciones) {
    const clave = String(fila?.parametro || "").trim();
    const valor = Number(fila?.valor);
    if (!clave || !Number.isFinite(valor)) continue;
    if (!parametroCatalogo(clave)) continue;
    const catalogo = parametroCatalogo(clave);
    lista.push({
      origen: "nativa",
      clave_nativa: clave,
      opcion_id: null,
      nombre: catalogo.etiqueta,
      tipo_valor: "numero",
      valor_numero: valor,
      valor_texto: null,
      unidad: clave === "ec" ? UNIDAD_EC : unidadParametro(clave) || null,
    });
  }
  return lista;
}

export function accionesDesdeDemo(acciones = [], mapaOpciones) {
  const resultado = [];
  const notasAccion = [];
  for (const accion of acciones) {
    const tipo = String(accion?.tipo || "").trim();
    const nombreOpcion = TIPO_DEMO_A_OPCION[tipo] || accion?.etiqueta || "Otra acción";
    const opcionId = mapaOpciones[nombreOpcion];
    if (!opcionId) {
      return { error: `Falta la opción personalizada «${nombreOpcion}».`, acciones: [], notasAccion: [] };
    }
    const etiqueta = String(accion?.etiqueta || nombreOpcion).trim() || nombreOpcion;
    resultado.push({
      origen: "personalizada",
      clave_nativa: null,
      opcion_id: opcionId,
      nombre: etiqueta,
    });
    if (accion?.nota) notasAccion.push(String(accion.nota).trim());
  }
  return { error: "", acciones: resultado, notasAccion };
}

function combinarObservacion(notaDia, notasAccion) {
  const partes = [];
  if (notaDia) partes.push(String(notaDia).trim());
  for (const nota of notasAccion || []) {
    if (nota && !partes.includes(nota)) partes.push(nota);
  }
  return partes.length ? partes.join("\n\n") : null;
}

function uuidDemoEstable(demoId) {
  const base = String(demoId || "")
    .replace(/^foto-/, "")
    .padEnd(12, "0")
    .slice(0, 12);
  return `00000000-0000-4000-8000-${base}`;
}

export function planificarRegistrosDelDia(dia, contexto) {
  const { espacioId, unidad, plantas, mapaOpciones, fotosPorId, fotosSubidasPorDemoId } = contexto;
  const payloads = [];
  const fecha = dia.fecha;

  if (fecha > FECHA_CORTE) {
    return { error: `La fecha ${fecha} supera el corte ${FECHA_CORTE}.`, payloads: [] };
  }

  const parametros = parametrosDesdeMediciones(dia.mediciones);
  if (parametros.length) {
    const datos = {
      alcance: "unidad",
      aplica_a: "ambiente",
      espacio_id: espacioId,
      unidad_cultivo_id: unidad.id,
      genetica_clave: null,
      genetica_etiqueta: null,
      observacion: null,
      fecha_evento: fechaEventoTecnica(fecha, 0),
      plantas: [],
      acciones: [],
      parametros,
    };
    const preparado = prepararDatosRegistro(datos);
    if (preparado.error) return { error: preparado.error, payloads: [] };
    payloads.push({ clave: `${fecha}:ambiente`, tipo: "ambiente", datos: preparado.datos });
  }

  const accionesOk = accionesDesdeDemo(dia.acciones, mapaOpciones);
  if (accionesOk.error) return { error: accionesOk.error, payloads: [] };

  const fotos = [];
  for (const demoId of dia.fotos || []) {
    const meta = fotosPorId.get(demoId);
    const subida = fotosSubidasPorDemoId?.[demoId];
    if (!meta) return { error: `Foto demo desconocida: ${demoId}.`, payloads: [] };
    if (subida) {
      fotos.push(subida);
      continue;
    }
    if (contexto.simularFotos && contexto.usuarioSimulado) {
      const fotoId = uuidDemoEstable(demoId);
      fotos.push({
        id: fotoId,
        ruta: rutaFotoRegistro(contexto.usuarioSimulado, fotoId, "webp"),
        ruta_miniatura: rutaFotoRegistro(contexto.usuarioSimulado, fotoId, "webp", true),
        tipo_mime: "image/webp",
        tamano_bytes: 1024,
        ancho: meta.ancho,
        alto: meta.alto,
        descripcion: meta.descripcion || null,
      });
      continue;
    }
    return { error: `Falta subir la foto ${demoId} antes de crear el registro.`, payloads: [] };
  }

  const observacion = combinarObservacion(dia.nota, accionesOk.notasAccion);
  const hayPlantas =
    accionesOk.acciones.length > 0 || Boolean(observacion) || fotos.length > 0;

  if (hayPlantas) {
    const plantasRegistro = plantas.map((planta) => snapshotPlanta(planta, unidad));
    const datos = {
      alcance: "unidad",
      aplica_a: "plantas",
      espacio_id: espacioId,
      unidad_cultivo_id: unidad.id,
      genetica_clave: null,
      genetica_etiqueta: null,
      observacion,
      fecha_evento: fechaEventoTecnica(fecha, 1),
      plantas: plantasRegistro,
      acciones: accionesOk.acciones,
      parametros: [],
      fotos,
    };
    const preparado = prepararDatosRegistro(datos);
    if (preparado.error) return { error: preparado.error, payloads: [] };
    payloads.push({ clave: `${fecha}:plantas`, tipo: "plantas", datos: preparado.datos });
  }

  if (!payloads.length) {
    return { error: `El día ${fecha} no produce registros válidos.`, payloads: [] };
  }

  return { error: "", payloads };
}

export function planificarImportacion(historial, contextoBase) {
  const payloads = [];
  for (const dia of historial.dias) {
    const plan = planificarRegistrosDelDia(dia, contextoBase);
    if (plan.error) return { error: plan.error, payloads: [], resumen: null };
    payloads.push(...plan.payloads);
  }
  return {
    error: "",
    payloads,
    resumen: {
      dias: historial.dias.length,
      registros: payloads.length,
      ambiente: payloads.filter((item) => item.tipo === "ambiente").length,
      plantas: payloads.filter((item) => item.tipo === "plantas").length,
    },
  };
}

export function indiceFotosDemo(historial) {
  const mapa = new Map();
  for (const foto of historial.fotos || []) {
    mapa.set(foto.id, foto);
  }
  return mapa;
}

export function rutasArchivoDemoDesdeUrl(urlPublica, raiz = process.cwd()) {
  const relativo = String(urlPublica || "").replace(/^\//, "");
  return path.join(raiz, "public", ...relativo.split("/"));
}

export function nombresPlantasImport(historial) {
  return (historial.plantas || []).map((planta, indice) => {
    const nombre = String(planta?.nombre || "").trim();
    return nombre || `Planta ${indice + 1}`;
  });
}

/** Documentación: en el dataset los nombres son «Planta 1» y «Planta 2» (técnicos de importación). */
export const NOTA_NOMBRES_PLANTAS =
  "Los nombres «Planta 1» y «Planta 2» provienen del dataset público rdwc1; son etiquetas técnicas de importación, no alias personalizados del cultivador.";
