import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import {
  LIMITE_DEFAULT,
  LIMITE_MAX,
  MAX_CONSULTA_CHARS,
  MAX_TEMA_CHARS,
  MAX_TEMAS,
  UMBRAL_DEFAULT,
} from "../_shared/flora-rag-constantes.ts";
import { generarEmbeddingGemini } from "../_shared/gemini-embed.ts";

function validarEntrada(cuerpo: Record<string, unknown>) {
  const consulta = String(cuerpo.consulta ?? "").trim();
  if (!consulta) return { ok: false as const, error: "La consulta es obligatoria." };
  if (consulta.length > MAX_CONSULTA_CHARS) {
    return { ok: false as const, error: "La consulta es demasiado larga." };
  }

  const temasRaw = Array.isArray(cuerpo.temas) ? cuerpo.temas : [];
  const temas = temasRaw
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_TEMAS)
    .map((t) => (t.length > MAX_TEMA_CHARS ? t.slice(0, MAX_TEMA_CHARS) : t));

  let limite = Number(cuerpo.limite ?? LIMITE_DEFAULT);
  if (!Number.isFinite(limite)) limite = LIMITE_DEFAULT;
  limite = Math.min(Math.max(Math.trunc(limite), 1), LIMITE_MAX);

  let umbral = Number(cuerpo.umbral ?? UMBRAL_DEFAULT);
  if (!Number.isFinite(umbral)) umbral = UMBRAL_DEFAULT;
  umbral = Math.min(Math.max(umbral, 0), 1);

  const modo = cuerpo.modo === "texto" ? "texto" : "hibrido";

  return { ok: true as const, consulta, temas, limite, umbral, modo };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse({ ok: false, error: "Servicio no configurado." }, 503);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Se requiere autenticación." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usuarioData, error: usuarioError } = await supabase.auth.getUser();
  if (usuarioError || !usuarioData?.user) {
    return jsonResponse({ ok: false, error: "Sesión inválida." }, 401);
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Cuerpo inválido." }, 400);
  }

  const validacion = validarEntrada(cuerpo);
  if (!validacion.ok) {
    return jsonResponse({ ok: false, error: validacion.error }, 400);
  }

  const { consulta, temas, limite, umbral, modo } = validacion;
  let embedding: number[] | null = null;
  let degradado = false;

  if (modo !== "texto") {
    try {
      embedding = await generarEmbeddingGemini(consulta);
    } catch {
      degradado = true;
      embedding = null;
    }
  } else {
    degradado = true;
  }

  const { data: filas, error: rpcError } = await supabase.rpc("flora_rag_buscar_hibrido", {
    p_consulta: consulta,
    p_embedding: embedding,
    p_temas: temas.length ? temas : null,
    p_limite: limite,
    p_umbral: umbral,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, error: "No se pudo completar la búsqueda." }, 502);
  }

  return jsonResponse({
    ok: true,
    fragmentos: filas ?? [],
    meta: {
      cantidad: Array.isArray(filas) ? filas.length : 0,
      degradado,
      motor: degradado && !embedding ? "texto" : embedding ? "hibrido" : "texto",
    },
  });
});
