import { notFound } from "next/navigation";
import { AvisoNotificaciones, FichaCampana, MarcoNotificaciones } from "@/componentes/admin/notificaciones-marco";
import { leerDetalleCampana } from "@/lib/admin/notificaciones";
import { enlaceNotificaciones, idCampanaValido, prepararConsultaNotificaciones } from "@/lib/admin/notificaciones-reglas";
import { credencialNotificaciones } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campaña",
  robots: { index: false, follow: false },
};

export default async function PaginaCampana({ params, searchParams }) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!idCampanaValido(id)) notFound();
  const credencial = await credencialNotificaciones();
  const { consulta } = prepararConsultaNotificaciones(parametros);
  const detalle = await leerDetalleCampana(credencial, id);
  if (detalle.estado === "no_encontrada") notFound();
  return (
    <MarcoNotificaciones
      titulo="Campaña"
      intro="Resultado agregado de una campaña. Sin texto del aviso, destino ni dispositivos."
      aviso={AvisoNotificaciones(detalle)}
    >
      <p>
        <a href={enlaceNotificaciones(consulta)}>Volver a notificaciones</a>
      </p>
      {detalle.estado === "listo" ? <FichaCampana campana={detalle.campana} /> : null}
    </MarcoNotificaciones>
  );
}
