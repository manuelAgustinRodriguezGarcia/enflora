import { AtribucionClima } from "@/componentes/clima/atribucion";
import { EscenaClima } from "@/componentes/clima/escena-clima";
import { IconoClima } from "@/componentes/clima/icono-clima";
import { TEXTO_ALERTA_OFICIAL, TEXTO_AVISO_ENFLORA } from "@/lib/clima/constantes";
import { iconoPronostico } from "@/lib/clima/iconos";
import {
  etiquetaActualizacion,
  etiquetaLocalidad,
  formatearInstante,
  textoDiaCorto,
  textoMilimetros,
  textoNieve,
  textoPorcentaje,
  textoPronostico,
  textoTemperatura,
  textoViento,
} from "@/lib/clima/texto";

function presente(texto) {
  return texto || "Sin dato";
}

function textoVigencia(desdeCache) {
  if (desdeCache === true) return "Datos en caché de ENFLORA. No es una consulta en vivo.";
  if (desdeCache === false) return "Consulta vigente al proveedor.";
  return "";
}

function FilaPronostico({ dia }) {
  const nieve = textoNieve(dia.nieveCm);
  return (
    <li>
      <details className="clima-fila">
        <summary>
          <span className="clima-fila__dia">
            <span className="clima-sr">Día</span>
            {textoDiaCorto(dia.fecha) || dia.fecha}
          </span>
          <IconoClima nombre={iconoPronostico(dia.codigo)} />
          <span className="clima-fila__max">
            <span className="clima-sr">Máxima prevista</span>
            {presente(textoTemperatura(dia.maximaC))}
          </span>
          <span className="clima-fila__min">
            <span className="clima-sr">Mínima prevista</span>
            {presente(textoTemperatura(dia.minimaC))}
          </span>
          <span className="clima-fila__prob">
            <span className="clima-sr">Probabilidad de lluvia</span>
            {presente(textoPorcentaje(dia.probabilidadLluvia))}
          </span>
        </summary>
        <dl className="clima-fila__detalle">
          <div>
            <dt>Precipitación prevista</dt>
            <dd>{presente(textoMilimetros(dia.precipitacionMm))}</dd>
          </div>
          <div>
            <dt>Viento máximo previsto</dt>
            <dd>{presente(textoViento(dia.vientoKph))}</dd>
          </div>
          {nieve ? (
            <div>
              <dt>Nieve prevista</dt>
              <dd>{nieve}</dd>
            </div>
          ) : null}
          <div>
            <dt>Condiciones previstas</dt>
            <dd>{dia.condicion || "Sin descripción"}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

function Avisos({ clima }) {
  const avisos = clima.avisosEnflora || [];
  return (
    <section className="clima-avisos" aria-labelledby="clima-avisos">
      <h2 id="clima-avisos">Avisos de ENFLORA</h2>
      <p className="clima__nota">{TEXTO_AVISO_ENFLORA}</p>
      {avisos.length ? (
        <ul className="clima__lista">
          {avisos.map((aviso) => (
            <li key={aviso.tipo} className="clima__aviso">
              <strong>{aviso.titulo}</strong>
              <p>{aviso.detalle}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="clima__vacio">Sin avisos de ENFLORA para estos días.</p>
      )}
    </section>
  );
}

function Oficial({ clima }) {
  const alertas = clima.alertasOficiales;
  const zona = clima.localidad?.zonaHoraria || "";
  return (
    <section className="clima-avisos" aria-labelledby="clima-oficiales">
      <h2 id="clima-oficiales">Alertas oficiales</h2>
      <p className="clima__nota">{TEXTO_ALERTA_OFICIAL}</p>
      {alertas === null ? <p className="clima__vacio">El proveedor no incluyó alertas oficiales en esta consulta.</p> : null}
      {alertas?.length === 0 ? <p className="clima__vacio">No hay alertas oficiales vigentes en la respuesta.</p> : null}
      {alertas?.length ? (
        <ul className="clima__lista">
          {alertas.map((alerta, indice) => (
            <li key={`${alerta.titulo}-${alerta.desde}-${indice}`} className="clima__aviso clima__aviso--oficial">
              <strong>{alerta.titulo}</strong>
              {alerta.evento ? <p>{alerta.evento}</p> : null}
              {alerta.severidad ? <p>Severidad informada: {alerta.severidad}</p> : null}
              {alerta.desde ? <p>Desde: {formatearInstante(alerta.desde, zona) || alerta.desde}</p> : null}
              {alerta.hasta ? <p>Hasta: {formatearInstante(alerta.hasta, zona) || alerta.hasta}</p> : null}
              {alerta.descripcion ? <p>{alerta.descripcion}</p> : null}
              {alerta.indicacion ? <p>Indicación del organismo emisor: {alerta.indicacion}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PanelClima({ espacioNombre, localidad, clima, desdeCache = null, menu = null }) {
  const zona = clima.localidad?.zonaHoraria || "";
  const actualizado = clima.actual ? etiquetaActualizacion(clima.actual.actualizadoEn, zona) : "";
  const consulta = etiquetaActualizacion(clima.consultaEn, zona) || formatearInstante(clima.consultaEn, zona);
  const vigencia = textoVigencia(desdeCache);
  const lugar = localidad || etiquetaLocalidad(clima.localidad);

  return (
    <div className="clima__datos">
      <EscenaClima espacioNombre={espacioNombre} localidad={lugar} actual={clima.actual} />
      {menu}
      <section className="clima-pronostico" aria-labelledby="clima-pronostico">
        <div className="clima-pronostico__cabecera">
          <h2 id="clima-pronostico">Pronóstico</h2>
          <p className="clima__nota">{textoPronostico(clima.diasPedidos)}</p>
          {clima.diasDisponibles < clima.diasPedidos ? (
            <p className="clima__nota">El proveedor devolvió {clima.diasDisponibles} días.</p>
          ) : null}
        </div>
        {clima.dias.length ? (
          <>
            <div className="clima-pronostico__encabezado" aria-hidden="true">
              <span>Día</span>
              <span />
              <span>Máx</span>
              <span>Mín</span>
              <span>Prob.</span>
            </div>
            <ol className="clima-pronostico__filas">
              {clima.dias.map((dia) => (
                <FilaPronostico key={dia.fecha} dia={dia} />
              ))}
            </ol>
          </>
        ) : (
          <p className="clima__vacio">El proveedor no envió días de pronóstico.</p>
        )}
      </section>
      <Avisos clima={clima} />
      <Oficial clima={clima} />
      <footer className="clima-pie">
        <p>{actualizado ? `Actualizado ${actualizado}` : "Sin hora de actualización del proveedor."}</p>
        {vigencia ? <p>{vigencia}</p> : null}
        {consulta ? <p>Consulta de ENFLORA: {consulta}</p> : null}
        <AtribucionClima atribucion={clima.atribucion} />
      </footer>
    </div>
  );
}
