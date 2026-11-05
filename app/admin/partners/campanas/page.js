import Link from "next/link";
import { AvisoPartners, MarcoPartners, PaginacionPartners, TablaCampanas } from "@/componentes/admin/partners-marco";
import { leerCampanasPartners } from "@/lib/admin/partners";
import { LIMITE_PARTNERS, interpretarCampanas } from "@/lib/admin/partners-reglas";
import { credencialPartners } from "../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campañas", robots: { index: false, follow: false } };

function enlace(consulta, offset) {
  const params = new URLSearchParams();
  if (consulta.estado !== "todos") params.set("estado", consulta.estado);
  if (offset) params.set("offset", String(offset));
  const texto = params.toString();
  return texto ? `/admin/partners/campanas?${texto}` : "/admin/partners/campanas";
}

export default async function PaginaCampanas({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPartners();
  const interpretado = interpretarCampanas(parametros);
  const listado = interpretado.ok
    ? await leerCampanasPartners(credencial, interpretado.consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const consulta = interpretado.ok ? interpretado.consulta : { estado: "todos", offset: 0 };
  const siguiente = listado.estado === "listo" && consulta.offset + listado.lista.filas.length < listado.lista.total
    ? enlace(consulta, consulta.offset + LIMITE_PARTNERS)
    : "";
  return (
    <MarcoPartners titulo="Campañas" intro="Usan el banner del listado de cultivos. Una campaña nueva queda en borrador." aviso={AvisoPartners(listado)}>
      <p><Link href="/admin/partners/campanas/nueva">Nueva campaña</Link></p>
      <form className="admin-planes__filtros" method="get">
        <label className="admin-planes__campo">
          Estado
          <select name="estado" defaultValue={consulta.estado}>
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="programada">Programada</option>
            <option value="activa">Activa</option>
            <option value="pausada">Pausada</option>
            <option value="finalizada">Finalizada</option>
          </select>
        </label>
        <button className="admin-dash__actualizar" type="submit">Filtrar</button>
      </form>
      {listado.estado === "listo" ? <TablaCampanas filas={listado.lista.filas} /> : null}
      <PaginacionPartners anterior={consulta.offset > 0 ? enlace(consulta, Math.max(0, consulta.offset - LIMITE_PARTNERS)) : ""} siguiente={siguiente} />
    </MarcoPartners>
  );
}
