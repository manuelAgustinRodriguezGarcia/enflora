import { AvisoEstado, FormularioPlanes, MarcoPlanes, PaginacionPlanes } from "@/componentes/admin/planes-marco";
import { TablaSuscripciones } from "@/componentes/admin/planes-tablas";
import { leerSuscripcionesPlanes } from "@/lib/admin/planes";
import { ESTADOS_SUSCRIPCION_PLANES, enlacesPlanes, interpretarEstadoSuscripcion, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Suscripciones Plus",
  robots: { index: false, follow: false },
};

const OPCIONES = ESTADOS_SUSCRIPCION_PLANES.map((estado) => [estado, estado === "todos" ? "Todos los estados" : estado.replaceAll("_", " ")]);

function hrefPagina(consulta, pagina) {
  return `/admin/planes/suscripciones?${parametrosConsulta({ ...consulta, pagina }, { pagina: true })}`;
}

export default async function PaginaSuscripciones({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPlanes();
  const { interpretado, consulta } = prepararConsultaPlanes(parametros);
  const estado = interpretarEstadoSuscripcion(parametros.estado_suscripcion);
  const listado =
    interpretado.ok && estado.ok
      ? await leerSuscripcionesPlanes(credencial, consulta, estado.valor)
      : { ok: false, estado: "consulta", error: interpretado.ok ? estado.error : interpretado.error };
  const datos = listado.estado === "listo" ? listado.listado : null;
  const consultaVista = { ...consulta, estadoSuscripcion: estado.ok ? estado.valor : "todos" };
  return (
    <MarcoPlanes
      titulo="Suscripciones Plus"
      intro="Estados guardados y cobertura derivada de la regla comercial. No se cancela ni se reactiva desde acá."
      actual="suscripciones"
      enlaces={enlacesPlanes(consultaVista)}
      formulario={
        <FormularioPlanes
          destino="/admin/planes/suscripciones"
          consulta={consultaVista}
          variante="suscripciones"
          opcionesEstado={OPCIONES}
          nombreEstado="estado_suscripcion"
          valorEstado={consultaVista.estadoSuscripcion}
        />
      }
      aviso={AvisoEstado(listado)}
    >
      {datos ? (
        <>
          <TablaSuscripciones filas={datos.filas} hrefDetalle={(fila) => `/admin/planes/suscripciones/${fila.id}?${parametrosConsulta(consultaVista)}`} />
          <PaginacionPlanes
            anterior={datos.pagina > 1 ? hrefPagina(consultaVista, datos.pagina - 1) : ""}
            siguiente={datos.pagina < datos.paginas ? hrefPagina(consultaVista, datos.pagina + 1) : ""}
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            etiqueta="suscripciones"
          />
        </>
      ) : null}
    </MarcoPlanes>
  );
}
