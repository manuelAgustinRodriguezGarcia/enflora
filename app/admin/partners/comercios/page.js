import Link from "next/link";
import { AvisoPartners, MarcoPartners, PaginacionPartners, TablaComercios } from "@/componentes/admin/partners-marco";
import { leerComerciosPartners } from "@/lib/admin/partners";
import { LIMITE_PARTNERS, interpretarComercios } from "@/lib/admin/partners-reglas";
import { credencialPartners } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = { title: "Comercios", robots: { index: false, follow: false } };

function enlace(consulta, offset) {
  const params = new URLSearchParams();
  if (consulta.estado !== "todos") params.set("estado", consulta.estado);
  if (consulta.busqueda) params.set("q", consulta.busqueda);
  if (offset) params.set("offset", String(offset));
  const texto = params.toString();
  return texto ? `/admin/partners/comercios?${texto}` : "/admin/partners/comercios";
}

export default async function PaginaComercios({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPartners();
  const interpretado = interpretarComercios(parametros);
  const listado = interpretado.ok
    ? await leerComerciosPartners(credencial, interpretado.consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const consulta = interpretado.ok ? interpretado.consulta : { estado: "todos", busqueda: "", offset: 0 };
  const siguiente = listado.estado === "listo" && consulta.offset + listado.lista.filas.length < listado.lista.total
    ? enlace(consulta, consulta.offset + LIMITE_PARTNERS)
    : "";
  return (
    <MarcoPartners titulo="Comercios" intro="Alta y seguimiento comercial. Un comercio nuevo queda pendiente y no se publica solo." aviso={AvisoPartners(listado)}>
      <p>
        <Link href="/admin/partners/comercios/nuevo">Agregar comercio</Link>
      </p>
      <form className="admin-planes__filtros" method="get">
        <label className="admin-planes__campo">
          Buscar
          <input name="q" defaultValue={consulta.busqueda} maxLength={80} />
        </label>
        <label className="admin-planes__campo">
          Estado
          <select name="estado" defaultValue={consulta.estado}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </label>
        <button className="admin-dash__actualizar" type="submit">Filtrar</button>
      </form>
      {listado.estado === "listo" ? <TablaComercios filas={listado.lista.filas} /> : null}
      <PaginacionPartners anterior={consulta.offset > 0 ? enlace(consulta, Math.max(0, consulta.offset - LIMITE_PARTNERS)) : ""} siguiente={siguiente} />
    </MarcoPartners>
  );
}
