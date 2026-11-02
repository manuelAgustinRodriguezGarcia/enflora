import { VistaInformativa } from "@/app/admin/vista-informativa";
import { seccionAdmin } from "@/lib/admin/secciones";

const seccion = seccionAdmin("planes");

export const dynamic = "force-dynamic";

export const metadata = {
  title: seccion.titulo,
  robots: { index: false, follow: false },
};

export default function PaginaPlanes() {
  return <VistaInformativa seccion={seccion} />;
}
