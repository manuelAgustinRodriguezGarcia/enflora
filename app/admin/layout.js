import "@/estilos/app-autenticada.scss";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CascaronAdmin } from "@/componentes/admin/cascaron-admin";
import { resolverModulosAdmin } from "@/lib/admin/acceso-panel";
import { destinoAdminPermitido, navegacionAdmin } from "@/lib/admin/secciones";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({ children }) {
  const acceso = await resolverModulosAdmin();
  if (!acceso.sesion) {
    const ruta = (await headers()).get("x-enflora-ruta") || "/admin";
    const destino = destinoAdminPermitido(ruta) || "/admin";
    redirect(`/ingreso?siguiente=${encodeURIComponent(destino)}`);
  }

  const secciones = navegacionAdmin(acceso.modulos);
  if (secciones.length === 0) notFound();

  return <CascaronAdmin secciones={secciones}>{children}</CascaronAdmin>;
}
