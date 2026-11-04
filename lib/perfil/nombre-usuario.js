export const MENSAJE_USUARIO_OCUPADO = "Uy, alguien ya tiene este nombre de usuario!";

export function normalizarNombreUsuario(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function armarSugerenciasNombreUsuario(base) {
  const limpio = normalizarNombreUsuario(base);
  const raiz = limpio.replace(/\.(42\d+)$/, "") || limpio;
  if (!raiz) return [];

  const sugerencias = [];
  for (let indice = 0; indice < 15; indice += 1) {
    const candidato = `${raiz}.${420 + indice}`;
    if (candidato !== limpio) sugerencias.push(candidato);
  }
  return sugerencias;
}
