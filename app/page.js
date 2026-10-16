import { redirect } from "next/navigation";
import { Landing } from "@/componentes/landing/landing";
import { obtenerCotizacionOficial } from "@/lib/cotizacion";

export const metadata = {
  title: {
    absolute: "ENFLORA | Registro y seguimiento de cultivos",
  },
  description:
    "Organizá tus plantas, registrá parámetros y consultá el historial de tus cultivos con ENFLORA, tu aplicación de seguimiento de cultivos.",
  alternates: {
    canonical: "https://enflora.com.ar/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

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
  return <Landing cotizacion={cotizacion} />;
}
