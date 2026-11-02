import Link from "next/link";
import { redirect } from "next/navigation";
import { EnlaceBoton } from "@/componentes/boton";
import { FormularioCrearRegistro } from "@/componentes/formulario-crear-registro";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarRegistrosUsuario } from "@/lib/cargar-registros";
import {
  cargarSeguimiento,
  leerSeguimiento,
  seguimientoDesdeLectura,
} from "@/lib/cargar-seguimiento";
import { esUuid } from "@/lib/historial-registros";
import { cargarCatalogoMezclas } from "@/lib/mezclas/cargar";
import { rangoDiaLocal } from "@/lib/registros";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export default async function PaginaRegistros({ searchParams }) {
  const parametros = await searchParams;
  const registroInicialId = esUuid(parametros?.editar) ? String(parametros.editar).trim() : "";
  if (!configuracionLista()) {
    return (
      <section className="registros">
        <h1>Registrar</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
  }

  const supabase = await crearClienteServidor();
  const dia = rangoDiaLocal();

  // Todo lo independiente se pide junto: antes eran cuatro vueltas a la base en serie.
  const [
    perfilRespuesta,
    espaciosRespuesta,
    unidadesRespuesta,
    plantasRespuesta,
    lecturaSeguimiento,
    hoy,
    catalogoMezclas,
  ] = await Promise.all([
    supabase.from("perfiles").select("tipo_seguimiento").eq("id", user.id).maybeSingle(),
    supabase.from("espacios").select("id, nombre").order("nombre"),
    supabase
      .from("unidades_cultivo")
      .select("id, nombre, tipo, tipo_personalizado, numero, espacio_id")
      .order("numero"),
    supabase
      .from("plantas")
      .select("id, nombre, genetica, numero, unidad_cultivo_id, estado")
      .order("numero"),
    leerSeguimiento(supabase, user.id),
    cargarRegistrosUsuario(supabase, {
      desde: dia.desde,
      hasta: dia.hasta,
      limite: 30,
    }),
    cargarCatalogoMezclas(supabase),
  ]);

  if (
    perfilRespuesta.error ||
    espaciosRespuesta.error ||
    unidadesRespuesta.error ||
    plantasRespuesta.error
  ) {
    return (
      <section className="registros">
        <h1>Registrar</h1>
        <p>No se pudieron cargar los datos para registrar.</p>
      </section>
    );
  }

  const espaciosPorId = new Map((espaciosRespuesta.data || []).map((item) => [item.id, item]));
  const plantasPorUnidad = new Map();

  for (const planta of plantasRespuesta.data || []) {
    const lista = plantasPorUnidad.get(planta.unidad_cultivo_id) || [];
    lista.push(planta);
    plantasPorUnidad.set(planta.unidad_cultivo_id, lista);
  }

  const unidades = (unidadesRespuesta.data || [])
    .map((unidad) => {
      const espacio = espaciosPorId.get(unidad.espacio_id);
      if (!espacio) return null;
      return {
        id: unidad.id,
        nombre: unidad.nombre,
        tipo: unidad.tipo,
        tipo_personalizado: unidad.tipo_personalizado,
        numero: unidad.numero,
        espacio_id: unidad.espacio_id,
        espacio_nombre: espacio.nombre,
        plantas: plantasPorUnidad.get(unidad.id) || [],
      };
    })
    .filter(Boolean);

  const tipo = perfilRespuesta.data?.tipo_seguimiento || "";
  let seguimientoCargado = { error: false, acciones: [], parametros: [], opciones: [] };
  if (esTipoSeguimiento(tipo)) {
    // Caso normal: la fila de preferencias ya existe y no hace falta ninguna consulta extra.
    // Solo si falta (usuario nuevo) se la crea con la RPC y se vuelve a leer.
    seguimientoCargado =
      !lecturaSeguimiento.error && lecturaSeguimiento.preferencias
        ? seguimientoDesdeLectura(lecturaSeguimiento)
        : await cargarSeguimiento(supabase, user.id, tipo);
  }

  if (seguimientoCargado.error) {
    return (
      <section className="registros">
        <h1>Registrar</h1>
        <p>No se pudieron cargar las preferencias de seguimiento.</p>
      </section>
    );
  }

  return (
    <TransicionVista>
      <section className="registros">
        <h1>Registrar</h1>
        <p className="registros__catalogo">
          <Link className="mezclas__enlace" href="/registros/productos">
            Mis productos
          </Link>
          <Link className="mezclas__enlace" href="/registros/recetas">
            Mis recetas
          </Link>
        </p>
        {unidades.length === 0 ? (
          <div className="vacio">
            <p>Necesitás al menos una unidad de cultivo para registrar.</p>
            <EnlaceBoton href="/espacios">Ir a espacios</EnlaceBoton>
          </div>
        ) : (
          <FormularioCrearRegistro
            unidades={unidades}
            seguimientoInicial={{
              tipo,
              acciones: seguimientoCargado.acciones,
              parametros: seguimientoCargado.parametros,
              opciones: seguimientoCargado.opciones,
            }}
            registrosHoy={hoy.error ? [] : hoy.registros}
            registroInicialId={registroInicialId}
            usuarioId={user.id}
            catalogoMezclas={catalogoMezclas}
          />
        )}
      </section>
    </TransicionVista>
  );
}
