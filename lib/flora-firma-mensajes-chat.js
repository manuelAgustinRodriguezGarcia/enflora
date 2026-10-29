import { mensajesClienteParaPersistencia } from "@/lib/flora-chats-guardados";

/** Huella estable del contenido persistible (sin bienvenida ni UI de espera). */
export function firmaMensajesChat(mensajesEntrada) {
  const crudos = mensajesClienteParaPersistencia(mensajesEntrada);
  return JSON.stringify(crudos);
}

export function chatFloraPersistibleCompleto(mensajesEntrada) {
  return mensajesClienteParaPersistencia(mensajesEntrada).length >= 2;
}

/** Autoguardado de chat ya guardado (incluye turno usuario sin respuesta de Flora aún). */
export function chatFloraPersistibleParaAutoguardado(mensajesEntrada) {
  const crudos = mensajesClienteParaPersistencia(mensajesEntrada);
  if (crudos.length < 2) return false;
  const tieneFlora = crudos.some((m) => m.rol === "flora");
  const tieneUsuario = crudos.some((m) => m.rol === "usuario");
  if (!tieneFlora || !tieneUsuario) return false;
  const ultimo = crudos[crudos.length - 1];
  if (ultimo.rol === "usuario") return true;
  return chatFloraPersistibleCompleto(mensajesEntrada);
}
