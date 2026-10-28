import { redirect } from "next/navigation";
import { SolucionesVista } from "@/componentes/flora/soluciones-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Soluciones de Flora",
  description: "Biblioteca privada de respuestas guardadas de Flora.",
};

export default async function PaginaListaSoluciones() {
  if (!configuracionLista()) {
    return <p className="flora-soluciones__aviso">Falta la configuración de Supabase.</p>;
  }

  const usuario = await obtenerSesionRapida();
  if (!usuario) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("flora_soluciones")
    .select("id, titulo, pregunta, respuesta, fecha_respuesta")
    .order("fecha_respuesta", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="flora-soluciones__aviso">No se pudieron cargar las soluciones.</p>;
  }

  return (
    <section className="flora-soluciones-pagina" aria-labelledby="soluciones-titulo">
      <SolucionesVista soluciones={data || []} />
    </section>
  );
}
