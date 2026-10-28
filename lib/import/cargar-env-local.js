import fs from "node:fs";
import path from "node:path";

/** Carga .env local sin sobrescribir variables ya definidas en el proceso. */
export function cargarEnvLocal(raiz = process.cwd()) {
  const ruta = path.join(raiz, ".env");
  if (!fs.existsSync(ruta)) return;
  const texto = fs.readFileSync(ruta, "utf8");
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const indice = limpia.indexOf("=");
    if (indice === -1) continue;
    const clave = limpia.slice(0, indice).trim();
    let valor = limpia.slice(indice + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (clave && process.env[clave] === undefined) {
      process.env[clave] = valor;
    }
  }
}
