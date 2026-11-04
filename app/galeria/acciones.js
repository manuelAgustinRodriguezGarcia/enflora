"use server";

import { TAMANO_PAGINA_GALERIA } from "@/lib/galeria-flora";
import { firmarMiniaturaGaleria, listarPaginaGaleria } from "@/lib/galeria-flora-servidor";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

async function sesionDeLectura() {
  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase." };
  }

  const user = await obtenerSesionRapida();
  if (!user) return { error: "No hay sesión." };

  const supabase = await crearClienteServidor();
  return { supabase, user };
}

export async function cargarPaginaGaleria(entrada) {
  const acceso = await sesionDeLectura();
  if (acceso.error) {
    return {
      ok: false,
      error: acceso.error,
      fotos: [],
      hay_mas: false,
      cursor: null,
      total: null,
      unidad_invalida: false,
      sin_coincidencias: false,
    };
  }

  return listarPaginaGaleria(acceso.supabase, acceso.user.id, {
    espacioId: entrada?.espacioId || "",
    unidadId: entrada?.unidadId || "",
    cursorFecha: entrada?.cursorFecha || "",
    cursorId: entrada?.cursorId || "",
    limite: TAMANO_PAGINA_GALERIA,
  });
}

export async function refrescarMiniaturaGaleria(fotoId) {
  const acceso = await sesionDeLectura();
  if (acceso.error) return { ok: false, error: acceso.error, url: "" };
  return firmarMiniaturaGaleria(acceso.supabase, acceso.user.id, fotoId);
}
