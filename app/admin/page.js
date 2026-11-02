import { notFound, redirect } from "next/navigation";
import { PanelDashboard } from "@/componentes/admin/panel-dashboard";
import { leerResumenDashboard } from "@/lib/admin/dashboard";
import { resolverModulosAdmin } from "@/lib/admin/acceso-panel";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import { destinoAdminPermitido, primerDestino, seccionAdmin } from "@/lib/admin/secciones";

const seccion = seccionAdmin("dashboard");

export const dynamic = "force-dynamic";

export const metadata = {
  title: seccion.titulo,
  robots: { index: false, follow: false },
};

export default async function PaginaDashboard() {
  const resultado = await obtenerAdmin(seccion.modulo);
  if (!resultado.ok) {
    if (resultado.motivo === MOTIVOS_ADMIN.sinSesion) {
      redirect(`/ingreso?siguiente=${encodeURIComponent(seccion.href)}`);
    }
    const acceso = await resolverModulosAdmin();
    const destino = destinoAdminPermitido(primerDestino(acceso.modulos));
    if (destino && destino !== seccion.href) redirect(destino);
    notFound();
  }

  const resumen = await leerResumenDashboard(resultado.credencial);
  return <PanelDashboard inicial={resumen} />;
}
