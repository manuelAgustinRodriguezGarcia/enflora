import { redirect } from "next/navigation";
import { BannerPublicitario } from "@/componentes/banner-publicitario";
import { EnlaceBoton } from "@/componentes/boton";
import { ContenidoListaEspacios } from "@/componentes/espacios/contenido-lista-espacios";
import { RecuperacionCargaEspacios } from "@/componentes/espacios/recuperacion-carga-espacios";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarListadoEspacios } from "@/lib/cargar-listado-espacios";
import { configuracionLista } from "@/lib/supabase/configuracion";

export const dynamic = "force-dynamic";

export default async function PaginaEspacios() {
  if (!configuracionLista()) {
    return (
      <section className="espacios">
        <h1>Espacios</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const resultado = await cargarListadoEspacios({ origen: "pagina_espacios" });

  if (!resultado.ok) {
    if (resultado.requiereIngreso) {
      redirect("/ingreso");
    }

    return (
      <TransicionVista>
        <section className="espacios">
          <h1>Espacios</h1>
          <RecuperacionCargaEspacios diagnosticoInicial={resultado.clasificado} />
        </section>
      </TransicionVista>
    );
  }

  const { espacios, unidadesPorEspacio, plantasPorEspacio, banners } = resultado;

  return (
    <TransicionVista>
      <section className="espacios">
        <h1>Espacios</h1>
        <EnlaceBoton href="/espacios/nuevo">Crear espacio</EnlaceBoton>
        <ContenidoListaEspacios
          espacios={espacios}
          unidadesPorEspacio={unidadesPorEspacio}
          plantasPorEspacio={plantasPorEspacio}
        />
        <BannerPublicitario campañas={banners.campañas} />
      </section>
    </TransicionVista>
  );
}
