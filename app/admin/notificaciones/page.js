import { notFound, redirect } from "next/navigation";
import { PruebaNotificacionesAdmin } from "@/componentes/admin/prueba-notificaciones";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import { destinoAdminPermitido, seccionAdmin } from "@/lib/admin/secciones";

const seccion = seccionAdmin("notificaciones");

export const dynamic = "force-dynamic";

export const metadata = {
  title: seccion.titulo,
  robots: { index: false, follow: false },
};

export default async function PaginaNotificaciones() {
  const resultado = await obtenerAdmin(seccion.modulo);
  if (!resultado.ok) {
    if (resultado.motivo === MOTIVOS_ADMIN.sinSesion) {
      const destino = destinoAdminPermitido(seccion.href) || "/admin";
      redirect(`/ingreso?siguiente=${encodeURIComponent(destino)}`);
    }
    notFound();
  }

  return (
    <section className="admin-estado">
      <p className="admin-estado__etiqueta">Administración</p>
      <h1>{seccion.titulo}</h1>
      <p className="admin-estado__resumen">{seccion.resumen}</p>
      <PruebaNotificacionesAdmin />
    </section>
  );
}
