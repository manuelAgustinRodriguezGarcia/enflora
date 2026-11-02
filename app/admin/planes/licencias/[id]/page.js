import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoEstado, MarcoPlanes } from "@/componentes/admin/planes-marco";
import { DetalleLicencia } from "@/componentes/admin/planes-tablas";
import { leerDetalleLicenciaPlanes } from "@/lib/admin/planes";
import { esUuid } from "@/lib/admin/reglas";
import { enlacesPlanes, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle de licencia",
  robots: { index: false, follow: false },
};

export default async function PaginaDetalleLicencia({ params, searchParams }) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();
  const credencial = await credencialPlanes();
  const { consulta } = prepararConsultaPlanes(parametros);
  const detalle = await leerDetalleLicenciaPlanes(credencial, id);
  if (detalle.estado === "no_encontrada") notFound();
  return (
    <MarcoPlanes
      titulo="Detalle de licencia"
      intro="Solo lectura. No se revoca la licencia ni se modifica el pago."
      actual="licencias"
      enlaces={enlacesPlanes(consulta)}
      aviso={AvisoEstado(detalle)}
    >
      <p>
        <Link href={`/admin/planes/licencias?${parametrosConsulta(consulta)}`}>Volver a licencias</Link>
      </p>
      {detalle.estado === "listo" ? <DetalleLicencia licencia={detalle.licencia} /> : null}
    </MarcoPlanes>
  );
}
