import { redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { PanelRecetas } from "@/componentes/mezclas/panel-recetas";
import { cargarCatalogoMezclas } from "@/lib/mezclas/cargar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Mis recetas",
  robots: { index: false, follow: false },
};

export default async function PaginaRecetas() {
  if (!configuracionLista()) {
    return (
      <section className="registros mezclas">
        <h1>Mis recetas</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const catalogo = await cargarCatalogoMezclas(supabase);

  return (
    <section className="registros mezclas">
      <EnlaceVolver href="/registros" etiqueta="Volver a registrar" />
      <h1>Mis recetas</h1>
      <p className="registros__intro">Mezclas reutilizables. Archivarla no borra los riegos ya registrados.</p>
      <PanelRecetas recetas={catalogo.recetas} disponible={catalogo.disponible} />
    </section>
  );
}
