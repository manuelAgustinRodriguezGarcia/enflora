import {
  claveUnicaTurnoGuardado,
  contarSolucionesUsuario,
  LIMITES_FLORA_SOLUCIONES,
  validarTextosGuardado,
  validarTituloSolucion,
  verificarTokenProcedenciaSolucion,
} from "@/lib/flora-soluciones";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
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

  const textos = validarTextosGuardado({
    pregunta: body?.pregunta,
    respuesta: body?.respuesta,
  });
  if (!textos.ok) return json({ ok: false, error: textos.error }, 400);

  const tituloVal = validarTituloSolucion(body?.titulo);
  if (!tituloVal.ok) return json({ ok: false, error: tituloVal.error }, 400);

  const tokenOk = verificarTokenProcedenciaSolucion(
    body?.tokenProcedencia,
    usuario.id,
    textos.pregunta,
    textos.respuesta,
  );
  if (!tokenOk.ok) return json({ ok: false, error: tokenOk.error }, 400);

  const supabase = await crearClienteServidor();
  const claveTurno = claveUnicaTurnoGuardado(textos.pregunta, textos.respuesta);

  const { data: existente } = await supabase
    .from("flora_soluciones")
    .select("id, titulo")
    .eq("clave_unica_turno", claveTurno)
    .maybeSingle();

  if (existente?.id) {
    return json({
      ok: true,
      id: existente.id,
      duplicado: true,
      mensaje: "Esta respuesta ya estaba guardada.",
    });
  }

  const cupo = await contarSolucionesUsuario(supabase);
  if (!cupo.ok) return json({ ok: false, error: cupo.error }, 502);
  if (cupo.count >= LIMITES_FLORA_SOLUCIONES.maxPorUsuario) {
    return json(
      {
        ok: false,
        error: `Alcanzaste el límite de ${LIMITES_FLORA_SOLUCIONES.maxPorUsuario} soluciones guardadas.`,
      },
      400,
    );
  }

  let referencias = body?.referencias;
  if (referencias !== null && referencias !== undefined && typeof referencias !== "object") {
    referencias = null;
  }

  let unidadCultivoId = body?.unidadCultivoId || body?.unidad_cultivo_id || null;
  let plantaId = body?.plantaId || body?.planta_id || null;
  if (unidadCultivoId && typeof unidadCultivoId === "string") unidadCultivoId = unidadCultivoId.trim() || null;
  if (plantaId && typeof plantaId === "string") plantaId = plantaId.trim() || null;

  const fechaRespuesta = body?.fechaRespuesta
    ? new Date(body.fechaRespuesta).toISOString()
    : new Date().toISOString();

  const fila = {
    usuario_id: usuario.id,
    titulo: tituloVal.valor,
    pregunta: textos.pregunta,
    respuesta: textos.respuesta,
    referencias: referencias || null,
    unidad_cultivo_id: unidadCultivoId,
    planta_id: plantaId,
    fecha_respuesta: fechaRespuesta,
    clave_unica_turno: claveTurno,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("flora_soluciones").insert(fila).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return json({ ok: true, duplicado: true, mensaje: "Esta respuesta ya estaba guardada." });
    }
    return json({ ok: false, error: "No se pudo guardar la solución." }, 502);
  }

  return json({
    ok: true,
    id: data.id,
    mensaje: "Solución guardada en tu biblioteca.",
  });
}
