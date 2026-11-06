import { PruebaNotificacionesAdmin } from "@/componentes/admin/prueba-notificaciones";
import {
  AvisoNotificaciones,
  FormularioNotificaciones,
  MarcoNotificaciones,
  RecordatoriosCalendario,
  ResumenNotificaciones,
} from "@/componentes/admin/notificaciones-marco";
import { leerPanelNotificaciones, leerRecordatoriosCalendario } from "@/lib/admin/notificaciones";
import { enlaceNotificaciones, prepararConsultaNotificaciones } from "@/lib/admin/notificaciones-reglas";
import { credencialNotificaciones } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notificaciones",
  robots: { index: false, follow: false },
};

export default async function PaginaNotificaciones({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialNotificaciones();
  const { interpretado, consulta } = prepararConsultaNotificaciones(parametros);
  const panel = interpretado.ok
    ? await leerPanelNotificaciones(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const recordatorios = await leerRecordatoriosCalendario(credencial);
  const anterior = consulta.offset > 0 ? enlaceNotificaciones(consulta, { offset: Math.max(0, consulta.offset - 20) }) : "";
  const siguiente =
    panel.estado === "listo" && consulta.offset + panel.lista.filas.length < panel.lista.total
      ? enlaceNotificaciones(consulta, { offset: consulta.offset + 20 })
      : "";
  return (
    <MarcoNotificaciones
      titulo="Notificaciones"
      intro="Suscripciones, envíos y campañas, en solo lectura. La prueba de abajo sigue limitada a tus dispositivos."
      formulario={<FormularioNotificaciones consulta={consulta} />}
      aviso={AvisoNotificaciones(panel)}
    >
      <RecordatoriosCalendario resultado={recordatorios} />
      {panel.estado === "listo" ? (
        <ResumenNotificaciones
          resumen={panel.resumen}
          lista={panel.lista}
          enlace={(id) => enlaceNotificaciones(consulta, { id, offset: 0 })}
          anterior={anterior}
          siguiente={siguiente}
        />
      ) : null}
      <PruebaNotificacionesAdmin />
    </MarcoNotificaciones>
  );
}
