import { notFound } from "next/navigation";
import { CabeceraUnidad } from "@/componentes/cabecera-unidad";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { PanelAgregarPlanta } from "@/componentes/panel-agregar-planta";
import { SeleccionPlantasUnidad } from "@/componentes/seleccion-plantas-unidad";
import { TransicionVista } from "@/componentes/transicion-vista";
import { fechaHoy } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function siguienteNumero(plantas) {
  let maximo = 0;
  for (const planta of plantas) {
    if (planta.numero > maximo) maximo = planta.numero;
  }
  return maximo + 1;
}

export default async function PaginaUnidad({ params }) {
  const { id, unidadId } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <EnlaceVolver href={`/espacios/${id}`} etiqueta="Volver al espacio" />
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: unidad, error: errorUnidad } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, tipo, tipo_personalizado, numero, espacio_id")
    .eq("id", unidadId)
    .eq("espacio_id", id)
    .maybeSingle();

  if (errorUnidad || !unidad) notFound();

  const [plantasRespuesta, metodosRespuesta, espacioRespuesta] = await Promise.all([
    supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, fecha_creacion, estado, numero")
      .eq("unidad_cultivo_id", unidad.id)
      .order("numero", { ascending: true }),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
    supabase.from("espacios").select("tipo").eq("id", id).maybeSingle(),
  ]);

  if (plantasRespuesta.error) return <p>No se pudieron cargar las plantas.</p>;
  if (metodosRespuesta.error) return <p>No se pudieron cargar los métodos.</p>;
  if (espacioRespuesta.error || !espacioRespuesta.data) notFound();

  const lista = plantasRespuesta.data || [];
  const metodosPersonalizados = (metodosRespuesta.data || []).map((metodo) => metodo.nombre);
  const hoy = fechaHoy();
  let abiertas = [];

  if (lista.length) {
    const historialRespuesta = await supabase
      .from("historial_etapas")
      .select("planta_id, etapa, fecha_inicio, fecha_fin")
      .in(
        "planta_id",
        lista.map((planta) => planta.id)
      )
      .is("fecha_fin", null);
    if (!historialRespuesta.error) abiertas = historialRespuesta.data || [];
  }

  const inicioPorPlanta = Object.fromEntries(abiertas.map((fila) => [fila.planta_id, fila]));

  return (
    <TransicionVista>
      <section className="espacio">
        <EnlaceVolver href={`/espacios/${unidad.espacio_id}`} etiqueta="Volver al espacio" />
        <CabeceraUnidad
          unidad={unidad}
          espacioId={unidad.espacio_id}
          tipoEspacio={espacioRespuesta.data.tipo}
          cantidadPlantas={lista.length}
        />
        <SeleccionPlantasUnidad
          espacioId={unidad.espacio_id}
          unidadId={unidad.id}
          plantas={lista}
          inicioPorPlanta={inicioPorPlanta}
          hoy={hoy}
        />
        <PanelAgregarPlanta
          unidadId={unidad.id}
          siguienteNumero={siguienteNumero(lista)}
          metodosPersonalizados={metodosPersonalizados}
        />
      </section>
    </TransicionVista>
  );
}
