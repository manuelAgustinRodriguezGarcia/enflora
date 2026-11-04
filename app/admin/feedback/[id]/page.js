import { notFound } from "next/navigation";
import { AvisoFeedback, FichaFeedback, MarcoFeedback, VolverFeedback } from "@/componentes/admin/feedback-marco";
import { GestionFeedback } from "@/componentes/admin/feedback-gestion";
import { esUuid } from "@/lib/admin/reglas";
import { leerDetalleFeedback } from "@/lib/admin/feedback";
import { enlaceFeedback, prepararConsultaFeedback } from "@/lib/admin/feedback-reglas";
import { credencialFeedback } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detalle de feedback",
  robots: { index: false, follow: false },
};

export default async function PaginaDetalleFeedback({ params, searchParams }) {
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();
  const credencial = await credencialFeedback();
  const { consulta } = prepararConsultaFeedback(parametros);
  const detalle = await leerDetalleFeedback(credencial, id);
  if (detalle.estado === "no_encontrado") notFound();

  return (
    <MarcoFeedback
      titulo="Detalle de feedback"
      intro="El mensaje completo y la nota interna. El correo sigue enmascarado."
      aviso={AvisoFeedback(detalle)}
    >
      <VolverFeedback href={enlaceFeedback(consulta)} />
      {detalle.estado === "listo" ? (
        <>
          <FichaFeedback feedback={detalle.feedback} />
          <GestionFeedback feedback={detalle.feedback} />
        </>
      ) : null}
    </MarcoFeedback>
  );
}
