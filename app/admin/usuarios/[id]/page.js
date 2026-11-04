import { notFound } from "next/navigation";
import { AvisoUsuarios, FichaUsuario, MarcoUsuarios, VolverUsuarios } from "@/componentes/admin/usuarios-marco";
import { esUuid } from "@/lib/admin/reglas";
import { leerDetalleUsuario } from "@/lib/admin/usuarios";
import { enlaceUsuarios, prepararConsultaUsuarios } from "@/lib/admin/usuarios-reglas";
import { credencialUsuarios } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ficha de usuario",
  robots: { index: false, follow: false },
};

export default async function PaginaDetalleUsuario({ params, searchParams }) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();
  const credencial = await credencialUsuarios();
  const { consulta } = prepararConsultaUsuarios(parametros);
  const detalle = await leerDetalleUsuario(credencial, id);
  if (detalle.estado === "no_encontrada") notFound();
  return (
    <MarcoUsuarios
      titulo="Ficha de usuario"
      intro="Estadísticas agregadas de una cuenta. El correo sigue enmascarado y no hay datos del cultivo."
      aviso={AvisoUsuarios(detalle)}
    >
      <VolverUsuarios href={enlaceUsuarios(consulta)} />
      {detalle.estado === "listo" ? <FichaUsuario usuario={detalle.usuario} /> : null}
    </MarcoUsuarios>
  );
}
