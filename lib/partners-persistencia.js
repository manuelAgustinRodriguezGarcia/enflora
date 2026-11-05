import "server-only";

import { createHash } from "node:crypto";
import { claveIdempotenciaPartners } from "@/lib/partners";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export function hashPartners(texto) {
  return createHash("sha256").update(String(texto)).digest("hex");
}

export function cupoPartners(request, origen) {
  const crudo = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  return hashPartners(`${origen}|${crudo}`);
}

export async function persistirSolicitudPartners(datos, cupo) {
  if (!configuracionLista()) return null;
  try {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc("registrar_solicitud_partners", {
      p_comercio: datos.comercio,
      p_representante: datos.representante,
      p_correo: datos.correo,
      p_sitio: datos.sitio,
      p_rubro: datos.rubro,
      p_plan: datos.plan,
      p_mensaje: datos.mensaje,
      p_cupo: cupo,
      p_idempotencia: hashPartners(claveIdempotenciaPartners(datos)),
    });
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function persistirEventoPublicidad({ campana, tipo, token, cupo }) {
  if (!configuracionLista()) return { ok: false, codigo: "no_disponible" };
  try {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc("registrar_evento_publicidad", {
      p_campana: campana,
      p_tipo: tipo,
      p_token: token,
      p_cupo: cupo,
    });
    if (error) return { ok: false, codigo: "error" };
    return data || { ok: false, codigo: "error" };
  } catch {
    return { ok: false, codigo: "error" };
  }
}
