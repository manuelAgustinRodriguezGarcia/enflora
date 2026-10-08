import Link from "next/link";
import { AsistenteEspacio } from "@/componentes/asistente-espacio";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaNuevoEspacio() {
  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href="/espacios">Volver a espacios</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("metodos_personalizados")
    .select("nombre")
    .order("nombre", { ascending: true });

  const metodosPersonalizados = error ? [] : (data || []).map((metodo) => metodo.nombre);

  return (
    <section className="espacio">
      <Link href="/espacios">Volver a espacios</Link>
      <h1>Crear espacio</h1>
      {error ? <p>No se pudieron cargar los métodos.</p> : null}
      <AsistenteEspacio metodosPersonalizados={metodosPersonalizados} />
    </section>
  );
}
