import { estadoPorEtapa, fechaValida } from "@/lib/etapas";
import { admiteVarias, etiquetaTipoUnidad, nombreUnidad, tipoUnidadPermitido } from "@/lib/unidades";

export const LIMITES_DEMO = {
  nombre: 40,
  tipoPersonalizado: 24,
  unidades: { minimo: 1, maximo: 3 },
  plantas: { minimo: 1, maximo: 9 },
  plantasTotales: 27,
  espacios: 3,
};

export const GENETICAS_DEMO = ["OG Kush", "White Widow", "Critical", "Gelato"];
export const METODO_DEMO = "TIERRA";
export const ETAPA_INICIAL_DEMO = "germinacion";

const TIPO_UNIDAD_DEMO = { interior: "carpa", exterior: "invernadero" };

export function geneticaDemo(numeroUnidad, numeroPlanta) {
  const indice = Math.floor((numeroPlanta - 1) / 2) + (numeroUnidad - 1) * 2;
  return GENETICAS_DEMO[indice % GENETICAS_DEMO.length];
}

export function tipoUnidadDemo(tipoEspacio) {
  return TIPO_UNIDAD_DEMO[tipoEspacio] || "";
}

function pluralSimple(palabra) {
  const base = String(palabra || "").trim();
  if (!base) return "";
  const ultima = base.slice(-1).toLowerCase();
  if (ultima === "s") return base;
  if ("aeiou".includes(ultima)) return `${base}s`;
  return `${base}es`;
}

export function textoUnidadesDemo(tipoEspacio, cantidad, tipoUnidad = "", tipoPersonalizado = "") {
  const tipo = tipoUnidad || tipoUnidadDemo(tipoEspacio);
  if (tipo === "carpa") return cantidad === 1 ? "1 carpa" : `${cantidad} carpas`;
  if (tipo === "invernadero") return cantidad === 1 ? "1 invernadero" : `${cantidad} invernaderos`;
  if (tipo === "sala") return "1 sala de cultivo";
  if (tipo === "aire_libre") return "Aire libre";
  if (tipo === "otro") {
    const base = limpiarNombreEspacio(tipoPersonalizado).toLowerCase();
    if (base) return cantidad === 1 ? `1 ${base}` : `${cantidad} ${pluralSimple(base)}`;
  }
  return cantidad === 1 ? "1 unidad" : `${cantidad} unidades`;
}

export function limpiarNombreEspacio(valor) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function enteroEnRango(valor, { minimo, maximo }) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

export function validarConfiguracion(entrada = {}) {
  const errores = {};
  const nombre = limpiarNombreEspacio(entrada.nombre);
  if (!nombre) errores.nombre = "Escribí el nombre del espacio.";
  else if (nombre.length > LIMITES_DEMO.nombre) {
    errores.nombre = `El nombre puede tener hasta ${LIMITES_DEMO.nombre} caracteres.`;
  } else if (/[<>]/.test(nombre)) errores.nombre = "El nombre no puede incluir los signos < o >.";

  const tipoUnidad = String(entrada.tipoUnidad || "").trim() || tipoUnidadDemo(entrada.tipo);
  const tipoPersonalizado = tipoUnidad === "otro" ? limpiarNombreEspacio(entrada.tipoPersonalizado) : "";
  if (!tipoUnidadDemo(entrada.tipo)) errores.tipo = "Elegí si el espacio es interior o exterior.";
  else if (!tipoUnidadPermitido(entrada.tipo, tipoUnidad)) errores.tipoUnidad = "Elegí el tipo de unidad.";
  else if (tipoUnidad === "otro") {
    if (!tipoPersonalizado) errores.tipoUnidad = "Escribí qué tipo de unidad es.";
    else if (tipoPersonalizado.length > LIMITES_DEMO.tipoPersonalizado) {
      errores.tipoUnidad = `El tipo puede tener hasta ${LIMITES_DEMO.tipoPersonalizado} caracteres.`;
    } else if (/[<>]/.test(tipoPersonalizado)) {
      errores.tipoUnidad = "El tipo no puede incluir los signos < o >.";
    }
  }

  const unidades = Number(entrada.cantidadUnidades);
  const plantas = Number(entrada.plantasPorUnidad);
  if (!enteroEnRango(unidades, LIMITES_DEMO.unidades)) {
    errores.cantidadUnidades = `Elegí entre ${LIMITES_DEMO.unidades.minimo} y ${LIMITES_DEMO.unidades.maximo} unidades.`;
  } else if (unidades > 1 && !errores.tipo && !errores.tipoUnidad && !admiteVarias(tipoUnidad)) {
    errores.cantidadUnidades = `${etiquetaTipoUnidad(tipoUnidad)} admite una sola unidad por espacio.`;
  }
  if (!enteroEnRango(plantas, LIMITES_DEMO.plantas)) {
    errores.plantasPorUnidad = `Elegí entre ${LIMITES_DEMO.plantas.minimo} y ${LIMITES_DEMO.plantas.maximo} plantas.`;
  } else if (!errores.cantidadUnidades && unidades * plantas > LIMITES_DEMO.plantasTotales) {
    errores.plantasPorUnidad = `La demo admite hasta ${LIMITES_DEMO.plantasTotales} plantas.`;
  }

  if (Object.keys(errores).length) return { errores };
  return {
    datos: {
      nombre,
      tipo: entrada.tipo,
      tipoUnidad,
      tipoPersonalizado,
      cantidadUnidades: unidades,
      plantasPorUnidad: plantas,
    },
  };
}

export function generarCultivo(entrada, { secuencia, fecha } = {}) {
  const { errores, datos } = validarConfiguracion(entrada);
  if (errores) return { errores };
  if (!Number.isInteger(secuencia) || secuencia < 1 || !fechaValida(fecha)) {
    return { errores: { general: "No se pudo preparar el espacio." } };
  }

  const { tipoUnidad, tipoPersonalizado } = datos;
  if (!tipoUnidadPermitido(datos.tipo, tipoUnidad) || (datos.cantidadUnidades > 1 && !admiteVarias(tipoUnidad))) {
    return { errores: { general: "No se pudo preparar el espacio." } };
  }

  const espacio = {
    id: `demo-espacio-${secuencia}`,
    nombre: datos.nombre,
    tipo: datos.tipo,
    fecha_creacion: fecha,
  };
  const unidades = [];
  const plantas = [];

  for (let numeroUnidad = 1; numeroUnidad <= datos.cantidadUnidades; numeroUnidad += 1) {
    const unidad = {
      id: `${espacio.id}-unidad-${numeroUnidad}`,
      espacio_id: espacio.id,
      nombre: nombreUnidad(tipoUnidad, numeroUnidad, tipoPersonalizado, datos.cantidadUnidades),
      tipo: tipoUnidad,
      tipo_personalizado: tipoPersonalizado || null,
      numero: numeroUnidad,
    };
    unidades.push(unidad);

    for (let numeroPlanta = 1; numeroPlanta <= datos.plantasPorUnidad; numeroPlanta += 1) {
      plantas.push({
        id: `${unidad.id}-planta-${numeroPlanta}`,
        unidad_cultivo_id: unidad.id,
        numero: numeroPlanta,
        nombre: `Planta ${numeroPlanta}`,
        genetica: geneticaDemo(numeroUnidad, numeroPlanta),
        metodo: METODO_DEMO,
        sustrato: null,
        etapa: ETAPA_INICIAL_DEMO,
        estado: estadoPorEtapa(ETAPA_INICIAL_DEMO),
        fecha_inicio: fecha,
        fecha_creacion: fecha,
        historial: [{ etapa: ETAPA_INICIAL_DEMO, fecha_inicio: fecha, fecha_fin: null }],
      });
    }
  }

  return { cultivo: { espacio, unidades, plantas } };
}
