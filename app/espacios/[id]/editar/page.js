import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioEspacio } from "@/componentes/formulario-espacio";
import { TransicionVista } from "@/componentes/transicion-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaEditarEspacio({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href="/espacios">Volver a espacios</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: espacio, error } = await supabase
    .from("espacios")
    .select("id, nombre, tipo")
    .eq("id", id)
    .maybeSingle();

  if (error || !espacio) {
    notFound();
  }

  return (
    <TransicionVista>
      <section className="espacio">
        <Link href={`/espacios/${espacio.id}`}>Volver al espacio</Link>
        <h1>Editar espacio</h1>
        <FormularioEspacio espacio={espacio} />
      </section>
    </TransicionVista>
  );
}
