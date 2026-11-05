import { cupoPartners, persistirEventoPublicidad } from "@/lib/partners-persistencia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }
  if (!body || typeof body !== "object" || !UUID.test(String(body.campana || "")) || !["impresion", "clic"].includes(body.tipo)) {
    return json({ ok: false }, 400);
  }
  if (typeof body.token !== "string" || !/^[a-f0-9]{32}$/.test(body.token)) return json({ ok: false }, 400);
  const resultado = await persistirEventoPublicidad({
    campana: body.campana,
    tipo: body.tipo,
    token: body.token,
    cupo: cupoPartners(request, "evento"),
  });
  if (resultado?.codigo === "limite") return json({ ok: false }, 429);
  if (resultado?.codigo === "no_visible" || resultado?.codigo === "consulta_invalida") return json({ ok: false }, 404);
  if (!resultado?.ok) return json({ ok: false }, 503);
  return json({ ok: true, contado: resultado.contado === true });
}
