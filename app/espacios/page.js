import Link from "next/link";
import { EnlaceBoton } from "@/componentes/boton";
import { EliminarEspacio } from "@/componentes/eliminar-espacio";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { etiquetaTipoEspacio, textoCantidad } from "@/lib/unidades";

export default async function PaginaEspacios() {
  if (!configuracionLista()) {
    return (
      <section className="espacios">
        <h1>Espacios</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const [espaciosRespuesta, unidadesRespuesta, plantasRespuesta] = await Promise.all([
    supabase.from("espacios").select("id, nombre, tipo").order("fecha_creacion", { ascending: true }),
    supabase.from("unidades_cultivo").select("id, espacio_id"),
    supabase.from("plantas").select("unidad_cultivo_id"),
  ]);

  if (espaciosRespuesta.error || unidadesRespuesta.error || plantasRespuesta.error) {
    return <p>No se pudieron cargar los espacios.</p>;
  }

  const unidades = unidadesRespuesta.data || [];
  const espacioDeUnidad = {};
  const unidadesPorEspacio = {};

  for (const unidad of unidades) {
    espacioDeUnidad[unidad.id] = unidad.espacio_id;
    unidadesPorEspacio[unidad.espacio_id] = (unidadesPorEspacio[unidad.espacio_id] || 0) + 1;
  }

  const plantasPorEspacio = {};
  for (const planta of plantasRespuesta.data || []) {
    const espacioId = espacioDeUnidad[planta.unidad_cultivo_id];
    if (!espacioId) continue;
    plantasPorEspacio[espacioId] = (plantasPorEspacio[espacioId] || 0) + 1;
  }

  const espacios = espaciosRespuesta.data || [];

  return (
    <TransicionVista>
    <section className="espacios">
      <h1>Espacios</h1>
      <EnlaceBoton href="/espacios/nuevo">Crear espacio</EnlaceBoton>
      {espacios.length === 0 ? (
        <p>No hay espacios de cultivo.</p>
      ) : (
        <ListaEntrada>
          {espacios.map((espacio) => {
            const cantidadUnidades = unidadesPorEspacio[espacio.id] || 0;
            return (
              <li className="tarjeta" key={espacio.id}>
                <Link className="tarjeta__cuerpo" href={`/espacios/${espacio.id}`}>
                  <span className="tarjeta__nombre">{espacio.nombre}</span>
                  <span className="tarjeta__meta">{etiquetaTipoEspacio(espacio.tipo)}</span>
                  <span className="tarjeta__meta">
                    {cantidadUnidades === 1 ? "1 unidad" : `${cantidadUnidades} unidades`}
                  </span>
                  <span className="tarjeta__meta">
                    {textoCantidad(plantasPorEspacio[espacio.id] || 0)}
                  </span>
                </Link>
                <div className="acciones">
                  <Link href={`/espacios/${espacio.id}/editar`}>Editar</Link>
                  <EliminarEspacio espacioId={espacio.id} />
                </div>
              </li>
            );
          })}
        </ListaEntrada>
      )}
    </section>
    </TransicionVista>
  );
}
