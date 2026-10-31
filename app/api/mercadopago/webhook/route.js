import { procesarWebhookMercadoPagoEntrada } from "@/lib/pagos/webhook-entrada";
import { resumenFirmaWebhook } from "@/lib/pagos/firma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id");
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

  let aviso = null;
  try {
    aviso = await request.json();
  } catch {
    aviso = null;
  }

  const resultado = await procesarWebhookMercadoPagoEntrada({
    dataId,
    type: url.searchParams.get("type"),
    topic: url.searchParams.get("topic"),
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    aviso,
    secret,
  });

  if (resultado.status === 401 || resultado.status === 503) {
    if (process.env.NODE_ENV !== "production" && resultado.status === 401) {
      const firma = resumenFirmaWebhook({
        xSignature: request.headers.get("x-signature"),
        xRequestId: request.headers.get("x-request-id"),
        dataId,
        secret,
      });
      console.error(`[mercadopago] webhook firma_invalida ${JSON.stringify(firma)}`);
    } else if (resultado.status === 503 && !secret) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          `[mercadopago] webhook sin_secreto ${JSON.stringify(
            resumenFirmaWebhook({
              xSignature: request.headers.get("x-signature"),
              xRequestId: request.headers.get("x-request-id"),
              dataId,
              secret,
            }),
          )}`,
        );
      } else {
        console.error("[mercadopago] webhook sin_secreto");
      }
    } else {
      console.error(`[mercadopago] webhook ${resultado.status === 503 ? "servicio" : "firma"}`);
    }
  }

  return json(resultado.body, resultado.status);
}
