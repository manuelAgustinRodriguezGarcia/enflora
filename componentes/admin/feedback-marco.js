import Link from "next/link";
import { textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";
import {
  CATEGORIAS_FEEDBACK,
  ESTADOS_FEEDBACK,
  PRIORIDADES_FEEDBACK,
  etiquetaCategoriaFeedback,
  etiquetaEstadoFeedback,
  etiquetaPrioridadFeedback,
} from "@/lib/feedback/reglas";

const CATEGORIAS = [["todos", "Todas"], ...CATEGORIAS_FEEDBACK.map((item) => [item.id, item.etiqueta])];
const ESTADOS = [["todos", "Todos"], ...ESTADOS_FEEDBACK.map((item) => [item.id, item.etiqueta])];
const PRIORIDADES = [["todos", "Todas"], ...PRIORIDADES_FEEDBACK.map((item) => [item.id, item.etiqueta])];

export function MarcoFeedback({ titulo, intro, formulario, aviso, children }) {
  return (
    <section className="admin-dash admin-planes admin-feedback">
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

function Select({ nombre, valor, opciones, etiqueta }) {
  return (
    <label className="admin-planes__campo">
      <span>{etiqueta}</span>
      <select name={nombre} defaultValue={valor}>
        {opciones.map(([id, texto]) => (
          <option key={id} value={id}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormularioFeedbackAdmin({ consulta }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/feedback">
      <Select nombre="categoria" valor={consulta.categoria} etiqueta="Categoría" opciones={CATEGORIAS} />
      <Select nombre="estado" valor={consulta.estado} etiqueta="Estado" opciones={ESTADOS} />
      <Select nombre="prioridad" valor={consulta.prioridad} etiqueta="Prioridad" opciones={PRIORIDADES} />
      <button className="admin-dash__actualizar" type="submit">
        Aplicar filtros
      </button>
      <p className="admin-planes__contexto">
        El correo se muestra enmascarado. El mensaje de la bandeja está resumido. La nota interna solo aparece en el
        detalle.
      </p>
    </form>
  );
}

export function AvisoFeedback(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver el feedback.";
  return resultado.error || "No pudimos leer el feedback. No se muestran datos parciales.";
}

export function ContadoresFeedback({ contadores }) {
  const cifras = [
    ["Nuevos", contadores.nuevo, "Todavía sin revisar"],
    ["En revisión", contadores.enRevision, "Los está mirando el equipo"],
    ["Resueltos", contadores.resueltos, "Implementados y descartados"],
  ];
  return (
    <div className="admin-dash__grilla">
      {cifras.map(([etiqueta, valor, detalle]) => (
        <article key={etiqueta} className="admin-dash__tarjeta">
          <h2>{etiqueta}</h2>
          <p className="admin-dash__valor">{textoEntero(valor)}</p>
          <p className="admin-dash__detalle">{detalle}</p>
        </article>
      ))}
    </div>
  );
}

export function TablaFeedback({ filas }) {
  if (filas.length === 0) {
    return <p className="admin-dash__vacio">Todavía no hay feedback con estos filtros.</p>;
  }
  return (
    <div className="admin-dash__tabla-contenedor">
      <table className="admin-dash__tabla">
        <caption className="admin-planes__caption">
          Bandeja de la página actual. No incluye el mensaje completo ni la nota interna.
        </caption>
        <thead>
          <tr>
            {["Categoría", "Mensaje", "Fecha", "Estado", "Prioridad", "Usuario", ""].map((columna) => (
              <th key={columna || "accion"} scope="col">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id}>
              <td>{etiquetaCategoriaFeedback(fila.categoria)}</td>
              <td className="admin-feedback__resumen">{fila.resumen}</td>
              <td>{textoInstante(fila.creadoEn) || "Sin fecha"}</td>
              <td>{etiquetaEstadoFeedback(fila.estado)}</td>
              <td>{etiquetaPrioridadFeedback(fila.prioridad)}</td>
              <td>
                {fila.nombre || "Sin perfil"}
                <br />
                {fila.nombreUsuario || "Sin usuario"}
                <br />
                {fila.correo || "Sin correo"}
              </td>
              <td>
                <Link href={fila.href}>Ver</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaginacionFeedback({ anterior, siguiente, pagina, paginas, total }) {
  if (total === 0) return null;
  return (
    <nav className="admin-planes__paginacion" aria-label="Paginación de feedback">
      {anterior ? <Link href={anterior}>Anterior</Link> : <span>Anterior</span>}
      <p>
        Página {pagina} de {paginas}. {textoEntero(total)} {total === 1 ? "mensaje" : "mensajes"}.
      </p>
      {siguiente ? <Link href={siguiente}>Siguiente</Link> : <span>Siguiente</span>}
    </nav>
  );
}

export function VolverFeedback({ href }) {
  return (
    <p>
      <Link href={href}>Volver a la bandeja</Link>
    </p>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </>
  );
}

export function FichaFeedback({ feedback }) {
  return (
    <>
      <dl className="admin-planes__detalle">
        <Dato etiqueta="Categoría" valor={etiquetaCategoriaFeedback(feedback.categoria)} />
        <Dato etiqueta="Estado" valor={etiquetaEstadoFeedback(feedback.estado)} />
        <Dato etiqueta="Prioridad" valor={etiquetaPrioridadFeedback(feedback.prioridad)} />
        <Dato etiqueta="Fecha" valor={textoInstante(feedback.creadoEn) || "Sin fecha"} />
        <Dato etiqueta="Nombre" valor={feedback.nombre || "Sin perfil"} />
        <Dato etiqueta="Usuario" valor={feedback.nombreUsuario || "Sin usuario"} />
        <Dato etiqueta="Correo" valor={feedback.correo || "Sin correo"} />
        <Dato etiqueta="Última revisión" valor={textoInstante(feedback.revisadoEn) || "Sin revisión"} />
      </dl>
      <h2>Mensaje</h2>
      <p className="admin-feedback__texto">{feedback.mensaje}</p>
      {feedback.nota ? (
        <>
          <h2>Nota interna</h2>
          <p className="admin-feedback__nota">{feedback.nota}</p>
        </>
      ) : null}
    </>
  );
}
