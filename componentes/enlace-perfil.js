import { EnlacePerfilCliente } from "@/componentes/enlace-perfil-cliente";
import { leerEncabezadoPerfil } from "@/lib/perfil/inicial-encabezado";

export async function EnlacePerfil({ usuarioId, email }) {
  if (!usuarioId) return <EnlacePerfilCliente consultar />;

  try {
    const { inicial, avatar } = await leerEncabezadoPerfil(usuarioId, email);
    return <EnlacePerfilCliente inicial={inicial} avatar={avatar} resuelto />;
  } catch {
    return <EnlacePerfilCliente consultar />;
  }
}
