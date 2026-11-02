import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { esRutaDemo } from "@/lib/acceso-prelanzamiento";
import { destinoAdminPermitido, esRutaPanelAdmin, RUTA_ADMIN, RUTA_ADMIN_EXPO, RUTA_ADMIN_EXPO_LEGADO } from "@/lib/admin/secciones";
import { RUTA_INICIO } from "@/lib/navegacion";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";

// Cookie de ayuda de navegación: "este usuario ya terminó el onboarding". Evita una consulta
// a la base en cada navegación. No es una credencial ni da acceso a nada: solo decide una redirección,
// y está atada al id del usuario (si cambia la sesión, se vuelve a consultar).
const COOKIE_ONBOARDING = "enflora_onb";
const UN_ANIO = 60 * 60 * 24 * 365;

function redirigir(request, pathname, respuesta, search) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (typeof search === "string") url.search = search;
  const redireccion = NextResponse.redirect(url);

  respuesta.cookies.getAll().forEach((cookie) => {
    redireccion.cookies.set(cookie);
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
  if (request.nextUrl.pathname.replace(/\/+$/, "") === RUTA_ADMIN_EXPO_LEGADO) {
    const url = request.nextUrl.clone();
    url.pathname = RUTA_ADMIN_EXPO;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  if (!configuracionLista()) {
    return continuar(request);
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
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

  const ruta = request.nextUrl.pathname;

  // Páginas que no dependen de la sesión: no se gasta ni una verificación.
  if (ruta === "/correo-validado" || ruta === "/correo/confirmar") {
    return respuesta;
  }

  if (ruta === "/") {
    const codigo = request.nextUrl.searchParams.get("code");
    const token = request.nextUrl.searchParams.get("token_hash");
    if (codigo || token) {
      return redirigir(request, "/correo/confirmar", respuesta);
    }
    return respuesta;
  }

  // getClaims verifica la firma del JWT de forma local con las claves públicas del proyecto
  // (firma asimétrica ES256): no hace una llamada de red por navegación como getUser().
  // Renueva la sesión cuando está por vencer y deja las cookies en la respuesta.
  const { data: datosClaims } = await supabase.auth.getClaims();
  const usuarioId = datosClaims?.claims?.sub || null;
  const user = usuarioId ? { id: usuarioId } : null;

  const esRutaPublica = ruta === "/ingreso" || ruta === "/registro";
  const esRutaAbierta =
    ruta === "/partners" ||
    ruta.startsWith("/partners/") ||
    ruta === "/partners-info" ||
    ruta === "/expo-cannabis" ||
    ruta.startsWith("/expo-cannabis/") ||
    esRutaDemo(ruta);

  if (esRutaPanelAdmin(ruta)) {
    if (!user) {
      const destino = destinoAdminPermitido(ruta) || RUTA_ADMIN;
      return redirigir(request, "/ingreso", respuesta, `?siguiente=${encodeURIComponent(destino)}`);
    }
    return respuesta;
  }

  if (esRutaAbierta) {
    return respuesta;
  }

  if (!user && ruta.startsWith("/pagos")) {
    const destino = `${ruta}${request.nextUrl.search}`;
    return redirigir(request, "/ingreso", respuesta, `?siguiente=${encodeURIComponent(destino)}`);
  }

  if (!user && !esRutaPublica) {
    return redirigir(request, "/ingreso", respuesta);
  }

  if (!user) {
    return respuesta;
  }

  // Desde acá hay sesión: se necesita saber si falta el onboarding.
  const onboarding = await estadoOnboarding(request, supabase, user.id);
  if (onboarding.completo && !onboarding.cacheado) {
    respuesta.cookies.set(COOKIE_ONBOARDING, user.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: UN_ANIO,
    });
  }
  const pendiente = onboarding.pendiente;
  const destino = pendiente ? "/onboarding" : RUTA_INICIO;

  if (esRutaPublica) {
    return redirigir(request, destino, respuesta);
  }

  if (pendiente && ruta !== "/onboarding" && !ruta.startsWith("/pagos") && !esRutaDemo(ruta)) {
    return redirigir(request, "/onboarding", respuesta);
  }

  if (!pendiente && ruta === "/onboarding") {
    return redirigir(request, RUTA_INICIO, respuesta);
  }

  return respuesta;
}

async function estadoOnboarding(request, supabase, usuarioId) {
  if (request.cookies.get(COOKIE_ONBOARDING)?.value === usuarioId) {
    return { pendiente: false, completo: true, cacheado: true };
  }

  const { data, error } = await supabase
    .from("perfiles")
    .select("tipo_seguimiento")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error || !data) return { pendiente: false, completo: false, cacheado: false };
  if (esTipoSeguimiento(data.tipo_seguimiento)) {
    return { pendiente: false, completo: true, cacheado: false };
  }

  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (errorEspacio || !espacio) return { pendiente: false, completo: false, cacheado: false };
  return { pendiente: true, completo: false, cacheado: false };
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
