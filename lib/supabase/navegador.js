import { createBrowserClient } from "@supabase/ssr";

let cliente = null;

// Cliente del navegador con la sesión del usuario (anon key + JWT). Nunca usa service role.
export function crearClienteNavegador() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return cliente;
}
