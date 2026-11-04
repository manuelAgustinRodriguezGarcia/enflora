import { TEXTO_ALERTA_OFICIAL, TEXTO_AVISO_ENFLORA, mensajeClima } from "@/lib/clima/constantes";
import { etiquetaLocalidad, lineaResumen } from "@/lib/clima/texto";

export function resumenLugar({ espacio, ubicacion, resultado, ahora = new Date() }) {
  const base = {
    espacioId: espacio.id,
    espacioNombre: espacio.nombre,
    href: espacio.href || `/cultivos/${espacio.id}/clima`,
    localidad: "",
    lugarNombre: "",
    region: "",
    pais: "",
    linea: "",
    avisoEnflora: "",
    avisoOficial: "",
    estado: "sin_localidad",
    muestraDatos: false,
  };
  if (!ubicacion) return base;

  const lugarNombre = String(ubicacion.nombre || "").trim();
  const region = String(ubicacion.region || "").trim();
  const pais = String(ubicacion.pais || "").trim();
  const localidad = etiquetaLocalidad({ nombre: lugarNombre, region, pais });
  if (!resultado?.ok) {
    return {
      ...base,
      localidad,
      lugarNombre,
      region,
      pais,
      estado: "error",
      linea: mensajeClima(resultado?.codigo || "sin_datos"),
    };
  }

  const avisos = resultado.clima?.avisosEnflora || [];
  const oficiales = resultado.clima?.alertasOficiales || [];
  return {
    ...base,
    localidad,
    lugarNombre,
    region,
    pais,
    estado: "listo",
    linea: lineaResumen(resultado.clima),
    vista: vistaClima(resultado.clima, ahora),
    avisoEnflora: avisos.length ? `Aviso de ENFLORA: ${avisos.map((aviso) => aviso.titulo).join(", ")}` : "",
    avisoOficial: oficiales.length ? `Alerta oficial: ${oficiales[0].titulo}` : "",
    muestraDatos: true,
    notaEnflora: avisos.length ? TEXTO_AVISO_ENFLORA : "",
    notaOficial: oficiales.length ? TEXTO_ALERTA_OFICIAL : "",
  };
}

function fechaEnZona(zona, ahora) {
  const pedida = typeof zona === "string" && zona ? zona : "America/Argentina/Buenos_Aires";
  const opciones = { year: "numeric", month: "2-digit", day: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-CA", { ...opciones, timeZone: pedida }).format(ahora);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...opciones, timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);
  }
}

export function diasParaInicio(dias, zona, ahora = new Date()) {
  const lista = Array.isArray(dias) ? dias : [];
  const fechados = lista.filter((dia) => typeof dia?.fecha === "string" && dia.fecha);
  if (!fechados.length) return lista.slice(0, 3);
  const hoy = fechaEnZona(zona, ahora);
  const siguientes = fechados.filter((dia) => dia.fecha > hoy);
  const visibles = siguientes.length ? siguientes : fechados.filter((dia) => dia.fecha !== hoy);
  return visibles.slice(0, 3);
}

function vistaClima(clima, ahora) {
  const actual = clima?.actual;
  const dias = diasParaInicio(clima?.dias, clima?.localidad?.zonaHoraria, ahora);
  return {
    actual: actual
      ? {
          temperaturaC: actual.temperaturaC ?? null,
          sensacionC: actual.sensacionC ?? null,
          humedad: actual.humedad ?? null,
          vientoKph: actual.vientoKph ?? null,
          precipitacionMm: actual.precipitacionMm ?? null,
          condicion: actual.condicion || "",
          codigo: Number.isInteger(actual.codigo) ? actual.codigo : null,
          esDia: typeof actual.esDia === "boolean" ? actual.esDia : null,
        }
      : null,
    dias: dias.map((dia) => ({
      fecha: dia.fecha || "",
      maximaC: dia.maximaC ?? null,
      minimaC: dia.minimaC ?? null,
      probabilidadLluvia: dia.probabilidadLluvia ?? null,
      codigo: Number.isInteger(dia.codigo) ? dia.codigo : null,
    })),
  };
}

export function armarResumenInicio({ lugares = [], estado = "listo" } = {}) {
  return {
    visible: estado === "no_disponible" || lugares.length > 0,
    estado,
    lugares,
    muestraDatos: lugares.some((lugar) => lugar.muestraDatos),
  };
}
