import { notFound } from "next/navigation";
import Link from "next/link";
import { FormularioSolicitud } from "@/componentes/admin/partners-formularios";
import { AvisoPartners, MarcoPartners } from "@/componentes/admin/partners-marco";
import { leerDetalleSolicitud } from "@/lib/admin/partners";
import { esUuid } from "@/lib/admin/reglas";
import { textoInstante } from "@/componentes/admin/formato-dashboard";
import { credencialPartners } from "../../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud comercial", robots: { index: false, follow: false } };

export default async function PaginaSolicitud({ params }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const credencial = await credencialPartners();
  const detalle = await leerDetalleSolicitud(credencial, id);
  if (detalle.estado === "no_encontrado") notFound();
  const solicitud = detalle.ficha;
  return (
    <MarcoPartners titulo="Solicitud" intro="Contacto comercial para responder la propuesta. La nota interna no sale al sitio público." aviso={AvisoPartners(detalle)}>
      <p><Link href="/admin/partners/solicitudes">Volver a solicitudes</Link></p>
      {detalle.estado === "listo" ? (
        <>
          <dl>
            <dt>Comercio</dt>
            <dd>{solicitud.comercio}</dd>
            <dt>Persona</dt>
            <dd>{solicitud.representante}</dd>
            <dt>Correo</dt>
            <dd>{solicitud.correo}</dd>
            <dt>Medio</dt>
            <dd>{solicitud.sitio || "No informado"}</dd>
            <dt>Rubro</dt>
            <dd>{solicitud.rubro || "No informado"}</dd>
            <dt>Plan</dt>
            <dd>{solicitud.plan}</dd>
            <dt>Recibida</dt>
            <dd>{textoInstante(solicitud.recibida_en)}</dd>
            <dt>Actualizada</dt>
            <dd>{textoInstante(solicitud.actualizada_en)}</dd>
          </dl>
          <h2>Mensaje</h2>
          <p>{solicitud.mensaje || "Sin mensaje"}</p>
          <FormularioSolicitud solicitud={solicitud} />
        </>
      ) : null}
    </MarcoPartners>
  );
}
