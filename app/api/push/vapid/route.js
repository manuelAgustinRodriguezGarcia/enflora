import { respuestaPush, solicitudMismoOrigen } from "@/lib/push/http";
import { huellaClavePublica } from "@/lib/push/reglas";
import { configuracionVapid } from "@/lib/push/vapid";

export async function GET(request) {
  const mismoSitio = request.headers.get("sec-fetch-site") === "same-origin" || solicitudMismoOrigen(request.headers);
  if (!mismoSitio) return respuestaPush(403, { ok: false });
  const config = configuracionVapid();
  if (!config) return respuestaPush(200, { ok: true, par: false, huella: null });
  const huella = await huellaClavePublica(config.publica);
  return respuestaPush(200, { ok: true, par: true, huella });
}
