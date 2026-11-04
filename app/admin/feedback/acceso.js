import { notFound, redirect } from "next/navigation";
import { resolverModulosAdmin } from "@/lib/admin/acceso-panel";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import { destinoAdminPermitido, primerDestino } from "@/lib/admin/secciones";

export async function credencialFeedback() {
  const autorizacion = await obtenerAdmin("feedback");
  if (autorizacion.ok) return autorizacion.credencial;
  if (autorizacion.motivo === MOTIVOS_ADMIN.sinSesion) {
    redirect("/ingreso?siguiente=%2Fadmin%2Ffeedback");
  }
  const acceso = await resolverModulosAdmin();
  const destino = destinoAdminPermitido(primerDestino(acceso.modulos));
  if (destino && destino !== "/admin/feedback") redirect(destino);
  notFound();
}
