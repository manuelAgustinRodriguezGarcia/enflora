import "server-only";

/**
 * Idempotencia sin ON CONFLICT: el índice único parcial de authorized_payment_id
 * no es target válido en PostgREST (42P10).
 */
export async function persistirPagoRecurrentePlus(supabase, filaPago) {
  const claveAuth = filaPago.authorized_payment_id ? String(filaPago.authorized_payment_id) : null;

  if (claveAuth) {
    const { data: existente, error: errorLectura } = await supabase
      .from("plus_pagos_recurrentes")
      .select("id")
      .eq("authorized_payment_id", claveAuth)
      .maybeSingle();
    if (errorLectura) {
      return { ok: false, codigo: "persistencia", detalle: errorLectura.message };
    }
    if (existente?.id) {
      const { error } = await supabase
        .from("plus_pagos_recurrentes")
        .update({ ...filaPago, actualizado_en: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) return { ok: false, codigo: "persistencia", detalle: error.message };
      return { ok: true, id: existente.id, reutilizado: true };
    }
  }

  const { data, error } = await supabase
    .from("plus_pagos_recurrentes")
    .insert(filaPago)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, codigo: "persistencia", detalle: error.message };
  }
  return { ok: true, id: data?.id, reutilizado: false };
}
