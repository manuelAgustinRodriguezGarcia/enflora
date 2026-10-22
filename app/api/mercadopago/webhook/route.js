import { leerRecepcionPagos } from "@/lib/pagos/ambiente";
import { aplicarEvaluacion } from "@/lib/pagos/aplicar";
import { clientePagos } from "@/lib/pagos/datos";
import { ambienteCompatibleConAviso, eventoOrdenWebhook } from "@/lib/pagos/evento-webhook";
import { firmaWebhookValida, resumenFirmaWebhook } from "@/lib/pagos/firma";
import { obtenerOrden } from "@/lib/pagos/orden";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id");
  const firma = firmaWebhookValida({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim(),
  });

  if (!firma.ok) {
    if (process.env.NODE_ENV !== "production") {
      const resumen = resumenFirmaWebhook({
        xSignature: request.headers.get("x-signature"),
        xRequestId: request.headers.get("x-request-id"),
        dataId,
        secret: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim(),
      });
      console.error(
        `[mercadopago] webhook ${firma.codigo} ${JSON.stringify({
          ...resumen,
          coincideOriginal: firma.coincideOriginal,
          coincideMinusculas: firma.coincideMinusculas,
        })}`,
      );
    } else {
      console.error(`[mercadopago] webhook ${firma.codigo}`);
    }
    return json({ ok: false }, firma.codigo === "sin_secreto" ? 503 : 401);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[mercadopago] webhook aceptada ${firma.variante}`);
  }

  const tipo = url.searchParams.get("type");
  const topic = url.searchParams.get("topic");
  if (!eventoOrdenWebhook({ type: tipo, topic })) {
    return json({ ok: true, ignorado: true });
  }

  if (!dataId || !request.headers.get("x-request-id")) {
    return json({ ok: false }, 400);
  }

  let aviso = null;
  try {
    aviso = await request.json();
  } catch {
    aviso = null;
  }

  const idAviso = aviso?.data?.id;
  if (idAviso && String(idAviso) !== String(dataId)) {
    console.error("[mercadopago] webhook referencia_distinta");
    return json({ ok: false }, 400);
  }

  const ambiente = leerRecepcionPagos();
  if (!ambiente.ok) {
    console.error(`[mercadopago] webhook ${ambiente.codigo}`);
    return json({ ok: false }, 503);
  }

  if (!ambienteCompatibleConAviso(ambiente.ambiente, aviso?.live_mode)) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[mercadopago] webhook ignorada live_mode");
    }
    return json({ ok: true, ignorado: true });
  }

  const supabase = clientePagos();
  if (!supabase) return json({ ok: false }, 503);

  let orden;
  try {
    orden = await obtenerOrden(dataId);
  } catch {
    console.error("[mercadopago] webhook orden_no_disponible");
    return json({ ok: false }, 503);
  }

  const referencia = String(orden?.external_reference || "");
  if (!referencia) return json({ ok: true, ignorado: true });

  const { data: pago, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("id", referencia)
    .maybeSingle();

  if (error || !pago) return json({ ok: true, ignorado: true });
  if (pago.ambiente !== ambiente.ambiente) return json({ ok: true, ignorado: true });

  const resultado = await aplicarEvaluacion({
    pago,
    orden,
    clave: request.headers.get("x-request-id"),
  });

  if (!resultado?.ok && resultado?.codigo === "persistencia") {
    return json({ ok: false }, 503);
  }

  return json({ ok: true, duplicada: Boolean(resultado?.duplicada) });
}
