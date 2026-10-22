export function siguientePermitido(valor) {
  if (typeof valor !== "string" || !valor) return "";
  if (valor === "/expo-cannabis/admin") return valor;
  if (!valor.startsWith("/pagos/")) return "";
  if (valor.includes("://") || valor.includes("\\") || valor.includes("//")) return "";
  return valor;
}
