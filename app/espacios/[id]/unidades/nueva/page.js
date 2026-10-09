import Link from "next/link";
import { notFound } from "next/navigation";
import { AsistenteEspacio } from "@/componentes/asistente-espacio";
import { TransicionVista } from "@/componentes/transicion-vista";
import { MAXIMO_UNIDADES, etiquetaTipoEspacio } from "@/lib/unidades";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaNuevaUnidad({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href={`/espacios/${id}`}>Volver al espacio</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id, nombre, tipo")
    .eq("id", id)
    .maybeSingle();

  if (errorEspacio || !espacio) notFound();

  const [unidadesRespuesta, metodosRespuesta] = await Promise.all([
    supabase.from("unidades_cultivo").select("id, tipo, numero").eq("espacio_id", espacio.id),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
  ]);

  if (unidadesRespuesta.error) return <p>No se pudieron cargar las unidades.</p>;

  const existentes = unidadesRespuesta.data || [];
  const metodosPersonalizados = metodosRespuesta.error
    ? []
    : (metodosRespuesta.data || []).map((metodo) => metodo.nombre);

  return (
    <TransicionVista>
    <section className="espacio">
      <Link href={`/espacios/${espacio.id}`}>Volver al espacio</Link>
      <h1>Agregar unidad</h1>
      <p>
        {espacio.nombre} · {etiquetaTipoEspacio(espacio.tipo)}
      </p>
      {metodosRespuesta.error ? <p>No se pudieron cargar los métodos.</p> : null}
      {existentes.length >= MAXIMO_UNIDADES ? (
        <p>Se pueden crear hasta 20 unidades.</p>
      ) : (
        <AsistenteEspacio
          metodosPersonalizados={metodosPersonalizados}
          espacio={{
            id: espacio.id,
            nombre: espacio.nombre,
            tipo: espacio.tipo,
            ocupadas: {
              total: existentes.length,
              sala: existentes.some((unidad) => unidad.tipo === "sala"),
              aire_libre: existentes.some((unidad) => unidad.tipo === "aire_libre"),
              carpas: existentes.filter((unidad) => unidad.tipo === "carpa").length,
              invernaderos: existentes.filter((unidad) => unidad.tipo === "invernadero").length,
            },
          }}
        />
      )}
    </section>
    </TransicionVista>
  );
}
