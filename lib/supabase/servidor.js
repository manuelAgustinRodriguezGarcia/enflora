import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
