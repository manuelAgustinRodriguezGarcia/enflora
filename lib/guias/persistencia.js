import { GUIAS, ID_BIENVENIDA, esEstadoGuia } from "@/lib/guias/catalogo";
import { normalizarProgreso } from "@/lib/guias/maquina";

export const PREFIJO_LOCAL = "enflora.guias.v1.";

export function claveLocal(usuarioId) {
  return `${PREFIJO_LOCAL}${usuarioId}`;
}

export function crearMemoria() {
  const mapa = new Map();
  return {
    getItem(clave) {
      return mapa.has(clave) ? mapa.get(clave) : null;
    },
    setItem(clave, valor) {
      mapa.set(clave, String(valor));
    },
    removeItem(clave) {
      mapa.delete(clave);
    },
    keys() {
      return [...mapa.keys()];
    },
  };
}

function almacenSeguro(storage) {
  if (storage) return storage;
  if (typeof localStorage === "undefined") return crearMemoria();
  return localStorage;
}

export function leerLocal(usuarioId, storage) {
  if (!usuarioId) return null;
  try {
    const crudo = almacenSeguro(storage).getItem(claveLocal(usuarioId));
    if (!crudo) return null;
    const dato = JSON.parse(crudo);
    return {
      actualizadoEn: typeof dato.actualizadoEn === "string" ? dato.actualizadoEn : "",
      progreso: normalizarProgreso(dato.progreso),
    };
  } catch {
    return null;
  }
}

export function guardarLocal(usuarioId, progreso, storage, actualizadoEn = new Date().toISOString()) {
  if (!usuarioId) return null;
  const limpio = {
    actualizadoEn,
    progreso: normalizarProgreso(progreso),
  };
  almacenSeguro(storage).setItem(claveLocal(usuarioId), JSON.stringify(limpio));
  return limpio;
}

export function limpiarLocal(usuarioId, storage) {
  const memoria = almacenSeguro(storage);
  if (usuarioId) {
    memoria.removeItem(claveLocal(usuarioId));
    return;
  }
  const claves = typeof memoria.keys === "function" ? memoria.keys() : [];
  for (const clave of claves) {
    if (String(clave).startsWith(PREFIJO_LOCAL)) memoria.removeItem(clave);
  }
}

export function limpiarGuiasLocales() {
  if (typeof localStorage === "undefined") return;
  const claves = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const clave = localStorage.key(i);
    if (clave && clave.startsWith(PREFIJO_LOCAL)) claves.push(clave);
  }
  for (const clave of claves) localStorage.removeItem(clave);
}

function filaRemotaValida(fila) {
  if (!fila || typeof fila !== "object") return null;
  if (!esEstadoGuia(fila.estado)) return null;
  const conocida = fila.guia_id === ID_BIENVENIDA || GUIAS.some((guia) => guia.id === fila.guia_id);
  if (!conocida) return null;
  return {
    guiaId: fila.guia_id,
    estado: fila.estado,
    pasoId: typeof fila.paso_id === "string" ? fila.paso_id : null,
    version: Number(fila.version) || 1,
    actualizadoEn: typeof fila.actualizado_en === "string" ? fila.actualizado_en : "",
  };
}

export function fusionarProgreso(local, filasRemotas) {
  const progreso = normalizarProgreso(local?.progreso);
  const localEn = Date.parse(local?.actualizadoEn || "") || 0;
  for (const cruda of filasRemotas || []) {
    const fila = filaRemotaValida(cruda);
    if (!fila) continue;
    const remotoEn = Date.parse(fila.actualizadoEn || "") || 0;
    const actual = progreso[fila.guiaId];
    if (!actual || fila.version !== actual.version) continue;
    if (remotoEn >= localEn) {
      progreso[fila.guiaId] = {
        estado: fila.estado,
        pasoId: fila.pasoId,
        version: actual.version,
      };
    }
  }
  return progreso;
}

export function filasParaGuardar(usuarioId, progreso, ids, actualizadoEn) {
  return ids.map((guiaId) => {
    const fila = progreso[guiaId];
    return {
      usuario_id: usuarioId,
      guia_id: guiaId,
      version: fila.version,
      estado: fila.estado,
      paso_id: fila.pasoId,
      actualizado_en: actualizadoEn,
    };
  });
}

export function esTablaAusente(error) {
  const codigo = String(error?.code || "");
  const texto = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return codigo === "42P01" || codigo === "PGRST205" || texto.includes("progreso_guias");
}
