import { AvisoUsuarios, FormularioUsuarios, MarcoUsuarios, PaginacionUsuarios, TablaUsuarios } from "@/componentes/admin/usuarios-marco";
import { leerListadoUsuarios } from "@/lib/admin/usuarios";
import { enlaceDetalleUsuario, enlaceUsuarios, prepararConsultaUsuarios } from "@/lib/admin/usuarios-reglas";
import { credencialUsuarios } from "./acceso";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Usuarios",
  robots: { index: false, follow: false },
};

export default async function PaginaUsuarios({ searchParams }) {
  const parametros = await searchParams;
  const credencial = await credencialUsuarios();
  const { interpretado, consulta } = prepararConsultaUsuarios(parametros);
  const listado = interpretado.ok
    ? await leerListadoUsuarios(credencial, consulta)
    : { ok: false, estado: "consulta", error: interpretado.error };
  return (
    <MarcoUsuarios
      titulo="Usuarios"
      intro="Cuentas, plan comercial y conteos. Sin fotografías, observaciones ni conversaciones."
      formulario={<FormularioUsuarios consulta={consulta} />}
      aviso={AvisoUsuarios(listado)}
    >
      {listado.estado === "listo" ? (
        <>
          <TablaUsuarios
            filas={listado.filas.map((fila) => ({ ...fila, href: enlaceDetalleUsuario(consulta, fila.id) }))}
          />
          <PaginacionUsuarios
            anterior={listado.pagina > 1 ? enlaceUsuarios(consulta, listado.pagina - 1) : ""}
            siguiente={listado.pagina < listado.paginas ? enlaceUsuarios(consulta, listado.pagina + 1) : ""}
            pagina={listado.pagina}
            paginas={listado.paginas}
            total={listado.total}
          />
        </>
      ) : null}
    </MarcoUsuarios>
  );
}
