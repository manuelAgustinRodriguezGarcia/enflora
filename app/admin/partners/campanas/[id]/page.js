import { notFound } from "next/navigation";
import Link from "next/link";
import { BotonesCampana, FormularioCampana } from "@/componentes/admin/partners-formularios";
import { AvisoPartners, MarcoPartners } from "@/componentes/admin/partners-marco";
import { leerComerciosPartners, leerDetalleCampana } from "@/lib/admin/partners";
import { esUuid } from "@/lib/admin/reglas";
import { interpretarComercios, tasaClics } from "@/lib/admin/partners-reglas";
import { textoEntero } from "@/componentes/admin/formato-dashboard";
import { credencialPartners } from "../../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaña", robots: { index: false, follow: false } };

export default async function PaginaCampana({ params }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const credencial = await credencialPartners();
  const detalle = await leerDetalleCampana(credencial, id);
  if (detalle.estado === "no_encontrado") notFound();
  const campana = detalle.estado === "listo" ? detalle.ficha : null;
  const comercios = campana ? await leerComerciosPartners(credencial, interpretarComercios({}).consulta) : { estado: "vacio", lista: { filas: [] } };
  const filas = comercios.estado === "listo" ? comercios.lista.filas : [];
  const comerciosFormulario = campana && filas.some((fila) => fila.id === campana.comercio_id)
    ? filas
    : campana
      ? [{ id: campana.comercio_id, nombre: campana.comercio }, ...filas]
      : [];
  const tasa = campana ? tasaClics(campana.impresiones, campana.clics) : null;
  return (
    <MarcoPartners titulo="Campaña" intro="Pieza, destino y medición de esta campaña. No se activa al guardarla." aviso={AvisoPartners(detalle)}>
      <p><Link href="/admin/partners/campanas">Volver a campañas</Link></p>
      {detalle.estado === "listo" ? (
        <>
          <p>
            Estado {campana.estado}. Impresiones {textoEntero(campana.impresiones)}. Clics {textoEntero(campana.clics)}.{" "}
            {tasa == null ? "Sin CTR porque no hay impresiones." : `CTR ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(tasa * 100)} %.`}
          </p>
          <BotonesCampana id={campana.id} estadoActual={campana.estado} />
          <FormularioCampana campana={campana} comercios={comerciosFormulario} />
        </>
      ) : null}
    </MarcoPartners>
  );
}
