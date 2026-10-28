import { notFound, redirect } from "next/navigation";
import { CabeceraUnidad } from "@/componentes/cabecera-unidad";
import { EnlaceBoton } from "@/componentes/boton";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { GaleriaFotos } from "@/componentes/galeria-fotos";
import { ListaTareasPendientes } from "@/componentes/lista-tareas-pendientes";
import { cargarTareasPendientesUnidad } from "@/lib/cargar-tareas";
import { PanelAgregarPlanta } from "@/componentes/panel-agregar-planta";
import { SeleccionPlantasUnidad } from "@/componentes/seleccion-plantas-unidad";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarFotosDeUnidad, firmarPortadas } from "@/lib/cargar-fotos";
import { consultarUnidad } from "@/lib/consultar-unidad";
import { fechaHoy } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

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

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const lectura = await consultarUnidad(supabase, { unidadId, espacioId: id });
  if (lectura.error || !lectura.unidad) notFound();

  const unidad = lectura.unidad;

  const [plantasRespuesta, metodosRespuesta, espacioRespuesta, fotosRespuesta, tareasRespuesta] =
    await Promise.all([
    supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, fecha_creacion, estado, numero")
      .eq("unidad_cultivo_id", unidad.id)
      .order("numero", { ascending: true }),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
    supabase.from("espacios").select("tipo").eq("id", id).maybeSingle(),
    cargarFotosDeUnidad(supabase, unidad.id),
    cargarTareasPendientesUnidad(supabase, unidad.id),
  ]);

  if (plantasRespuesta.error) return <p>No se pudieron cargar las plantas.</p>;
  if (metodosRespuesta.error) return <p>No se pudieron cargar los métodos.</p>;
  if (espacioRespuesta.error || !espacioRespuesta.data) notFound();

  const portadas = await firmarPortadas(supabase, [unidad], { conOriginal: true });
  const portadaFirmada = portadas.get(unidad.id);
  const portadaUrl = portadaFirmada?.portada || portadaFirmada?.miniatura || "";
  const tienePortada = Boolean(unidad.portada_ruta && unidad.portada_miniatura);

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
          portadaUrl={portadaUrl}
          usuarioId={user.id}
          tienePortada={tienePortada}
        />
        <ListaTareasPendientes tareas={tareasRespuesta.tareas} />
        {tareasRespuesta.error ? (
          <p className="galeria-fotos__vacio" role="alert">
            No se pudieron cargar las tareas pendientes.
          </p>
        ) : null}
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
        <GaleriaFotos
          fotos={fotosRespuesta.fotos}
          titulo="Fotos de la unidad"
          vacio="Todavía no hay fotos en los registros de esta unidad (incluye registros de ambiente)."
        />
        {fotosRespuesta.error ? (
          <p className="galeria-fotos__vacio" role="alert">
            No se pudieron cargar las fotos de la unidad.
          </p>
        ) : null}
        <EnlaceBoton
          href={`/registros/historial?unidad=${unidad.id}`}
          variante="secundario"
          className="registros__historial"
        >
          Ver historial
        </EnlaceBoton>
      </section>
    </TransicionVista>
  );
}
