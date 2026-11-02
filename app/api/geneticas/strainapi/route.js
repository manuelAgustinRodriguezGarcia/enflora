import { leerJsonAcotado } from "@/lib/push/http";
import { detalleDesdeStrain, slugValido, solicitudDeLaApp } from "@/lib/geneticas/reglas";
import { guardarCopiaStrain } from "@/lib/geneticas/datos";
import { fichaEnStrainApi, permitirBusquedaUsuario } from "@/lib/geneticas/strainapi";
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

export async function POST(request) {
  if (!solicitudDeLaApp(request.headers)) return json({ ok: false, error: "No se pudo guardar la genética." }, 403);
  if (!configuracionLista()) return json({ ok: false, error: "Falta la configuración de Supabase." }, 503);

  const user = await obtenerSesionRapida();
  if (!user?.id) return json({ ok: false, error: "Tenés que iniciar sesión." }, 401);
  if (!permitirBusquedaUsuario(user.id)) {
    return json({ ok: false, error: "Demasiadas búsquedas. Podés seguir con el nombre." }, 429);
  }

  const cuerpo = await leerJsonAcotado(request, 2000);
  const slug = slugValido(cuerpo?.slug);
  if (!slug) return json({ ok: false, error: "La genética no es válida." }, 400);

  const remoto = await fichaEnStrainApi(slug);
  if (!remoto.ok || !remoto.ficha) {
    return json({ ok: false, error: "StrainAPI no responde. Podés seguir con el nombre." }, 503);
  }

  const supabase = await crearClienteServidor();
  const guardado = await guardarCopiaStrain(supabase, user.id, remoto.ficha);
  if (guardado.error) {
    return json({
      ok: false,
      error: guardado.error,
      detalle: detalleDesdeStrain(remoto.ficha, null),
    }, 503);
  }

  return json({ ok: true, detalle: guardado.detalle });
}
