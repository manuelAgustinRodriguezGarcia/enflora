import { extraerListaStrain, normalizarStrain, ordenarCoincidenciasStrain, slugValido } from "@/lib/geneticas/reglas";

const BASE = "https://www.strainapi.com/wp-json/strainapi/v1";

export function urlBusquedaStrain(consulta) {
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", consulta);
  return url.toString();
}

export function urlFichaStrain(slug) {
  const limpio = slugValido(slug);
  if (!limpio) return "";
  return `${BASE}/strains/${limpio}`;
}

async function leerJson(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    return null;
  }
}

async function pedir(url, fetchImpl) {
  if (!url) return { ok: false, motivo: "consulta" };
  try {
    const respuesta = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) return { ok: false, motivo: respuesta.status === 404 ? "vacia" : "caida" };
    return { ok: true, cuerpo: await leerJson(respuesta) };
  } catch {
    return { ok: false, motivo: "caida" };
  }
}

export async function solicitarBusqueda(consulta, fetchImpl = fetch) {
  const pedido = await pedir(urlBusquedaStrain(consulta), fetchImpl);
  if (!pedido.ok) return pedido;
  const lista = extraerListaStrain(pedido.cuerpo);
  if (!lista) return { ok: false, motivo: "caida" };
  const items = [];
  for (const registro of ordenarCoincidenciasStrain(consulta, lista)) {
    const ficha = normalizarStrain(registro);
    if (!ficha) continue;
    items.push({
      idExterno: ficha.idExterno,
      slug: ficha.slug,
      nombre: ficha.nombre,
    });
    if (items.length >= 8) break;
  }
  return { ok: true, items };
}

function registroFicha(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return null;
  const anidado = cuerpo.data;
  if (
    anidado &&
    typeof anidado === "object" &&
    !Array.isArray(anidado) &&
    (anidado.slug || anidado.name || anidado.id)
  ) {
    return anidado;
  }
  return cuerpo;
}

export async function solicitarFicha(slug, fetchImpl = fetch) {
  const pedido = await pedir(urlFichaStrain(slug), fetchImpl);
  if (!pedido.ok) return pedido;
  const ficha = normalizarStrain(registroFicha(pedido.cuerpo));
  if (!ficha) return { ok: false, motivo: "vacia" };
  return { ok: true, ficha };
}
