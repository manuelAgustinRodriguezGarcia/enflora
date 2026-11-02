import { redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { PanelProductos } from "@/componentes/mezclas/panel-productos";
import { cargarCatalogoMezclas } from "@/lib/mezclas/cargar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Mis productos",
  robots: { index: false, follow: false },
};

export default async function PaginaProductos() {
  if (!configuracionLista()) {
    return (
      <section className="registros mezclas">
        <h1>Mis productos</h1>
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
      <h1>Mis productos</h1>
      <p className="registros__intro">Fertilizantes, nutrientes y aditivos de tu cultivo.</p>
      <PanelProductos productos={catalogo.productos} disponible={catalogo.disponible} />
    </section>
  );
}
