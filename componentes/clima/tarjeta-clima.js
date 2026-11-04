import Link from "next/link";
import { CloudRain, Droplet, Wind } from "lucide-react";
import { IconoClima } from "@/componentes/clima/icono-clima";
import { IconoChevron } from "@/componentes/iconos-ui";
import { iconoPronostico } from "@/lib/clima/iconos";
import { temaClima } from "@/lib/clima/tema";
import {
  textoDiaCorto,
  textoPorcentaje,
  textoTemperatura,
  textoViento,
  textoMilimetros,
} from "@/lib/clima/texto";

function presente(texto) {
  return texto || "Sin dato";
}

function variablesTema(paleta) {
  return {
    "--clima-fondo": paleta.fondo,
    "--clima-fondo-fin": paleta.fondoFin,
    "--clima-tinta": paleta.tinta,
    "--clima-suave": paleta.tintaSuave,
    "--clima-acento": paleta.acento,
  };
}

export function TarjetaClima({
  nombre,
  detalle = "",
  actual = null,
  dias = [],
  avisoEnflora = "",
  avisoOficial = "",
  href = "",
  titulo = false,
}) {
  const tema = temaClima({
    temperaturaC: actual?.temperaturaC ?? null,
    esDia: actual?.esDia ?? null,
    codigo: actual?.codigo ?? null,
  });
  const sensacion = textoTemperatura(actual?.sensacionC);
  const Nombre = titulo ? "h1" : "span";
  const cuerpo = (
    <>
      <span className="clima-mini__ahora">
        <span className="clima-mini__texto">
          <Nombre className="clima-mini__nombre" {...(titulo ? { id: "clima-espacio" } : {})}>
            {nombre || "Sin localidad"}
          </Nombre>
          {detalle ? <span className="clima-mini__lugar">{detalle}</span> : null}
          <span className="clima-mini__condicion">{actual?.condicion || "Condición no informada"}</span>
        </span>
        <span className="clima-mini__lectura">
          <span className="clima-mini__icono">
            <IconoClima nombre={tema.icono} />
          </span>
          <span className="clima-mini__temp">{presente(textoTemperatura(actual?.temperaturaC))}</span>
          <span className="clima-mini__sensacion">{sensacion ? `Sensación ${sensacion}` : "Sensación no informada"}</span>
        </span>
      </span>
      <dl className="clima-mini__metricas">
        <div>
          <dt className="clima-sr">Humedad</dt>
          <dd>
            <Droplet aria-hidden="true" />
            {presente(textoPorcentaje(actual?.humedad))}
          </dd>
        </div>
        <div>
          <dt className="clima-sr">Viento</dt>
          <dd>
            <Wind aria-hidden="true" />
            {presente(textoViento(actual?.vientoKph))}
          </dd>
        </div>
        <div>
          <dt className="clima-sr">Precipitación actual</dt>
          <dd>
            <CloudRain aria-hidden="true" />
            {presente(textoMilimetros(actual?.precipitacionMm))}
          </dd>
        </div>
      </dl>
      {avisoEnflora ? <span className="clima-mini__aviso">{avisoEnflora}</span> : null}
      {avisoOficial ? <span className="clima-mini__aviso clima-mini__aviso--oficial">{avisoOficial}</span> : null}
    </>
  );

  return (
    <article
      className="clima-mini"
      data-rango={tema.rango}
      data-momento={tema.momento}
      style={variablesTema(tema.paleta)}
      {...(titulo ? { "aria-labelledby": "clima-espacio" } : {})}
    >
      <span className="clima-mini__brillo" aria-hidden="true" />
      {href ? (
        <Link className="clima-mini__enlace" href={href}>
          {cuerpo}
        </Link>
      ) : (
        <div className="clima-mini__enlace">{cuerpo}</div>
      )}
      {dias.length ? (
        <details className="clima-mini__pronostico">
          <summary className="clima-mini__desplegar">
            <span>Ver próximos días</span>
            <IconoChevron className="clima-mini__chevron" />
          </summary>
          <div className="clima-mini__dias-cuerpo">
            <ol className="clima-mini__dias">
              {dias.map((dia) => (
                <li key={dia.fecha || `${dia.maximaC}-${dia.minimaC}`}>
                  <span className="clima-mini__dia">{textoDiaCorto(dia.fecha) || "Día"}</span>
                  <IconoClima nombre={iconoPronostico(dia.codigo)} />
                  <span className="clima-mini__max">
                    <span className="clima-sr">Máxima prevista</span>
                    {presente(textoTemperatura(dia.maximaC))}
                  </span>
                  <span className="clima-mini__min">
                    <span className="clima-sr">Mínima prevista</span>
                    {presente(textoTemperatura(dia.minimaC))}
                  </span>
                  <span className="clima-mini__prob">
                    <span className="clima-sr">Probabilidad de lluvia</span>
                    {presente(textoPorcentaje(dia.probabilidadLluvia))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      ) : null}
    </article>
  );
}
