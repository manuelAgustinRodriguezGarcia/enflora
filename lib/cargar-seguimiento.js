import { accionesOfrecibles, esTipoSeguimiento } from "@/lib/seguimiento";

// Lee preferencias y opciones personalizadas en paralelo, sin crear nada.
// Devuelve preferencias: null si el usuario todavía no tiene fila.
export async function leerSeguimiento(supabase, usuarioId) {
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
    preferencias: preferencias.data || null,
    opciones: opciones.data || [],
  };
}

export function seguimientoDesdeLectura(lectura) {
  return {
    error: false,
    // Foto y Nota ya no son acciones: se ignoran en las preferencias guardadas.
    acciones: accionesOfrecibles(lectura.preferencias?.acciones),
    parametros: lectura.preferencias?.parametros || [],
    opciones: lectura.opciones,
  };
}

export async function cargarSeguimiento(supabase, usuarioId, tipo) {
  if (esTipoSeguimiento(tipo)) {
    const asegurado = await supabase.rpc("asegurar_preferencias_seguimiento");
    if (asegurado.error) {
      return { error: true };
    }
  }

  const lectura = await leerSeguimiento(supabase, usuarioId);
  if (lectura.error) {
    return { error: true };
  }

  return seguimientoDesdeLectura(lectura);
}
