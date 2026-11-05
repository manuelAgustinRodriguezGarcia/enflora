const demora = Number(process.env.BNA_DELAY_MS || 0);
const modo = process.env.BNA_MODE || "passthrough";
const original = globalThis.fetch;

function htmlVigente() {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dia = String(ahora.getUTCDate()).padStart(2, "0");
  const mes = String(ahora.getUTCMonth() + 1).padStart(2, "0");
  const anio = ahora.getUTCFullYear();
  return `<table><tr><th>${dia}/${mes}/${anio}</th><th>Compra</th><th>Venta</th></tr><tr><td>Dolar U.S.A</td><td>1.495,00</td><td>1.545,00</td></tr></table>Hora Actualización: 10:00`;
}

globalThis.fetch = async function fetchConSonda(entrada, init) {
  const url =
    typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada?.url || "";
  if (!url.includes("bna.com.ar")) return original.call(this, entrada, init);

  const inicio = Date.now();
  console.error(`[bna-probe] ${modo} delay=${demora} ${url}`);
  function esperar(ms, signal) {
  return new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(resolver, ms);
    if (!signal) return;
    const cancelar = () => {
      clearTimeout(temporizador);
      rechazar(signal.reason);
    };
    if (signal.aborted) {
      cancelar();
      return;
    }
    signal.addEventListener("abort", cancelar, { once: true });
  });
}

if (modo === "hang") await esperar(2 ** 30, init?.signal);
if (modo === "error") {
  console.error(`[bna-probe] error en ${Date.now() - inicio}ms`);
  throw new Error("bna-probe");
}
if (demora > 0) await esperar(demora, init?.signal);
  if (modo === "fixture" || modo === "delay" || modo === "hang") {
    console.error(`[bna-probe] respuesta en ${Date.now() - inicio}ms`);
    return new Response(htmlVigente(), { status: 200, headers: { "content-type": "text/html" } });
  }
  const respuesta = await original.call(this, entrada, init);
  console.error(`[bna-probe] red ${respuesta.status} en ${Date.now() - inicio}ms`);
  return respuesta;
};
