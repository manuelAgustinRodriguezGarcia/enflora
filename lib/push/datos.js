import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  CLAVE_CAMPANA_LANZAMIENTO,
  LIMITE_ALTAS_HORA,
  TAMANO_LOTE_PUSH,
} from "./reglas.js";

export function clientePush() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function agenteCorto(agente) {
  if (typeof agente !== "string") return null;
  const limpio = agente.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!limpio) return null;
  return limpio.slice(0, 180);
}

export async function permiteAlta(supabase, clave) {
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("push_limites")
    .select("id", { count: "exact", head: true })
    .eq("clave", clave)
    .gte("creada_en", desde);
  if (error) return null;
  return (count || 0) < LIMITE_ALTAS_HORA;
}

export async function registrarIntento(supabase, clave) {
  const { error } = await supabase.from("push_limites").insert({ clave });
  return !error;
}

export async function guardarSuscripcion(supabase, entrada, usuarioId, agente) {
  const { data: previa, error: errorLectura } = await supabase
    .from("push_suscripciones")
    .select("id, usuario_id")
    .eq("endpoint", entrada.endpoint)
    .maybeSingle();
  if (errorLectura) return { ok: false };

  const fila = {
    endpoint: entrada.endpoint,
    p256dh: entrada.p256dh,
    auth: entrada.auth,
    origen: entrada.origen,
    plataforma: entrada.plataforma,
    user_agent: agenteCorto(agente),
    expira_en: entrada.expiraEn,
    activa: true,
    revocada_en: null,
    expirada_en: null,
    motivo_baja: null,
    actualizada_en: new Date().toISOString(),
    usuario_id: usuarioId || previa?.usuario_id || null,
  };

  if (!previa) {
    const { data, error } = await supabase
      .from("push_suscripciones")
      .insert(fila)
      .select("id")
      .single();
    if (!error) return { ok: true, id: data.id };
    if (error.code !== "23505") return { ok: false };
  }

  const { data, error } = await supabase
    .from("push_suscripciones")
    .update(fila)
    .eq("endpoint", entrada.endpoint)
    .select("id")
    .single();
  if (error) return { ok: false };
  return { ok: true, id: data.id };
}

export async function revocarSuscripcion(supabase, endpoint) {
  const { error } = await supabase
    .from("push_suscripciones")
    .update({
      activa: false,
      revocada_en: new Date().toISOString(),
      motivo_baja: "usuario",
      actualizada_en: new Date().toISOString(),
    })
    .eq("endpoint", endpoint);
  return !error;
}

export async function leerCampanaLanzamiento(supabase) {
  const { data, error } = await supabase
    .from("push_campanas")
    .select("id, clave, titulo, mensaje, url, programada_para, zona_horaria, habilitada, estado, iniciada_en")
    .eq("clave", CLAVE_CAMPANA_LANZAMIENTO)
    .maybeSingle();
  if (error) throw new Error("campana");
  return data;
}

export async function marcarEnCurso(supabase, campana) {
  const patch = { estado: "en_curso" };
  if (!campana.iniciada_en) patch.iniciada_en = new Date().toISOString();
  const { error } = await supabase
    .from("push_campanas")
    .update(patch)
    .eq("id", campana.id)
    .in("estado", ["borrador", "programada", "en_curso"]);
  if (error) throw new Error("campana");
}

export async function marcarCompletada(supabase, campanaId) {
  const { error } = await supabase
    .from("push_campanas")
    .update({ estado: "completada", finalizada_en: new Date().toISOString() })
    .eq("id", campanaId)
    .eq("estado", "en_curso");
  if (error) throw new Error("campana");
}

export async function liberarInterrumpidos(supabase, campanaId) {
  const limite = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("push_envios")
    .update({
      estado: "error",
      error: "interrumpido",
      actualizado_en: new Date().toISOString(),
    })
    .eq("campana_id", campanaId)
    .eq("estado", "enviando")
    .lt("actualizado_en", limite);
  if (error) throw new Error("envios");
}

export async function leerLote(supabase, campanaId) {
  const { data, error } = await supabase.rpc("push_lote_pendiente", {
    p_campana: campanaId,
    p_limite: TAMANO_LOTE_PUSH,
  });
  if (error) throw new Error("lote");
  return data || [];
}

export async function quedanPendientes(supabase, campanaId) {
  const lote = await leerLote(supabase, campanaId);
  if (lote.length > 0) return true;
  const { count, error } = await supabase
    .from("push_envios")
    .select("id", { count: "exact", head: true })
    .eq("campana_id", campanaId)
    .eq("estado", "enviando");
  if (error) throw new Error("envios");
  return (count || 0) > 0;
}

export async function reclamarEnvio(supabase, campanaId, suscripcionId, clave) {
  const { data, error } = await supabase.rpc("push_reclamar_envio", {
    p_campana: campanaId,
    p_suscripcion: suscripcionId,
    p_clave: clave,
  });
  if (error) throw new Error("reclamo");
  return data || null;
}

export async function guardarResultado(supabase, resultado) {
  const { error } = await supabase
    .from("push_envios")
    .update({
      estado: resultado.estado,
      codigo_estado: resultado.codigo,
      error: resultado.error,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", resultado.id);
  if (error) throw new Error("resultado");
}

export async function desactivarSuscripcion(supabase, suscripcionId, motivo) {
  const ahora = new Date().toISOString();
  const patch = {
    activa: false,
    motivo_baja: motivo,
    actualizada_en: ahora,
  };
  if (motivo === "expirada") patch.expirada_en = ahora;
  if (motivo === "usuario") patch.revocada_en = ahora;
  const { error } = await supabase.from("push_suscripciones").update(patch).eq("id", suscripcionId);
  if (error) throw new Error("suscripcion");
}

export async function limpiarLimitesViejos(supabase) {
  const limite = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("push_limites").delete().lt("creada_en", limite);
}

export async function leerSuscripcionPorEndpoint(supabase, endpoint) {
  const { data, error } = await supabase
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth, activa, expira_en")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, suscripcion: data };
}

export async function leerSuscripcionPorId(supabase, id) {
  const { data, error } = await supabase
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth, activa, expira_en")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, suscripcion: data };
}

export async function registrarEnvioPrueba(supabase, suscripcionId, estado, codigo, errorTexto) {
  const { error } = await supabase.from("push_envios").insert({
    suscripcion_id: suscripcionId,
    campana_id: null,
    tipo: "prueba",
    clave_idempotencia: `prueba:${suscripcionId}:${randomUUID()}`,
    estado,
    codigo_estado: codigo,
    error: errorTexto,
    intentos: 1,
  });
  return !error;
}
