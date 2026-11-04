import { iconoClima } from "@/lib/clima/iconos";

// Rangos de color de la pantalla. No son umbrales de avisos ni de cultivo.
// <10 hielo, 10–17.9 fresco, 18–25.9 templado, 26–32 cálido, >32 intenso.
const PALETAS_DIA = {
  hielo: { fondo: "#E4F3FB", fondoFin: "#C5DFF2", tinta: "#0E3A56", tintaSuave: "#3D6278", acento: "#7EB6D6" },
  fresco: { fondo: "#E5F4F2", fondoFin: "#C9E6DC", tinta: "#0E3D3A", tintaSuave: "#3E655C", acento: "#6FB3A4" },
  templado: { fondo: "#F4F8EC", fondoFin: "#E3EFD4", tinta: "#0B3D2A", tintaSuave: "#4A6354", acento: "#A4C85B" },
  calido: { fondo: "#FFF6E4", fondoFin: "#F8D7B0", tinta: "#5A3410", tintaSuave: "#7A5530", acento: "#E8A04A" },
  intenso: { fondo: "#FFF1E8", fondoFin: "#F6C2A8", tinta: "#6A2A16", tintaSuave: "#703018", acento: "#E07A5F" },
  neutro: { fondo: "#F5F8EF", fondoFin: "#EAF2DC", tinta: "#0B3D2A", tintaSuave: "#4A6354", acento: "#A4C85B" },
};

const PALETAS_NOCHE = {
  hielo: { fondo: "#10243A", fondoFin: "#1A3E5C", tinta: "#E7F4FB", tintaSuave: "#B7D4E6", acento: "#8EC8E8" },
  fresco: { fondo: "#10243A", fondoFin: "#163E44", tinta: "#E7F6F2", tintaSuave: "#B7D6CE", acento: "#7ECCC0" },
  templado: { fondo: "#10243A", fondoFin: "#1A3328", tinta: "#F4F8EC", tintaSuave: "#C9DE94", acento: "#A4C85B" },
  calido: { fondo: "#10243A", fondoFin: "#3A2A18", tinta: "#FFF6E4", tintaSuave: "#F3D2A2", acento: "#E8A04A" },
  intenso: { fondo: "#10243A", fondoFin: "#3E241C", tinta: "#FFF1E8", tintaSuave: "#F6C2A8", acento: "#E07A5F" },
  neutro: { fondo: "#10243A", fondoFin: "#1A3328", tinta: "#F4F8EC", tintaSuave: "#C9DE94", acento: "#A4C85B" },
};

export function rangoTemperatura(temperaturaC) {
  if (typeof temperaturaC !== "number" || !Number.isFinite(temperaturaC)) return "neutro";
  if (temperaturaC < 10) return "hielo";
  if (temperaturaC < 18) return "fresco";
  if (temperaturaC < 26) return "templado";
  if (temperaturaC <= 32) return "calido";
  return "intenso";
}

export function momentoClima(esDia) {
  if (esDia === true) return "dia";
  if (esDia === false) return "noche";
  return "indeterminado";
}

function paletaDia(rango) {
  switch (rango) {
    case "hielo":
    case "fresco":
    case "templado":
    case "calido":
    case "intenso":
    case "neutro":
      return PALETAS_DIA[rango];
    default: {
      const nunca = rango;
      throw new Error(`Rango de clima sin paleta: ${nunca}`);
    }
  }
}

function paletaNoche(rango) {
  switch (rango) {
    case "hielo":
    case "fresco":
    case "templado":
    case "calido":
    case "intenso":
    case "neutro":
      return PALETAS_NOCHE[rango];
    default: {
      const nunca = rango;
      throw new Error(`Rango de clima sin paleta: ${nunca}`);
    }
  }
}

function paletaDe(rango, momento) {
  switch (momento) {
    case "noche":
      return paletaNoche(rango);
    case "dia":
    case "indeterminado":
      return paletaDia(rango);
    default: {
      const nunca = momento;
      throw new Error(`Momento de clima sin paleta: ${nunca}`);
    }
  }
}

export function temaClima({ temperaturaC = null, esDia = null, codigo = null } = {}) {
  const rango = rangoTemperatura(temperaturaC);
  const momento = momentoClima(esDia);
  return {
    rango,
    momento,
    paleta: paletaDe(rango, momento),
    icono: iconoClima(codigo, momento === "noche" ? "noche" : "dia"),
  };
}
