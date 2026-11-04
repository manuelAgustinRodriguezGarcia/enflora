import fs from "node:fs";

const nombres = [
  "clear-day",
  "clear-night",
  "partly-cloudy-day",
  "partly-cloudy-night",
  "partly-cloudy-day-rain",
  "partly-cloudy-night-rain",
  "partly-cloudy-day-snow",
  "partly-cloudy-night-snow",
  "cloudy",
  "overcast-day",
  "overcast-night",
  "mist",
  "drizzle",
  "rain",
  "extreme-rain",
  "sleet",
  "snow",
  "hail",
  "thunderstorms-day",
  "thunderstorms-night",
  "thunderstorms-day-rain",
  "thunderstorms-night-rain",
  "thunderstorms-day-snow",
  "thunderstorms-night-snow",
  "fog-day",
  "fog-night",
  "not-available",
];

const dir = "node_modules/@meteocons/svg/flat";
const cuerpo = nombres
  .map((nombre) => {
    const svg = fs.readFileSync(`${dir}/${nombre}.svg`, "utf8").trim();
    return `  ${JSON.stringify(nombre)}: ${JSON.stringify(svg)},`;
  })
  .join("\n");

const archivo = `// Iconos Flat usados por el mapa de condition.code. Origen: @meteocons/svg (MIT).
export const ICONOS_METEOCONS = {
${cuerpo}
};

export function quitarAnimacionSvg(svg) {
  return String(svg || "")
    .replace(/<animate(?:Transform|Motion)?\\b[^>]*>[\\s\\S]*?<\\/animate(?:Transform|Motion)?>/g, "")
    .replace(/<animate(?:Transform|Motion)?\\b[^>]*\\/>/g, "");
}

export function svgMeteocons(nombre, { estatico = false, prefijo = "" } = {}) {
  const base = ICONOS_METEOCONS[nombre] || ICONOS_METEOCONS["not-available"];
  let svg = estatico ? quitarAnimacionSvg(base) : base;
  if (prefijo) {
    svg = svg.replace(/\\bid="([^"]+)"/g, (_, id) => \`id="\${prefijo}-\${id}"\`);
    svg = svg.replace(/url\\(#([^)]+)\\)/g, (_, id) => \`url(#\${prefijo}-\${id})\`);
  }
  return svg.replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
}
`;

fs.writeFileSync("lib/clima/meteocons-flat.js", archivo);
console.log("bytes", fs.statSync("lib/clima/meteocons-flat.js").size);
