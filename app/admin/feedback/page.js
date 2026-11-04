import {
  AvisoFeedback,
  ContadoresFeedback,
  FormularioFeedbackAdmin,
  MarcoFeedback,
  PaginacionFeedback,
  TablaFeedback,
} from "@/componentes/admin/feedback-marco";
import { leerListadoFeedback } from "@/lib/admin/feedback";
import { enlaceDetalleFeedback, enlaceFeedback, prepararConsultaFeedback } from "@/lib/admin/feedback-reglas";
import { credencialFeedback } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default async function PaginaFeedbackAdmin({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialFeedback();
  const { interpretado, consulta } = prepararConsultaFeedback(parametros);
  const listado = interpretado.ok
    ? await leerListadoFeedback(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };

  return (
    <MarcoFeedback
      titulo="Feedback"
      intro="Sugerencias y reportes de la aplicación. Sin cultivos, conversaciones ni fotografías."
      formulario={<FormularioFeedbackAdmin consulta={consulta} />}
      aviso={AvisoFeedback(listado)}
    >
      {listado.estado === "listo" ? (
        <>
          <ContadoresFeedback contadores={listado.contadores} />
          <TablaFeedback
            filas={listado.filas.map((fila) => ({ ...fila, href: enlaceDetalleFeedback(consulta, fila.id) }))}
          />
          <PaginacionFeedback
            anterior={listado.pagina > 1 ? enlaceFeedback(consulta, listado.pagina - 1) : ""}
            siguiente={listado.pagina < listado.paginas ? enlaceFeedback(consulta, listado.pagina + 1) : ""}
            pagina={listado.pagina}
            paginas={listado.paginas}
            total={listado.total}
          />
        </>
      ) : null}
    </MarcoFeedback>
  );
}
