import Link from "next/link";
import { MenuAccionesTarjetaEspacio } from "@/componentes/espacios/menu-acciones-tarjeta-espacio";
import { ImagenEspacio } from "@/componentes/imagen-espacio";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { etiquetaTipoEspacio, textoCantidad } from "@/lib/unidades";

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
                <span className="tarjeta__metricas">
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
