import { NextResponse } from "next/server";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET(request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  const token = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");
  const exito = new URL("/correo-validado", url.origin);
  const ingreso = new URL("/ingreso", url.origin);

  if (!codigo && !token) {
    return NextResponse.redirect(ingreso);
  }

  if (!configuracionLista()) {
    return NextResponse.redirect(ingreso);
  }

  const supabase = await crearClienteServidor();
  const resultado = codigo
    ? await supabase.auth.exchangeCodeForSession(codigo)
    : await supabase.auth.verifyOtp({ token_hash: token, type: tipo });

  if (resultado.error) {
    return NextResponse.redirect(ingreso);
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(exito);
}
