const url = "https://enflora.com.ar/";
const inicio = performance.now();
const respuesta = await fetch(url, {
  headers: { accept: "text/html", "accept-encoding": "identity" },
});
const cabeceras = Math.round(performance.now() - inicio);
const lector = respuesta.body.getReader();
const decodificador = new TextDecoder();
let html = "";
let bytes = 0;
let flora = null;
let fin = null;
const cortes = [];
while (true) {
  const parte = await lector.read();
  const t = Math.round(performance.now() - inicio);
  if (parte.done) {
    fin = t;
    break;
  }
  bytes += parte.value.byteLength;
  html += decodificador.decode(parte.value, { stream: true });
  if (cortes.length < 8) cortes.push({ t, bytes: parte.value.byteLength, acumulado: bytes });
  if (flora == null && html.includes("flora-landing.png")) {
    flora = { t, offset: html.indexOf("flora-landing.png"), acumulado: bytes };
  }
}
const preload = html.match(/<link[^>]+flora-landing[^>]*>/i)?.[0] || "";
const scriptAntes = html.slice(0, html.indexOf("flora-landing.png")).includes("<script");
console.log(
  JSON.stringify(
    {
      status: respuesta.status,
      encoding: respuesta.headers.get("content-encoding"),
      cache: respuesta.headers.get("x-vercel-cache"),
      region: respuesta.headers.get("x-vercel-id"),
      cabecerasMs: cabeceras,
      flora,
      finMs: fin,
      bytes,
      cortes,
      scriptAntesDelPreload: scriptAntes,
      preloadBytes: preload.length,
      fetchPriorityEnPreload: preload.includes("fetchpriority"),
    },
    null,
    2,
  ),
);
