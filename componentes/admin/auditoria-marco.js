import Link from "next/link";
import { textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const PERIODOS = [
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["personalizado", "Período personalizado"],
];

const RESULTADOS = [
  ["", "Todos los resultados"],
  ["exito", "Éxito"],
  ["rechazo", "Rechazo"],
  ["error", "Error"],
];

export function MarcoAuditoria({ titulo, intro, formulario, aviso, children }) {
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

export function AvisoAuditoria(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver la auditoría.";
  return resultado.error || "No pudimos leer la auditoría. No se muestran eventos parciales.";
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

export function FormularioAuditoria({ consulta, modulos, acciones }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/auditoria">
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
        <span>Desde</span>
        <input name="desde" type="date" defaultValue={consulta.desdeDia} />
      </label>
      <label className="admin-planes__campo">
        <span>Hasta</span>
        <input name="hasta" type="date" defaultValue={consulta.hastaDia} />
      </label>
      <label className="admin-planes__campo">
        <span>Módulo</span>
        <select name="modulo" defaultValue={consulta.modulo}>
          <option value="">Todos los módulos</option>
          {modulos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Acción</span>
        <select name="accion" defaultValue={consulta.accion}>
          <option value="">Todas las acciones</option>
          {acciones.map((item) => (
            <option key={item.id} value={item.id}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Resultado</span>
        <select name="resultado" defaultValue={consulta.resultado}>
          {RESULTADOS.map(([id, texto]) => (
            <option key={id || "todos"} value={id}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Administrador</span>
        <input name="administrador" type="text" defaultValue={consulta.administrador} placeholder="UUID autorizado" autoComplete="off" spellCheck="false" />
      </label>
      <button className="admin-dash__actualizar" type="submit">
        Filtrar
      </button>
    </form>
  );
}

export function ResumenAuditoria({ resumen }) {
  const vacio = resumen.totalRegistrado === 0;
  return (
    <>
      {vacio ? (
        <p className="admin-dash__aclaracion">
          Todavía no hay eventos. No se reconstruyen acciones anteriores a los registros de Usuarios, Partners y esta auditoría.
        </p>
      ) : null}
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Eventos del período" valor={textoEntero(resumen.total)} detalle={`${textoEntero(resumen.totalRegistrado)} en total, sin inventar historial`} />
        <Cifra etiqueta="Éxitos" valor={textoEntero(resumen.exitos)} detalle={`${textoEntero(resumen.rechazos)} rechazos y ${textoEntero(resumen.errores)} errores`} />
        <Cifra etiqueta="Registro del módulo" valor={textoEntero(resumen.heredados)} detalle="Usuarios y Partners, leídos de su auditoría" />
        <Cifra etiqueta="Registro central" valor={textoEntero(resumen.centrales)} detalle="Escritos a partir de esta migración" />
      </div>
      {resumen.porModulo.length ? (
        <ul className="admin-dash__detalle">
          {resumen.porModulo.map((item) => (
            <li key={item.modulo}>
              {item.etiqueta}: {textoEntero(item.total)}
            </li>
          ))}
        </ul>
      ) : null}
      {resumen.porAccion.length ? (
        <ul className="admin-dash__detalle">
          {resumen.porAccion.map((item) => (
            <li key={item.accion}>
              {item.etiqueta}: {textoEntero(item.total)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function TablaAuditoria({ filas }) {
  if (!filas.length) return <p className="admin-dash__aclaracion">No hay eventos para este filtro.</p>;
  return (
    <table className="admin-planes__tabla">
      <thead>
        <tr>
          <th>Cuándo</th>
          <th>Módulo</th>
          <th>Acción</th>
          <th>Resultado</th>
          <th>Origen</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.id}>
            <td>
              <Link href={`/admin/auditoria/${fila.id}`}>{textoInstante(fila.creadaEn)}</Link>
            </td>
            <td>{fila.moduloEtiqueta}</td>
            <td>{fila.accionEtiqueta}</td>
            <td>{fila.resultadoEtiqueta}</td>
            <td>{fila.coberturaEtiqueta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FichaAuditoria({ evento }) {
  const campos = [
    ["Fecha", textoInstante(evento.creadaEn)],
    ["Administrador", evento.administradorId],
    ["Módulo", evento.moduloEtiqueta],
    ["Acción", evento.accionEtiqueta],
    ["Recurso", evento.recursoTipo],
    ["Identificador", evento.recursoId || "Sin identificador"],
    ["Resultado", evento.resultadoEtiqueta],
    ["Motivo", evento.motivo || "Sin motivo"],
    ["Origen del registro", evento.coberturaEtiqueta],
    ["Operación", evento.operacionId],
  ];
  return (
    <>
      <p className="admin-dash__aclaracion">
        {evento.cobertura === "heredada"
          ? "Este evento ya estaba en la auditoría del módulo. No se copió ni se completó con datos que esa tabla no guarda."
          : "Este evento se escribió en la auditoría central. No hay una reconstrucción anterior."}
      </p>
      <dl className="admin-dash__detalle">
        {campos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <p>
        <Link href="/admin/auditoria">Volver al listado</Link>
      </p>
    </>
  );
}

export function PaginacionAuditoria({ anterior, siguiente }) {
  return (
    <p>
      {anterior ? <Link href={anterior}>Anterior</Link> : null} {siguiente ? <Link href={siguiente}>Siguiente</Link> : null}
    </p>
  );
}
