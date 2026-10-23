import { redirect } from "next/navigation";
import { DatosEstructurados } from "@/componentes/datos-estructurados";
import { Landing } from "@/componentes/landing/landing";
import { obtenerCotizacionOficial } from "@/lib/cotizacion";
import { metadatosPublicos, NOMBRE_MARCA, TITULO_INICIO } from "@/lib/seo";

export const metadata = metadatosPublicos({
  titulo: TITULO_INICIO,
  descripcion: `Organizá tus plantas, registrá parámetros y consultá el historial de tus cultivos con ${NOMBRE_MARCA}, tu aplicación de seguimiento de cultivos.`,
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
