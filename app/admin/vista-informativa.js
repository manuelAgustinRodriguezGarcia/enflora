import { notFound, redirect } from "next/navigation";
import { EstadoSeccion } from "@/componentes/admin/estado-seccion";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import { destinoAdminPermitido } from "@/lib/admin/secciones";

/** Pantalla de un módulo que todavía no opera. Comprueba el permiso y no lee datos. */
export async function VistaInformativa({ seccion }) {
  const resultado = await obtenerAdmin(seccion.modulo);
  if (!resultado.ok) {
    if (resultado.motivo === MOTIVOS_ADMIN.sinSesion) {
      const destino = destinoAdminPermitido(seccion.href) || "/admin";
      redirect(`/ingreso?siguiente=${encodeURIComponent(destino)}`);
    }
    notFound();
  }

  return <EstadoSeccion titulo={seccion.titulo} resumen={seccion.resumen} />;
}
