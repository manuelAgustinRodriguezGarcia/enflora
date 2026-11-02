import { FormularioPlanes, MarcoPlanes, AvisoEstado } from "@/componentes/admin/planes-marco";
import { ResumenPlanes } from "@/componentes/admin/planes-resumen";
import { leerResumenPlanes } from "@/lib/admin/planes";
import { enlacesPlanes, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planes e ingresos",
  robots: { index: false, follow: false },
};

export default async function PaginaPlanes({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPlanes();
  const { interpretado, consulta } = prepararConsultaPlanes(parametros);
  const resumen = interpretado.ok ? await leerResumenPlanes(credencial, consulta) : { ok: false, estado: "consulta", error: interpretado.error };
  return (
    <MarcoPlanes
      titulo="Planes e ingresos"
      intro="Lectura de suscripciones, licencias y cobros. No cancela, no cobra y no modifica precios."
      actual="resumen"
      enlaces={enlacesPlanes(consulta)}
      formulario={<FormularioPlanes destino="/admin/planes" consulta={consulta} variante="resumen" />}
      aviso={AvisoEstado(resumen)}
    >
      {resumen.estado === "listo" ? <ResumenPlanes resumen={resumen.resumen} /> : null}
    </MarcoPlanes>
  );
}
