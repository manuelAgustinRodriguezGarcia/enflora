import { ESTADOS_EXPO, expoCannabis } from "@/lib/expo-cannabis/configuracion";

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;

export const INICIO_MS = Date.parse(expoCannabis.inicio);

export const FIN_MS = Date.parse(expoCannabis.fin);

export function estadoExpo(ahora) {
  if (ahora < INICIO_MS) return ESTADOS_EXPO.proximo;
  if (ahora < FIN_MS) return ESTADOS_EXPO.enCurso;
  return ESTADOS_EXPO.finalizado;
}

export function tiempoRestante(ahora) {
  const minutosTotales = Math.max(0, Math.ceil((INICIO_MS - ahora) / MINUTO_MS));
  return {
    dias: Math.floor(minutosTotales / 1440),
    horas: Math.floor((minutosTotales % 1440) / 60),
    minutos: minutosTotales % 60,
  };
}

export function pillVisible(ahora, pill = expoCannabis.pill) {
  const haySeccion = expoCannabis.seccionesVisibles.desafio || expoCannabis.seccionesVisibles.premios;
  if (!expoCannabis.publicada || !pill.visible || !haySeccion) return false;
  return ahora < FIN_MS + pill.horasVisibleTrasFinalizar * HORA_MS;
}

export function dosDigitos(valor) {
  return String(valor).padStart(2, "0");
}

export function formatearRestante({ dias, horas, minutos }) {
  return `${dosDigitos(dias)}d ${dosDigitos(horas)}h ${dosDigitos(minutos)}m`;
}

export function describirRestante({ dias, horas, minutos }) {
  const partes = [
    `${dias} ${dias === 1 ? "día" : "días"}`,
    `${horas} ${horas === 1 ? "hora" : "horas"}`,
    `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`,
  ];
  return `Faltan ${partes[0]}, ${partes[1]} y ${partes[2]}`;
}

export function msHastaProximoMinuto(ahora) {
  return MINUTO_MS - (ahora % MINUTO_MS) + 50;
}

export function instanteExpo(ahora = Date.now()) {
  return { estado: estadoExpo(ahora), pill: pillVisible(ahora) };
}