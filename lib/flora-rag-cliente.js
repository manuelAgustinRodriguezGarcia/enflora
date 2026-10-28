import "server-only";

import { LIMITES_FLORA, FUENTE_GUIA, respuestaFlora } from "@/lib/flora-contrato";
import {
  FLORA_RAG_LIMITE_DEFAULT,
  FLORA_RAG_LIMITE_MAX,
  floraRagRetrieveUrl,
} from "@/lib/flora-rag-config";
import { mapearFilasRagAFragmentosGuia } from "@/lib/flora-rag-mapeo";

const TIMEOUT_MS = 12_000;

function limiteEfectivo(limite) {
  if (limite === undefined || limite === null) return FLORA_RAG_LIMITE_DEFAULT;
  const n = Math.trunc(Number(limite));
  if (!Number.isFinite(n)) return FLORA_RAG_LIMITE_DEFAULT;
  return Math.min(Math.max(n, 1), Math.min(FLORA_RAG_LIMITE_MAX, LIMITES_FLORA.maxFragmentosGuia));
}

/**
 * @returns {Promise<{ ok: boolean, fragmentos: object[], meta: object, errorRag?: boolean }>}
 */
export async function recuperarFragmentosRag(supabase, { consulta, temas = [], limite } = {}) {
  const url = floraRagRetrieveUrl();
  if (!url) {
    return { ok: false, fragmentos: [], meta: {}, errorRag: true };
  }

  const { data: sesionData } = await supabase.auth.getSession();
  const token = sesionData?.session?.access_token;
  if (!token) {
    return { ok: false, fragmentos: [], meta: {}, errorRag: true };
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        consulta,
        temas,
        limite: limiteEfectivo(limite),
      }),
      signal: controlador.signal,
    });

    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !cuerpo?.ok) {
      return { ok: false, fragmentos: [], meta: cuerpo?.meta || {}, errorRag: true };
    }

    const fragmentos = mapearFilasRagAFragmentosGuia(cuerpo.fragmentos);
    return {
      ok: true,
      fragmentos,
      meta: cuerpo.meta || {},
      errorRag: false,
    };
  } catch {
    return { ok: false, fragmentos: [], meta: {}, errorRag: true };
  } finally {
    clearTimeout(temporizador);
  }
}

export function respuestaFloraDesdeRag({ consulta, temas, fragmentos, meta = {}, limitaciones = [] }) {
  const limitacionesLista = [...limitaciones];
  if (meta.degradado) {
    limitacionesLista.push("La búsqueda usó solo texto porque el embedding no estuvo disponible.");
  }
  if (fragmentos.length === 0 && !limitacionesLista.some((l) => /biblioteca|documentos/i.test(l))) {
    limitacionesLista.push(
      "La biblioteca editorial en Supabase no devolvió fragmentos para esta consulta (puede estar vacía o sin coincidencias).",
    );
  }

  return respuestaFlora({
    fuente: FUENTE_GUIA,
    tipoConsulta: "buscar_guia",
    datos: fragmentos,
    metadatos: {
      completo: true,
      hayMas: false,
      cantidad: fragmentos.length,
      sinDatos: fragmentos.length === 0,
      consulta: consulta || undefined,
      temas: temas?.length ? temas : undefined,
      motor: "supabase_rag",
      ...meta,
    },
    limitaciones: limitacionesLista.length ? limitacionesLista : undefined,
  });
}
