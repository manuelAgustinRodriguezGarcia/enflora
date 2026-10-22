import { EnlaceBoton } from "@/componentes/boton";
import { formatearFechaCotizacion } from "@/lib/cotizacion";
import { reconciliarPago } from "@/lib/pagos/aplicar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Resultado del pago",
  robots: { index: false, follow: false },
};

const TEXTOS = {
  creada: {
    titulo: "Preparando pago",
    texto: "La orden todavía no tiene un resultado verificado.",
  },
  pendiente: {
    titulo: "Pendiente de acreditación",
    texto: "Mercado Pago todavía no acreditó el pago. La licencia sigue inactiva.",
  },
  acreditado: {
    titulo: "Pago acreditado",
    texto: "La licencia quedó activada para este ciclo.",
  },
  rechazado: {
    titulo: "Pago rechazado",
    texto: "Mercado Pago rechazó el pago. La licencia no se activó.",
  },
  cancelado: {
    titulo: "Pago cancelado",
    texto: "La orden fue cancelada. La licencia no se activó.",
  },
  reembolsado: {
    titulo: "Pago reembolsado",
    texto: "El reembolso, total o parcial, revocó la licencia de este ciclo.",
  },
  contracargo: {
    titulo: "Contracargo",
    texto: "El contracargo revocó la licencia de este ciclo.",
  },
};

function pesos(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(numero);
}

function cotizacion(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(numero);
}

export default async function PaginaResultado({ params }) {
  const { pagoId } = await params;
  const supabase = await crearClienteServidor();
  const campos =
    "id, estado, order_id, ciclo_cultivo_id, importe_ars, precio_usd, cotizacion_valor, cotizacion_publicada_en, acreditado_en, creado_en, ambiente, vendedor_mp";
  const { data: pago, error } = await supabase.from("pagos").select(campos).eq("id", pagoId).maybeSingle();

  if (error || !pago) notFound();

  let verificado = pago.estado;
  let operacion = "";
  let fallo = false;
  if (pago.order_id) {
    try {
      const resultado = await reconciliarPago(pago);
      if (resultado?.estado) verificado = resultado.estado;
      if (resultado?.operacion) operacion = resultado.operacion;
      else if (resultado?.ok === false && resultado.codigo !== "importe") fallo = true;
    } catch {
      fallo = true;
    }
  }

  const { data: fresco } = await supabase.from("pagos").select(campos).eq("id", pago.id).maybeSingle();
  const actual = fresco || pago;
  if (fresco?.estado) verificado = fresco.estado;

  const { data: ciclo } = await supabase
    .from("ciclos_cultivo")
    .select("nombre, estado")
    .eq("id", actual.ciclo_cultivo_id)
    .maybeSingle();

  const estado = fallo ? null : TEXTOS[verificado] || TEXTOS.creada;
  const cultivo = ciclo?.nombre || "tu ciclo";
  const fecha = formatearFechaCotizacion(actual.acreditado_en || actual.creado_en);
  const productiva = verificado === "acreditado" && actual.ambiente === "produccion" && !fallo;

  return (
    <section className="pago" role="status">
      <h1>{fallo ? "Error al verificar" : estado.titulo}</h1>
      <p>
        {fallo
          ? "No pudimos confirmar el estado con Mercado Pago. No se activó ninguna licencia por esta visita."
          : estado.texto}
      </p>
      <dl className="pago__resumen">
        <div>
          <dt>Producto</dt>
          <dd>Licencia de un ciclo de cultivo</dd>
        </div>
        <div>
          <dt>Ciclo</dt>
          <dd>{cultivo}</dd>
        </div>
        <div>
          <dt>Precio</dt>
          <dd>USD {Number(actual.precio_usd) || 30}</dd>
        </div>
        <div>
          <dt>Dólar billete vendedor</dt>
          <dd>
            {cotizacion(actual.cotizacion_valor)}
            {actual.cotizacion_publicada_en ? ` · ${formatearFechaCotizacion(actual.cotizacion_publicada_en)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Importe</dt>
          <dd>{pesos(actual.importe_ars)}</dd>
        </div>
        <div>
          <dt>Operación</dt>
          <dd>{operacion || "Todavía no informada"}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{fecha || "—"}</dd>
        </div>
      </dl>
      {productiva ? <p>La licencia productiva de este ciclo está activa.</p> : null}
      {verificado === "acreditado" && actual.ambiente === "prueba" && !fallo ? (
        <p>
          La licencia de prueba quedó en este ciclo.
          {ciclo?.estado === "finalizado" ? " El ciclo está finalizado y la licencia sigue en él." : ""}
          {" "}No habilita el producto en producción. Un ciclo nuevo no la hereda.
        </p>
      ) : null}
      {verificado === "acreditado" && actual.ambiente === "produccion" && ciclo?.estado === "finalizado" && !fallo ? (
        <p>El ciclo está finalizado y la licencia sigue en él.</p>
      ) : null}
      {verificado === "pendiente" || verificado === "creada" ? (
        <EnlaceBoton href={`/pagos/resultado/${pago.id}`}>Verificar estado</EnlaceBoton>
      ) : null}
      <EnlaceBoton href="/pagos/licencia">Volver a la licencia</EnlaceBoton>
    </section>
  );
}
