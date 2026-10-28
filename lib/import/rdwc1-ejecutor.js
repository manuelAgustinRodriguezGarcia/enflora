import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { HISTORIAL_RDWC1 } from "@/lib/demo/historial/rdwc1-dataset";
import { BUCKET_FOTOS, rutaFotoRegistro, rutaPortadaUnidad } from "@/lib/fotos";
import { argumentosRpcRegistro } from "@/lib/registros";
import {
  ESPACIO_NOMBRE,
  ESPACIO_TIPO,
  ETAPA_ACTUAL,
  ETAPA_INICIAL,
  FECHA_ENFLORA,
  FECHA_INICIO,
  GENETICA,
  IMPORT_ID,
  METODO_CULTIVO,
  OPCIONES_ACCION_IMPORT,
  UNIDAD_NOMBRE,
  UNIDAD_TIPO,
} from "@/lib/import/rdwc1-constantes";
import {
  cargarEstadoLocal,
  cargarEstadoRemoto,
  crearEstadoVacío,
  diaYaImportado,
  guardarEstadoLocal,
  importacionCompleta,
  marcarDiaCompleto,
  marcarRegistroImportado,
  registroYaImportado,
  sincronizarEstado,
} from "@/lib/import/rdwc1-estado";
import {
  indiceFotosDemo,
  nombresPlantasImport,
  planificarImportacion,
  planificarRegistrosDelDia,
  rutasArchivoDemoDesdeUrl,
} from "@/lib/import/rdwc1-mapeo";
import {
  credencialesDisponibles,
  detectarConflictosNombres,
  validarConfirmacionImport,
  validarDataset,
} from "@/lib/import/rdwc1-validacion";

function logSeguro(mensaje, datos = {}) {
  console.log(JSON.stringify({ mensaje, ...datos }, null, 2));
}

export async function crearClienteImportacion(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.ENFLORA_IMPORT_EMAIL;
  const password = env.ENFLORA_IMPORT_PASSWORD;
  if (!url || !key || !email || !password) {
    return { error: "Faltan NEXT_PUBLIC_SUPABASE_* o ENFLORA_IMPORT_EMAIL/PASSWORD.", supabase: null, user: null };
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { error: "No se pudo iniciar sesión (revisá credenciales).", supabase: null, user: null };
  }
  return { error: "", supabase, user: data.user };
}

async function asegurarOpcionesAccion(supabase, estado) {
  const mapa = { ...(estado.opciones_accion || {}) };
  const { data: existentes } = await supabase
    .from("opciones_seguimiento_personalizadas")
    .select("id, nombre, categoria")
    .eq("categoria", "accion");

  for (const opcion of existentes || []) {
    const nombre = String(opcion.nombre || "").trim();
    if (OPCIONES_ACCION_IMPORT.includes(nombre)) {
      mapa[nombre] = opcion.id;
    }
  }

  for (const nombre of OPCIONES_ACCION_IMPORT) {
    if (mapa[nombre]) continue;
    const { data, error } = await supabase.rpc("crear_opcion_seguimiento", {
      categoria: "accion",
      nombre,
      tipo_valor: null,
      unidad: null,
    });
    if (error) {
      return { error: `No se pudo crear la opción «${nombre}»: ${error.message}`, mapaOpciones: null };
    }
    mapa[nombre] = data.id;
  }

  estado.opciones_accion = mapa;
  return { error: "", mapaOpciones: mapa };
}

async function subirParFotos(supabase, rutaLocal, rutaMiniLocal, destino, destinoMini) {
  const bytes = fs.readFileSync(rutaLocal);
  const bytesMini = fs.readFileSync(rutaMiniLocal);
  const { error: e1 } = await supabase.storage.from(BUCKET_FOTOS).upload(destino, bytes, {
    contentType: "image/webp",
    upsert: false,
  });
  if (e1) return { error: e1.message, rutas: [] };
  const { error: e2 } = await supabase.storage.from(BUCKET_FOTOS).upload(destinoMini, bytesMini, {
    contentType: "image/webp",
    upsert: false,
  });
  if (e2) {
    await supabase.storage.from(BUCKET_FOTOS).remove([destino]);
    return { error: e2.message, rutas: [] };
  }
  return { error: "", rutas: [destino, destinoMini], tamano_bytes: bytes.length + bytesMini.length };
}

async function prepararFotoRegistro(supabase, userId, demoFoto, estado) {
  const fotoId = crypto.randomUUID();
  const ruta = rutaFotoRegistro(userId, fotoId, "webp");
  const miniatura = rutaFotoRegistro(userId, fotoId, "webp", true);
  const origen = rutasArchivoDemoDesdeUrl(demoFoto.url);
  const origenMini = rutasArchivoDemoDesdeUrl(demoFoto.miniatura);
  const subida = await subirParFotos(supabase, origen, origenMini, ruta, miniatura);
  if (subida.error) return { error: subida.error, foto: null, rutas: [] };
  estado.storage_huerfano.push(...subida.rutas);
  return {
    error: "",
    rutas: subida.rutas,
    foto: {
      id: fotoId,
      ruta,
      ruta_miniatura: miniatura,
      tipo_mime: "image/webp",
      tamano_bytes: subida.tamano_bytes,
      ancho: demoFoto.ancho,
      alto: demoFoto.alto,
      descripcion: demoFoto.descripcion || null,
    },
  };
}

async function limpiarRutasStorage(supabase, rutas) {
  const lista = [...new Set((rutas || []).filter(Boolean))];
  if (!lista.length) return;
  await supabase.storage.from(BUCKET_FOTOS).remove(lista);
}

async function crearEspacioYUnidad(supabase, userId, estado) {
  const { data: espacio, error: eEspacio } = await supabase
    .from("espacios")
    .insert({ usuario_id: userId, nombre: ESPACIO_NOMBRE, tipo: ESPACIO_TIPO })
    .select("id, nombre")
    .single();
  if (eEspacio || !espacio) return { error: "No se pudo crear el espacio Casa delfi." };

  const { data: unidad, error: eUnidad } = await supabase
    .from("unidades_cultivo")
    .insert({
      espacio_id: espacio.id,
      nombre: UNIDAD_NOMBRE,
      tipo: UNIDAD_TIPO,
      numero: 1,
    })
    .select("id, nombre, espacio_id")
    .single();
  if (eUnidad || !unidad) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudo crear la unidad Carpa hidro." };
  }

  estado.espacio_id = espacio.id;
  estado.unidad_id = unidad.id;
  return { error: "", espacio, unidad };
}

async function crearPlantasEInicialEtapa(supabase, unidadId, espacioId, nombres) {
  const filas = nombres.map((nombre, indice) => ({
    unidad_cultivo_id: unidadId,
    numero: indice + 1,
    nombre,
    genetica: GENETICA,
    metodo: METODO_CULTIVO,
    sustrato: null,
    etapa: ETAPA_INICIAL,
    fecha_inicio: FECHA_INICIO,
    estado: "activa",
  }));

  const { data: plantas, error } = await supabase.from("plantas").insert(filas).select("id, numero, nombre");
  if (error || !plantas?.length) return { error: "No se pudieron crear las plantas.", plantas: [] };

  const historial = plantas.map((planta) => ({
    planta_id: planta.id,
    etapa: ETAPA_INICIAL,
    fecha_inicio: FECHA_INICIO,
    fecha_fin: null,
  }));
  const { error: errorHistorial } = await supabase.from("historial_etapas").insert(historial);
  if (errorHistorial) {
    await supabase.from("espacios").delete().eq("id", espacioId);
    return { error: "No se pudo crear el historial inicial de etapas.", plantas: [] };
  }

  const ids = plantas.map((item) => item.id);
  const { error: errorEnflora } = await supabase.rpc("cambiar_etapa_plantas", {
    p_planta_ids: ids,
    p_etapa: ETAPA_ACTUAL,
    p_fecha: FECHA_ENFLORA,
  });
  if (errorEnflora) {
    await supabase.from("espacios").delete().eq("id", espacioId);
    return { error: `No se pudo registrar la transición a enflora: ${errorEnflora.message}`, plantas: [] };
  }

  return { error: "", plantas };
}

async function importarPortada(supabase, userId, unidadId, historial, estado) {
  const portada = historial.cultivo?.portada;
  if (!portada) return { error: "", rutas: [] };
  const archivoId = crypto.randomUUID();
  const ruta = rutaPortadaUnidad(userId, unidadId, archivoId, "webp");
  const miniatura = rutaPortadaUnidad(userId, unidadId, archivoId, "webp", true);
  const origen = rutasArchivoDemoDesdeUrl(portada.url);
  const origenMini = rutasArchivoDemoDesdeUrl(portada.miniatura);
  const subida = await subirParFotos(supabase, origen, origenMini, ruta, miniatura);
  if (subida.error) return { error: subida.error, rutas: [] };
  estado.storage_huerfano.push(...subida.rutas);
  const { error } = await supabase.rpc("establecer_portada_unidad", {
    p_unidad_id: unidadId,
    p_ruta: ruta,
    p_miniatura: miniatura,
  });
  if (error) {
    await limpiarRutasStorage(supabase, subida.rutas);
    return { error: error.message, rutas: [] };
  }
  estado.portada_rutas = subida.rutas;
  for (const r of subida.rutas) {
    estado.storage_huerfano = estado.storage_huerfano.filter((item) => item !== r);
  }
  return { error: "", rutas: subida.rutas };
}

async function crearRegistroRpc(supabase, datos) {
  const args = argumentosRpcRegistro(datos);
  return supabase.rpc("crear_registro", args);
}

export function contarRegistrosEsperados(historial = HISTORIAL_RDWC1) {
  const mapaOpciones = Object.fromEntries(
    OPCIONES_ACCION_IMPORT.map((nombre) => [nombre, "00000000-0000-4000-8000-000000000001"])
  );
  const plan = planificarImportacion(historial, {
    espacioId: "00000000-0000-4000-8000-000000000002",
    unidad: { id: "00000000-0000-4000-8000-000000000003", nombre: UNIDAD_NOMBRE },
    plantas: [
      { id: "00000000-0000-4000-8000-000000000004", nombre: "Planta 1", numero: 1, genetica: GENETICA },
      { id: "00000000-0000-4000-8000-000000000005", nombre: "Planta 2", numero: 2, genetica: GENETICA },
    ],
    mapaOpciones,
    fotosPorId: indiceFotosDemo(historial),
    fotosSubidasPorDemoId: {},
    simularFotos: true,
    usuarioSimulado: "00000000-0000-4000-8000-000000000001",
  });
  return plan.resumen?.registros || 0;
}

async function comprobarInfraestructura(supabase, userId) {
  const infra = {};

  const { error: errorFotos } = await supabase.from("registro_fotos").select("id", { head: true, count: "exact" });
  if (errorFotos) {
    const texto = `${errorFotos.message || ""} ${errorFotos.code || ""}`;
    infra.registro_fotos = {
      ok: false,
      error: /registro_fotos|42P01|PGRST205/i.test(texto)
        ? "tabla ausente o embed no disponible (aplicar supabase/registro-fotos.sql)"
        : errorFotos.message,
    };
  } else {
    infra.registro_fotos = { ok: true, detalle: "tabla accesible con RLS" };
  }

  // getBucket() suele fallar con anon/authenticated (no lee storage.buckets);
  // la app sube con .from('enflora-fotos').upload — probamos eso.
  const { error: errorListaRaiz } = await supabase.storage.from(BUCKET_FOTOS).list("", { limit: 1 });
  const { error: errorListaUsuario } = await supabase.storage.from(BUCKET_FOTOS).list(userId, { limit: 1 });

  if (errorListaRaiz && /not found|does not exist/i.test(errorListaRaiz.message || "")) {
    infra.bucket_fotos = {
      ok: false,
      error: errorListaRaiz.message || "bucket no encontrado",
    };
  } else if (errorListaRaiz && errorListaUsuario) {
    infra.bucket_fotos = {
      ok: false,
      error: errorListaUsuario.message || errorListaRaiz.message,
    };
  } else {
    infra.bucket_fotos = {
      ok: true,
      detalle: "accesible vía Storage API (privado; políticas RLS)",
    };
  }

  const remoto = await cargarEstadoRemoto(supabase);
  if (remoto.remotoDisponible) {
    infra.importaciones_cultivo = { ok: true, detalle: "tabla disponible (opcional)", opcional: true };
  } else {
    infra.importaciones_cultivo = {
      ok: true,
      opcional: true,
      detalle: "no aplicada; se usa private/importaciones/*.json",
    };
  }

  return infra;
}

export async function ejecutarDryRun({ raiz = process.cwd(), conSesion = false, env = process.env } = {}) {
  const validacion = validarDataset(HISTORIAL_RDWC1, raiz);
  const mapaOpcionesSimulado = Object.fromEntries(
    OPCIONES_ACCION_IMPORT.map((nombre) => [nombre, "00000000-0000-4000-8000-000000000001"])
  );
  const plan = planificarImportacion(HISTORIAL_RDWC1, {
    espacioId: "00000000-0000-4000-8000-000000000002",
    unidad: { id: "00000000-0000-4000-8000-000000000003", nombre: UNIDAD_NOMBRE },
    plantas: [
      { id: "00000000-0000-4000-8000-000000000004", nombre: "Planta 1", numero: 1, genetica: GENETICA },
      { id: "00000000-0000-4000-8000-000000000005", nombre: "Planta 2", numero: 2, genetica: GENETICA },
    ],
    mapaOpciones: mapaOpcionesSimulado,
    fotosPorId: indiceFotosDemo(HISTORIAL_RDWC1),
    fotosSubidasPorDemoId: {},
    simularFotos: true,
    usuarioSimulado: "00000000-0000-4000-8000-000000000001",
  });

  const salida = {
    modo: "dry-run",
    import_id: IMPORT_ID,
    validacion,
    plan,
    registros_esperados: plan.resumen?.registros,
    sesion: null,
    conflictos: [],
    infraestructura: null,
    confirmacionRequerida: `ENFLORA_IMPORT_CONFIRM=${IMPORT_ID}`,
  };

  const verificarSesion = conSesion || credencialesDisponibles(env);
  if (verificarSesion) {
    const auth = await crearClienteImportacion(env);
    if (auth.error) {
      salida.sesion = { error: auth.error };
      return salida;
    }
    salida.sesion = { usuario_id: auth.user.id, email: auth.user.email };
    salida.conflictos = await detectarConflictosNombres(auth.supabase, auth.user.id);
    salida.infraestructura = await comprobarInfraestructura(auth.supabase, auth.user.id);
    const remoto = await cargarEstadoRemoto(auth.supabase);
    const local = cargarEstadoLocal(raiz);
    salida.importacionPrev = remoto.estado || local;
    if (importacionCompleta(remoto.estado || local)) {
      salida.conflictos.push(`Importación ${IMPORT_ID} ya está completa.`);
    }
    await auth.supabase.auth.signOut();
  }

  return salida;
}

export async function ejecutarImport({ raiz = process.cwd(), env = process.env } = {}) {
  if (!validarConfirmacionImport(IMPORT_ID, env)) {
    return { ok: false, error: `Confirmación requerida: ENFLORA_IMPORT_CONFIRM=${IMPORT_ID}` };
  }

  const validacion = validarDataset(HISTORIAL_RDWC1, raiz);
  if (!validacion.ok) return { ok: false, error: validacion.errores.join(" ") };

  const auth = await crearClienteImportacion(env);
  if (auth.error) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const conflictos = await detectarConflictosNombres(supabase, user.id);
  if (conflictos.length) {
    await supabase.auth.signOut();
    return { ok: false, error: conflictos.join(" ") };
  }

  let estado = cargarEstadoLocal(raiz);
  const remoto = await cargarEstadoRemoto(supabase);
  if (remoto.estado && (!estado || remoto.estado.fecha_inicio > (estado.fecha_inicio || ""))) {
    estado = remoto.estado;
  }
  if (importacionCompleta(estado)) {
    await supabase.auth.signOut();
    return { ok: false, error: `La importación ${IMPORT_ID} ya está completa.` };
  }
  if (!estado || estado.usuario_id !== user.id) {
    estado = crearEstadoVacío(user.id);
  }

  const opciones = await asegurarOpcionesAccion(supabase, estado);
  if (opciones.error) {
    await supabase.auth.signOut();
    return { ok: false, error: opciones.error };
  }

  if (!estado.espacio_id || !estado.unidad_id) {
    const base = await crearEspacioYUnidad(supabase, user.id, estado);
    if (base.error) {
      await sincronizarEstado(supabase, estado, raiz);
      await supabase.auth.signOut();
      return { ok: false, error: base.error };
    }
    const nombres = nombresPlantasImport(HISTORIAL_RDWC1);
    const plantasOk = await crearPlantasEInicialEtapa(
      supabase,
      estado.unidad_id,
      estado.espacio_id,
      nombres
    );
    if (plantasOk.error) {
      await sincronizarEstado(supabase, estado, raiz);
      await supabase.auth.signOut();
      return { ok: false, error: plantasOk.error };
    }
    estado.planta_ids = plantasOk.plantas.map((item) => item.id);
    await sincronizarEstado(supabase, estado, raiz);
  }

  const { data: plantasDb } = await supabase
    .from("plantas")
    .select("id, nombre, numero, genetica, unidad_cultivo_id")
    .in("id", estado.planta_ids);

  const { data: unidad } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, espacio_id")
    .eq("id", estado.unidad_id)
    .single();

  if (!estado.portada_rutas?.length) {
    const portada = await importarPortada(supabase, user.id, estado.unidad_id, HISTORIAL_RDWC1, estado);
    if (portada.error) {
      await sincronizarEstado(supabase, estado, raiz);
      await supabase.auth.signOut();
      return { ok: false, error: portada.error };
    }
    await sincronizarEstado(supabase, estado, raiz);
  }

  const fotosPorId = indiceFotosDemo(HISTORIAL_RDWC1);
  const fotosSubidasPorDemoId = { ...(estado.fotos_demo || {}) };

  for (const dia of HISTORIAL_RDWC1.dias) {
    if (diaYaImportado(estado, dia.fecha)) continue;

    for (const demoId of dia.fotos || []) {
      if (fotosSubidasPorDemoId[demoId]) continue;
      const demoFoto = fotosPorId.get(demoId);
      const preparada = await prepararFotoRegistro(supabase, user.id, demoFoto, estado);
      if (preparada.error) {
        await limpiarRutasStorage(supabase, estado.storage_huerfano);
        await sincronizarEstado(supabase, estado, raiz);
        await supabase.auth.signOut();
        return { ok: false, error: preparada.error };
      }
      fotosSubidasPorDemoId[demoId] = preparada.foto;
      estado.fotos_demo = fotosSubidasPorDemoId;
    }

    const plan = planificarRegistrosDelDia(dia, {
      espacioId: unidad.espacio_id,
      unidad,
      plantas: plantasDb,
      mapaOpciones: estado.opciones_accion,
      fotosPorId,
      fotosSubidasPorDemoId,
    });
    if (plan.error) {
      await limpiarRutasStorage(supabase, estado.storage_huerfano);
      await sincronizarEstado(supabase, estado, raiz);
      await supabase.auth.signOut();
      return { ok: false, error: plan.error };
    }

    for (const payload of plan.payloads) {
      if (registroYaImportado(estado, payload.clave)) continue;
      const { data, error } = await crearRegistroRpc(supabase, payload.datos);
      if (error) {
        await limpiarRutasStorage(supabase, estado.storage_huerfano);
        await sincronizarEstado(supabase, estado, raiz);
        await supabase.auth.signOut();
        return { ok: false, error: error.message };
      }
      const rutasFoto = (payload.datos.fotos || []).flatMap((f) => [f.ruta, f.ruta_miniatura]);
      marcarRegistroImportado(estado, {
        clave: payload.clave,
        id: data.id,
        fecha: dia.fecha,
        tipo: payload.tipo,
        foto_rutas: rutasFoto,
      });
      for (const r of rutasFoto) {
        estado.storage_huerfano = estado.storage_huerfano.filter((item) => item !== r);
      }
    }
    marcarDiaCompleto(estado, dia.fecha);
    await sincronizarEstado(supabase, estado, raiz);
  }

  estado.estado = "complete";
  estado.fecha_fin = new Date().toISOString();
  await sincronizarEstado(supabase, estado, raiz);
  await supabase.auth.signOut();

  logSeguro("Importación completa", {
    import_id: IMPORT_ID,
    espacio_id: estado.espacio_id,
    unidad_id: estado.unidad_id,
    registros: estado.registros.length,
  });
  return { ok: true, estado };
}

export async function ejecutarVerify({ raiz = process.cwd(), env = process.env } = {}) {
  const validacion = validarDataset(HISTORIAL_RDWC1, raiz);
  const auth = await crearClienteImportacion(env);
  if (auth.error) return { ok: false, error: auth.error, validacion };
  const { supabase, user } = auth;
  const estado = cargarEstadoLocal(raiz) || (await cargarEstadoRemoto(supabase)).estado;
  if (!estado?.unidad_id) {
    await supabase.auth.signOut();
    return { ok: false, error: "No hay importación registrada para verificar.", validacion };
  }

  const registrosEsperados = contarRegistrosEsperados();

  const { count: registrosCount } = await supabase
    .from("registros")
    .select("id", { count: "exact", head: true })
    .eq("unidad_cultivo_id", estado.unidad_id);

  const ids = estado.registros.map((item) => item.id);
  let fotosCount = 0;
  if (ids.length) {
    const { count } = await supabase
      .from("registro_fotos")
      .select("id", { count: "exact", head: true })
      .in("registro_id", ids);
    fotosCount = count || 0;
  }

  const { count: etapasCount } = await supabase
    .from("historial_etapas")
    .select("id", { count: "exact", head: true })
    .in("planta_id", estado.planta_ids);

  await supabase.auth.signOut();
  return {
    ok: true,
    validacion,
    usuario_id: user.id,
    esperado: {
      registros: registrosEsperados,
      fotos: 100,
      etapas_por_planta: 2,
      etapas_total: 4,
      dias: 63,
    },
    encontrado: {
      registros: registrosCount,
      fotos: fotosCount,
      etapas: etapasCount,
      dias_completados: estado.dias_completados?.length,
    },
    estado,
  };
}

export async function ejecutarRollback({ raiz = process.cwd(), env = process.env } = {}) {
  if (!validarConfirmacionImport(IMPORT_ID, env)) {
    return { ok: false, error: `Confirmación requerida: ENFLORA_IMPORT_CONFIRM=${IMPORT_ID}` };
  }
  const auth = await crearClienteImportacion(env);
  if (auth.error) return { ok: false, error: auth.error };
  const { supabase, user } = auth;
  const estado = cargarEstadoLocal(raiz) || (await cargarEstadoRemoto(supabase)).estado;
  if (!estado || estado.usuario_id !== user.id) {
    await supabase.auth.signOut();
    return { ok: false, error: "No hay estado de importación para revertir." };
  }
  if (estado.import_id !== IMPORT_ID) {
    await supabase.auth.signOut();
    return { ok: false, error: "El estado local no corresponde a esta importación." };
  }

  const rutas = new Set([...(estado.portada_rutas || []), ...estado.storage_huerfano]);
  for (const reg of estado.registros || []) {
    for (const r of reg.foto_rutas || []) rutas.add(r);
    await supabase.rpc("eliminar_registro", { p_registro_id: reg.id });
  }

  if (estado.unidad_id) {
    const { error } = await supabase.rpc("quitar_portada_unidad", { p_unidad_id: estado.unidad_id });
    if (error && !/portada/i.test(error.message)) {
      await supabase.auth.signOut();
      return { ok: false, error: error.message };
    }
  }

  await limpiarRutasStorage(supabase, [...rutas]);

  if (estado.espacio_id) {
    await supabase.from("espacios").delete().eq("id", estado.espacio_id);
  }

  estado.estado = "rolled_back";
  guardarEstadoLocal(estado, raiz);
  await supabase.from("importaciones_cultivo").delete().eq("import_id", IMPORT_ID);
  await supabase.auth.signOut();
  return { ok: true, mensaje: "Rollback completado para recursos de la importación." };
}
