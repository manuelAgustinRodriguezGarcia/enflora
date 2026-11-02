import Link from "next/link";
import { etiquetaAmbiente, textoPeriodo } from "@/componentes/admin/formato-planes";

const PRODUCTOS = [
  ["todos", "Todos los productos"],
  ["plus", "Plus"],
  ["pago_unico", "Pago único"],
];

const ESTADOS_OPERACION = [
  ["todos", "Todos los estados"],
  ["creada", "Creada"],
  ["pendiente", "Pendiente"],
  ["acreditado", "Acreditado"],
  ["rechazado", "Rechazado"],
  ["cancelado", "Cancelado"],
  ["reembolsado", "Reembolsado"],
  ["contracargo", "Contracargo"],
];

export function MarcoPlanes({ titulo, intro, actual, enlaces, formulario, aviso, children }) {
  return (
    <section className="admin-dash admin-planes">
      <header className="admin-dash__cabecera">
        <p className="admin-estado__etiqueta">Administración</p>
        <h1>{titulo}</h1>
        <p className="admin-dash__aclaracion">{intro}</p>
      </header>
      <nav className="admin-planes__secciones" aria-label="Secciones de planes">
        {enlaces.map((enlace) => (
          <Link key={enlace.id} href={enlace.href} aria-current={enlace.id === actual ? "page" : undefined}>
            {enlace.titulo}
          </Link>
        ))}
      </nav>
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

export function FormularioPlanes({ destino, consulta, variante, opcionesEstado = ESTADOS_OPERACION, nombreEstado = "estado", valorEstado = "todos" }) {
  const conservaPeriodo = variante === "stock" || variante === "suscripciones" || variante === "licencias";
  const periodo = (
    <Select
      nombre="periodo"
      valor={consulta.periodo}
      etiqueta="Período"
      opciones={[
        ["7", "Últimos 7 días"],
        ["30", "Últimos 30 días"],
        ["90", "Últimos 90 días"],
        ["personalizado", "Período personalizado"],
      ]}
    />
  );
  return (
    <form className="admin-planes__filtros" method="get" action={destino}>
      {conservaPeriodo ? <input type="hidden" name="periodo" value={consulta.periodo} /> : periodo}
      {conservaPeriodo && consulta.periodo === "personalizado" ? (
        <>
          <input type="hidden" name="desde" value={consulta.desdeDia} />
          <input type="hidden" name="hasta" value={consulta.hastaDia} />
        </>
      ) : null}
      <Select
        nombre="ambiente"
        valor={consulta.ambiente}
        etiqueta="Ambiente"
        opciones={[
          ["produccion", "Producción"],
          ["prueba", "Prueba"],
        ]}
      />
      {variante === "operaciones" ? (
        <Select nombre="producto" valor={consulta.producto} etiqueta="Producto" opciones={PRODUCTOS} />
      ) : (
        <input type="hidden" name="producto" value={consulta.producto} />
      )}
      {variante === "operaciones" ? (
        <Select nombre="estado" valor={consulta.estado} etiqueta="Estado" opciones={ESTADOS_OPERACION} />
      ) : (
        <input type="hidden" name="estado" value={consulta.estado} />
      )}
      {variante === "suscripciones" ? (
        <Select nombre={nombreEstado} valor={valorEstado} etiqueta="Estado" opciones={opcionesEstado} />
      ) : (
        <input type="hidden" name="estado_suscripcion" value={consulta.estadoSuscripcion || "todos"} />
      )}
      {variante === "licencias" ? (
        <Select nombre={nombreEstado} valor={valorEstado} etiqueta="Estado" opciones={opcionesEstado} />
      ) : (
        <input type="hidden" name="estado_licencia" value={consulta.estadoLicencia || "todos"} />
      )}
      {!conservaPeriodo ? (
        <>
          <label className="admin-planes__campo">
            <span>Desde</span>
            <input type="date" name="desde" defaultValue={consulta.periodo === "personalizado" ? consulta.desdeDia : ""} />
          </label>
          <label className="admin-planes__campo">
            <span>Hasta</span>
            <input type="date" name="hasta" defaultValue={consulta.periodo === "personalizado" ? consulta.hastaDia : ""} />
          </label>
        </>
      ) : null}
      <button className="admin-dash__actualizar" type="submit">
        Aplicar filtros
      </button>
      <p className="admin-planes__contexto">
        {conservaPeriodo
          ? `${etiquetaAmbiente(consulta.ambiente)}. Esta lista es el estado actual y no recorta por el período de ingresos.`
          : `${etiquetaAmbiente(consulta.ambiente)} · ${textoPeriodo(consulta.desdeDia, consulta.hastaDia)} · ARS. Los ingresos no mezclan prueba y producción.`}
      </p>
    </form>
  );
}

export function PaginacionPlanes({ anterior, siguiente, pagina, paginas, total, etiqueta }) {
  if (total === 0) return null;
  return (
    <nav className="admin-planes__paginacion" aria-label="Paginación">
      {anterior ? <Link href={anterior}>Anterior</Link> : <span>Anterior</span>}
      <p>
        Página {pagina} de {paginas}. {total} {etiqueta}.
      </p>
      {siguiente ? <Link href={siguiente}>Siguiente</Link> : <span>Siguiente</span>}
    </nav>
  );
}

export function AvisoEstado(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver planes e ingresos.";
  return resultado.error || "No pudimos leer los datos de planes. No se muestran cifras parciales.";
}
