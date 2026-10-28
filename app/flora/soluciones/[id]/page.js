import Link from "next/link";
import { redirect } from "next/navigation";
import { SolucionDetalleVista } from "@/componentes/flora/soluciones-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export async function generateMetadata({ params }) {
  return { title: "Solución guardada · Flora" };
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

  return <SolucionDetalleVista solucion={data} />;
}
