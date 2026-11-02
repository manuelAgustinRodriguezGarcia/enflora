import { VistaInformativa } from "@/app/admin/vista-informativa";
import { seccionAdmin } from "@/lib/admin/secciones";

const seccion = seccionAdmin("flora_ia");

export const dynamic = "force-dynamic";

export const metadata = {
  title: seccion.titulo,
  robots: { index: false, follow: false },
};

export default function PaginaFlora() {
  return <VistaInformativa seccion={seccion} />;
}
