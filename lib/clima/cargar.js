import "server-only";

import { almacenClima } from "@/lib/clima/almacen-servidor";
import { armarResumenInicio, resumenLugar } from "@/lib/clima/resumen";
import { mensajeClima } from "@/lib/clima/constantes";
import { obtenerPronostico } from "@/lib/clima/servicio";
import { etiquetaLocalidad } from "@/lib/clima/texto";
import { filtrarUbicaciones, coordenadaLeida, tablaClimaAusente, zonaHorariaValida } from "@/lib/clima/validar";

const COLUMNAS_UBICACION =
  "espacio_id, usuario_id, nombre, region, pais, latitud, longitud, zona_horaria, proveedor, proveedor_lugar_id";
const COLUMNAS_PREFERENCIA =
  "usuario_id, ver_clima, nombre, region, pais, latitud, longitud, zona_horaria, proveedor, proveedor_lugar_id";

function ubicacionDePreferencia(fila, usuarioId) {
  if (!fila || fila.usuario_id !== usuarioId) return null;
  const coordenadas = coordenadaLeida(fila.latitud, fila.longitud);
  const nombre = String(fila.nombre || "").trim();
  if (!coordenadas || !nombre) return null;
  return {
    origen: "usuario",
    usuario_id: usuarioId,
    nombre,
    region: fila.region,
    pais: fila.pais,
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    zona_horaria: fila.zona_horaria || "",
  };
}

export async function leerPreferenciaClima(supabase, usuarioId) {
  const { data, error } = await supabase
    .from("preferencias_clima")
    .select(COLUMNAS_PREFERENCIA)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error) {
    if (tablaClimaAusente(error)) return { estado: "no_disponible", verClima: true, ubicacion: null };
    return { estado: "error", verClima: true, ubicacion: null };
  }

  const fila = data && data.usuario_id === usuarioId ? data : null;
  return {
    estado: "ok",
    verClima: fila ? fila.ver_clima !== false : true,
    ubicacion: ubicacionDePreferencia(fila, usuarioId),
  };
}

export async function leerUbicacion(supabase, espacioId, usuarioId) {
  const { data, error } = await supabase
    .from("ubicaciones_clima")
    .select(COLUMNAS_UBICACION)
    .eq("espacio_id", espacioId)
    .maybeSingle();

  if (!error) {
    const fila = data && data.usuario_id === usuarioId ? data : null;
    return { estado: "ok", fila };
  }
  if (tablaClimaAusente(error)) return { estado: "no_disponible", fila: null };
  return { estado: "error", fila: null };
}

async function recordarZona(supabase, ubicacion, clima) {
  const zona = zonaHorariaValida(clima?.localidad?.zonaHoraria);
  if (!zona || zona === ubicacion.zona_horaria) return;
  if (ubicacion.origen === "usuario") {
    await supabase.from("preferencias_clima").update({ zona_horaria: zona }).eq("usuario_id", ubicacion.usuario_id);
    return;
  }
  if (!ubicacion.espacio_id) return;
  await supabase.from("ubicaciones_clima").update({ zona_horaria: zona }).eq("espacio_id", ubicacion.espacio_id);
}

export async function climaDeUbicacion(supabase, ubicacion, usuarioId) {
  const coordenadas = coordenadaLeida(ubicacion.latitud, ubicacion.longitud);
  if (!coordenadas) {
    return { ok: false, codigo: "ubicacion_invalida", mensaje: mensajeClima("ubicacion_invalida") };
  }
  const resultado = await obtenerPronostico({
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    usuarioId,
    zonaConocida: ubicacion.zona_horaria || "",
    almacen: almacenClima(),
  });
  if (resultado.ok) await recordarZona(supabase, ubicacion, resultado.clima);
  return resultado;
}

export async function cargarClimaInicio(supabase, usuarioId) {
  const preferencia = await leerPreferenciaClima(supabase, usuarioId);
  if (preferencia.estado === "ok" && preferencia.verClima === false) {
    return armarResumenInicio({ estado: "oculto" });
  }

  const espaciosRes = await supabase
    .from("espacios")
    .select("id, nombre, tipo, usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("tipo", "exterior")
    .order("nombre", { ascending: true });

  if (espaciosRes.error && !preferencia.ubicacion) return armarResumenInicio({ estado: "oculto" });
  const espacios = espaciosRes.error
    ? []
    : (espaciosRes.data || []).filter((espacio) => espacio.usuario_id === usuarioId && espacio.tipo === "exterior");
  if (!espacios.length && !preferencia.ubicacion) return armarResumenInicio();

  let filasUbicacion = [];
  let falloUbicaciones = null;
  if (espacios.length) {
    const ubicacionesRes = await supabase
      .from("ubicaciones_clima")
      .select(COLUMNAS_UBICACION)
      .in(
        "espacio_id",
        espacios.map((espacio) => espacio.id)
      );
    if (ubicacionesRes.error) falloUbicaciones = ubicacionesRes.error;
    else filasUbicacion = ubicacionesRes.data;
  }

  if (falloUbicaciones && !preferencia.ubicacion) {
    if (tablaClimaAusente(falloUbicaciones)) return armarResumenInicio({ estado: "no_disponible" });
    return armarResumenInicio({
      estado: "listo",
      lugares: espacios.map((espacio) =>
        resumenLugar({
          espacio,
          ubicacion: { nombre: "", region: "", pais: "" },
          resultado: { ok: false, codigo: "sin_datos" },
        })
      ),
    });
  }

  const porEspacio = new Map(filtrarUbicaciones(filasUbicacion, usuarioId).map((fila) => [fila.espacio_id, fila]));
  const pronosticos = new Map();

  async function pronostico(ubicacion) {
    const clave = `${ubicacion.latitud},${ubicacion.longitud}`;
    if (!pronosticos.has(clave)) pronosticos.set(clave, climaDeUbicacion(supabase, ubicacion, usuarioId));
    return pronosticos.get(clave);
  }

  const ocultarEspacios = Boolean(falloUbicaciones && tablaClimaAusente(falloUbicaciones));
  const lugares = [];
  if (preferencia.ubicacion) {
    const resultado = await pronostico(preferencia.ubicacion);
    if (resultado?.ok) await recordarZona(supabase, preferencia.ubicacion, resultado.clima);
    lugares.push(
      resumenLugar({
        espacio: { id: `usuario:${usuarioId}`, nombre: "Tu localidad", href: "/perfil#clima" },
        ubicacion: preferencia.ubicacion,
        resultado,
      })
    );
  }
  for (const espacio of espacios) {
    if (ocultarEspacios) continue;
    if (falloUbicaciones) {
      lugares.push(
        resumenLugar({
          espacio,
          ubicacion: { nombre: "", region: "", pais: "" },
          resultado: { ok: false, codigo: "sin_datos" },
        })
      );
      continue;
    }
    const ubicacion = porEspacio.get(espacio.id) || null;
    const resultado = ubicacion ? await pronostico(ubicacion) : null;
    if (ubicacion && resultado?.ok) await recordarZona(supabase, ubicacion, resultado.clima);
    lugares.push(resumenLugar({ espacio, ubicacion, resultado }));
  }

  return armarResumenInicio({ lugares });
}

function etiquetaDeUbicacion(ubicacion) {
  if (!ubicacion) return "";
  return etiquetaLocalidad({ nombre: ubicacion.nombre, region: ubicacion.region, pais: ubicacion.pais });
}

export async function cargarClimaPerfil(supabase, usuarioId) {
  const preferencia = await leerPreferenciaClima(supabase, usuarioId);
  const base = {
    verClima: preferencia.verClima,
    localidad: etiquetaDeUbicacion(preferencia.ubicacion),
    preferenciaEstado: preferencia.estado,
  };

  const espaciosRes = await supabase
    .from("espacios")
    .select("id, nombre, tipo, usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("tipo", "exterior")
    .order("nombre", { ascending: true });

  if (espaciosRes.error) {
    return { ...base, estado: tablaClimaAusente(espaciosRes.error) ? "no_disponible" : "error", espacios: [] };
  }
  const espacios = (espaciosRes.data || []).filter(
    (espacio) => espacio.usuario_id === usuarioId && espacio.tipo === "exterior"
  );
  if (!espacios.length) return { ...base, estado: "listo", espacios: [] };

  const ubicacionesRes = await supabase
    .from("ubicaciones_clima")
    .select("espacio_id, usuario_id, nombre, region, pais")
    .in(
      "espacio_id",
      espacios.map((espacio) => espacio.id)
    );

  if (ubicacionesRes.error) {
    return {
      ...base,
      estado: tablaClimaAusente(ubicacionesRes.error) ? "no_disponible" : "error",
      espacios: [],
    };
  }

  const porEspacio = new Map(
    filtrarUbicaciones(ubicacionesRes.data, usuarioId).map((fila) => [fila.espacio_id, fila])
  );

  return {
    ...base,
    estado: "listo",
    espacios: espacios.map((espacio) => {
      const ubicacion = porEspacio.get(espacio.id) || null;
      return {
        id: espacio.id,
        nombre: espacio.nombre,
        localidad: ubicacion
          ? etiquetaLocalidad({ nombre: ubicacion.nombre, region: ubicacion.region, pais: ubicacion.pais })
          : "",
      };
    }),
  };
}
