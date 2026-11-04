import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { fechaInicioPlanta, formatearFecha } from "@/lib/etapas";

export function etiquetaEstadoPlanta(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

export function ContenidoTarjetaPlanta({ planta, datos }) {
  const dia = Number.isFinite(datos.dia) ? datos.dia : null;

  return (
    <>
      <div className="tarjeta__cabecera">
        <span className="tarjeta__nombre">{planta.nombre}</span>
        <span className="tarjeta__estado">
          <IndicadorEtapa etapa={planta.etapa} tamano="compacto" dias={dia === null ? null : [dia]} />
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
        {dia === null ? (
          <span className="tarjeta__dato">
            <span className="tarjeta__etiqueta">Inicio</span>
            <span className="tarjeta__valor">{formatearFecha(fechaInicioPlanta(planta))}</span>
          </span>
        ) : null}
        {planta.estado && planta.estado !== "activa" ? (
          <span className="tarjeta__dato">
            <span className="tarjeta__etiqueta">Estado</span>
            <span className="tarjeta__valor">{etiquetaEstadoPlanta(planta.estado)}</span>
          </span>
        ) : null}
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
