import {
  AvisoAuditoria,
  FormularioAuditoria,
  MarcoAuditoria,
  PaginacionAuditoria,
  ResumenAuditoria,
  TablaAuditoria,
} from "@/componentes/admin/auditoria-marco";
import { leerResumenAuditoria } from "@/lib/admin/auditoria";
import {
  ACCIONES_AUDITORIA,
  LIMITE_AUDITORIA,
  MODULOS_AUDITORIA,
  enlaceAuditoria,
  interpretarAuditoria,
} from "@/lib/admin/auditoria-reglas";
import { credencialAuditoria } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Auditoría",
  robots: { index: false, follow: false },
};

export default async function PaginaAuditoria({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialAuditoria();
  const interpretado = interpretarAuditoria(parametros);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarAuditoria({}).consulta;
  const panel = interpretado.ok
    ? await leerResumenAuditoria(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const anterior = consulta.offset > 0 ? enlaceAuditoria(consulta, { offset: Math.max(0, consulta.offset - LIMITE_AUDITORIA) }) : "";
  const siguiente =
    panel.estado === "listo" && consulta.offset + panel.resumen.filas.length < panel.resumen.total
      ? enlaceAuditoria(consulta, { offset: consulta.offset + LIMITE_AUDITORIA })
      : "";
  return (
    <MarcoAuditoria
      titulo="Auditoría"
      intro="Operaciones de Usuarios, Partners y Expo. El correo, los mensajes y los datos de cultivo no salen en este listado."
      formulario={<FormularioAuditoria consulta={consulta} modulos={MODULOS_AUDITORIA} acciones={ACCIONES_AUDITORIA} />}
      aviso={AvisoAuditoria(panel)}
    >
      {panel.estado === "listo" ? (
        <>
          <ResumenAuditoria resumen={panel.resumen} />
          <TablaAuditoria filas={panel.resumen.filas} />
          <PaginacionAuditoria anterior={anterior} siguiente={siguiente} />
        </>
      ) : null}
    </MarcoAuditoria>
  );
}
