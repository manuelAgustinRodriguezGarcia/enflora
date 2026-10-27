import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { configuracionLista } from "@/lib/supabase/configuracion";

export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesAGuardar) {
          try {
            cookiesAGuardar.forEach(({ name, value, options }) => {
              almacenCookies.set(name, value, options);
            });
          } catch {
            return;
          }
        },
      },
    }
  );
}

// Verificación estricta: consulta al servidor de Auth (una llamada de red). Reservada para
// operaciones sensibles (pagos, administración) donde conviene confirmar que la cuenta sigue vigente.
export async function obtenerUsuario() {
  if (!configuracionLista()) {
    return null;
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

// Verificación rápida para leer pantallas: valida la firma y el vencimiento del JWT de forma
// local (el proyecto usa claves de firma asimétricas), sin ir hasta Auth. Los datos igual quedan
// protegidos por RLS, que se evalúa con ese mismo JWT en Postgres. Devuelve { id, email, esAnonimo }.
// React.cache evita repetir la verificación entre layout, página y acciones del mismo request.
export const obtenerSesionRapida = cache(async () => {
  if (!configuracionLista()) {
    return null;
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email || null,
    esAnonimo: Boolean(claims.is_anonymous),
  };
});
