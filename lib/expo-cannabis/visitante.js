import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Parte PÚBLICA de Expo Cannabis: identificación de visitantes y conteo de partidas.
 * Sin privilegios administrativos: no importar nada de lib/admin ni de expo-cannabis/admin.
 */
const COOKIE_VISITANTE = "enflora_expo_visitante";
const UN_ANIO = 60 * 60 * 24 * 400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function visitanteExpo() {
  const almacen = await cookies();
  const actual = String(almacen.get(COOKIE_VISITANTE)?.value || "").trim().toLowerCase();
  if (UUID.test(actual)) return actual;

  const creado = crypto.randomUUID();
  almacen.set(COOKIE_VISITANTE, creado, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UN_ANIO,
  });
  return creado;
}

export async function registrarPartidaExpo(visitorId) {
  if (!UUID.test(String(visitorId || "").toLowerCase())) return false;
  const servicio = crearClienteVisitantes();
  if (!servicio) return false;
  const { error } = await servicio.rpc("registrar_partida_expo", {
    p_visitor: visitorId,
  });
  return !error;
}

function crearClienteVisitantes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
