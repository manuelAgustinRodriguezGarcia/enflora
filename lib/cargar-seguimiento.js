import { esTipoSeguimiento } from "@/lib/seguimiento";

export async function cargarSeguimiento(supabase, usuarioId, tipo) {
  if (esTipoSeguimiento(tipo)) {
    const asegurado = await supabase.rpc("asegurar_preferencias_seguimiento");
    if (asegurado.error) {
      return { error: true };
    }
  }

  const [preferencias, opciones] = await Promise.all([
    supabase
      .from("preferencias_seguimiento")
      .select("acciones, parametros")
      .eq("usuario_id", usuarioId)
      .maybeSingle(),
    supabase
      .from("opciones_seguimiento_personalizadas")
      .select("id, categoria, nombre, tipo_valor, unidad, prioritaria, activa")
      .eq("usuario_id", usuarioId)
      .eq("activa", true)
      .order("fecha_creacion"),
  ]);

  if (preferencias.error || opciones.error) {
    return { error: true };
  }

  return {
    error: false,
    acciones: preferencias.data?.acciones || [],
    parametros: preferencias.data?.parametros || [],
    opciones: opciones.data || [],
  };
}
