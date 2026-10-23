export function respuestaPush(status, cuerpo, reintentarEnSeg) {
  const headers = { "Cache-Control": "no-store" };
  if (status === 429 && reintentarEnSeg > 0) headers["Retry-After"] = String(Math.ceil(reintentarEnSeg));
  return Response.json(cuerpo, { status, headers });
}

export function solicitudMismoOrigen(cabeceras) {
  const sitio = cabeceras.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin") return false;
  const origen = cabeceras.get("origin");
  const host = cabeceras.get("host");
  if (!origen || !host) return false;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export async function leerJsonAcotado(request, maximo) {
  const texto = await request.text();
  if (texto.length > maximo) return null;
  try {
    const cuerpo = JSON.parse(texto);
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return null;
    return cuerpo;
  } catch {
    return null;
  }
}
