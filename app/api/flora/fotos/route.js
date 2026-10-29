import { listarFotosGaleriaFlora, listarUnidadesGaleriaFlora } from "@/lib/flora-galeria-fotos-servidor";
import { configuracionLista } from "@/lib/supabase/configuracion";
import {
  crearClienteServidor,
  obtenerUsuario,
  sincronizarSesionParaLectura,
} from "@/lib/supabase/servidor";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function GET(request) {
  if (!configuracionLista()) {
    return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);
  }

  const usuario = await obtenerUsuario();
  if (!usuario?.id) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const supabase = await crearClienteServidor();
  const sesion = await sincronizarSesionParaLectura(supabase);
  if (!sesion.ok) {
    return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  }

  const url = new URL(request.url);
  const incluirUnidades = url.searchParams.get("unidades") === "1";

  const listado = await listarFotosGaleriaFlora(supabase, usuario.id, {
    limite: url.searchParams.get("limite"),
    cursorFecha: url.searchParams.get("cursor_fecha"),
    cursorId: url.searchParams.get("cursor_id"),
    unidadId: url.searchParams.get("unidad_id"),
    busqueda: url.searchParams.get("busqueda"),
    fechaDesde: url.searchParams.get("fecha_desde"),
    fechaHasta: url.searchParams.get("fecha_hasta"),
  });

  if (!listado.ok) {
    return json({ ok: false, error: listado.error || "No se pudieron cargar las fotos." }, 502);
  }

  let unidades = undefined;
  if (incluirUnidades) {
    const unidadesResp = await listarUnidadesGaleriaFlora(supabase);
    if (unidadesResp.ok) {
      unidades = unidadesResp.unidades;
    }
  }

  return json({
    ok: true,
    fotos: listado.fotos,
    hay_mas: listado.hay_mas,
    cursor: listado.cursor,
    beneficios: listado.beneficios,
    limite: listado.limite,
    sin_coincidencias: listado.sin_coincidencias,
    sin_fotos_cuenta: listado.sin_fotos_cuenta,
    hay_filtros: listado.hay_filtros,
    unidades,
  });
}
