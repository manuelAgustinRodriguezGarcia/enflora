import { writeFileSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:3456/";
const identidad = process.argv.includes("--identity");
const salida = process.argv.find((arg, i) => process.argv[i - 1] === "--out");
const marcas = [
  "flora-landing.png",
  "fetchpriority",
  "Elegí tu mejor plan",
  "precios__ars",
  "cotizacion_no_disponible",
  "rel=\"preload\"",
];

const inicio = performance.now();
const respuesta = await fetch(url, {
  headers: {
    accept: "text/html",
    "accept-encoding": identidad ? "identity" : "gzip, deflate, br",
  },
  redirect: "manual",
});
const cabeceras = Math.round(performance.now() - inicio);
const lector = respuesta.body.getReader();
const decodificador = new TextDecoder();
let html = "";
let bytes = 0;
const vistos = new Map();
const cortes = [];

while (true) {
  const parte = await lector.read();
  const t = Math.round(performance.now() - inicio);
  if (parte.done) {
    cortes.push({ t, bytes: 0, fin: true });
    break;
  }
  bytes += parte.value.byteLength;
  const texto = decodificador.decode(parte.value, { stream: true });
  html += texto;
  cortes.push({ t, bytes: parte.value.byteLength });
  for (const marca of marcas) {
    if (!vistos.has(marca) && html.includes(marca)) vistos.set(marca, t);
  }
}

const offsetFlora = html.indexOf("flora-landing.png");
const offsetPrecios = html.indexOf("precios__ars");
const preload = html.match(/<link[^>]+flora-landing[^>]*>/i)?.[0] || null;
const imagen = html.match(/<img[^>]+flora-landing[^>]*>/i)?.[0] || null;
const informe = JSON.stringify(
  {
      url,
      identidad,
      status: respuesta.status,
      location: respuesta.headers.get("location"),
      cache: respuesta.headers.get("x-nextjs-cache") || respuesta.headers.get("cache-control"),
      encoding: respuesta.headers.get("content-encoding"),
      cabecerasMs: cabeceras,
      finMs: cortes.at(-1)?.t,
      bytes,
      cortes,
      marcas: Object.fromEntries(vistos),
      offsetFlora,
      offsetPrecios,
      preload,
      imagen,
      ars: (html.match(/precios__ars/g) || []).length,
      heroes: (html.match(/flora-landing\.png/g) || []).length,
      seccionesPrecios: (html.match(/id=\\"precios\\"|id="precios"/g) || []).length,
    },
  null,
  2,
);
if (salida) writeFileSync(salida, informe);
console.log(informe);
