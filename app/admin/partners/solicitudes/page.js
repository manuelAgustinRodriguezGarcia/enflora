import { AvisoPartners, MarcoPartners, PaginacionPartners, TablaSolicitudes } from "@/componentes/admin/partners-marco";
import { leerSolicitudesPartners } from "@/lib/admin/partners";
import { LIMITE_PARTNERS, interpretarSolicitudes } from "@/lib/admin/partners-reglas";
import { credencialPartners } from "../acceso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitudes comerciales", robots: { index: false, follow: false } };

function enlace(consulta, offset) {
  const params = new URLSearchParams();
  if (consulta.estado !== "todos") params.set("estado", consulta.estado);
  if (consulta.busqueda) params.set("q", consulta.busqueda);
  if (offset) params.set("offset", String(offset));
  const texto = params.toString();
  return texto ? `/admin/partners/solicitudes?${texto}` : "/admin/partners/solicitudes";
}

export default async function PaginaSolicitudes({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPartners();
  const interpretado = interpretarSolicitudes(parametros);
  const listado = interpretado.ok
    ? await leerSolicitudesPartners(credencial, interpretado.consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const consulta = interpretado.ok ? interpretado.consulta : { estado: "todos", busqueda: "", offset: 0 };
  const siguiente = listado.estado === "listo" && consulta.offset + listado.lista.filas.length < listado.lista.total
    ? enlace(consulta, consulta.offset + LIMITE_PARTNERS)
    : "";
  return (
    <MarcoPartners titulo="Solicitudes" intro="Propuestas enviadas desde el formulario de marcas. No son los contactos de Expo Cannabis." aviso={AvisoPartners(listado)}>
      <form className="admin-planes__filtros" method="get">
        <label className="admin-planes__campo">
          Buscar
          <input name="q" defaultValue={consulta.busqueda} maxLength={80} />
        </label>
        <label className="admin-planes__campo">
          Estado
          <select name="estado" defaultValue={consulta.estado}>
            <option value="todos">Todas</option>
            <option value="recibida">Recibidas</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="cerrada">Cerradas</option>
          </select>
        </label>
        <button className="admin-dash__actualizar" type="submit">Filtrar</button>
      </form>
      {listado.estado === "listo" ? <TablaSolicitudes filas={listado.lista.filas} /> : null}
      <PaginacionPartners anterior={consulta.offset > 0 ? enlace(consulta, Math.max(0, consulta.offset - LIMITE_PARTNERS)) : ""} siguiente={siguiente} />
    </MarcoPartners>
  );
}
