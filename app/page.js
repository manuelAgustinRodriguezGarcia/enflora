import { redirect } from "next/navigation";
import { Landing } from "@/componentes/landing/landing";

export const metadata = {
  title: "ENFLORA",
  description:
    "Registrá tus plantas, seguí su evolución y armá un historial para entender cada cultivo.",
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

  return <Landing />;
}
