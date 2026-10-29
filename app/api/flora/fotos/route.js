import { listarFotosGaleriaFlora } from "@/lib/flora-imagen-servidor";
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
  const pagina = Math.max(0, Number(url.searchParams.get("pagina")) || 0);
  const limite = Math.min(100, Math.max(1, Number(url.searchParams.get("limite")) || 48));

  const listado = await listarFotosGaleriaFlora(supabase, { pagina, limite });
  if (!listado.ok) {
    return json({ ok: false, error: listado.error || "No se pudieron cargar las fotos." }, 502);
  }

  return json({
    ok: true,
    fotos: listado.fotos,
    total: listado.total,
    pagina: listado.pagina,
    limite: listado.limite,
  });
}
