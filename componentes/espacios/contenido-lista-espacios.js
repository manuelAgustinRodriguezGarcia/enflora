import Link from "next/link";
import { EnlaceBoton } from "@/componentes/boton";
import { EliminarEspacio } from "@/componentes/eliminar-espacio";
import { IconoLapiz } from "@/componentes/iconos-ui";
import { ImagenEspacio } from "@/componentes/imagen-espacio";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { etiquetaTipoEspacio, textoCantidad } from "@/lib/unidades";

export function ContenidoListaEspacios({ espacios, unidadesPorEspacio, plantasPorEspacio }) {
  if (espacios.length === 0) {
    return (
      <div className="vacio">
        <p>Todavía no hay espacios de cultivo.</p>
        <EnlaceBoton href="/espacios/nuevo">Crear espacio</EnlaceBoton>
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
              <ImagenEspacio tipo={espacio.tipo} className="imagen-espacio--miniatura" />
              <span className="tarjeta__info">
                <span className="tarjeta__cabecera">
                  <span className="tarjeta__nombre">{espacio.nombre}</span>
                  <span className="tarjeta__tipo">{etiquetaTipoEspacio(espacio.tipo)}</span>
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
            <div className="acciones acciones--tarjeta">
              <EnlaceBoton
                className="boton boton--secundario boton--icono"
                href={`/espacios/${espacio.id}/editar`}
                aria-label="Editar espacio"
              >
                <IconoLapiz />
              </EnlaceBoton>
              <EliminarEspacio espacioId={espacio.id} />
            </div>
          </li>
        );
      })}
    </ListaEntrada>
  );
}
