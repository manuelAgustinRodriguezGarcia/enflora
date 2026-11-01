import "server-only";

function codigoDb(error) {
  const code = String(error?.code || "");
  return /^[A-Za-z0-9]{1,12}$/.test(code) ? code : null;
}

function falloPersistencia(error) {
  return { ok: false, codigo: "persistencia", codigoDb: codigoDb(error), detalle: error?.message };
}

/**
 * Idempotencia sin ON CONFLICT: el índice único parcial de authorized_payment_id
 * no es target válido en PostgREST (42P10).
 */
async function actualizarPagoExistente(supabase, id, filaPago) {
  const { error } = await supabase
    .from("plus_pagos_recurrentes")
    .update({ ...filaPago, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return falloPersistencia(error);
  return { ok: true, id, reutilizado: true };
}

async function leerPagoPorAuthorized(supabase, claveAuth) {
  return supabase
    .from("plus_pagos_recurrentes")
    .select("id")
    .eq("authorized_payment_id", claveAuth)
    .maybeSingle();
}

export async function persistirPagoRecurrentePlus(supabase, filaPago) {
  const claveAuth = filaPago.authorized_payment_id ? String(filaPago.authorized_payment_id) : null;

  if (claveAuth) {
    const { data: existente, error: errorLectura } = await leerPagoPorAuthorized(supabase, claveAuth);
    if (errorLectura) return falloPersistencia(errorLectura);
    if (existente?.id) return actualizarPagoExistente(supabase, existente.id, filaPago);
  }

  const { data, error } = await supabase
    .from("plus_pagos_recurrentes")
    .insert(filaPago)
    .select("id")
    .maybeSingle();
  if (error) {
    if (claveAuth && codigoDb(error) === "23505") {
      const { data: existente, error: errorRelectura } = await leerPagoPorAuthorized(supabase, claveAuth);
      if (errorRelectura || !existente?.id) return falloPersistencia(errorRelectura || error);
      return actualizarPagoExistente(supabase, existente.id, filaPago);
    }
    return falloPersistencia(error);
  }
  return { ok: true, id: data?.id, reutilizado: false };
}
