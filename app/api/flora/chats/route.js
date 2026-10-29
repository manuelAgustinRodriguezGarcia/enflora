import {
  contarBibliotecaFloraUsuario,
  contarChatsGuardadosUsuario,
  LIMITES_FLORA_SOLUCIONES,
} from "@/lib/flora-soluciones";
import {
  LIMITES_FLORA_CHATS,
  fusionarReferenciasDesdeMensajesChat,
  validarPayloadGuardarChat,
} from "@/lib/flora-chats-guardados";
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

  const payload = validarPayloadGuardarChat(body);
  if (!payload.ok) return json({ ok: false, error: payload.error }, 400);

  const referencias =
    payload.referencias || fusionarReferenciasDesdeMensajesChat(body?.mensajes) || null;

  const supabase = await crearClienteServidor();
  const ahora = new Date().toISOString();

  const { data: porSesion } = await supabase
    .from("flora_chats_guardados")
    .select("id, titulo")
    .eq("clave_sesion", payload.claveSesion)
    .maybeSingle();

  const idActualizar = payload.chatGuardadoId || porSesion?.id || null;

  if (idActualizar) {
    const { data, error } = await supabase
      .from("flora_chats_guardados")
      .update({
        titulo: payload.titulo,
        primera_pregunta: payload.primeraPregunta,
        mensajes: payload.mensajes,
        referencias,
        cantidad_mensajes: payload.mensajes.length,
        clave_sesion: payload.claveSesion,
        updated_at: ahora,
      })
      .eq("id", idActualizar)
      .eq("usuario_id", usuario.id)
      .select("id, titulo, updated_at, cantidad_mensajes")
      .maybeSingle();

    if (error || !data) {
      return json({ ok: false, error: "No se pudo actualizar el chat guardado." }, 502);
    }

    return json({
      ok: true,
      id: data.id,
      actualizado: true,
      mensaje: "Chat actualizado en tu biblioteca.",
      chat: data,
    });
  }

  const cupo = await contarBibliotecaFloraUsuario(supabase);
  if (!cupo.ok) return json({ ok: false, error: cupo.error }, 502);
  if (cupo.count >= LIMITES_FLORA_CHATS.maxPorUsuarioBiblioteca) {
    return json(
      {
        ok: false,
        error: `Alcanzaste el límite de ${LIMITES_FLORA_CHATS.maxPorUsuarioBiblioteca} elementos en tu biblioteca.`,
      },
      400,
    );
  }

  const chatsCount = await contarChatsGuardadosUsuario(supabase);
  if (!chatsCount.ok) return json({ ok: false, error: chatsCount.error }, 502);
  if (chatsCount.count >= LIMITES_FLORA_CHATS.maxChats) {
    return json(
      {
        ok: false,
        error: `Alcanzaste el límite de ${LIMITES_FLORA_CHATS.maxChats} chats guardados.`,
      },
      400,
    );
  }

  const fila = {
    usuario_id: usuario.id,
    titulo: payload.titulo,
    primera_pregunta: payload.primeraPregunta,
    mensajes: payload.mensajes,
    referencias,
    clave_sesion: payload.claveSesion,
    cantidad_mensajes: payload.mensajes.length,
    created_at: ahora,
    updated_at: ahora,
  };

  const { data, error } = await supabase
    .from("flora_chats_guardados")
    .insert(fila)
    .select("id, titulo, updated_at, cantidad_mensajes")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existente } = await supabase
        .from("flora_chats_guardados")
        .select("id, titulo, updated_at, cantidad_mensajes")
        .eq("clave_sesion", payload.claveSesion)
        .maybeSingle();
      if (existente?.id) {
        return json({
          ok: true,
          id: existente.id,
          duplicado: true,
          mensaje: "Este chat ya estaba guardado.",
          chat: existente,
        });
      }
    }
    return json({ ok: false, error: "No se pudo guardar el chat." }, 502);
  }

  return json({
    ok: true,
    id: data.id,
    mensaje: "Chat guardado en tu biblioteca.",
    chat: data,
  });
}

export async function GET(request) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const url = new URL(request.url);
  const pagina = Math.max(0, Number(url.searchParams.get("pagina")) || 0);
  const limite = Math.min(
    LIMITES_FLORA_CHATS.paginaListado,
    Math.max(1, Number(url.searchParams.get("limite")) || LIMITES_FLORA_CHATS.paginaListado),
  );
  const desde = pagina * limite;
  const hasta = desde + limite - 1;

  const supabase = await crearClienteServidor();
  const { data, error, count } = await supabase
    .from("flora_chats_guardados")
    .select("id, titulo, primera_pregunta, cantidad_mensajes, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(desde, hasta);

  if (error) {
    return json({ ok: false, error: "No se pudieron cargar los chats." }, 502);
  }

  return json({
    ok: true,
    chats: data || [],
    pagina,
    limite,
    total: count ?? 0,
    maxBiblioteca: LIMITES_FLORA_SOLUCIONES.maxPorUsuario,
  });
}
