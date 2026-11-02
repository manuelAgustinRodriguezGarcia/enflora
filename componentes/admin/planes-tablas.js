import Link from "next/link";
import {
  etiquetaAmbiente,
  etiquetaEstado,
  etiquetaIncidencia,
  etiquetaProducto,
  textoInstante,
  textoPesosCentavos,
} from "@/componentes/admin/formato-planes";

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

export function TablaOperaciones({ filas, hrefDetalle }) {
  if (filas.length === 0) {
    return <p className="admin-dash__vacio">No hay operaciones con estos filtros. No se muestran filas de ejemplo.</p>;
  }
  return (
    <Tabla
      caption="El importe de una fila pendiente, rechazada, reembolsada o con contracargo no entra en los ingresos. Una misma referencia de Mercado Pago se muestra una sola vez."
      columnas={["Fecha", "Identificador", "Producto", "Estado", "Importe", "Ambiente", "Cuenta", "Pago de Mercado Pago", ""]}
    >
      {filas.map((fila) => (
        <tr key={`${fila.origen}-${fila.id}`}>
          <td>{textoInstante(fila.fecha)}</td>
          <td>
            <code>{fila.id}</code>
          </td>
          <td>{etiquetaProducto(fila.producto)}</td>
          <td>{etiquetaEstado(fila.estado)}</td>
          <td>{textoPesosCentavos(fila.importeCentavos)}</td>
          <td>{etiquetaAmbiente(fila.ambiente)}</td>
          <td>
            <code>{fila.usuarioId}</code>
          </td>
          <td>{fila.referenciaMp || "Sin identificador"}</td>
          <td>
            <Link href={hrefDetalle(fila)}>Ver</Link>
          </td>
        </tr>
      ))}
    </Tabla>
  );
}

export function TablaSuscripciones({ filas, hrefDetalle }) {
  if (filas.length === 0) {
    return <p className="admin-dash__vacio">No hay suscripciones con estos filtros.</p>;
  }
  return (
    <Tabla
      caption="El estado es el guardado. La cobertura comercial exige período vigente y un pago acreditado. Esta lista no se limita al período de ingresos."
      columnas={["Alta", "Identificador", "Estado", "Cobertura", "Pagos acreditados", "Renovaciones", "Vigencia", "Incidencia", "Cuenta", ""]}
    >
      {filas.map((fila) => (
        <tr key={fila.id}>
          <td>{textoInstante(fila.creadaEn)}</td>
          <td>
            <code>{fila.id}</code>
          </td>
          <td>{etiquetaEstado(fila.estadoInterno)}</td>
          <td>{fila.habilitada ? "Habilitada" : "No habilitada"}</td>
          <td>{fila.pagosAcreditados}</td>
          <td>{fila.renovaciones}</td>
          <td>{fila.periodoHasta ? textoInstante(fila.periodoHasta) : "Sin período"}</td>
          <td>{etiquetaIncidencia(fila.incidencia)}</td>
          <td>
            <code>{fila.usuarioId}</code>
          </td>
          <td>
            <Link href={hrefDetalle(fila)}>Ver</Link>
          </td>
        </tr>
      ))}
    </Tabla>
  );
}

export function TablaLicencias({ filas, hrefDetalle }) {
  if (filas.length === 0) {
    return <p className="admin-dash__vacio">No hay licencias con estos filtros.</p>;
  }
  return (
    <Tabla
      caption="Una licencia habilita con estado activa y pago acreditado de la misma cuenta y ciclo. La cobertura además pide que el ciclo siga activo."
      columnas={["Activada", "Identificador", "Estado", "Pago", "Ciclo", "Habilita", "Cobertura", "Incidencia", "Cuenta", ""]}
    >
      {filas.map((fila) => (
        <tr key={fila.id}>
          <td>{textoInstante(fila.activadaEn)}</td>
          <td>
            <code>{fila.id}</code>
          </td>
          <td>{etiquetaEstado(fila.estado)}</td>
          <td>{fila.estadoPago ? etiquetaEstado(fila.estadoPago) : "Sin pago"}</td>
          <td>{fila.cicloEstado || "Sin ciclo"}</td>
          <td>{fila.habilita ? "Sí" : "No"}</td>
          <td>{fila.cobertura ? "Vigente" : "No"}</td>
          <td>{etiquetaIncidencia(fila.incidencia)}</td>
          <td>
            <code>{fila.usuarioId}</code>
          </td>
          <td>
            <Link href={hrefDetalle(fila)}>Ver</Link>
          </td>
        </tr>
      ))}
    </Tabla>
  );
}

function Fila({ etiqueta, valor }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </>
  );
}

export function DetalleOperacion({ operacion }) {
  return (
    <dl className="admin-planes__detalle">
      <Fila etiqueta="Fecha" valor={textoInstante(operacion.fecha)} />
      <Fila etiqueta="Identificador interno" valor={operacion.id} />
      <Fila etiqueta="Producto" valor={etiquetaProducto(operacion.producto)} />
      <Fila etiqueta="Estado" valor={etiquetaEstado(operacion.estado)} />
      <Fila etiqueta="Estado de Mercado Pago" valor={operacion.estadoMp || "No registrado"} />
      <Fila etiqueta="Importe" valor={`${textoPesosCentavos(operacion.importeCentavos)} · ${operacion.moneda}`} />
      <Fila
        etiqueta="Importe cotizado"
        valor={
          operacion.importeCotizadoCentavos === null
            ? "No se guarda un importe cotizado distinto del cobrado."
            : `${textoPesosCentavos(operacion.importeCotizadoCentavos)}. No se usa como ingreso.`
        }
      />
      <Fila etiqueta="Ambiente" valor={etiquetaAmbiente(operacion.ambiente)} />
      <Fila etiqueta="Cuenta" valor={operacion.usuarioId} />
      <Fila etiqueta="Pago de Mercado Pago" valor={operacion.referenciaMp || "Sin identificador"} />
      <Fila etiqueta="Orden o cargo de Mercado Pago" valor={operacion.ordenMp || "Sin identificador"} />
      <Fila etiqueta="Entra en los totales" valor={operacion.incluidaEnTotales ? "Sí, si la fecha cae en el período" : "No"} />
      <Fila etiqueta="Suscripción" valor={operacion.suscripcionId || "No aplica"} />
      <Fila etiqueta="Ciclo" valor={operacion.cicloId || "No aplica"} />
      <Fila etiqueta="Período cubierto" valor={operacion.periodoHasta ? `${textoInstante(operacion.periodoDesde)} – ${textoInstante(operacion.periodoHasta)}` : "No aplica"} />
    </dl>
  );
}

export function DetalleSuscripcion({ suscripcion, pagos, pagosRecortados }) {
  return (
    <>
      <dl className="admin-planes__detalle">
        <Fila etiqueta="Identificador" valor={suscripcion.id} />
        <Fila etiqueta="Cuenta" valor={suscripcion.usuarioId} />
        <Fila etiqueta="Ambiente" valor={etiquetaAmbiente(suscripcion.ambiente)} />
        <Fila etiqueta="Estado" valor={etiquetaEstado(suscripcion.estadoInterno)} />
        <Fila etiqueta="Cobertura comercial" valor={suscripcion.habilitada ? "Habilitada" : "No habilitada"} />
        <Fila etiqueta="Pagos acreditados" valor={String(suscripcion.pagosAcreditados)} />
        <Fila etiqueta="Renovaciones" valor={String(suscripcion.renovaciones)} />
        <Fila etiqueta="Incidencia" valor={etiquetaIncidencia(suscripcion.incidencia)} />
        <Fila etiqueta="Vigente hasta" valor={suscripcion.periodoHasta ? textoInstante(suscripcion.periodoHasta) : "Sin período"} />
        <Fila etiqueta="Cancelada" valor={suscripcion.canceladaEn ? textoInstante(suscripcion.canceladaEn) : "No"} />
        <Fila etiqueta="Sigue hasta el fin del período" valor={suscripcion.vigenteHastaFinPeriodo ? "Sí" : "No"} />
      </dl>
      <h2>Pagos de la suscripción</h2>
      <p className="admin-dash__aclaracion">El primer cobro acreditado es el alta. Los siguientes son renovaciones. Esta vista no cobra ni cancela.</p>
      {pagosRecortados ? <p className="admin-dash__detalle">Se muestran los 24 movimientos más recientes.</p> : null}
      {pagos.length === 0 ? (
        <p className="admin-dash__vacio">Esta suscripción no tiene pagos registrados.</p>
      ) : (
        <Tabla caption="Importes cobrados solo cuando el estado es acreditado." columnas={["Fecha", "Estado", "Importe", "Referencia", "Período"]}>
          {pagos.map((pago) => (
            <tr key={pago.id}>
              <td>{textoInstante(pago.acreditadoEn || pago.creadoEn)}</td>
              <td>{etiquetaEstado(pago.estado)}</td>
              <td>{textoPesosCentavos(pago.importeCentavos)}</td>
              <td>{pago.referenciaMp || "Sin identificador"}</td>
              <td>{pago.periodoHasta ? textoInstante(pago.periodoHasta) : "Sin período"}</td>
            </tr>
          ))}
        </Tabla>
      )}
    </>
  );
}

export function DetalleLicencia({ licencia }) {
  return (
    <dl className="admin-planes__detalle">
      <Fila etiqueta="Identificador" valor={licencia.id} />
      <Fila etiqueta="Cuenta" valor={licencia.usuarioId} />
      <Fila etiqueta="Ambiente del pago" valor={etiquetaAmbiente(licencia.ambiente)} />
      <Fila etiqueta="Estado de la licencia" valor={etiquetaEstado(licencia.estado)} />
      <Fila etiqueta="Estado del pago" valor={licencia.estadoPago ? etiquetaEstado(licencia.estadoPago) : "Sin pago"} />
      <Fila etiqueta="Ciclo" valor={licencia.cicloId} />
      <Fila etiqueta="Estado del ciclo" valor={licencia.cicloEstado || "Sin ciclo"} />
      <Fila etiqueta="Habilita el pago" valor={licencia.habilita ? "Sí" : "No"} />
      <Fila etiqueta="Cobertura del ciclo" valor={licencia.cobertura ? "Vigente" : "No"} />
      <Fila etiqueta="Incidencia" valor={etiquetaIncidencia(licencia.incidencia)} />
      <Fila etiqueta="Activada" valor={textoInstante(licencia.activadaEn)} />
      <Fila etiqueta="Revocada" valor={licencia.revocadaEn ? textoInstante(licencia.revocadaEn) : "No"} />
      <Fila etiqueta="Pago" valor={licencia.pagoId || "Sin pago"} />
    </dl>
  );
}
