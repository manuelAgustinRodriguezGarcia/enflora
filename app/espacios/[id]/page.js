import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuAccionesTarjetaEspacio } from "@/componentes/espacios/menu-acciones-tarjeta-espacio";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { PortadaUnidad } from "@/componentes/portada-unidad";
import { TransicionVista } from "@/componentes/transicion-vista";
import { firmarPortadas } from "@/lib/cargar-fotos";
import { listarUnidadesConPortada } from "@/lib/consultar-unidad";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { etiquetaTipoEspacio, etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

export default async function PaginaEspacio({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <EnlaceVolver href="/espacios" etiqueta="Volver a espacios" />
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

  const unidadesRespuesta = await listarUnidadesConPortada(supabase, espacio.id);
  if (unidadesRespuesta.error) return <p>No se pudieron cargar las unidades.</p>;

  const lista = unidadesRespuesta.unidades || [];
  const portadas = await firmarPortadas(supabase, lista);
  const ids = lista.map((unidad) => unidad.id);
  let cantidades = {};

  if (ids.length) {
    const { data: plantas, error: errorPlantas } = await supabase
      .from("plantas")
      .select("unidad_cultivo_id")
      .in("unidad_cultivo_id", ids);

    if (errorPlantas) return <p>No se pudieron cargar las plantas.</p>;

    cantidades = {};
    for (const planta of plantas || []) {
      cantidades[planta.unidad_cultivo_id] = (cantidades[planta.unidad_cultivo_id] || 0) + 1;
    }
  }

  const total = Object.values(cantidades).reduce((suma, cantidad) => suma + cantidad, 0);

  return (
    <TransicionVista>
      <section className="espacio">
        <EnlaceVolver href="/espacios" etiqueta="Volver a espacios" />
        <header className="detalle-cabecera">
          <div className="detalle-cabecera__superior">
            <h1 className="detalle-cabecera__titulo">{espacio.nombre}</h1>
            <div className="detalle-cabecera__acciones">
              <MenuAccionesTarjetaEspacio espacioId={espacio.id} lado="bottom" />
            </div>
          </div>
          <div className="detalle-cabecera__fila">
            <span className={`detalle-cabecera__chip detalle-cabecera__chip--${espacio.tipo}`}>
              {etiquetaTipoEspacio(espacio.tipo)}
            </span>
            <span className="detalle-cabecera__meta">
              {lista.length === 1 ? "1 unidad" : `${lista.length} unidades`}
            </span>
            <span className="detalle-cabecera__meta">{textoCantidad(total)}</span>
          </div>
        </header>
        <h2>Unidades</h2>
        {lista.length === 0 ? (
          <div className="vacio">
            <p>Todavía no hay unidades en este espacio.</p>
          </div>
        ) : (
          <ListaEntrada>
            {lista.map((unidad) => (
              <li key={unidad.id}>
                <Link
                  className="tarjeta tarjeta--unidad"
                  href={`/espacios/${espacio.id}/unidades/${unidad.id}`}
                >
                  <PortadaUnidad
                    url={portadas.get(unidad.id)?.miniatura || ""}
                    className="tarjeta__portada"
                  />
                  <div className="tarjeta__info">
                    <div className="tarjeta__cabecera">
                      <span className="tarjeta__nombre">{unidad.nombre}</span>
                      <span className="tarjeta__tipo">
                        {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)}
                      </span>
                    </div>
                    <div className="tarjeta__metricas">
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Plantas</span>
                        <span className="tarjeta__valor">{textoCantidad(cantidades[unidad.id] || 0)}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ListaEntrada>
        )}
        <FabNuevoChatFlora
          href={`/espacios/${espacio.id}/unidades/nueva`}
          ariaLabel="Agregar unidad"
        />
      </section>
    </TransicionVista>
  );
}
