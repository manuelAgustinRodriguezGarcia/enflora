import Link from "next/link";
import { textoDia, textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const NAV = [
  ["/admin/partners", "Resumen"],
  ["/admin/partners/comercios", "Comercios"],
  ["/admin/partners/solicitudes", "Solicitudes"],
  ["/admin/partners/campanas", "Campañas"],
];

export function MarcoPartners({ titulo, intro, aviso, children }) {
  return (
    <section className="admin-dash admin-planes">
      <header className="admin-dash__cabecera">
        <p className="admin-estado__etiqueta">Administración</p>
        <h1>{titulo}</h1>
        <p className="admin-dash__aclaracion">{intro}</p>
        <nav aria-label="Secciones de partners">
          {NAV.map(([href, texto]) => (
            <Link key={href} href={href}>
              {texto}
            </Link>
          ))}
        </nav>
      </header>
      {aviso ? (
        <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
          {aviso}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function AvisoPartners(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver partners.";
  return resultado.error || "No pudimos leer partners. No se muestran cifras parciales.";
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

function tasa(impresiones, clics) {
  if (!impresiones) return "Sin impresiones en el período";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format((clics / impresiones) * 100)} % de clics sobre impresiones`;
}

export function ResumenPartners({ resumen }) {
  const vacio = resumen.comercios === 0 && resumen.solicitudes === 0 && resumen.impresiones === 0;
  return (
    <>
      {vacio ? <p className="admin-dash__aclaracion">Todavía no hay comercios, solicitudes ni mediciones.</p> : null}
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Comercios" valor={textoEntero(resumen.comercios)} detalle={`${textoEntero(resumen.aprobados)} aprobados, ${textoEntero(resumen.pendientes)} pendientes, ${textoEntero(resumen.rechazados)} rechazados`} />
        <Cifra etiqueta="Activos y vigentes" valor={textoEntero(resumen.activos)} detalle="Aprobados, activos y dentro de la fecha" />
        <Cifra etiqueta="Solicitudes" valor={textoEntero(resumen.solicitudes)} detalle={`${textoEntero(resumen.solicitudes_recibidas)} sin revisar`} />
        <Cifra etiqueta="Campañas activas" valor={textoEntero(resumen.campanas_activas)} detalle={`${textoEntero(resumen.campanas_finalizadas)} finalizadas, ${textoEntero(resumen.campanas_borrador)} en borrador`} />
        <Cifra etiqueta="Impresiones del período" valor={textoEntero(resumen.impresiones)} detalle="Una por navegador y campaña" />
        <Cifra etiqueta="Clics del período" valor={textoEntero(resumen.clics)} detalle={tasa(resumen.impresiones, resumen.clics)} />
      </div>
      <p className="admin-dash__aclaracion">
        Un envío aceptado no aplica acá: la impresión es la vista del banner y el clic es el toque en el enlace. No hay historial anterior a esta medición. Flora no muestra publicidad.
      </p>
    </>
  );
}

export function TablaComercios({ filas }) {
  if (!filas.length) return <p className="admin-dash__aclaracion">No hay comercios para este filtro.</p>;
  return (
    <table className="admin-planes__tabla">
      <thead>
        <tr>
          <th>Comercio</th>
          <th>Plan</th>
          <th>Revisión</th>
          <th>Activo</th>
          <th>Vigencia</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.id}>
            <td>
              <Link href={`/admin/partners/comercios/${fila.id}`}>{fila.nombre}</Link>
              <p className="admin-dash__detalle">{fila.rubro || "Sin rubro"}</p>
            </td>
            <td>{fila.plan}</td>
            <td>{fila.estado_revision}</td>
            <td>{fila.activo ? "Sí" : "No"}</td>
            <td>
              {textoDia(String(fila.fecha_inicio).slice(0, 10))}
              {fila.fecha_fin ? ` – ${textoDia(String(fila.fecha_fin).slice(0, 10))}` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TablaSolicitudes({ filas }) {
  if (!filas.length) return <p className="admin-dash__aclaracion">No hay solicitudes para este filtro.</p>;
  return (
    <table className="admin-planes__tabla">
      <thead>
        <tr>
          <th>Comercio</th>
          <th>Contacto</th>
          <th>Estado</th>
          <th>Recibida</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.id}>
            <td>
              <Link href={`/admin/partners/solicitudes/${fila.id}`}>{fila.comercio}</Link>
              <p className="admin-dash__detalle">{fila.resumen || "Sin mensaje"}</p>
            </td>
            <td>{fila.correo}</td>
            <td>{fila.estado}</td>
            <td>{textoInstante(fila.recibida_en)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TablaCampanas({ filas }) {
  if (!filas.length) return <p className="admin-dash__aclaracion">No hay campañas para este filtro.</p>;
  return (
    <table className="admin-planes__tabla">
      <thead>
        <tr>
          <th>Campaña</th>
          <th>Estado</th>
          <th>Ubicación</th>
          <th>Impresiones</th>
          <th>Clics</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.id}>
            <td>
              <Link href={`/admin/partners/campanas/${fila.id}`}>{fila.nombre}</Link>
              <p className="admin-dash__detalle">{fila.comercio}</p>
            </td>
            <td>{fila.estado}</td>
            <td>Listado de cultivos</td>
            <td>{textoEntero(fila.impresiones)}</td>
            <td>{textoEntero(fila.clics)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PaginacionPartners({ anterior, siguiente }) {
  return (
    <p>
      {anterior ? <Link href={anterior}>Anterior</Link> : null} {siguiente ? <Link href={siguiente}>Siguiente</Link> : null}
    </p>
  );
}
