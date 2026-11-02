import { AvisoEstado, FormularioPlanes, MarcoPlanes, PaginacionPlanes } from "@/componentes/admin/planes-marco";
import { TablaOperaciones } from "@/componentes/admin/planes-tablas";
import { leerOperacionesPlanes } from "@/lib/admin/planes";
import { enlacesPlanes, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operaciones de planes",
  robots: { index: false, follow: false },
};

function hrefPagina(consulta, pagina) {
  return `/admin/planes/operaciones?${parametrosConsulta({ ...consulta, pagina }, { pagina: true })}`;
}

export default async function PaginaOperaciones({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPlanes();
  const { interpretado, consulta } = prepararConsultaPlanes(parametros);
  const listado = interpretado.ok
    ? await leerOperacionesPlanes(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  const datos = listado.estado === "listo" ? listado.listado : null;
  return (
    <MarcoPlanes
      titulo="Operaciones"
      intro="Historial de cobros de Plus y de pago único. Solo lectura."
      actual="operaciones"
      enlaces={enlacesPlanes(consulta)}
      formulario={<FormularioPlanes destino="/admin/planes/operaciones" consulta={consulta} variante="operaciones" />}
      aviso={AvisoEstado(listado)}
    >
      {datos ? (
        <>
          <TablaOperaciones
            filas={datos.filas}
            hrefDetalle={(fila) => `/admin/planes/operaciones/${fila.origen}/${fila.id}?${parametrosConsulta(consulta)}`}
          />
          <PaginacionPlanes
            anterior={datos.pagina > 1 ? hrefPagina(consulta, datos.pagina - 1) : ""}
            siguiente={datos.pagina < datos.paginas ? hrefPagina(consulta, datos.pagina + 1) : ""}
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            etiqueta="operaciones"
          />
        </>
      ) : null}
    </MarcoPlanes>
  );
}
