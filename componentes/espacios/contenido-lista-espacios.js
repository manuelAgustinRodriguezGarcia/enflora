import Link from "next/link";
import { MenuAccionesTarjetaEspacio } from "@/componentes/espacios/menu-acciones-tarjeta-espacio";
import { ImagenEspacio } from "@/componentes/imagen-espacio";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { PillPlantas, PillUnidades } from "@/componentes/resumen-configuracion";
import { etiquetaTipoEspacio } from "@/lib/unidades";

export function ContenidoListaEspacios({ espacios, unidadesPorEspacio, plantasPorEspacio }) {
  if (espacios.length === 0) {
    return (
      <div className="vacio">
        <p>Todavía no hay espacios de cultivo.</p>
      </div>
    );
  }

  return (
    <ListaEntrada>
      {espacios.map((espacio) => {
        const cantidadUnidades = unidadesPorEspacio[espacio.id] || 0;
        return (
          <li className="tarjeta tarjeta--espacio" key={espacio.id}>
            <Link className="tarjeta__cuerpo" href={`/espacios/${espacio.id}`}>
              <span className="tarjeta__visual">
                <ImagenEspacio tipo={espacio.tipo} className="imagen-espacio--miniatura" />
                <span className={`tarjeta__tipo tarjeta__tipo--${espacio.tipo}`}>
                  {etiquetaTipoEspacio(espacio.tipo)}
                </span>
              </span>
              <span className="tarjeta__info">
                <span className="tarjeta__cabecera">
                  <span className="tarjeta__nombre">{espacio.nombre}</span>
                </span>
                <span className="tarjeta__metricas tarjeta__metricas--pills">
                  <PillUnidades cantidad={cantidadUnidades} />
                  <PillPlantas cantidad={plantasPorEspacio[espacio.id] || 0} mostrarCero />
                </span>
              </span>
            </Link>
            <MenuAccionesTarjetaEspacio espacioId={espacio.id} />
          </li>
        );
      })}
    </ListaEntrada>
  );
}
