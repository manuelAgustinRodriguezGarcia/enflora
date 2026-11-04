import { textoFecha, textoMilimetros, textoTemperatura, textoViento } from "@/lib/clima/texto";

function unir(partes) {
  if (partes.length <= 1) return partes[0] || "";
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function titulo(tipo) {
  switch (tipo) {
    case "temperatura_baja":
      return "Temperatura baja";
    case "calor":
      return "Calor intenso";
    case "lluvia":
      return "Lluvia fuerte";
    case "viento":
      return "Viento intenso";
    default: {
      /** @type {never} */
      const agotado = tipo;
      throw new Error(`Aviso no contemplado: ${agotado}`);
    }
  }
}

function detalle(tipo, ocurrencias) {
  const frases = ocurrencias.map((item) => {
    const dia = textoFecha(item.fecha) || item.fecha;
    switch (tipo) {
      case "temperatura_baja":
        return `${textoTemperatura(item.valor)} el ${dia}`;
      case "calor":
        return `${textoTemperatura(item.valor)} el ${dia}`;
      case "lluvia":
        return `${textoMilimetros(item.valor)} el ${dia}`;
      case "viento":
        return `${textoViento(item.valor)} el ${dia}`;
      default: {
        /** @type {never} */
        const agotado = tipo;
        throw new Error(`Aviso no contemplado: ${agotado}`);
      }
    }
  });
  switch (tipo) {
    case "temperatura_baja":
      return `Mínima prevista de ${unir(frases)}.`;
    case "calor":
      return `Máxima prevista de ${unir(frases)}.`;
    case "lluvia":
      return `Precipitación prevista de ${unir(frases)}.`;
    case "viento":
      return `Viento máximo previsto de ${unir(frases)}.`;
    default: {
      /** @type {never} */
      const agotado = tipo;
      throw new Error(`Aviso no contemplado: ${agotado}`);
    }
  }
}

function armar(tipo, ocurrencias) {
  if (!ocurrencias.length) return null;
  return {
    origen: "enflora",
    tipo,
    titulo: titulo(tipo),
    detalle: detalle(tipo, ocurrencias),
    dias: ocurrencias.map((item) => item.fecha),
  };
}

export function avisosDesdePronostico(dias, umbrales) {
  const frio = [];
  const calor = [];
  const lluvia = [];
  const viento = [];

  for (const dia of dias || []) {
    if (!dia?.fecha || dia.esPronostico !== true) continue;
    if (typeof dia.minimaC === "number" && dia.minimaC <= umbrales.temperaturaBajaC) {
      frio.push({ fecha: dia.fecha, valor: dia.minimaC });
    }
    if (typeof dia.maximaC === "number" && dia.maximaC >= umbrales.calorC) {
      calor.push({ fecha: dia.fecha, valor: dia.maximaC });
    }
    if (typeof dia.precipitacionMm === "number" && dia.precipitacionMm >= umbrales.lluviaMm) {
      lluvia.push({ fecha: dia.fecha, valor: dia.precipitacionMm });
    }
    if (typeof dia.vientoKph === "number" && dia.vientoKph >= umbrales.vientoKph) {
      viento.push({ fecha: dia.fecha, valor: dia.vientoKph });
    }
  }

  return [armar("temperatura_baja", frio), armar("calor", calor), armar("lluvia", lluvia), armar("viento", viento)].filter(
    Boolean
  );
}
