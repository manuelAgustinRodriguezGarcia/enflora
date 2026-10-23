import "server-only";
import { esAdministradorExpo } from "@/lib/expo-cannabis/admin";
import { solicitudMismoOrigen } from "@/lib/push/http";
import { usuarioAdminPush } from "@/lib/push/reglas";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export async function administradorPush(request) {
  if (!solicitudMismoOrigen(request.headers)) return null;
  try {
    const usuario = await obtenerUsuario();
    return usuarioAdminPush(usuario, esAdministradorExpo) ? usuario : null;
  } catch {
    return null;
  }
}
