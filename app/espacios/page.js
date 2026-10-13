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
          <div className="vacio">
            <p>Todavía no hay espacios de cultivo.</p>
            <EnlaceBoton href="/espacios/nuevo">Crear espacio</EnlaceBoton>
          </div>
        ) : (
          <ListaEntrada>
            {espacios.map((espacio) => {
              const cantidadUnidades = unidadesPorEspacio[espacio.id] || 0;
              return (
                <li className="tarjeta" key={espacio.id}>
                  <Link className="tarjeta__cuerpo" href={`/espacios/${espacio.id}`}>
                    <div className="tarjeta__cabecera">
                      <span className="tarjeta__nombre">{espacio.nombre}</span>
                      <span className="tarjeta__tipo">{etiquetaTipoEspacio(espacio.tipo)}</span>
                    </div>
                    <div className="tarjeta__metricas">
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Unidades</span>
                        <span className="tarjeta__valor">
                          {cantidadUnidades === 1 ? "1 unidad" : `${cantidadUnidades} unidades`}
                        </span>
                      </span>
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Plantas</span>
                        <span className="tarjeta__valor">
                          {textoCantidad(plantasPorEspacio[espacio.id] || 0)}
                        </span>
                      </span>
                    </div>
                  </Link>
                  <div className="acciones acciones--tarjeta">
                    <EnlaceBoton
                      className="boton boton--secundario"
                      href={`/espacios/${espacio.id}/editar`}
                    >
                      Editar
                    </EnlaceBoton>
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
