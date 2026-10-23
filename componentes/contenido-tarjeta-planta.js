import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { fechaInicioPlanta, formatearFecha } from "@/lib/etapas";

export function etiquetaEstadoPlanta(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

export function ContenidoTarjetaPlanta({ planta, datos }) {
  return (
    <>
      <div className="tarjeta__cabecera">
        <span className="tarjeta__nombre">{planta.nombre}</span>
        <span className="tarjeta__estado">
          <IndicadorEtapa etapa={planta.etapa} tamano="compacto" />
        </span>
      </div>
      <div className="tarjeta__metricas">
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Genética</span>
          <span className="tarjeta__valor">{planta.genetica || "—"}</span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Método</span>
          <span className="tarjeta__valor">{planta.metodo || "—"}</span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">{datos.dia === null ? "Inicio" : "Día"}</span>
          <span className="tarjeta__valor">
            {datos.dia === null ? formatearFecha(fechaInicioPlanta(planta)) : datos.dia}
          </span>
        </span>
        <span className="tarjeta__dato">
          <span className="tarjeta__etiqueta">Estado</span>
          <span className="tarjeta__valor">{etiquetaEstadoPlanta(planta.estado)}</span>
        </span>
        {planta.sustrato ? (
          <span className="tarjeta__dato">
            <span className="tarjeta__etiqueta">Sustrato</span>
            <span className="tarjeta__valor">{planta.sustrato}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}
