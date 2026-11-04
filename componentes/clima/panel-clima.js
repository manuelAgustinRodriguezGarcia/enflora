import { TarjetaClima } from "@/componentes/clima/tarjeta-clima";
import { diasParaInicio } from "@/lib/clima/resumen";

export function PanelClima({ clima, menu = null }) {
  const localidad = clima.localidad || {};
  const detalle = [localidad.region, localidad.pais].map((parte) => String(parte || "").trim()).filter(Boolean).join(", ");
  const avisos = clima.avisosEnflora || [];
  const oficiales = clima.alertasOficiales || [];
  const dias = diasParaInicio(clima.dias, localidad.zonaHoraria);

  return (
    <div className="clima__datos">
      <TarjetaClima
        nombre={localidad.nombre}
        detalle={detalle}
        actual={clima.actual}
        dias={dias}
        avisoEnflora={avisos.length ? `Aviso de ENFLORA: ${avisos.map((aviso) => aviso.titulo).join(", ")}` : ""}
        avisoOficial={oficiales.length ? `Alerta oficial: ${oficiales[0].titulo}` : ""}
        titulo
      />
      {menu}
    </div>
  );
}
