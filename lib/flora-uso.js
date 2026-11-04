import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Guarda el uso después de responder. Un fallo de métricas no cambia la respuesta de Flora.
 * La función de base ignora un segundo guardado de la misma solicitud.
 */
export async function programarUsoFlora(argumentos, dependencias = {}) {
  if (!argumentos) return { ok: false };
  const rpc = dependencias.rpc || rpcUsoFlora;
  try {
    await rpc(argumentos);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function rpcUsoFlora(argumentos) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return;
  const cliente = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await cliente.rpc("registrar_uso_flora", argumentos);
  if (error && error.code !== "PGRST202") throw error;
}
