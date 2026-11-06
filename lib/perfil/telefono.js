export const MENSAJE_TELEFONO_OBLIGATORIO = "El teléfono no se puede dejar vacío.";

export const PLACEHOLDER_TELEFONO = "11 4200 4200";

export function telefonoIngresado(valor) {
  return String(valor ?? "").trim();
}

export function intentaBorrarTelefono(anterior, siguiente) {
  return Boolean(telefonoIngresado(anterior)) && !telefonoIngresado(siguiente);
}
