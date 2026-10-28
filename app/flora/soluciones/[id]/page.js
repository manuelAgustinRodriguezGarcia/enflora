import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";
import { AccionesDetalleSolucion } from "@/componentes/flora/soluciones-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export async function generateMetadata({ params }) {
  return { title: "Solución guardada · Flora" };
}

function formatearFecha(iso) {
  try {
    return format(new Date(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });
  } catch {
    return "";
  }
}

export default async function PaginaDetalleSolucion({ params }) {
  if (!configuracionLista()) {
    return <p className="flora-soluciones__aviso">Falta la configuración de Supabase.</p>;
  }

  const usuario = await obtenerSesionRapida();
  if (!usuario) redirect("/ingreso");

  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("flora_soluciones")
    .select(
      "id, titulo, pregunta, respuesta, referencias, unidad_cultivo_id, planta_id, fecha_respuesta, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return (
      <p className="flora-soluciones__aviso">
        Solución no encontrada.{" "}
        <Link href="/flora/soluciones">Volver al listado</Link>
      </p>
    );
  }

  return (
    <article className="flora-soluciones-detalle">
      <header className="flora-soluciones-detalle__cabecera">
        <Link href="/flora/soluciones" className="flora-soluciones-detalle__volver">
          ← Soluciones
        </Link>
        <h1>{data.titulo}</h1>
        <time dateTime={data.fecha_respuesta}>
          Respuesta del {formatearFecha(data.fecha_respuesta)}
        </time>
      </header>

      <p className="flora-soluciones-detalle__aviso-historico" role="note">
        Esta es una respuesta generada en su fecha original. Los datos actuales de tu cultivo pueden
        haber cambiado; no uses fechas o recomendaciones históricas como si fueran vigentes hoy.
      </p>

      <section className="flora-soluciones-detalle__bloque">
        <h2>Tu pregunta</h2>
        <p className="flora-soluciones-detalle__pregunta">{data.pregunta}</p>
      </section>

      <section className="flora-soluciones-detalle__bloque">
        <h2>Respuesta de Flora</h2>
        <div className="flora-soluciones-detalle__respuesta">
          <MensajeFloraMarkdown texto={data.respuesta} animar={false} />
        </div>
      </section>

      {data.referencias ? (
        <section className="flora-soluciones-detalle__bloque flora-soluciones-detalle__refs">
          <h2>Referencias conservadas</h2>
          <pre>{JSON.stringify(data.referencias, null, 2)}</pre>
        </section>
      ) : null}

      <AccionesDetalleSolucion solucionId={data.id} tituloInicial={data.titulo} />
    </article>
  );
}
