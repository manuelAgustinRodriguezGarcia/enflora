import { Resend } from "resend";
import { construirEmailPartners, MENSAJES_PARTNERS, validarPartners } from "@/lib/partners";

const ERROR_GENERICO = MENSAJES_PARTNERS.generico;

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: ERROR_GENERICO }, 400);
  }

  const resultado = validarPartners(body);

  if (!resultado.ok) {
    return json({ ok: false, error: resultado.error || ERROR_GENERICO }, 400);
  }

  if (resultado.honeypot) {
    return json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.CONTACT_EMAIL || "enflora.420@gmail.com";

  if (!apiKey || !from) {
    console.error("[partners] Faltan RESEND_API_KEY o RESEND_FROM_EMAIL");
    return json({ ok: false, error: ERROR_GENERICO }, 503);
  }

  const { asunto, text, html } = construirEmailPartners(resultado.datos);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: resultado.datos.correo,
      subject: asunto,
      text,
      html,
    });

    if (error) {
      console.error("[partners] Resend error:", error.name || "unknown");
      return json({ ok: false, error: ERROR_GENERICO }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error(
      "[partners] Envío fallido:",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ ok: false, error: ERROR_GENERICO }, 502);
  }
}

export function GET() {
  return json({ ok: false, error: "Método no permitido" }, 405);
}

export function PUT() {
  return json({ ok: false, error: "Método no permitido" }, 405);
}

export function PATCH() {
  return json({ ok: false, error: "Método no permitido" }, 405);
}

export function DELETE() {
  return json({ ok: false, error: "Método no permitido" }, 405);
}
