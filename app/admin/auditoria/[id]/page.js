import { notFound } from "next/navigation";
import { FichaAuditoria, MarcoAuditoria } from "@/componentes/admin/auditoria-marco";
import { leerDetalleAuditoria } from "@/lib/admin/auditoria";
import { credencialAuditoria } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Evento de auditoría",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PaginaEventoAuditoria({ params }) {
  const { id } = await params;
  if (!UUID.test(id || "")) notFound();
  const credencial = await credencialAuditoria();
  const detalle = await leerDetalleAuditoria(credencial, id);
  if (detalle.estado === "no_encontrado") notFound();
  return (
    <MarcoAuditoria
      titulo="Evento"
      intro="Detalle del registro. No incluye correo, mensajes ni contenido de cultivos."
      aviso={detalle.estado === "listo" ? null : detalle.error || "No pudimos leer el evento."}
    >
      {detalle.estado === "listo" ? <FichaAuditoria evento={detalle.evento} /> : null}
    </MarcoAuditoria>
  );
}
