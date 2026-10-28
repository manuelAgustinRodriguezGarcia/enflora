import { listarFotosGaleriaFlora } from "@/lib/flora-imagen-servidor";
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
  const listado = await listarFotosGaleriaFlora(supabase);
  if (!listado.ok) {
    return json({ ok: false, error: listado.error || "No se pudieron cargar las fotos." }, 502);
  }

  return json({ ok: true, fotos: listado.fotos });
}
