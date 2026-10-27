import { redirect } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { HistorialRegistros } from "@/componentes/historial-registros";
import { TransicionVista } from "@/componentes/transicion-vista";
import { afirmarFiltrosHistorial, cargarHistorialRegistros } from "@/lib/cargar-registros";
import { filtrosDesdeConsulta } from "@/lib/historial-registros";
import { agruparPlantasPorGenetica, normalizarGenetica } from "@/lib/registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { adjuntarMiniaturas } from "@/lib/fotos-servidor";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const metadata = {
  title: "Historial",
};

function catalogoGeneticas(plantas, filas, activa) {
  const mapa = new Map();
  for (const grupo of agruparPlantasPorGenetica(plantas)) {
    mapa.set(grupo.clave, grupo.etiqueta);
  }
  for (const fila of filas || []) {
    const clave = normalizarGenetica(fila.genetica_clave);
    if (!clave || mapa.has(clave)) continue;
    mapa.set(clave, fila.genetica_etiqueta || clave);
  }
  if (activa && !mapa.has(activa)) mapa.set(activa, activa);
  return [...mapa.entries()]
    .map(([clave, etiqueta]) => ({ clave, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

function cargarEtapasPlanta(supabase, filtros) {
  let consulta = supabase
    .from("historial_etapas")
    .select("id, etapa, fecha_inicio, fecha_fin")
    .eq("planta_id", filtros.plantaId)
    .order("fecha_inicio", { ascending: false });
  if (filtros.desde) consulta = consulta.gte("fecha_inicio", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha_inicio", filtros.hasta);
  return consulta;
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
  const traerRegistros = Boolean(filtros && !filtros.sinContenido);
  const traerEtapas = Boolean(
    traerRegistros && filtros.plantaId && filtros.contenidos.length === 3
  );

  // Los filtros ya vienen de la URL: la validación de pertenencia, la página de registros y las
  // etapas no dependen de los catálogos, así que todo se pide en una sola tanda.
  const [
    espaciosRespuesta,
    unidadesRespuesta,
    plantasRespuesta,
    geneticasRespuesta,
    propio,
    pagina,
    etapasRespuesta,
  ] = await Promise.all([
      supabase.from("espacios").select("id, nombre").order("nombre"),
      supabase
        .from("unidades_cultivo")
        .select("id, nombre, espacio_id")
        .order("numero"),
      supabase
        .from("plantas")
        .select("id, nombre, genetica, numero, unidad_cultivo_id")
        .order("numero"),
      supabase
        .from("registros")
        .select("genetica_clave, genetica_etiqueta")
        .not("genetica_clave", "is", null)
        .limit(100),
      filtros ? afirmarFiltrosHistorial(supabase, filtros) : Promise.resolve({ error: "" }),
      traerRegistros
        ? cargarHistorialRegistros(supabase, filtros)
        : Promise.resolve(null),
      traerEtapas ? cargarEtapasPlanta(supabase, filtros) : Promise.resolve(null),
    ]);

  if (espaciosRespuesta.error || unidadesRespuesta.error || plantasRespuesta.error) {
    return (
      <TransicionVista>
        <section className="historial">
          <EnlaceVolver href="/registros" etiqueta="Volver a registros" />
          <h1>Historial</h1>
          <p className="historial__error" role="alert">
            No se pudieron cargar los datos del historial.
          </p>
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
  const geneticas = catalogoGeneticas(
    plantas,
    geneticasRespuesta.error ? [] : geneticasRespuesta.data,
    normalizado.filtros?.genetica
  );

  let mensajeFiltro = normalizado.error;
  let registros = [];
  let hayMas = false;
  let errorCarga = false;
  let etapas = [];
  let errorEtapas = false;
  let fichaPlanta = null;

  if (!mensajeFiltro && normalizado.filtros) {
    if (propio.error) {
      mensajeFiltro = propio.error;
    } else if (pagina) {
      if (pagina.error) errorCarga = true;
      else {
        registros = await adjuntarMiniaturas(supabase, pagina.registros);
        hayMas = pagina.hayMas;
      }

      if (etapasRespuesta) {
        if (etapasRespuesta.error) errorEtapas = true;
        else etapas = etapasRespuesta.data || [];

        const planta = plantas.find((item) => item.id === normalizado.filtros.plantaId);
        const unidad = unidades.find((item) => item.id === planta?.unidad_cultivo_id);
        if (planta && unidad) {
          fichaPlanta = {
            href: `/espacios/${unidad.espacioId}/unidades/${unidad.id}/plantas/${planta.id}`,
            nombre: planta.nombre,
          };
        }
      }
    }
  }

  return (
    <TransicionVista>
      <section className="historial">
        <EnlaceVolver href="/registros" etiqueta="Volver a registros" />
        <header className="historial__cabecera">
          <h1>Historial</h1>
          <p className="historial__intro">
            Consultá, editá o eliminá registros anteriores. Los de hoy siguen en Nuevo registro.
          </p>
        </header>
        <HistorialRegistros
          key={JSON.stringify(normalizado.filtros || { error: normalizado.error })}
          filtros={normalizado.filtros}
          registros={registros}
          hayMas={hayMas}
          errorCarga={errorCarga}
          mensajeFiltro={mensajeFiltro}
          unidades={unidades}
          plantas={plantas.map((planta) => ({
            id: planta.id,
            nombre: planta.nombre,
            genetica: planta.genetica,
            numero: planta.numero,
            unidadId: planta.unidad_cultivo_id,
          }))}
          geneticas={geneticas}
          etapas={etapas}
          errorEtapas={errorEtapas}
          fichaPlanta={fichaPlanta}
        />
      </section>
    </TransicionVista>
  );
}
