import { readFileSync } from "node:fs";

const traza = JSON.parse(readFileSync("mediciones/lh-fase7/lhr-0.trace.json", "utf8"));
const eventos = traza.traceEvents || traza;
const meta = eventos.find((e) => e.name === "navigationStart" && e.args?.data?.isLoadingMainFrame);
const t0 = meta.ts;

function ms(ts) {
  return Math.round((ts - t0) / 10) / 100;
}

const redes = new Map();
const tareas = [];
const pinturas = [];
const nombres = new Map();

for (const e of eventos) {
  const n = e.name || "";
  if (n.toLowerCase().includes("paint") || n.toLowerCase().includes("lcp") || n === "firstContentfulPaint") {
    nombres.set(n, (nombres.get(n) || 0) + 1);
    if (e.ts) pinturas.push({ n, t: ms(e.ts), dur: e.dur ? Math.round(e.dur / 1000) : 0, ph: e.ph });
  }
  const datos = e.args?.data || {};
  if (n === "ResourceSendRequest" || n === "ResourceFinish" || n === "ResourceReceiveResponse") {
    const id = datos.requestId;
    if (!id) continue;
    const item = redes.get(id) || { url: "" };
    if (datos.url) item.url = datos.url;
    if (n === "ResourceSendRequest") item.envio = e.ts;
    if (n === "ResourceReceiveResponse") item.respuesta = e.ts;
    if (n === "ResourceFinish") {
      item.fin = e.ts;
      item.transfer = datos.encodedDataLength;
      item.decoded = datos.decodedBodyLength;
      item.mime = datos.mimeType || item.mime;
    }
    if (datos.mimeType) item.mime = datos.mimeType;
    redes.set(id, item);
  }
  if (n === "RunTask" && e.dur) tareas.push({ inicio: e.ts, fin: e.ts + e.dur, dur: e.dur });
}

const recursos = [...redes.values()]
  .filter((r) => r.url && r.envio)
  .map((r) => ({
    url: r.url.replace("https://enflora.com.ar", "").slice(0, 110),
    envio: ms(r.envio),
    respuesta: r.respuesta ? ms(r.respuesta) : null,
    fin: r.fin ? ms(r.fin) : null,
    transfer: r.transfer || null,
    decoded: r.decoded || null,
    mime: r.mime || null,
  }))
  .sort((a, b) => a.envio - b.envio);

const imagenFin = 526;
const lcp = 2506;
const ventana = tareas.filter((t) => ms(t.fin) > imagenFin && ms(t.inicio) < lcp);
const ocupado = ventana.reduce((s, t) => s + t.dur, 0) / 1000;
const larga = [...ventana].sort((a, b) => b.dur - a.dur)[0];

const bloqueantes = recursos.filter((r) =>
  (r.mime || "").includes("css") || r.url.endsWith(".css") || (r.mime || "").includes("font") || r.url.includes(".woff") || (r.mime || "").includes("javascript") || r.url.endsWith(".js"),
);

console.log(JSON.stringify({
  nombresPaint: Object.fromEntries(nombres),
  pinturas: pinturas.filter((p) => p.t < 4000).slice(0, 25),
  cssYjs: bloqueantes.filter((r) => r.envio < 2600).slice(0, 25),
  tareasEnVentana: ventana.length,
  ocupadoMs: Math.round(ocupado),
  tareaMasLarga: larga ? { inicio: ms(larga.inicio), dur: Math.round(larga.dur / 1000) } : null,
}, null, 2));
