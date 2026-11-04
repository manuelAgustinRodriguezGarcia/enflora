import { textoDia, textoEntero } from "@/componentes/admin/formato-dashboard";

const PERIODOS = [
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["personalizado", "Período personalizado"],
];

const OPERACIONES = [
  ["todos", "Todas"],
  ["chat", "Chat"],
  ["chat_imagen", "Chat con imagen"],
];

const USD = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 6 });

export function textoUsd(valor) {
  if (valor == null) return "No disponible";
  return USD.format(valor);
}

export function textoToken(valor) {
  if (valor == null) return "No disponible";
  return textoEntero(valor);
}

function textoMs(valor) {
  if (valor == null) return "No disponible";
  return `${textoEntero(valor)} ms`;
}

function textoPorcentaje(parte, total) {
  if (!total) return "No disponible";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((parte / total) * 100)} %`;
}

export function etiquetaOperacion(operacion) {
  if (operacion === "chat") return "Chat";
  if (operacion === "chat_imagen") return "Chat con imagen";
  return "Todas";
}

export function MarcoFlora({ titulo, intro, formulario, aviso, children }) {
  return (
    <section className="admin-dash admin-planes">
      <header className="admin-dash__cabecera">
        <p className="admin-estado__etiqueta">Administración</p>
        <h1>{titulo}</h1>
        <p className="admin-dash__aclaracion">{intro}</p>
      </header>
      {formulario}
      {aviso ? (
        <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
          {aviso}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function FormularioFlora({ consulta }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/flora">
      <label className="admin-planes__campo">
        <span>Período</span>
        <select name="periodo" defaultValue={consulta.periodo}>
          {PERIODOS.map(([id, texto]) => (
            <option key={id} value={id}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Modelo</span>
        <input
          type="text"
          name="modelo"
          defaultValue={consulta.modelo === "todos" ? "" : consulta.modelo}
          maxLength={64}
          placeholder="Todos"
          autoComplete="off"
        />
      </label>
      <label className="admin-planes__campo">
        <span>Operación</span>
        <select name="operacion" defaultValue={consulta.operacion}>
          {OPERACIONES.map(([id, texto]) => (
            <option key={id} value={id}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Desde</span>
        <input type="date" name="desde" defaultValue={consulta.periodo === "personalizado" ? consulta.desdeDia : ""} />
      </label>
      <label className="admin-planes__campo">
        <span>Hasta</span>
        <input type="date" name="hasta" defaultValue={consulta.periodo === "personalizado" ? consulta.hastaDia : ""} />
      </label>
      <button className="admin-dash__actualizar" type="submit">
        Aplicar filtros
      </button>
      <p className="admin-planes__contexto">
        Las cifras empiezan cuando la telemetría está activa. Un día en cero no reconstruye el uso anterior. El costo es
        una estimación con la tarifa guardada en cada solicitud. El importe facturado no está en esta base.
      </p>
    </form>
  );
}

export function AvisoFlora(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver Flora IA.";
  return resultado.error || "No pudimos leer las métricas de Flora. No se muestran cifras parciales.";
}

function Cifra({ etiqueta, valor, detalle }) {
  return (
    <article className="admin-dash__tarjeta">
      <h2>{etiqueta}</h2>
      <p className="admin-dash__valor">{valor}</p>
      {detalle ? <p className="admin-dash__detalle">{detalle}</p> : null}
    </article>
  );
}

function GraficoSolicitudes({ serie }) {
  const maximo = Math.max(1, ...serie.map((punto) => punto.solicitudes));
  const ancho = 720;
  const alto = 168;
  const paso = ancho / serie.length;
  const barra = Math.max(1, paso * 0.62);
  return (
    <figure className="admin-dash__grafico">
      <figcaption>Solicitudes medidas por día</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Solicitudes de Flora por día">
        {serie.map((punto, indice) => {
          const altura = (punto.solicitudes / maximo) * (alto - 8);
          return (
            <rect
              key={punto.dia}
              x={indice * paso + paso * 0.16}
              y={alto - altura}
              width={barra}
              height={altura}
              className="admin-dash__barra admin-dash__barra--usuarios"
            >
              <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.solicitudes)} solicitudes`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

function TablaPeriodo({ titulo, filas, etiquetaDia }) {
  if (filas.length === 0) return null;
  return (
    <div className="admin-dash__tabla-contenedor">
      <table className="admin-dash__tabla">
        <caption className="admin-planes__caption">{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">{etiquetaDia}</th>
            <th scope="col">Solicitudes</th>
            <th scope="col">Errores</th>
            <th scope="col">Tokens totales reportados</th>
            <th scope="col">Costo estimado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.dia}>
              <th scope="row">{fila.dia.length === 7 ? fila.dia : textoDia(fila.dia)}</th>
              <td>{textoEntero(fila.solicitudes)}</td>
              <td>{textoEntero(fila.errores)}</td>
              <td>{textoToken(fila.tokensTotal)}</td>
              <td>{textoUsd(fila.costoUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResumenFlora({ resumen }) {
  if (resumen.solicitudes === 0) {
    return (
      <p className="admin-dash__vacio">
        No hay solicitudes medidas en este período. El uso anterior a la telemetría no se muestra.
      </p>
    );
  }
  const adicionales = [resumen.tokensPensamiento, resumen.tokensCache, resumen.tokensHerramientas].every(
    (valor) => valor == null,
  )
    ? null
    : (resumen.tokensPensamiento || 0) + (resumen.tokensCache || 0) + (resumen.tokensHerramientas || 0);
  return (
    <>
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Solicitudes" valor={textoEntero(resumen.solicitudes)} detalle={`${textoEntero(resumen.exitos)} con respuesta.`} />
        <Cifra etiqueta="Usuarios" valor={textoEntero(resumen.usuarios)} detalle="Cuentas distintas que registraron una solicitud. Sin nombre ni correo." />
        <Cifra etiqueta="Tokens de entrada" valor={textoToken(resumen.tokensEntrada)} detalle={`${textoEntero(resumen.solicitudesSinEntrada)} solicitudes sin este dato.`} />
        <Cifra etiqueta="Tokens de salida" valor={textoToken(resumen.tokensSalida)} detalle={`${textoEntero(resumen.solicitudesSinSalida)} solicitudes sin este dato.`} />
        <Cifra etiqueta="Tokens totales" valor={textoToken(resumen.tokensTotal)} detalle={`${textoEntero(resumen.solicitudesSinTotal)} solicitudes sin el total del proveedor.`} />
        <Cifra etiqueta="Tokens adicionales" valor={textoToken(adicionales)} detalle="Pensamiento, caché y herramientas, solo si el proveedor los informó." />
        <Cifra
          etiqueta="Costo estimado"
          valor={textoUsd(resumen.costoUsd)}
          detalle={
            resumen.costoUsd == null
              ? "No disponible hasta cargar una tarifa verificada para el modelo."
              : `${textoEntero(resumen.solicitudesSinCosto)} solicitudes quedaron sin costo.`
          }
        />
        <Cifra etiqueta="Costo por usuario" valor={textoUsd(resumen.costoPromedioUsuarioUsd)} detalle="Promedio del costo calculado entre las cuentas que tienen costo. No es una factura." />
        <Cifra etiqueta="Importe facturado" valor="No disponible" detalle="No hay un importe cobrado por el proveedor en esta base." />
        <Cifra etiqueta="Errores" valor={textoPorcentaje(resumen.errores, resumen.solicitudes)} detalle={`${textoEntero(resumen.errores)} errores y ${textoEntero(resumen.cancelaciones)} cancelaciones.`} />
        <Cifra etiqueta="Latencia promedio" valor={textoMs(resumen.duracionPromedioMs)} detalle={`${textoEntero(resumen.muestrasLatencia)} solicitudes con duración.`} />
        <Cifra
          etiqueta="Latencia p50 / p95"
          valor={resumen.duracionP50Ms == null ? "No disponible" : `${textoMs(resumen.duracionP50Ms)} / ${textoMs(resumen.duracionP95Ms)}`}
          detalle={resumen.muestrasLatencia < 20 ? "Hacen falta al menos 20 duraciones." : "Sobre las duraciones medidas."}
        />
      </div>
      <section className="admin-dash__serie" aria-labelledby="admin-flora-serie">
        <h2 id="admin-flora-serie">Evolución diaria</h2>
        <GraficoSolicitudes serie={resumen.serie} />
        <TablaPeriodo titulo="Consumo diario medido" filas={resumen.serie} etiquetaDia="Día" />
      </section>
      <TablaPeriodo titulo="Consumo semanal, agrupado desde los días medidos" filas={resumen.serieSemana} etiquetaDia="Semana" />
      <TablaPeriodo titulo="Consumo mensual, agrupado desde los días medidos" filas={resumen.serieMes} etiquetaDia="Mes" />
      <div className="admin-dash__tabla-contenedor">
        <table className="admin-dash__tabla">
          <caption className="admin-planes__caption">Distribución por modelo</caption>
          <thead>
            <tr>
              <th scope="col">Modelo</th>
              <th scope="col">Solicitudes</th>
              <th scope="col">Tokens totales reportados</th>
              <th scope="col">Costo estimado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porModelo.length === 0 ? (
              <tr>
                <td colSpan={4}>Sin modelos en este período.</td>
              </tr>
            ) : (
              resumen.porModelo.map((fila) => (
                <tr key={fila.modelo}>
                  <th scope="row">{fila.modelo}</th>
                  <td>{textoEntero(fila.solicitudes)}</td>
                  <td>{textoToken(fila.tokensTotal)}</td>
                  <td>{textoUsd(fila.costoUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-dash__tabla-contenedor">
        <table className="admin-dash__tabla">
          <caption className="admin-planes__caption">Distribución por operación</caption>
          <thead>
            <tr>
              <th scope="col">Operación</th>
              <th scope="col">Solicitudes</th>
              <th scope="col">Tokens totales reportados</th>
              <th scope="col">Costo estimado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porOperacion.length === 0 ? (
              <tr>
                <td colSpan={4}>Sin operaciones en este período.</td>
              </tr>
            ) : (
              resumen.porOperacion.map((fila) => (
                <tr key={fila.operacion}>
                  <th scope="row">{etiquetaOperacion(fila.operacion)}</th>
                  <td>{textoEntero(fila.solicitudes)}</td>
                  <td>{textoToken(fila.tokensTotal)}</td>
                  <td>{textoUsd(fila.costoUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
