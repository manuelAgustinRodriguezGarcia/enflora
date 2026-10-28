import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { esAdministradorFloraRag } from "../_shared/flora-rag-admin-auth.ts";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../_shared/flora-rag-constantes.ts";
import { generarEmbeddingGemini } from "../_shared/gemini-embed.ts";

const ESTADOS_DOCUMENTO = new Set(["borrador", "revision", "publicado", "archivado"]);
const ESTADOS_FUENTE = new Set(["activa", "inactiva"]);

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clienteUsuario(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) return null;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clienteServicio() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SeccionEntrada = {
  seccion_id: string;
  seccion_titulo?: string;
  orden?: number;
  contenido: string;
  palabras_clave?: string[];
};

async function upsertFuente(admin: ReturnType<typeof createClient>, fuente: Record<string, unknown>) {
  const codigo = String(fuente.codigo ?? "").trim();
  const titulo = String(fuente.titulo ?? "").trim();
  if (!codigo || !titulo) throw new Error("fuente_incompleta");

  const estado = String(fuente.estado ?? "activa").trim();
  if (!ESTADOS_FUENTE.has(estado)) throw new Error("fuente_estado_invalido");

  const { data, error } = await admin
    .from("flora_fuentes")
    .upsert(
      {
        codigo,
        titulo,
        autor: fuente.autor ? String(fuente.autor).trim() : null,
        url: fuente.url ? String(fuente.url).trim() : null,
        procedencia: fuente.procedencia ? String(fuente.procedencia).trim() : null,
        condiciones_uso: fuente.condiciones_uso ? String(fuente.condiciones_uso).trim() : null,
        notas_editoriales: fuente.notas_editoriales ? String(fuente.notas_editoriales).trim() : null,
        estado,
      },
      { onConflict: "codigo" },
    )
    .select("id, codigo")
    .single();

  if (error || !data) throw new Error("fuente_no_guardada");
  return data;
}

async function upsertDocumento(
  admin: ReturnType<typeof createClient>,
  fuenteId: string,
  documento: Record<string, unknown>,
  secciones: SeccionEntrada[],
) {
  const slug = String(documento.slug ?? "").trim();
  const titulo = String(documento.titulo ?? "").trim();
  if (!slug || !titulo) throw new Error("documento_incompleto");

  const estado = String(documento.estado ?? "borrador").trim();
  if (!ESTADOS_DOCUMENTO.has(estado)) throw new Error("documento_estado_invalido");

  const hashDocumento = await sha256Hex(
    secciones
      .map((s) => `${s.seccion_id}:${String(s.contenido).trim()}`)
      .join("|"),
  );

  const palabrasClave = Array.isArray(documento.palabras_clave)
    ? documento.palabras_clave.map((p) => String(p).trim()).filter(Boolean)
    : [];

  const { data: docRow, error: docError } = await admin
    .from("flora_documentos")
    .upsert(
      {
        fuente_id: fuenteId,
        slug,
        titulo,
        tema: documento.tema ? String(documento.tema).trim() : null,
        subtema: documento.subtema ? String(documento.subtema).trim() : null,
        palabras_clave: palabrasClave,
        referencias: documento.referencias ?? [],
        estado,
        version: documento.version ? String(documento.version).trim() : null,
        contenido_hash: hashDocumento,
        publicado_en: estado === "publicado" ? new Date().toISOString() : documento.publicado_en ?? null,
        incorporado_en: documento.incorporado_en ?? null,
        embedding_modelo: EMBEDDING_MODEL,
        embedding_dimension: EMBEDDING_DIMENSION,
      },
      { onConflict: "slug" },
    )
    .select("id, slug, estado")
    .single();

  if (docError || !docRow) throw new Error("documento_no_guardado");

  const idsActivos: string[] = [];

  for (const [indice, seccion] of secciones.entries()) {
    const seccionId = String(seccion.seccion_id ?? "").trim();
    const contenido = String(seccion.contenido ?? "").trim();
    if (!seccionId || !contenido) continue;

    const contenidoHash = await sha256Hex(`${seccionId}:${contenido}`);
    const palabrasSeccion = Array.isArray(seccion.palabras_clave)
      ? seccion.palabras_clave.map((p) => String(p).trim()).filter(Boolean)
      : [];

    const { data: existente } = await admin
      .from("flora_fragmentos")
      .select("id, contenido_hash, activo")
      .eq("documento_id", docRow.id)
      .eq("contenido_hash", contenidoHash)
      .maybeSingle();

    if (existente?.id && existente.activo) {
      idsActivos.push(existente.id);
      continue;
    }

    const embedding = await generarEmbeddingGemini(contenido);

    const { data: insertado, error: fragError } = await admin
      .from("flora_fragmentos")
      .upsert(
        {
          documento_id: docRow.id,
          seccion_id: seccionId,
          seccion_titulo: seccion.seccion_titulo ? String(seccion.seccion_titulo).trim() : null,
          orden: Number.isFinite(seccion.orden) ? Number(seccion.orden) : indice,
          contenido,
          palabras_clave: palabrasSeccion,
          contenido_hash: contenidoHash,
          embedding,
          embedding_modelo: EMBEDDING_MODEL,
          embedding_version: EMBEDDING_VERSION,
          activo: true,
        },
        { onConflict: "documento_id,contenido_hash" },
      )
      .select("id")
      .single();

    if (fragError || !insertado) throw new Error("fragmento_no_guardado");
    idsActivos.push(insertado.id);
  }

  await admin.from("flora_fragmentos").update({ activo: false }).eq("documento_id", docRow.id);
  if (idsActivos.length) {
    await admin.from("flora_fragmentos").update({ activo: true }).in("id", idsActivos);
  }

  return { documento: docRow, fragmentosActivos: idsActivos.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido." }, 405);
  }

  const usuarioClient = clienteUsuario(req);
  if (!usuarioClient) {
    return jsonResponse({ ok: false, error: "Se requiere autenticación." }, 401);
  }

  const { data: usuarioData, error: usuarioError } = await usuarioClient.auth.getUser();
  if (usuarioError || !usuarioData?.user) {
    return jsonResponse({ ok: false, error: "Sesión inválida." }, 401);
  }

  if (!esAdministradorFloraRag(usuarioData.user)) {
    return jsonResponse({ ok: false, error: "No autorizado." }, 403);
  }

  const admin = clienteServicio();
  if (!admin) {
    return jsonResponse({ ok: false, error: "Servicio no configurado." }, 503);
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Cuerpo inválido." }, 400);
  }

  const accion = String(cuerpo.accion ?? "").trim();

  try {
    if (accion === "crear_fuente") {
      const fuente = await upsertFuente(admin, (cuerpo.fuente as Record<string, unknown>) || {});
      return jsonResponse({ ok: true, fuente });
    }

    if (accion === "upsert_documento" || accion === "reindexar_documento") {
      const fuenteInput = (cuerpo.fuente as Record<string, unknown>) || {};
      const fuente = await upsertFuente(admin, fuenteInput);
      const secciones = (Array.isArray(cuerpo.secciones) ? cuerpo.secciones : []) as SeccionEntrada[];
      const resultado = await upsertDocumento(
        admin,
        fuente.id,
        (cuerpo.documento as Record<string, unknown>) || {},
        secciones,
      );
      return jsonResponse({ ok: true, ...resultado });
    }

    if (accion === "cambiar_estado_documento") {
      const slug = String((cuerpo.documento as Record<string, unknown>)?.slug ?? "").trim();
      const estado = String(cuerpo.estado ?? "").trim();
      if (!slug || !ESTADOS_DOCUMENTO.has(estado)) {
        return jsonResponse({ ok: false, error: "Parámetros inválidos." }, 400);
      }
      const { error } = await admin
        .from("flora_documentos")
        .update({
          estado,
          publicado_en: estado === "publicado" ? new Date().toISOString() : null,
        })
        .eq("slug", slug);
      if (error) return jsonResponse({ ok: false, error: "No se pudo actualizar." }, 502);
      return jsonResponse({ ok: true, slug, estado });
    }

    return jsonResponse({ ok: false, error: "Acción no reconocida." }, 400);
  } catch {
    return jsonResponse({ ok: false, error: "No se pudo completar la operación." }, 502);
  }
});
