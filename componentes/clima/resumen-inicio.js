import Link from "next/link";
import { CloudRain, Droplet, Wind } from "lucide-react";
import { EnlaceBoton } from "@/componentes/boton";
import { IconoClima } from "@/componentes/clima/icono-clima";
import { IconoChevron } from "@/componentes/iconos-ui";
import { mensajeClima } from "@/lib/clima/constantes";
import { iconoPronostico } from "@/lib/clima/iconos";
import { temaClima } from "@/lib/clima/tema";
import {
  textoDiaCorto,
  textoMilimetros,
  textoPorcentaje,
  textoTemperatura,
  textoViento,
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

function TarjetaConfigurar() {
  return (
    <li>
      <article className="clima-mini clima-mini--configurar">
        <div className="clima-mini__configurar">
          <p className="clima-mini__configurar-texto">Configurá el clima para que Flora te pueda avisar</p>
          <EnlaceBoton href="/perfil#clima">Ir a clima</EnlaceBoton>
        </div>
      </article>
    </li>
  );
}

function TarjetaSimple({ lugar }) {
  return (
    <li>
      <Link className="clima-mini clima-mini--simple" href={lugar.href}>
        <span className="clima-mini__nombre">{lugar.espacioNombre}</span>
        <span>{lugar.localidad || "Sin localidad"}</span>
        {lugar.linea ? <span>{lugar.linea}</span> : null}
      </Link>
    </li>
  );
}

function TarjetaClima({ lugar }) {
  const actual = lugar.vista?.actual;
  const dias = lugar.vista?.dias || [];
  const tema = temaClima({
    temperaturaC: actual?.temperaturaC ?? null,
    esDia: actual?.esDia ?? null,
    codigo: actual?.codigo ?? null,
  });
  const sensacion = textoTemperatura(actual?.sensacionC);
  const detalle = [lugar.region, lugar.pais].map((parte) => String(parte || "").trim()).filter(Boolean).join(", ");

  return (
    <li>
      <article
        className="clima-mini"
        data-rango={tema.rango}
        data-momento={tema.momento}
        style={variablesTema(tema.paleta)}
      >
        <span className="clima-mini__brillo" aria-hidden="true" />
        <Link className="clima-mini__enlace" href={lugar.href}>
          <span className="clima-mini__ahora">
            <span className="clima-mini__texto">
              <span className="clima-mini__nombre">{lugar.lugarNombre || "Sin localidad"}</span>
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
          {lugar.avisoEnflora ? <span className="clima-mini__aviso">{lugar.avisoEnflora}</span> : null}
          {lugar.avisoOficial ? <span className="clima-mini__aviso clima-mini__aviso--oficial">{lugar.avisoOficial}</span> : null}
        </Link>
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
    </li>
  );
}

export function ResumenClimaInicio({ clima }) {
  if (!clima || clima.estado === "oculto") return null;

  const lugares = Array.isArray(clima.lugares) ? clima.lugares : [];
  const listos = lugares.filter((lugar) => lugar.estado === "listo" && lugar.vista);
  const otros = lugares.filter((lugar) => lugar.estado !== "sin_localidad" && !(lugar.estado === "listo" && lugar.vista));
  const sinConfigurar = clima.estado !== "no_disponible" && listos.length === 0 && otros.length === 0;

  return (
    <section className="inicio__seccion" aria-label="Clima">
      {clima.estado === "no_disponible" ? <p className="inicio__vacio">{mensajeClima("no_disponible")}</p> : null}
      {listos.length || otros.length || sinConfigurar ? (
        <ul className="clima-minis">
          {listos.map((lugar) => (
            <TarjetaClima key={lugar.espacioId} lugar={lugar} />
          ))}
          {otros.map((lugar) => (
            <TarjetaSimple key={lugar.espacioId} lugar={lugar} />
          ))}
          {sinConfigurar ? <TarjetaConfigurar /> : null}
        </ul>
      ) : null}
    </section>
  );
}
