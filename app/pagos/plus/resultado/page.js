import { EnlaceBoton } from "@/componentes/boton";
import { formatearFechaCotizacion } from "@/lib/cotizacion";
import { consultarPlusActivo } from "@/lib/pagos/plus/leer-plus-activo";
import { ESTADOS_PLUS_INTERNO } from "@/lib/pagos/plus/constantes";
import { resolverSuscripcionIdRetornoPlus } from "@/lib/pagos/plus/gestion-servidor";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";
import { redirect } from "next/navigation";
import { reconciliarPlusRetorno } from "../acciones";

export const metadata = {
  title: "Resultado suscripción Plus",
  robots: { index: false, follow: false },
};

export default async function PaginaResultadoPlus({ searchParams }) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/pagos/plus");

  const params = await searchParams;
  const supabase = await crearClienteServidor();

  const resuelta = await resolverSuscripcionIdRetornoPlus({
    supabase,
    usuarioId: usuario.id,
    suscripcionIdParam: params?.suscripcion,
  });

  if (!resuelta.ok && resuelta.codigo === "retorno_ambiguo") {
    return (
      <section className="pago" role="status">
        <h1>No pudimos identificar la suscripción</h1>
        <p>
          Mercado Pago volvió sin referencia y tenés más de una suscripción abierta. Entrá a PLAN 420
          para ver el estado correcto.
        </p>
        <EnlaceBoton href="/pagos/plus">Ir a mi PLAN 420</EnlaceBoton>
      </section>
    );
  }

  if (!resuelta.ok) {
    return (
      <section className="pago" role="status">
        <h1>Resultado de suscripción</h1>
        <p>No encontramos una suscripción Plus reciente para tu cuenta en este ambiente.</p>
        <EnlaceBoton href="/pagos/plus">Ir a mi PLAN 420</EnlaceBoton>
      </section>
    );
  }

  const suscripcionId = resuelta.suscripcionId;

  let reconciliacion = { ok: false, codigo: "sin_intento" };
  try {
    reconciliacion = await reconciliarPlusRetorno(params?.suscripcion ?? "");
  } catch {
    reconciliacion = { ok: false, codigo: "mp_no_disponible" };
  }

  const supabaseLectura = await crearClienteServidor();
  const plus = await consultarPlusActivo(supabaseLectura, usuario.id);
  const { data: fresco } = await supabaseLectura
    .from("plus_suscripciones")
    .select("estado_interno, periodo_vigente_hasta, proxima_renovacion")
    .eq("id", suscripcionId)
    .maybeSingle();

  const falloMp = reconciliacion.ok === false && reconciliacion.codigo === "mp_no_disponible";
  const persistenciaFallida =
    reconciliacion.ok === false && reconciliacion.codigo === "persistencia";

  let titulo = "Volviste de Mercado Pago";
  let texto =
    "Consultamos el estado real de tu suscripción. Los beneficios Plus solo se activan con un cobro acreditado y período vigente.";

  if (plus.activo) {
    titulo = "Plus acreditado";
    texto = "Tu suscripción tiene un pago acreditado. Los beneficios pagos ya aplican en tu cuenta.";
  } else if (persistenciaFallida) {
    titulo = "Cobro detectado, registro pendiente";
    texto =
      "Mercado Pago acreditó el cobro pero no pudimos guardarlo ahora. Reintentá en unos minutos o contactá soporte si persiste.";
  } else if (fresco?.estado_interno === ESTADOS_PLUS_INTERNO.pendienteCheckout) {
    titulo = "Suscripción pendiente";
    texto =
      "Mercado Pago todavía no confirmó la autorización o el primer cobro. Podés revisar el estado en unos minutos.";
  } else if (fresco?.estado_interno === ESTADOS_PLUS_INTERNO.activa && !plus.activo) {
    titulo = "Autorizada, cobro pendiente";
    texto =
      "La suscripción está autorizada en Mercado Pago. Esperamos la acreditación del cobro para activar beneficios.";
  } else if (fresco?.estado_interno === ESTADOS_PLUS_INTERNO.pastDue) {
    titulo = "Cobro rechazado o pendiente";
    texto =
      "El último intento de cobro no quedó acreditado. Revisá el medio de pago en Mercado Pago.";
  } else if (falloMp) {
    titulo = "No pudimos verificar ahora";
    texto =
      "Mercado Pago no respondió. No activamos beneficios por esta visita; el webhook o un reintento actualizarán el estado.";
  }

  return (
    <section className="pago" role="status">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {resuelta.inferida ? (
        <p className="pago__nota">Identificamos tu suscripción reciente aunque Mercado Pago no devolvió el enlace completo.</p>
      ) : null}
      {fresco?.periodo_vigente_hasta ? (
        <p>Período vigente hasta: {formatearFechaCotizacion(fresco.periodo_vigente_hasta)}</p>
      ) : null}
      {fresco?.proxima_renovacion ? (
        <p>Próximo cobro previsto: {formatearFechaCotizacion(fresco.proxima_renovacion)}</p>
      ) : null}
      <EnlaceBoton href="/pagos/plus">Ir a mi PLAN 420</EnlaceBoton>
    </section>
  );
}
