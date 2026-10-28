import {
  leerPersonalidadFloraUsuario,
  normalizarPersonalidadFlora,
  PERSONALIDADES_FLORA,
} from "@/lib/flora-personalidad";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function GET() {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const supabase = await crearClienteServidor();
  const personalidad = await leerPersonalidadFloraUsuario(supabase);

  return json({
    ok: true,
    personalidad,
    opciones: PERSONALIDADES_FLORA.map(({ id, nombre, descripcion, ejemplo }) => ({
      id,
      nombre,
      descripcion,
      ejemplo,
    })),
  });
}

export async function PUT(request) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Datos inválidos." }, 400);
  }

  const entrada = String(body?.personalidad ?? "").trim();
  if (!entrada || !PERSONALIDADES_FLORA.some((p) => p.id === entrada)) {
    return json({ ok: false, error: "Elegí una personalidad válida." }, 400);
  }

  const { valor: personalidad } = normalizarPersonalidadFlora(entrada);
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("preferencias_flora").upsert(
    {
      usuario_id: usuario.id,
      personalidad,
      fecha_actualizacion: new Date().toISOString(),
    },
    { onConflict: "usuario_id" },
  );

  if (error) {
    return json({ ok: false, error: "No se pudo guardar la preferencia." }, 502);
  }

  return json({ ok: true, personalidad, mensaje: "Preferencia de Flora actualizada." });
}
