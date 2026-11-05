import { AvisoPartners, MarcoPartners, ResumenPartners } from "@/componentes/admin/partners-marco";
import { leerResumenPartners } from "@/lib/admin/partners";
import { interpretarPeriodoPartners } from "@/lib/admin/partners-reglas";
import { credencialPartners } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partners y publicidad",
  robots: { index: false, follow: false },
};

export default async function PaginaPartners({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPartners();
  const interpretado = interpretarPeriodoPartners(parametros);
  const resumen = interpretado.ok
    ? await leerResumenPartners(credencial, interpretado.consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  return (
    <MarcoPartners
      titulo="Partners y publicidad"
      intro="Comercios, solicitudes y campañas. Los banners públicos siguen saliendo del directorio y del listado de cultivos, marcados como publicidad."
      aviso={AvisoPartners(resumen)}
    >
      <form className="admin-planes__filtros" method="get">
        <label className="admin-planes__campo">
          Período de medición
          <select name="periodo" defaultValue={interpretado.ok ? interpretado.consulta.periodo : "30"}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="personalizado">Período personalizado</option>
          </select>
        </label>
        <label className="admin-planes__campo">
          Desde
          <input type="date" name="desde" />
        </label>
        <label className="admin-planes__campo">
          Hasta
          <input type="date" name="hasta" />
        </label>
        <button className="admin-dash__actualizar" type="submit">
          Actualizar
        </button>
      </form>
      {resumen.estado === "listo" ? <ResumenPartners resumen={resumen.resumen} /> : null}
    </MarcoPartners>
  );
}
