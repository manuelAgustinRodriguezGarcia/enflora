import { redirect } from "next/navigation";
import { DatosEstructurados } from "@/componentes/datos-estructurados";
import { Landing } from "@/componentes/landing/landing";
import { obtenerCotizacionOficial } from "@/lib/cotizacion";
import { DESCRIPCION_INICIO, metadatosPublicos, TITULO_INICIO } from "@/lib/seo";

export const metadata = metadatosPublicos({
  titulo: TITULO_INICIO,
  descripcion: DESCRIPCION_INICIO,
  canonical: "https://enflora.com.ar/",
});

export default async function PaginaInicio({ searchParams }) {
  const parametros = await searchParams;
  const codigo = typeof parametros?.code === "string" ? parametros.code : "";
  const token = typeof parametros?.token_hash === "string" ? parametros.token_hash : "";

  if (codigo || token) {
    const consulta = new URLSearchParams();
    if (codigo) consulta.set("code", codigo);
    if (token) consulta.set("token_hash", token);
    if (typeof parametros.type === "string") consulta.set("type", parametros.type);
    redirect(`/correo/confirmar?${consulta.toString()}`);
  }

  const cotizacion = await obtenerCotizacionOficial();
  return (
    <>
      <DatosEstructurados />
      <Landing cotizacion={cotizacion} />
    </>
  );
}
