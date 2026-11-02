import { destinoAdminPermitido } from "@/lib/admin/secciones";

export function siguientePermitido(valor) {
  if (typeof valor !== "string" || !valor) return "";
  const admin = destinoAdminPermitido(valor);
  if (admin) return admin;
  if (!valor.startsWith("/pagos/")) return "";
  if (valor.includes("://") || valor.includes("\\") || valor.includes("//")) return "";
  return valor;
}
