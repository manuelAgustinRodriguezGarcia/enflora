import { redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { PanelRecetas } from "@/componentes/mezclas/panel-recetas";
import { cargarCatalogoMezclas } from "@/lib/mezclas/cargar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Mis mezclas",
  robots: { index: false, follow: false },
};

export default async function PaginaMezclas() {
  if (!configuracionLista()) {
    return (
      <section className="registros mezclas">
        <h1>Mis mezclas</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const catalogo = await cargarCatalogoMezclas(supabase);
  const sinProductos = catalogo.disponible && (catalogo.productos || []).length === 0;

  return (
    <section className="registros mezclas">
      <EnlaceVolver href="/registros" etiqueta="Volver a registrar" />
      <h1>Mis mezclas</h1>
      {sinProductos ? null : (
        <p className="registros__intro">
          Guardá las mezclas que utilizás cuando regás para no tener que escribirlas de nuevo cada vez que registres un riego.
        </p>
      )}
      <PanelRecetas
        recetas={catalogo.recetas}
        productos={catalogo.productos}
        disponible={catalogo.disponible}
        sinProductos={sinProductos}
      />
    </section>
  );
}
