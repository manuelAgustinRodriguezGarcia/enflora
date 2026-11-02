import { armarBusqueda, solicitudDeLaApp, validarConsulta } from "@/lib/geneticas/reglas";
import { buscarGeneticasPropias } from "@/lib/geneticas/datos";
import { buscarEnStrainApi, permitirBusquedaUsuario } from "@/lib/geneticas/strainapi";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request) {
  if (!solicitudDeLaApp(request.headers)) return json({ ok: false, error: "No se pudo buscar." }, 403);
  if (!configuracionLista()) return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);

  const user = await obtenerSesionRapida();
  if (!user?.id) return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);

  const consulta = validarConsulta(new URL(request.url).searchParams.get("q"));
  if (!consulta.ok) return json({ ok: false, error: "Escribí al menos 2 letras." }, 400);

  const supabase = await crearClienteServidor();
  const propias = await buscarGeneticasPropias(supabase, user.id, consulta.texto);
  const locales = Array.isArray(propias) ? propias : [];

  const puedeExterno = permitirBusquedaUsuario(user.id);
  const remoto = puedeExterno ? await buscarEnStrainApi(consulta.texto) : null;
  const respuesta = armarBusqueda(locales, remoto);

  return json({ ok: true, ...respuesta });
}
