import { redirect } from "next/navigation";
import { BannerPublicitario } from "@/componentes/banner-publicitario";
import { ContenidoListaEspacios } from "@/componentes/espacios/contenido-lista-espacios";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { RecuperacionCargaEspacios } from "@/componentes/espacios/recuperacion-carga-espacios";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarListadoEspacios } from "@/lib/cargar-listado-espacios";
import { configuracionLista } from "@/lib/supabase/configuracion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mis cultivos",
};

export default async function PaginaCultivos() {
  if (!configuracionLista()) {
    return (
      <section className="espacios">
        <h1>Mis cultivos</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const resultado = await cargarListadoEspacios({ origen: "pagina_cultivos" });

  if (!resultado.ok) {
    if (resultado.requiereIngreso) {
      redirect("/ingreso");
    }

    return (
      <TransicionVista>
        <section className="espacios">
          <h1>Mis cultivos</h1>
          <RecuperacionCargaEspacios diagnosticoInicial={resultado.clasificado} />
        </section>
      </TransicionVista>
    );
  }

  const { espacios, unidadesPorEspacio, plantasPorEspacio, banners } = resultado;

  return (
    <TransicionVista>
      <section className="espacios">
        <h1>Mis cultivos</h1>
        <ContenidoListaEspacios
          espacios={espacios}
          unidadesPorEspacio={unidadesPorEspacio}
          plantasPorEspacio={plantasPorEspacio}
        />
        <BannerPublicitario campañas={banners.campañas} />
        <FabNuevoChatFlora href="/cultivos/nuevo" ariaLabel="Crear espacio" />
      </section>
    </TransicionVista>
  );
}
