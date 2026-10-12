import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";

function redirigir(request, pathname, respuesta) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redireccion = NextResponse.redirect(url);

  respuesta.cookies.getAll().forEach((cookie) => {
    redireccion.cookies.set(cookie.name, cookie.value);
  });

  return redireccion;
}

function continuar(request) {
  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-enflora-ruta", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: cabeceras },
  });
}

export async function proxy(request) {
  if (!configuracionLista()) {
    return continuar(request);
  }

  let respuesta = continuar(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesAGuardar) {
          cookiesAGuardar.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          respuesta = continuar(request);
          cookiesAGuardar.forEach(({ name, value, options }) => {
            respuesta.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;

  if (ruta === "/correo-validado" || ruta === "/correo/confirmar") {
    return respuesta;
  }

  const esRutaPublica = ruta === "/ingreso" || ruta === "/registro";
  const pendiente = user ? await onboardingPendiente(supabase, user.id) : false;
  const destino = pendiente ? "/onboarding" : "/espacios";

  if (ruta === "/") {
    const codigo = request.nextUrl.searchParams.get("code");
    const token = request.nextUrl.searchParams.get("token_hash");
    if (codigo || token) {
      return redirigir(request, "/correo/confirmar", respuesta);
    }
    return respuesta;
  }

  if (!user && !esRutaPublica) {
    return redirigir(request, "/ingreso", respuesta);
  }

  if (user && esRutaPublica) {
    return redirigir(request, destino, respuesta);
  }

  if (user && pendiente && ruta !== "/onboarding") {
    return redirigir(request, "/onboarding", respuesta);
  }

  if (user && !pendiente && ruta === "/onboarding") {
    return redirigir(request, "/espacios", respuesta);
  }

  return respuesta;
}

async function onboardingPendiente(supabase, usuarioId) {
  const { data, error } = await supabase
    .from("perfiles")
    .select("tipo_seguimiento")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error || !data || esTipoSeguimiento(data.tipo_seguimiento)) return false;

  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (errorEspacio || !espacio) return false;
  return true;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
