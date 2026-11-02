import { etiquetaAmbiente, textoDia, textoEntero, textoInstante, textoPeriodo, textoPesosCentavos } from "@/componentes/admin/formato-planes";

function Tarjeta({ etiqueta, valor, detalle }) {
  return (
    <article className="admin-dash__tarjeta">
      <h2>{etiqueta}</h2>
      <p className="admin-dash__valor">{valor}</p>
      {detalle ? <p className="admin-dash__detalle">{detalle}</p> : null}
    </article>
  );
}

function GraficoIngresos({ serie, ambiente }) {
  const maximo = Math.max(1, ...serie.map((punto) => punto.centavos));
  const ancho = Math.max(720, serie.length * 14);
  const alto = 168;
  const paso = ancho / serie.length;
  const barra = Math.max(2, paso * 0.62);
  return (
    <figure className="admin-dash__grafico">
      <figcaption>
        <span className="admin-dash__leyenda">Ingresos acreditados en ARS</span>
      </figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Ingresos acreditados por día en ${etiquetaAmbiente(ambiente)}`}>
        {serie.map((punto, indice) => {
          const altura = (punto.centavos / maximo) * (alto - 8);
          return (
            <rect
              key={punto.dia}
              x={indice * paso + paso * 0.18}
              y={alto - altura}
              width={barra}
              height={altura}
              className="admin-dash__barra admin-dash__barra--usuarios"
            >
              <title>{`${textoDia(punto.dia)}: ${textoPesosCentavos(punto.centavos)}`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

export function ResumenPlanes({ resumen }) {
  const contexto = `${etiquetaAmbiente(resumen.ambiente)} · ${textoPeriodo(resumen.desdeDia, resumen.hastaDia)} · ${resumen.moneda}`;
  const vacio =
    resumen.ingresosAcreditadosCentavos === 0 &&
    resumen.pagosAcreditados === 0 &&
    resumen.pagosPendientes === 0 &&
    resumen.suscripcionesActivas === 0 &&
    resumen.licenciasCobertura === 0;
  return (
    <>
      <p className="admin-dash__actualizado">
        Actualizado {textoInstante(resumen.generadoEn)}. {contexto}.
      </p>
      {vacio ? (
        <p className="admin-dash__vacio">No hay cobros ni suscripciones en este ambiente y período. Los ceros son el conteo real.</p>
      ) : null}
      <div className="admin-dash__grilla">
        <Tarjeta etiqueta="Ingresos acreditados" valor={textoPesosCentavos(resumen.ingresosAcreditadosCentavos)} detalle={`${contexto}. Suma cobros acreditados, una sola vez por pago de Mercado Pago.`} />
        <Tarjeta etiqueta="Ingresos Plus" valor={textoPesosCentavos(resumen.ingresosPlusCentavos)} detalle="Importe cobrado en ARS de plus_pagos_recurrentes. No usa el precio en dólares." />
        <Tarjeta etiqueta="Ingresos por pago único" valor={textoPesosCentavos(resumen.ingresosCultivoCentavos)} detalle="Importe en ARS guardado en pagos de licencia de cultivo." />
        <Tarjeta etiqueta="Suscripciones Plus activas" valor={textoEntero(resumen.suscripcionesActivas)} detalle="Estado interna activa, ahora. No implica un cobro acreditado." />
        <Tarjeta etiqueta="Plus con cobertura comercial" valor={textoEntero(resumen.suscripcionesHabilitadas)} detalle="Activa, o cancelada hasta el fin del período, con período vigente y un pago acreditado que todavía cubre." />
        <Tarjeta etiqueta="Suscripciones canceladas" valor={textoEntero(resumen.suscripcionesCanceladas)} detalle="Estado cancelada en este ambiente. Es un stock, no un ingreso del período." />
        <Tarjeta etiqueta="Licencias con cobertura" valor={textoEntero(resumen.licenciasCobertura)} detalle="Licencia activa, pago acreditado del mismo ambiente y ciclo de cultivo activo." />
        <Tarjeta etiqueta="Licencias con pago acreditado" valor={textoEntero(resumen.licenciasHabilitanPago)} detalle="Misma regla de pago, aunque el ciclo ya esté finalizado." />
        <Tarjeta etiqueta="Pagos pendientes" valor={textoEntero(resumen.pagosPendientes)} detalle={`No entran en los ingresos. Órdenes creadas sin estado de pago: ${textoEntero(resumen.pagosCreados)}.`} />
        <Tarjeta etiqueta="Pagos rechazados" valor={textoEntero(resumen.pagosRechazados)} detalle="Cantidad en el período. No son ingreso." />
        <Tarjeta etiqueta="Pagos acreditados" valor={textoEntero(resumen.pagosAcreditados)} detalle={`${textoEntero(resumen.sinImporte)} sin importe cobrado utilizable, fuera del total en ARS.`} />
        <Tarjeta etiqueta="Reembolsos" valor={textoEntero(resumen.pagosReembolsados)} detalle={resumen.textoReembolsos} />
        <Tarjeta etiqueta="Contracargos" valor={textoEntero(resumen.pagosContracargos)} detalle={resumen.textoReembolsos} />
        <Tarjeta etiqueta="Nuevos clientes de pago" valor={textoEntero(resumen.clientesPagoNuevos)} detalle="Cuentas cuyo primer cobro acreditado con importe, en este ambiente, cae en el período. Plus y pago único cuentan una sola vez." />
        <Tarjeta etiqueta="Ingresos netos" valor="No disponible" detalle={resumen.textoIngresosNetos} />
        <Tarjeta etiqueta="MRR" valor="No disponible" detalle={resumen.textoMrr} />
      </div>
      <section className="admin-dash__serie" aria-labelledby="planes-serie">
        <h2 id="planes-serie">Evolución diaria</h2>
        <p className="admin-dash__aclaracion">Cada barra es un día en hora de Argentina. Solo entran cobros acreditados con importe único. {contexto}.</p>
        <GraficoIngresos serie={resumen.serieDia} ambiente={resumen.ambiente} />
      </section>
      <section className="admin-dash__serie" aria-labelledby="planes-mes">
        <h2 id="planes-mes">Evolución mensual</h2>
        <div className="admin-dash__tabla-contenedor">
          <table className="admin-dash__tabla">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Ingresos acreditados</th>
              </tr>
            </thead>
            <tbody>
              {resumen.serieMes.map((punto) => (
                <tr key={punto.mes}>
                  <th scope="row">{punto.mes}</th>
                  <td>{textoPesosCentavos(punto.centavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-dash__serie" aria-labelledby="planes-incidencias">
        <h2 id="planes-incidencias">Incidencias</h2>
        <ul className="admin-planes__incidencias">
          <li>Suscripciones activas sin pago acreditado: {textoEntero(resumen.suscripcionesActivasSinPago)}.</li>
          <li>Cobros acreditados sin fecha, fuera de los ingresos del período: {textoEntero(resumen.acreditadosSinFecha)}.</li>
          <li>Pagos repetidos con importes cobrados distintos, sin sumar: {textoEntero(resumen.crucesImporte)}.</li>
          <li>Licencias activas cuyo pago no habilita: {textoEntero(resumen.licenciasSinCobro)}.</li>
          <li>Licencias activas sin fila de pago. Este conteo no depende del ambiente: {textoEntero(resumen.licenciasSinPago)}.</li>
          <li>Cancelados en el período: {textoEntero(resumen.pagosCancelados)}. No son ingreso.</li>
        </ul>
      </section>
    </>
  );
}
