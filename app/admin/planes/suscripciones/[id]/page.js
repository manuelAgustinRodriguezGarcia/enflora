import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoEstado, MarcoPlanes } from "@/componentes/admin/planes-marco";
import { DetalleSuscripcion } from "@/componentes/admin/planes-tablas";
import { leerDetalleSuscripcionPlanes } from "@/lib/admin/planes";
import { esUuid } from "@/lib/admin/reglas";
import { enlacesPlanes, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle de suscripción",
  robots: { index: false, follow: false },
};

export default async function PaginaDetalleSuscripcion({ params, searchParams }) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();
  const credencial = await credencialPlanes();
  const { consulta } = prepararConsultaPlanes(parametros);
  const detalle = await leerDetalleSuscripcionPlanes(credencial, id);
  if (detalle.estado === "no_encontrada") notFound();
  return (
    <MarcoPlanes
      titulo="Detalle de suscripción"
      intro="Solo lectura. No hay botones para cancelar, reactivar, renovar ni cambiar el precio."
      actual="suscripciones"
      enlaces={enlacesPlanes(consulta)}
      aviso={AvisoEstado(detalle)}
    >
      <p>
        <Link href={`/admin/planes/suscripciones?${parametrosConsulta(consulta)}`}>Volver a suscripciones</Link>
      </p>
      {detalle.estado === "listo" ? (
        <DetalleSuscripcion suscripcion={detalle.suscripcion} pagos={detalle.pagos} pagosRecortados={detalle.pagosRecortados} />
      ) : null}
    </MarcoPlanes>
  );
}
