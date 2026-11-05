import { readFileSync, writeFileSync } from "node:fs";

const traza = JSON.parse(readFileSync("mediciones/lh-fase7/lhr-0.trace.json", "utf8"));
const eventos = traza.traceEvents || traza;
const meta = eventos.find((e) => e.name === "navigationStart" && e.args?.data?.isLoadingMainFrame);
const nav = meta?.args?.data?.navigationId;
const t0 = meta?.ts || eventos.find((e) => e.name === "TracingStartedInBrowser")?.ts || 0;

function ms(ts) {
  return Math.round((ts - t0) / 10) / 100;
}

const interes = new Set([
  "ResourceSendRequest",
  "ResourceReceiveResponse",
  "ResourceReceivedData",
  "ResourceFinish",
  "ParseHTML",
  "ParseAuthorStyleSheet",
  "EvaluateScript",
  "FunctionCall",
  "v8.compile",
  "RunTask",
  "Layout",
  "UpdateLayoutTree",
  "ScheduleStyleRecalculation",
  "Paint",
  "PaintImage",
  "LargestContentfulPaint::Candidate",
  "largestContentfulPaint::Candidate",
  "MarkLCP",
]);

const porId = new Map();
const tareas = [];
const scripts = [];
const layouts = [];
const paints = [];
const lcp = [];
const parseHtml = [];
let recibidosDoc = [];

for (const e of eventos) {
  if (e.ph !== "X" && e.ph !== "I" && e.ph !== "R") continue;
  const datos = e.args?.data || {};
  const url = datos.url || datos.stackTrace?.[0]?.url || "";
  if (e.name === "ResourceSendRequest" || e.name === "ResourceReceiveResponse" || e.name === "ResourceReceivedData" || e.name === "ResourceFinish") {
    const id = datos.requestId;
    if (!id) continue;
    const item = porId.get(id) || { url: datos.url || "" };
    if (datos.url) item.url = datos.url;
    if (e.name === "ResourceSendRequest") item.envio = e.ts;
    if (e.name === "ResourceReceiveResponse") {
      item.respuesta = e.ts;
      item.mime = datos.mimeType;
      item.estado = datos.statusCode;
      item.prioridad = datos.priority;
      item.protocolo = datos.protocol;
      item.encodedLength = datos.encodedDataLength;
    }
    if (e.name === "ResourceReceivedData") {
      item.datos = item.datos || [];
      item.datos.push({ t: e.ts, bytes: datos.encodedDataLength || 0 });
    }
    if (e.name === "ResourceFinish") {
      item.fin = e.ts;
      item.transfer = datos.encodedDataLength;
      item.decoded = datos.decodedBodyLength;
    }
    porId.set(id, item);
  }
  if (e.name === "RunTask" && e.dur > 20000) {
    tareas.push({ inicio: ms(e.ts), dur: Math.round(e.dur / 10) / 100 });
  }
  if (e.name === "EvaluateScript" && e.dur) {
    scripts.push({
      inicio: ms(e.ts),
      dur: Math.round(e.dur / 10) / 100,
      url: (datos.url || "").replace("https://enflora.com.ar", ""),
    });
  }
  if ((e.name === "Layout" || e.name === "UpdateLayoutTree") && e.dur > 5000) {
    const pila = (datos.stackTrace || e.args?.beginData?.stackTrace || [])
      .slice(0, 4)
      .map((f) => `${(f.functionName || "(anon)")} ${String(f.url || "").split("/").pop()}:${f.lineNumber}`);
    layouts.push({
      tipo: e.name,
      inicio: ms(e.ts),
      dur: Math.round(e.dur / 10) / 100,
      pila,
    });
  }
  if (e.name === "Paint" || e.name === "PaintImage") {
    paints.push({ tipo: e.name, inicio: ms(e.ts), dur: Math.round((e.dur || 0) / 10) / 100 });
  }
  if (String(e.name).toLowerCase().includes("largestcontentfulpaint")) {
    lcp.push({
      nombre: e.name,
      inicio: ms(e.ts),
      size: datos.size,
      node: datos.nodeName,
      url: datos.url || datos.imageUrl,
    });
  }
  if (e.name === "ParseHTML" && e.dur > 1000) {
    parseHtml.push({
      inicio: ms(e.ts),
      dur: Math.round(e.dur / 10) / 100,
      fin: ms(e.ts + e.dur),
      rango: datos.frame ? undefined : `${datos.startLine || 0}-${datos.endLine || ""}`,
    });
  }
}

const recursos = [...porId.values()]
  .filter((r) => r.url && r.envio)
  .map((r) => ({
    url: r.url.replace("https://enflora.com.ar", ""),
    envio: ms(r.envio),
    respuesta: r.respuesta ? ms(r.respuesta) : null,
    fin: r.fin ? ms(r.fin) : null,
    primerDato: r.datos?.[0] ? ms(r.datos[0].t) : null,
    trozos: r.datos?.length || 0,
    bytesTrozos: (r.datos || []).reduce((s, d) => s + d.bytes, 0),
    transfer: r.transfer || null,
    decoded: r.decoded || null,
    mime: r.mime || null,
    prioridad: r.prioridad || null,
  }))
  .sort((a, b) => a.envio - b.envio);

const doc = recursos.find((r) => r.url === "/" || r.url.startsWith("/?"));
const flora = recursos.find((r) => r.url.includes("flora-landing.png"));
const lcpMs = lcp.at(-1)?.inicio ?? null;

const antesLcp = (lista) => lista.filter((x) => lcpMs == null || x.inicio <= lcpMs + 5);
const suma = (lista, campo = "dur") => Math.round(lista.reduce((s, x) => s + (x[campo] || 0), 0));

const scriptsAntes = antesLcp(scripts);
const porScript = new Map();
for (const s of scriptsAntes) {
  const clave = s.url.split("?")[0] || "(inline)";
  const prev = porScript.get(clave) || { url: clave, dur: 0, veces: 0, inicio: s.inicio };
  prev.dur += s.dur;
  prev.veces += 1;
  prev.inicio = Math.min(prev.inicio, s.inicio);
  porScript.set(clave, prev);
}

const informe = {
  navegacionMs: 0,
  lcp: lcp.slice(-6),
  documento: doc
    ? {
        ...doc,
        datos: undefined,
      }
    : null,
  flora,
  parseHtml: parseHtml.slice(0, 12),
  primerosRecursos: recursos.slice(0, 18).map(({ url, envio, respuesta, fin, primerDato, transfer, decoded, mime, prioridad }) => ({
    url: url.slice(0, 140),
    envio,
    respuesta,
    primerDato,
    fin,
    transfer,
    decoded,
    mime,
    prioridad,
  })),
  tareasLargasAntesLcp: antesLcp(tareas).filter((t) => t.dur >= 50),
  scriptsAntesLcp: [...porScript.values()]
    .map((s) => ({ ...s, dur: Math.round(s.dur) }))
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 15),
  layoutAntesLcp: antesLcp(layouts).sort((a, b) => b.dur - a.dur).slice(0, 12),
  sumaLayoutAntesLcp: suma(antesLcp(layouts)),
  sumaScriptsAntesLcp: suma(scriptsAntes),
  paints: paints.filter((p) => lcpMs == null || (p.inicio >= (flora?.fin || 0) - 50 && p.inicio <= lcpMs + 30)).slice(0, 20),
};

if (doc) {
  const crudo = [...porId.values()].find((r) => (r.url || "").endsWith("enflora.com.ar/") || r.url === "https://enflora.com.ar/");
  informe.trozosDocumento = (crudo?.datos || []).slice(0, 12).map((d) => ({ t: ms(d.t), bytes: d.bytes }));
}

writeFileSync("mediciones/lh-fase7/traza-resumen.json", JSON.stringify(informe, null, 2));
console.log(JSON.stringify({
  lcp: informe.lcp.at(-1),
  doc: informe.documento,
  flora: informe.flora,
  trozos: informe.trozosDocumento,
  tareas: informe.tareasLargasAntesLcp,
  scripts: informe.scriptsAntesLcp.slice(0, 8),
  layout: informe.sumaLayoutAntesLcp,
  scriptsMs: informe.sumaScriptsAntesLcp,
  parse: informe.parseHtml.slice(0, 4),
}, null, 2));
