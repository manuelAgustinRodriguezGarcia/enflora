import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
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

export async function proxy(request) {
  if (!configuracionLista()) {
    return NextResponse.next();
  }

  let respuesta = NextResponse.next({ request });

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
          respuesta = NextResponse.next({ request });
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

  const esRutaPublica = ruta === "/entrar" || ruta === "/registro";

  if (ruta === "/") {
    return redirigir(request, user ? "/espacios" : "/entrar", respuesta);
  }

  if (!user && !esRutaPublica) {
    return redirigir(request, "/entrar", respuesta);
  }

  if (user && esRutaPublica) {
    return redirigir(request, "/espacios", respuesta);
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
