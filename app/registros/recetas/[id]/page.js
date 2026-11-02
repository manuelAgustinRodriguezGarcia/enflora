import { notFound, redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { FormularioReceta } from "@/componentes/mezclas/formulario-receta";
import { cargarCatalogoMezclas, cargarRecetaMezcla } from "@/lib/mezclas/cargar";
import { esUuid } from "@/lib/historial-registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Receta",
  robots: { index: false, follow: false },
};

export default async function PaginaReceta({ params }) {
  const { id } = await params;
  const nueva = id === "nueva";
  if (!nueva && !esUuid(id)) notFound();

  if (!configuracionLista()) {
    return (
      <section className="registros mezclas">
        <h1>Receta</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const catalogo = await cargarCatalogoMezclas(supabase);
  let receta = null;
  if (!nueva) {
    const cargada = await cargarRecetaMezcla(supabase, id);
    if (!cargada.receta) notFound();
    receta = cargada.receta;
  }

  return (
    <section className="registros mezclas">
      <EnlaceVolver href="/registros/recetas" etiqueta="Volver a mis recetas" />
      <h1>{nueva ? "Nueva receta" : "Editar receta"}</h1>
      {catalogo.disponible ? (
        <FormularioReceta receta={receta} productos={catalogo.productos} />
      ) : (
        <p className="registro-crear__ayuda">Falta aplicar supabase/mezclas.sql en Supabase.</p>
      )}
    </section>
  );
}
