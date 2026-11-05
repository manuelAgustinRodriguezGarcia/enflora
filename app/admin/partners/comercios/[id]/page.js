import { notFound } from "next/navigation";
import Link from "next/link";
import { BotonesComercio, FormularioComercio } from "@/componentes/admin/partners-formularios";
import { AvisoPartners, MarcoPartners } from "@/componentes/admin/partners-marco";
import { leerDetalleComercio } from "@/lib/admin/partners";
import { esUuid } from "@/lib/admin/reglas";
import { textoInstante } from "@/componentes/admin/formato-dashboard";
import { credencialPartners } from "../../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comercio", robots: { index: false, follow: false } };

export default async function PaginaComercio({ params }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const credencial = await credencialPartners();
  const detalle = await leerDetalleComercio(credencial, id);
  if (detalle.estado === "no_encontrado") notFound();
  const comercio = detalle.ficha;
  return (
    <MarcoPartners titulo="Comercio" intro="Datos comerciales públicos y el historial de cambios. Sin notas de otras bandejas." aviso={AvisoPartners(detalle)}>
      <p><Link href="/admin/partners/comercios">Volver al listado</Link></p>
      {detalle.estado === "listo" ? (
        <>
          <BotonesComercio id={comercio.id} revision={comercio.estado_revision} activo={comercio.activo} />
          <FormularioComercio comercio={comercio} />
          <h2>Historial</h2>
          {comercio.historial?.length ? (
            <ul>
              {comercio.historial.map((item) => (
                <li key={`${item.accion}-${item.creada_en}`}>
                  {item.accion}: {item.antes || "—"} → {item.despues || "—"} ({textoInstante(item.creada_en)})
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-dash__aclaracion">Todavía no hay cambios registrados.</p>
          )}
        </>
      ) : null}
    </MarcoPartners>
  );
}
