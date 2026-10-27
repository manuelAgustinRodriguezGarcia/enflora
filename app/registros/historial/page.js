import { redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { PaginaHistorialCultivo } from "@/componentes/pagina-historial-cultivo";
import { TransicionVista } from "@/componentes/transicion-vista";
import { afirmarFiltrosHistorial } from "@/lib/cargar-registros";
import { cargarHistorialVistaUnidad } from "@/lib/cargar-historial-vista";
import { filtrosDesdeConsulta } from "@/lib/historial-registros";
import { agruparPlantasPorGenetica } from "@/lib/registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Historial",
};

function catalogoGeneticas(plantas, unidadId, activa) {
  const mapa = new Map();
  const alcance = unidadId
    ? plantas.filter((planta) => planta.unidad_cultivo_id === unidadId)
    : plantas;
  for (const grupo of agruparPlantasPorGenetica(alcance)) {
    mapa.set(grupo.clave, grupo.etiqueta);
  }
  if (activa && !mapa.has(activa)) mapa.set(activa, activa);
  return [...mapa.entries()]
    .map(([clave, etiqueta]) => ({ clave, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export default async function PaginaHistorial({ searchParams }) {
  const parametros = await searchParams;

  if (!configuracionLista()) {
    return (
      <section className="historial">
        <h1>Historial</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const normalizado = filtrosDesdeConsulta(parametros);
  const filtros = !normalizado.error ? normalizado.filtros : null;

  const [espaciosRespuesta, unidadesRespuesta, plantasRespuesta] = await Promise.all([
    supabase.from("espacios").select("id, nombre").order("nombre"),
    supabase.from("unidades_cultivo").select("id, nombre, espacio_id").order("numero"),
    supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero, unidad_cultivo_id")
      .order("numero"),
  ]);

  if (espaciosRespuesta.error || unidadesRespuesta.error || plantasRespuesta.error) {
    return (
      <TransicionVista>
        <section className="historial">
          <EnlaceVolver href="/registros" etiqueta="Volver a registros" />
          <h1>Historial</h1>
          <p className="historial__error" role="alert">No se pudieron cargar los datos del historial.</p>
        </section>
      </TransicionVista>
    );
  }

  const espaciosPorId = new Map((espaciosRespuesta.data || []).map((item) => [item.id, item]));
  const unidades = (unidadesRespuesta.data || []).map((unidad) => ({
    id: unidad.id,
    nombre: unidad.nombre,
    espacioId: unidad.espacio_id,
    espacioNombre: espaciosPorId.get(unidad.espacio_id)?.nombre || "",
  }));
  const plantas = plantasRespuesta.data || [];

  let mensajeFiltro = normalizado.error;
  let datosVista = null;
  let geneticas = [];

  if (!mensajeFiltro && filtros?.unidadId) {
    const propio = await afirmarFiltrosHistorial(supabase, filtros);
    if (propio.error) {
      mensajeFiltro = propio.error;
    } else if (filtros.sinContenido) {
      mensajeFiltro = "Elegí al menos un tipo de contenido para ver registros.";
      } else {
        const cargado = await cargarHistorialVistaUnidad(supabase, filtros);
        if (cargado.error) {
          mensajeFiltro = cargado.error;
        } else {
          geneticas = catalogoGeneticas(plantas, filtros.unidadId, filtros.genetica);
          datosVista = {
            unidad: cargado.unidad,
            espacioNombre: cargado.espacioNombre,
            plantas: cargado.plantas,
            historialBase: cargado.historial,
            registrosIniciales: cargado.registrosIniciales,
            hayMasDias: cargado.hayMasDias,
            cursorDias: cargado.cursorDias,
            resumen: cargado.resumen,
            portada: cargado.portada,
            etapas: cargado.etapas,
            etapasPorPlanta: cargado.etapasPorPlanta,
          };
        }
      }
  }

  return (
    <TransicionVista>
      <section className="historial historial--vista-cultivo">
        <EnlaceVolver href="/registros" etiqueta="Volver a registros" />
        <header className="historial__cabecera">
          <h1>Historial</h1>
          <p className="historial__intro">
            Recorré el cultivo con fotos, etapas, mediciones y registros día a día. Podés editar o eliminar cada evento.
          </p>
        </header>
        <PaginaHistorialCultivo
          unidades={unidades}
          filtros={filtros}
          mensajeFiltro={mensajeFiltro}
          datosVista={datosVista}
          geneticas={geneticas}
        />
      </section>
    </TransicionVista>
  );
}
