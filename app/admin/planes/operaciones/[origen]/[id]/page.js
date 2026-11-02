import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoEstado, MarcoPlanes } from "@/componentes/admin/planes-marco";
import { DetalleOperacion } from "@/componentes/admin/planes-tablas";
import { leerDetalleOperacionPlanes } from "@/lib/admin/planes";
import { esUuid } from "@/lib/admin/reglas";
import { enlacesPlanes, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../../../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle de operación",
  robots: { index: false, follow: false },
};

export default async function PaginaDetalleOperacion({ params, searchParams }) {
  const { origen, id } = await params;
  const parametros = await searchParams;
  if ((origen !== "plus" && origen !== "cultivo") || !esUuid(id)) notFound();
  const credencial = await credencialPlanes();
  const { consulta } = prepararConsultaPlanes(parametros);
  const detalle = await leerDetalleOperacionPlanes(credencial, origen, id);
  if (detalle.estado === "no_encontrada") notFound();
  return (
    <MarcoPlanes
      titulo="Detalle de operación"
      intro="Vista de solo lectura. No hay acciones de cobro, reembolso ni cambio de estado."
      actual="operaciones"
      enlaces={enlacesPlanes(consulta)}
      aviso={AvisoEstado(detalle)}
    >
      <p>
        <Link href={`/admin/planes/operaciones?${parametrosConsulta(consulta)}`}>Volver al historial</Link>
      </p>
      {detalle.estado === "listo" ? <DetalleOperacion operacion={detalle.operacion} /> : null}
    </MarcoPlanes>
  );
}
