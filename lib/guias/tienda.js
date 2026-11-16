"use client";

import { useSyncExternalStore } from "react";

const vacio = {
  listo: false,
  tieneEspacios: false,
  progreso: null,
  activa: null,
  aviso: "",
  iniciar() {},
  saltar() {},
  pausar() {},
};

let snapshot = vacio;
const oyentes = new Set();

export function obtenerGuias() {
  return snapshot;
}

export function publicarGuias(siguiente) {
  snapshot = siguiente;
  oyentes.forEach((oyente) => oyente());
}

export function reiniciarTiendaGuias() {
  snapshot = vacio;
  oyentes.forEach((oyente) => oyente());
}

function suscribir(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function snapshotServidor() {
  return vacio;
}

export function useGuias() {
  return useSyncExternalStore(suscribir, obtenerGuias, snapshotServidor);
}
