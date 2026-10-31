import "server-only";
import { obtenerAdminExpo, verificarAdminExpo } from "@/lib/expo-cannabis/admin";
import { solicitudMismoOrigen } from "@/lib/push/http";

export async function administradorPush(request) {
  if (!solicitudMismoOrigen(request.headers)) return null;
  try {
    // La identidad sale de Supabase Auth (getUser) y exige cuenta no anónima con correo confirmado.
    const resultado = await obtenerAdminExpo();
    if (!resultado.ok) return null;
    const { id } = verificarAdminExpo(resultado.credencial);
    return { id };
  } catch {
    return null;
  }
}
