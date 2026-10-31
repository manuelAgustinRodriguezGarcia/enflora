import { formatearFechaCotizacion } from "@/lib/cotizacion";
import { textoReferenciaCotizacion } from "@/lib/pagos/cotizacion-comercial";
import { obtenerCotizacionBilleteVendedor } from "@/lib/pagos/cotizacion-bna";
import { PRECIO_PLUS_USD, ESTADOS_PLUS_INTERNO } from "@/lib/pagos/plus/constantes";
import { formatearCentavosArs, formatearCotizacion } from "@/lib/pagos/dinero";
import { importePlusCentavos } from "@/lib/pagos/plus/dinero";
import { leerResumenPlusUsuario } from "@/lib/pagos/plus/gestion-servidor";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";
import { redirect } from "next/navigation";
import { cancelarPlus, iniciarSuscripcionPlus } from "./acciones";

export const metadata = {
  title: "PLAN 420 — Suscripción mensual",
  robots: { index: false, follow: false },
};

const ERRORES = {
  plus_ya_activo: "Ya tenés Plus activo en este ambiente.",
  suscripcion_en_curso: "Ya hay una suscripción en curso. Revisá el estado abajo.",
  cotizacion_no_disponible: "No pudimos leer la cotización BNA. Intentá más tarde.",
  importe_incoherente:
    "No pudimos calcular un importe coherente con el precio comercial. Intentá más tarde.",
  importe_invalido: "El importe en pesos no es válido. Intentá más tarde.",
  checkout: "No pudimos iniciar el checkout. No se activó Plus.",
  checkout_ausente: "Mercado Pago no devolvió enlace de suscripción.",
  comprador_prueba_invalido: "Configurá MERCADOPAGO_TEST_BUYER_EMAIL para pruebas.",
  comprador_invalido: "Falta un correo válido para el checkout.",
  mp_cancel_fallido: "No pudimos cancelar en Mercado Pago. Probá de nuevo.",
};

function pesos(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(numero);
}

function etiquetaEstado(estado) {
  switch (estado) {
    case ESTADOS_PLUS_INTERNO.activa:
      return "Activa";
    case ESTADOS_PLUS_INTERNO.pendienteCheckout:
      return "Pendiente de autorización en Mercado Pago";
    case ESTADOS_PLUS_INTERNO.pausada:
      return "Pausada";
    case ESTADOS_PLUS_INTERNO.cancelada:
      return "Cancelada";
    case ESTADOS_PLUS_INTERNO.pastDue:
      return "Cobro pendiente o rechazado";
    case ESTADOS_PLUS_INTERNO.vencida:
      return "Vencida";
    default:
      return estado || "—";
  }
}

export default async function PaginaPlus({ searchParams }) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/plus");

  const params = await searchParams;
  const supabase = await crearClienteServidor();
  const [resumen, cotizacion] = await Promise.all([
    leerResumenPlusUsuario(supabase, usuario.id),
    obtenerCotizacionBilleteVendedor(),
  ]);

  const errorClave = params?.error;
  const cancelada = params?.cancelada === "1";
  const referenciaCotizacion = textoReferenciaCotizacion(
    cotizacion.ok
      ? {
          ok: true,
          ventaEscala4: cotizacion.cotizacion.venta,
          fecha: cotizacion.cotizacion.publicadaEn,
          advertenciaAntigua: cotizacion.advertenciaAntigua,
        }
      : { ok: false },
  );

  const importeReferenciaCentavos =
    cotizacion.ok && importePlusCentavos(cotizacion.cotizacion.venta);

  if (!resumen.ok) {
    return (
      <section className="pago">
        <h1>PLAN 420</h1>
        <p>No pudimos leer el ambiente de pagos ({resumen.codigo}).</p>
      </section>
    );
  }

  const sub = resumen.suscripcion;
  const beneficios = resumen.beneficiosActivos;

  return (
    <section className="pago">
      <h1>PLAN 420 — Suscripción mensual</h1>
      <p className="pago__subtitulo">Una suscripción para todos tus cultivos.</p>
      <p>
        <strong>US$ {PRECIO_PLUS_USD.toFixed(2).replace(".", ",")}/mes</strong> en toda tu cuenta
        (todos los espacios, unidades y cultivos). Renovación mensual automática en Mercado Pago.
      </p>
      <p>
        El cobro se expresa en pesos argentinos según el dólar billete vendedor del Banco Nación.
        Ambiente: <strong>{resumen.ambiente}</strong>.
      </p>
      <p>{referenciaCotizacion}</p>
      {cotizacion.ok ? (
        <p>
          Cotización BNA vendedor: <strong>{formatearCotizacion(cotizacion.cotizacion.venta)}</strong>
        </p>
      ) : null}
      {importeReferenciaCentavos ? (
        <p>
          Referencia de este mes:{" "}
          <strong>{formatearCentavosArs(importeReferenciaCentavos)}</strong> / mes
        </p>
      ) : null}
      <p className="pago__nota">
        El importe en ARS se actualiza antes de cada renovación según la cotización BNA vigente en
        ese momento. Al iniciar el checkout, el importe mostrado coincide con el que recibe Mercado
        Pago.
      </p>

      {errorClave ? (
        <p role="alert">{ERRORES[errorClave] || ERRORES.checkout}</p>
      ) : null}
      {cancelada ? (
        <p>La suscripción quedó cancelada en Mercado Pago. Los beneficios siguen hasta el fin del período pagado.</p>
      ) : null}

      {beneficios ? (
        <div role="status">
          <h2>Plus activo</h2>
          <p>Los beneficios pagos aplican en toda tu cuenta mientras el período esté vigente.</p>
          {sub?.periodo_vigente_hasta ? (
            <p>Vigencia del período: hasta {formatearFechaCotizacion(sub.periodo_vigente_hasta)}</p>
          ) : null}
        </div>
      ) : null}

      {sub ? (
        <div>
          <h2>Tu suscripción</h2>
          <ul>
            <li>Estado: {etiquetaEstado(sub.estado_interno)}</li>
            <li>Importe ARS registrado: {pesos(sub.importe_ars)}</li>
            {sub.cotizacion_valor ? (
              <li>Cotización al alta: {Number(sub.cotizacion_valor).toFixed(2)}</li>
            ) : null}
            {sub.proxima_renovacion ? (
              <li>Próxima renovación (MP): {formatearFechaCotizacion(sub.proxima_renovacion)}</li>
            ) : null}
            {sub.vigente_hasta_fin_periodo && sub.periodo_vigente_hasta ? (
              <li>Beneficios hasta: {formatearFechaCotizacion(sub.periodo_vigente_hasta)}</li>
            ) : null}
          </ul>
          {resumen.ultimoPago ? (
            <p>
              Último cobro: {pesos(resumen.ultimoPago.importe_cobrado_ars || resumen.ultimoPago.importe_ars)}{" "}
              ({resumen.ultimoPago.estado_interno})
            </p>
          ) : sub.estado_interno === ESTADOS_PLUS_INTERNO.activa && !beneficios ? (
            <p>Mercado Pago autorizó la suscripción; esperamos el primer cobro acreditado.</p>
          ) : null}
          {sub.estado_interno !== ESTADOS_PLUS_INTERNO.cancelada ? (
            <form action={cancelarPlus}>
              <input type="hidden" name="suscripcionId" value={sub.id} />
              <button type="submit" className="landing__accion landing__accion--linea">
                Cancelar renovaciones
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {!beneficios &&
      (!sub || sub.estado_interno === ESTADOS_PLUS_INTERNO.pendienteCheckout) ? (
        <form action={iniciarSuscripcionPlus}>
          <button type="submit" className="landing__accion landing__accion--acento">
            {sub?.init_point ? "Continuar checkout Mercado Pago" : "Suscribirme a PLAN 420"}
          </button>
        </form>
      ) : null}

      {!resumen.dbDisponible ? (
        <p role="alert">
          Las tablas Plus no están disponibles en esta base. Contactá soporte si acabás de migrar.
        </p>
      ) : null}

      <p className="pago__alternativa">
        <a href="/pagos/licencia">¿Preferís pagar por un solo ciclo? Conocé el Pago único</a>
      </p>
    </section>
  );
}
