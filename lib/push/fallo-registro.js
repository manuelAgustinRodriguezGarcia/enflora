import { clasificarFalloSuscripcion } from "@/lib/push/reglas";

let ultimoFalloRegistro = null;

export function ultimoFalloRegistroWorker() {
  return ultimoFalloRegistro;
}

export function anotarFalloRegistroWorker(error) {
  ultimoFalloRegistro = error ? clasificarFalloSuscripcion(error, "worker") : null;
}
