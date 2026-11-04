import { headers } from "next/headers";
import { EnlacePerfilCliente } from "@/componentes/enlace-perfil-cliente";
import { leerEncabezadoPerfil } from "@/lib/perfil/inicial-encabezado";
import { esRutaApp } from "@/lib/navegacion";

export async function EnlacePerfil({ usuarioId, email }) {
  const ruta = (await headers()).get("x-enflora-ruta") || "";
  if (!usuarioId || !esRutaApp(ruta)) return null;

  const { inicial, avatar } = await leerEncabezadoPerfil(usuarioId, email);
  return <EnlacePerfilCliente inicial={inicial} avatar={avatar} />;
}
