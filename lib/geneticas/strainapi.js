import "server-only";

import { crearCacheStrain, crearCupo } from "@/lib/geneticas/cache";
import { solicitarBusqueda, solicitarFicha } from "@/lib/geneticas/cliente-strain";

const busquedas = crearCacheStrain({ ttlMs: 5 * 60 * 1000 });
const fichas = crearCacheStrain({ ttlMs: 30 * 60 * 1000 });
const cupoUsuario = crearCupo({ limite: 30, ventanaMs: 60 * 1000 });
const cupoGlobal = crearCupo({ limite: 120, ventanaMs: 60 * 1000 });

export function permitirBusquedaUsuario(usuarioId) {
  return cupoUsuario.permitir(usuarioId);
}

export function buscarEnStrainApi(consulta) {
  const clave = consulta.toLocaleLowerCase("es");
  return busquedas.obtener(clave, () => {
    if (!cupoGlobal.permitir("global")) return { ok: false, motivo: "limite" };
    return solicitarBusqueda(consulta, fetch);
  });
}

export function fichaEnStrainApi(slug) {
  return fichas.obtener(slug, () => {
    if (!cupoGlobal.permitir("global")) return { ok: false, motivo: "limite" };
    return solicitarFicha(slug, fetch);
  });
}
