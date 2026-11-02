"use server";

import { leerResumenDashboard } from "@/lib/admin/dashboard";
import { obtenerAdmin } from "@/lib/admin/autorizacion";

export async function actualizarDashboard() {
  const autorizacion = await obtenerAdmin("dashboard");
  if (!autorizacion.ok) return { ok: false, estado: "denegado", error: "" };
  return leerResumenDashboard(autorizacion.credencial);
}
