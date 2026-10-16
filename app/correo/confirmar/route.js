import { NextResponse } from "next/server";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function redirigirSinIndexar(destino) {
  const respuesta = NextResponse.redirect(destino);
  respuesta.headers.set("X-Robots-Tag", "noindex, nofollow");
  return respuesta;
}

export async function GET(request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const token = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");
  const exito = new URL("/correo-validado", url.origin);
  const ingreso = new URL("/ingreso", url.origin);

  if (!codigo && !token) {
    return redirigirSinIndexar(ingreso);
  }

  if (!configuracionLista()) {
    return redirigirSinIndexar(ingreso);
  }

  const supabase = await crearClienteServidor();
  const resultado = codigo
    ? await supabase.auth.exchangeCodeForSession(codigo)
    : await supabase.auth.verifyOtp({ token_hash: token, type: tipo });

  if (resultado.error) {
    return redirigirSinIndexar(ingreso);
  }

  await supabase.auth.signOut();
  return redirigirSinIndexar(exito);
}
