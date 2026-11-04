import { AvisoAlmacenamiento, FormularioAlmacenamiento, MarcoAlmacenamiento, ResumenAlmacenamiento } from "@/componentes/admin/almacenamiento-marco";
import { leerResumenAlmacenamiento } from "@/lib/admin/almacenamiento";
import { prepararConsultaAlmacenamiento } from "@/lib/admin/almacenamiento-reglas";
import { credencialAlmacenamiento } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Almacenamiento",
  robots: { index: false, follow: false },
};

export default async function PaginaAlmacenamiento({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialAlmacenamiento();
  const { interpretado, consulta } = prepararConsultaAlmacenamiento(parametros);
  const resumen = interpretado.ok
    ? await leerResumenAlmacenamiento(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  return (
    <MarcoAlmacenamiento
      titulo="Almacenamiento"
      intro="Ocupación real de los archivos en Supabase Storage. Sin fotografías, rutas ni descargas."
      formulario={<FormularioAlmacenamiento consulta={consulta} />}
      aviso={AvisoAlmacenamiento(resumen)}
    >
      {resumen.estado === "listo" ? <ResumenAlmacenamiento resumen={resumen.resumen} /> : null}
    </MarcoAlmacenamiento>
  );
}
