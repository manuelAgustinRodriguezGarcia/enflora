import { VistaInformativa } from "@/app/admin/vista-informativa";
import { seccionAdmin } from "@/lib/admin/secciones";

const seccion = seccionAdmin("auditoria");

export const dynamic = "force-dynamic";

export const metadata = {
  title: seccion.titulo,
  robots: { index: false, follow: false },
};

export default function PaginaAuditoria() {
  return <VistaInformativa seccion={seccion} />;
}
