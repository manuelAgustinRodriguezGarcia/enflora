/**
 * Stub de next/headers para ``node --test``.
 * Por defecto usarlo falla a propósito (fuera de una solicitud de Next). Un test que necesite una
 * "solicitud" puede fijar cookies con `__fijarCookies` y debe restablecerlas con `__restablecerCookies`.
 */
let almacen = null;

export function __fijarCookies(lista) {
  almacen = (lista || []).map(({ name, value }) => ({ name, value }));
}

export function __restablecerCookies() {
  almacen = null;
}

export async function cookies() {
  if (!almacen) throw new Error("next/headers no está disponible en tests");
  return {
    getAll: () => almacen.map((cookie) => ({ ...cookie })),
    get: (nombre) => almacen.find((cookie) => cookie.name === nombre),
    set: () => {},
  };
}

export async function headers() {
  throw new Error("next/headers no está disponible en tests");
}
