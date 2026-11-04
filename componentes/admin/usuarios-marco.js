import Link from "next/link";
import { textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const PLANES = Object.freeze({
  gratuito: "Gratuito",
  plus: "Plus",
  licencia: "Licencia por cultivo",
  plus_y_licencia: "Plus y licencia por cultivo",
});

const PERIODOS = [
  ["todos", "Desde enero de 2015"],
  ["7", "Altas de los últimos 7 días"],
  ["30", "Altas de los últimos 30 días"],
  ["90", "Altas de los últimos 90 días"],
  ["personalizado", "Rango de alta"],
];

const CONFIRMACIONES = [
  ["todos", "Todas"],
  ["confirmado", "Correo confirmado"],
  ["sin_confirmar", "Sin confirmar"],
];

const PLANES_FILTRO = [
  ["todos", "Todos los planes"],
  ["gratuito", "Gratuito"],
  ["plus", "Plus"],
  ["licencia", "Licencia por cultivo"],
];

export function etiquetaPlan(plan) {
  return PLANES[plan] ?? "Sin plan";
}

function textoFecha(iso, vacio) {
  if (!iso) return vacio;
  return textoInstante(iso) || vacio;
}

export function MarcoUsuarios({ titulo, intro, formulario, aviso, children }) {
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

export function FormularioUsuarios({ consulta }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/usuarios">
      <label className="admin-planes__campo">
        <span>Nombre o correo</span>
        <input type="search" name="q" defaultValue={consulta.busqueda} maxLength={80} autoComplete="off" />
      </label>
      <Select nombre="periodo" valor={consulta.periodo} etiqueta="Fecha de alta" opciones={PERIODOS} />
      <Select nombre="confirmacion" valor={consulta.confirmacion} etiqueta="Confirmación" opciones={CONFIRMACIONES} />
      <Select nombre="plan" valor={consulta.plan} etiqueta="Plan" opciones={PLANES_FILTRO} />
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
        El correo se muestra enmascarado. La última conexión es el último inicio de sesión. La última actividad es el
        registro de cultivo más reciente. El rango de fechas filtra la fecha de alta.
      </p>
    </form>
  );
}

export function AvisoUsuarios(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver la gestión de usuarios.";
  return resultado.error || "No pudimos leer las cuentas. No se muestran datos parciales.";
}

function Tabla({ caption, columnas, children }) {
  return (
    <div className="admin-dash__tabla-contenedor">
      <table className="admin-dash__tabla">
        <caption className="admin-planes__caption">{caption}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna} scope="col">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TablaUsuarios({ filas }) {
  if (filas.length === 0) {
    return <p className="admin-dash__vacio">No hay cuentas con estos filtros.</p>;
  }
  return (
    <Tabla
      caption="Conteos agregados de la página actual. No incluye nombres de espacios, observaciones ni fotografías."
      columnas={[
        "Nombre",
        "Usuario",
        "Correo",
        "Alta",
        "Última conexión",
        "Plan",
        "Espacios",
        "Unidades",
        "Plantas",
        "Registros",
        "Última actividad",
        "",
      ]}
    >
      {filas.map((fila) => (
        <tr key={fila.id}>
          <td>{fila.nombre || "Sin perfil"}</td>
          <td>{fila.nombreUsuario || "Sin usuario"}</td>
          <td>{fila.correo || "Sin correo"}</td>
          <td>{textoFecha(fila.alta, "Sin fecha")}</td>
          <td>{textoFecha(fila.ultimaConexion, "Sin conexión registrada")}</td>
          <td>{etiquetaPlan(fila.plan)}</td>
          <td>{textoEntero(fila.espacios)}</td>
          <td>{textoEntero(fila.unidades)}</td>
          <td>{textoEntero(fila.plantas)}</td>
          <td>{textoEntero(fila.registros)}</td>
          <td>{textoFecha(fila.ultimaActividad, "Sin registros")}</td>
          <td>
            <Link href={fila.href}>Ver ficha</Link>
          </td>
        </tr>
      ))}
    </Tabla>
  );
}

export function PaginacionUsuarios({ anterior, siguiente, pagina, paginas, total }) {
  if (total === 0) return null;
  return (
    <nav className="admin-planes__paginacion" aria-label="Paginación de usuarios">
      {anterior ? <Link href={anterior}>Anterior</Link> : <span>Anterior</span>}
      <p>
        Página {pagina} de {paginas}. {textoEntero(total)} {total === 1 ? "cuenta" : "cuentas"}.
      </p>
      {siguiente ? <Link href={siguiente}>Siguiente</Link> : <span>Siguiente</span>}
    </nav>
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

export function FichaUsuario({ usuario }) {
  return (
    <dl className="admin-planes__detalle">
      <Dato etiqueta="Nombre" valor={usuario.nombre || "Sin perfil"} />
      <Dato etiqueta="Usuario" valor={usuario.nombreUsuario || "Sin usuario"} />
      <Dato etiqueta="Correo" valor={usuario.correo || "Sin correo"} />
      <Dato etiqueta="Confirmación" valor={usuario.confirmado ? "Correo confirmado" : "Sin confirmar"} />
      <Dato etiqueta="Fecha de alta" valor={textoFecha(usuario.alta, "Sin fecha")} />
      <Dato etiqueta="Última conexión" valor={textoFecha(usuario.ultimaConexion, "Sin conexión registrada")} />
      <Dato etiqueta="Última actividad de cultivo" valor={textoFecha(usuario.ultimaActividad, "Sin registros")} />
      <Dato etiqueta="Plan" valor={etiquetaPlan(usuario.plan)} />
      <Dato etiqueta="Espacios" valor={textoEntero(usuario.espacios)} />
      <Dato etiqueta="Unidades" valor={textoEntero(usuario.unidades)} />
      <Dato etiqueta="Plantas" valor={textoEntero(usuario.plantas)} />
      <Dato etiqueta="Plantas activas" valor={textoEntero(usuario.plantasActivas)} />
      <Dato etiqueta="Plantas finalizadas" valor={textoEntero(usuario.plantasFinalizadas)} />
      <Dato etiqueta="Registros" valor={textoEntero(usuario.registros)} />
      <Dato etiqueta="Registros de los últimos 30 días" valor={textoEntero(usuario.registros30)} />
    </dl>
  );
}

export function VolverUsuarios({ href }) {
  return (
    <p>
      <Link href={href}>Volver al listado</Link>
    </p>
  );
}
