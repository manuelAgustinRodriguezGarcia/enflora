/** Rangos físicamente plausibles. No son objetivos de cultivo. */

const RANGOS = {
  ph: { min: 0, max: 14 },
  humedad: { min: 0, max: 100 },
  temperatura: { min: -20, max: 60 },
  vpd: { min: 0, max: 10 },
  ppm: { min: 0, max: 20000 },
};

function claveMedicion(clave) {
  return String(clave || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function rangoDe(clave, unidad) {
  const nombre = claveMedicion(clave);
  if (nombre === "ec" || nombre === "electroconductividad") {
    const texto = String(unidad || "").toLowerCase();
    if (/ms/.test(texto) && !/µ|μ|us/.test(texto)) return { min: 0, max: 20 };
    return { min: 0, max: 20000 };
  }
  return RANGOS[nombre] || null;
}

export function revisarMedicionPlausible(clave, valor, unidad = "") {
  if (valor === null || valor === undefined || valor === "") {
    return { estado: "ausente" };
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return { estado: "presente" };
  const rango = rangoDe(clave, unidad);
  if (!rango) return { estado: "presente" };
  if (numero < rango.min || numero > rango.max) {
    return {
      estado: "sospechoso",
      advertencia: `Valor guardado fuera del rango físicamente plausible (${rango.min} a ${rango.max}).`,
    };
  }
  return { estado: "presente" };
}
