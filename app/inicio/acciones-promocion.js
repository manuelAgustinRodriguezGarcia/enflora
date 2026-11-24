"use server";

import { marcarPromocionUsuario } from "@/lib/promociones-servidor";
import { crearClienteServidor, sincronizarSesionParaLectura } from "@/lib/supabase/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function registrarMarcaPromocion(campanaId, accion) {
  if (!UUID.test(String(campanaId || "")) || (accion !== "impresion" && accion !== "cierre")) return { ok: false };
  const supabase = await crearClienteServidor();
  const sesion = await sincronizarSesionParaLectura(supabase);
  if (!sesion.ok) return { ok: false };
  return marcarPromocionUsuario(supabase, sesion.userId, campanaId, accion);
}
