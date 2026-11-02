import { AvisoEstado, FormularioPlanes, MarcoPlanes, PaginacionPlanes } from "@/componentes/admin/planes-marco";
import { TablaLicencias } from "@/componentes/admin/planes-tablas";
import { leerLicenciasPlanes } from "@/lib/admin/planes";
import { enlacesPlanes, interpretarEstadoLicencia, parametrosConsulta, prepararConsultaPlanes } from "@/lib/admin/planes-reglas";
import { credencialPlanes } from "../acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Licencias de cultivo",
  robots: { index: false, follow: false },
};

const OPCIONES = [
  ["todos", "Todos los estados"],
  ["activa", "Activa"],
  ["revocada", "Revocada"],
];

function hrefPagina(consulta, pagina) {
  return `/admin/planes/licencias?${parametrosConsulta({ ...consulta, pagina }, { pagina: true })}`;
}

export default async function PaginaLicencias({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialPlanes();
  const { interpretado, consulta } = prepararConsultaPlanes(parametros);
  const estado = interpretarEstadoLicencia(parametros.estado_licencia);
  const listado =
    interpretado.ok && estado.ok
      ? await leerLicenciasPlanes(credencial, consulta, estado.valor)
      : { ok: false, estado: "consulta", error: interpretado.ok ? estado.error : interpretado.error };
  const datos = listado.estado === "listo" ? listado.listado : null;
  const consultaVista = { ...consulta, estadoLicencia: estado.ok ? estado.valor : "todos" };
  return (
    <MarcoPlanes
      titulo="Licencias de cultivo"
      intro="Licencias por ciclo y cobertura según la regla comercial. No se conceden ni se revocan desde acá."
      actual="licencias"
      enlaces={enlacesPlanes(consultaVista)}
      formulario={
        <FormularioPlanes
          destino="/admin/planes/licencias"
          consulta={consultaVista}
          variante="licencias"
          opcionesEstado={OPCIONES}
          nombreEstado="estado_licencia"
          valorEstado={consultaVista.estadoLicencia}
        />
      }
      aviso={AvisoEstado(listado)}
    >
      {datos ? (
        <>
          <TablaLicencias filas={datos.filas} hrefDetalle={(fila) => `/admin/planes/licencias/${fila.id}?${parametrosConsulta(consultaVista)}`} />
          <PaginacionPlanes
            anterior={datos.pagina > 1 ? hrefPagina(consultaVista, datos.pagina - 1) : ""}
            siguiente={datos.pagina < datos.paginas ? hrefPagina(consultaVista, datos.pagina + 1) : ""}
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            etiqueta="licencias"
          />
        </>
      ) : null}
    </MarcoPlanes>
  );
}
