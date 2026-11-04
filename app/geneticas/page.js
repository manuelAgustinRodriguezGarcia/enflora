import { redirect } from "next/navigation";
import { ListaGeneticas } from "@/componentes/lista-geneticas";
import { listarGeneticasPropias } from "@/lib/geneticas/datos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mis genéticas",
  robots: { index: false, follow: false },
};

export default async function PaginaGeneticas() {
  if (!configuracionLista()) {
    return (
      <section className="registros">
        <h1>Mis genéticas</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const lista = await listarGeneticasPropias(supabase, user.id);
  if (lista.error) {
    return (
      <section className="registros">
        <h1>Mis genéticas</h1>
        <p>{lista.error}</p>
      </section>
    );
  }

  return (
    <section className="registros">
      <h1>Mis genéticas</h1>
      <ListaGeneticas iniciales={lista.geneticas || []} esquemaAusente={Boolean(lista.esquemaAusente)} />
    </section>
  );
}
