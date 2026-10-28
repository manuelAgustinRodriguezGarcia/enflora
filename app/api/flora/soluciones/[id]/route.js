import { validarTituloSolucion, uuidSolucionOpcional } from "@/lib/flora-soluciones";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function GET(_request, { params }) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const { id: idParam } = await params;
  const idVal = uuidSolucionOpcional(idParam, "id");
  if (!idVal.ok) return json({ ok: false, error: idVal.error }, 400);

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("flora_soluciones")
    .select(
      "id, titulo, pregunta, respuesta, referencias, unidad_cultivo_id, planta_id, fecha_respuesta, created_at, updated_at",
    )
    .eq("id", idVal.valor)
    .maybeSingle();

  if (error || !data) {
    return json({ ok: false, error: "Solución no encontrada." }, 404);
  }

  return json({ ok: true, solucion: data });
}

export async function PATCH(request, { params }) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const { id: idParam } = await params;
  const idVal = uuidSolucionOpcional(idParam, "id");
  if (!idVal.ok) return json({ ok: false, error: idVal.error }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Datos inválidos." }, 400);
  }

  const tituloVal = validarTituloSolucion(body?.titulo);
  if (!tituloVal.ok) return json({ ok: false, error: tituloVal.error }, 400);

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("flora_soluciones")
    .update({ titulo: tituloVal.valor, updated_at: new Date().toISOString() })
    .eq("id", idVal.valor)
    .select("id, titulo")
    .maybeSingle();

  if (error || !data) {
    return json({ ok: false, error: "No se pudo actualizar el título." }, 404);
  }

  return json({ ok: true, solucion: data });
}

export async function DELETE(_request, { params }) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const { id: idParam } = await params;
  const idVal = uuidSolucionOpcional(idParam, "id");
  if (!idVal.ok) return json({ ok: false, error: idVal.error }, 400);

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("flora_soluciones").delete().eq("id", idVal.valor);

  if (error) {
    return json({ ok: false, error: "No se pudo eliminar la solución." }, 502);
  }

  return json({ ok: true });
}
