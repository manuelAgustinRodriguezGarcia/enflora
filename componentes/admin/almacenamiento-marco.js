import { Files, HardDrive, ImageIcon } from "lucide-react";
import { textoBytes, textoDia, textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const PERIODOS = [
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["personalizado", "Período personalizado"],
];

const ETIQUETAS = {
  registros: "Fotografías de registros",
  portadas: "Portadas de unidades",
  flora: "Imágenes de Flora",
  miniaturas: "Miniaturas",
  otros: "Otros archivos",
  sin_clasificar: "Sin clasificar",
};

export function etiquetaCategoria(categoria) {
  return ETIQUETAS[categoria] || "Sin clasificar";
}

export function etiquetaMime(mime) {
  if (mime === "sin_tipo") return "Sin tipo";
  return mime;
}

function textoTamano(valor) {
  if (valor == null) return "No disponible";
  return textoBytes(valor);
}

function textoPorcentaje(parte, total) {
  if (!total) return "No disponible";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((parte / total) * 100)} %`;
}

export function MarcoAlmacenamiento({ titulo, intro, formulario, aviso, children }) {
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

export function FormularioAlmacenamiento({ consulta }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/almacenamiento">
      <label className="admin-planes__campo">
        <span>Período de archivos nuevos</span>
        <select name="periodo" defaultValue={consulta.periodo}>
          {PERIODOS.map(([id, texto]) => (
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
        Actualizar
      </button>
      <p className="admin-planes__contexto">
        El período cuenta archivos nuevos y bytes añadidos. La ocupación de arriba es la que hay ahora. Un día en cero
        no reconstruye la ocupación de ese día.
      </p>
    </form>
  );
}

export function AvisoAlmacenamiento(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver el almacenamiento.";
  return resultado.error || "No pudimos leer el almacenamiento. No se muestran cifras parciales.";
}

function Cifra({ etiqueta, valor, detalle, icono: Icono }) {
  return (
    <article className="admin-dash__tarjeta">
      <h2>
        {Icono ? <Icono aria-hidden="true" size={18} /> : null} {etiqueta}
      </h2>
      <p className="admin-dash__valor">{valor}</p>
      {detalle ? <p className="admin-dash__detalle">{detalle}</p> : null}
    </article>
  );
}

function GraficoAltas({ serie }) {
  const maximo = Math.max(1, ...serie.map((punto) => punto.objetos));
  const ancho = 720;
  const alto = 168;
  const paso = ancho / serie.length;
  const barra = Math.max(1, paso * 0.62);
  return (
    <figure className="admin-dash__grafico">
      <figcaption>Archivos nuevos por día</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Archivos nuevos por día">
        {serie.map((punto, indice) => {
          const altura = (punto.objetos / maximo) * (alto - 8);
          return (
            <rect
              key={punto.dia}
              x={indice * paso + paso * 0.16}
              y={alto - altura}
              width={barra}
              height={altura}
              className="admin-dash__barra admin-dash__barra--usuarios"
            >
              <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.objetos)} archivos nuevos`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

function BarrasCategoria({ filas, total }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.objetos));
  const ancho = 720;
  const altoFila = 28;
  const alto = altoFila * filas.length;
  return (
    <figure className="admin-dash__grafico">
      <figcaption>Objetos por categoría</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Objetos por categoría">
        {filas.map((fila, indice) => {
          const largo = (fila.objetos / maximo) * 280;
          return (
            <g key={fila.categoria} transform={`translate(0 ${indice * altoFila})`}>
              <text x="0" y="18" fontSize="13">
                {etiquetaCategoria(fila.categoria)}
              </text>
              <rect x="250" y="6" width={Math.max(fila.objetos ? 2 : 0, largo)} height="12" className="admin-dash__barra admin-dash__barra--usuarios">
                <title>{`${etiquetaCategoria(fila.categoria)}: ${textoEntero(fila.objetos)}`}</title>
              </rect>
              <text x="540" y="18" fontSize="13">
                {`${textoEntero(fila.objetos)} · ${textoPorcentaje(fila.objetos, total)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function ResumenAlmacenamiento({ resumen }) {
  if (resumen.objetos === 0) {
    return (
      <p className="admin-dash__vacio">
        No hay objetos en Storage. Esta vista no estima el tamaño de la base ni el tráfico de descarga.
      </p>
    );
  }
  return (
    <>
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Objetos" valor={textoEntero(resumen.objetos)} detalle="Cada archivo físico, una sola vez." icono={Files} />
        <Cifra
          etiqueta="Espacio usado"
          valor={textoTamano(resumen.bytes)}
          detalle={
            resumen.bytesCompletos
              ? "Suma del tamaño que Storage informó. No es el tamaño de PostgreSQL ni una factura."
              : `${textoEntero(resumen.objetosSinTamano)} objetos no tienen tamaño. La suma no está completa.`
          }
          icono={HardDrive}
        />
        <Cifra etiqueta="Imágenes" valor={textoEntero(resumen.imagenes)} detalle={`${textoEntero(resumen.objetosSinMime)} objetos sin tipo informado.`} icono={ImageIcon} />
        <Cifra etiqueta="Tamaño promedio" valor={textoTamano(resumen.promedioBytes)} detalle="Solo entre los objetos que tienen tamaño." />
        <Cifra etiqueta="Archivos nuevos" valor={textoEntero(resumen.anadidosObjetos)} detalle="Creados en el período elegido. No es la ocupación de esos días." />
        <Cifra
          etiqueta="Bytes añadidos"
          valor={textoTamano(resumen.anadidosBytes)}
          detalle={
            resumen.anadidosSinTamano
              ? `${textoEntero(resumen.anadidosSinTamano)} altas no tienen tamaño.`
              : "Suma del tamaño de los archivos creados en el período."
          }
        />
        <Cifra etiqueta="Ocupación histórica" valor="No disponible" detalle="No hay mediciones diarias guardadas. No se reconstruye el pasado." />
        <Cifra
          etiqueta="Medición"
          valor={textoInstante(resumen.medidoEn) || "No disponible"}
          detalle={resumen.ultimoObjetoEn ? `Último cambio de un archivo: ${textoInstante(resumen.ultimoObjetoEn)}.` : "Todavía no hay fecha de cambio."}
        />
      </div>
      <section className="admin-dash__serie" aria-labelledby="admin-almacen-categorias">
        <h2 id="admin-almacen-categorias">Distribución</h2>
        <p className="admin-dash__detalle">
          Las portadas son de unidades. Los espacios no tienen un archivo propio. Avatares y fotos de genéticas quedan
          en otros archivos. El porcentaje es sobre la cantidad de objetos.
        </p>
        <BarrasCategoria filas={resumen.porCategoria} total={resumen.objetos} />
      </section>
      <section className="admin-dash__serie" aria-labelledby="admin-almacen-serie">
        <h2 id="admin-almacen-serie">Evolución de altas</h2>
        <GraficoAltas serie={resumen.serie} />
      </section>
      <div className="admin-dash__tabla-contenedor">
        <table className="admin-dash__tabla">
          <caption className="admin-planes__caption">Por bucket</caption>
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              <th scope="col">Objetos</th>
              <th scope="col">Tamaño informado</th>
              <th scope="col">Sin tamaño</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porBucket.length === 0 ? (
              <tr>
                <td colSpan={4}>No hay buckets declarados.</td>
              </tr>
            ) : (
              resumen.porBucket.map((fila) => (
                <tr key={fila.bucket}>
                  <th scope="row">{fila.bucket}</th>
                  <td>{textoEntero(fila.objetos)}</td>
                  <td>{textoTamano(fila.bytes)}</td>
                  <td>{textoEntero(fila.objetosSinTamano)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-dash__tabla-contenedor">
        <table className="admin-dash__tabla">
          <caption className="admin-planes__caption">Por tipo</caption>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Objetos</th>
              <th scope="col">Tamaño informado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porMime.length === 0 ? (
              <tr>
                <td colSpan={3}>Storage no informó tipos.</td>
              </tr>
            ) : (
              resumen.porMime.map((fila) => (
                <tr key={fila.mime}>
                  <th scope="row">{etiquetaMime(fila.mime)}</th>
                  <td>{textoEntero(fila.objetos)}</td>
                  <td>{textoTamano(fila.bytes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
