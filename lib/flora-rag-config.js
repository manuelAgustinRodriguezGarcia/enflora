/** Configuración del motor de guía editorial (local JSON vs Supabase RAG). */

export const FLORA_RAG_EMBEDDING_MODEL = "gemini-embedding-2";
export const FLORA_RAG_EMBEDDING_DIMENSION = 768;

export const FLORA_RAG_LIMITE_DEFAULT = 5;
export const FLORA_RAG_LIMITE_MAX = 8;

export function motorGuiaFlora() {
  const raw = String(process.env.FLORA_GUIA_MOTOR || "local").trim().toLowerCase();
  if (raw === "supabase" || raw === "auto") return raw;
  return "local";
}

export function urlBaseSupabaseFlora() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

export function floraRagRetrieveUrl() {
  const base = urlBaseSupabaseFlora();
  if (!base) return "";
  const custom = String(process.env.FLORA_RAG_RETRIEVE_URL || "").trim();
  if (custom) return custom;
  return `${base}/functions/v1/flora-rag-retrieve`;
}
