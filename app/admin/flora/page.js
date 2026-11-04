import { AvisoFlora, FormularioFlora, MarcoFlora, ResumenFlora } from "@/componentes/admin/flora-marco";
import { leerResumenFlora } from "@/lib/admin/flora";
import { prepararConsultaFlora } from "@/lib/admin/flora-reglas";
import { credencialFlora } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Flora IA",
  robots: { index: false, follow: false },
};

export default async function PaginaFlora({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialFlora();
  const { interpretado, consulta } = prepararConsultaFlora(parametros);
  const resumen = interpretado.ok
    ? await leerResumenFlora(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  return (
    <MarcoFlora
      titulo="Flora IA"
      intro="Uso, tokens y costo estimado. Sin conversaciones, imágenes ni datos del cultivo."
      formulario={<FormularioFlora consulta={consulta} />}
      aviso={AvisoFlora(resumen)}
    >
      {resumen.estado === "listo" ? <ResumenFlora resumen={resumen.resumen} /> : null}
    </MarcoFlora>
  );
}
