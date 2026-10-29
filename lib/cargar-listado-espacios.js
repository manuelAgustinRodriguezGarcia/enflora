import "server-only";

import { randomUUID } from "node:crypto";
import { cargarCampañasBanner } from "@/lib/publicidad";
import {
  clasificarErrorConsulta,
  consultaEsReintetable,
  esperarReintento,
  registrarDiagnosticoCarga,
} from "@/lib/supabase/diagnostico-consulta";
import { crearClienteServidor, sincronizarSesionParaLectura } from "@/lib/supabase/servidor";

const ESPERA_ENTRE_INTENTOS_MS = [0, 320];
const MAX_INTENTOS = 2;

function armarMetricas(unidades, plantasData) {
  const espacioDeUnidad = {};
  const unidadesPorEspacio = {};

  for (const unidad of unidades) {
    espacioDeUnidad[unidad.id] = unidad.espacio_id;
    unidadesPorEspacio[unidad.espacio_id] = (unidadesPorEspacio[unidad.espacio_id] || 0) + 1;
  }

  const plantasPorEspacio = {};
  for (const planta of plantasData) {
    const espacioId = espacioDeUnidad[planta.unidad_cultivo_id];
    if (!espacioId) continue;
    plantasPorEspacio[espacioId] = (plantasPorEspacio[espacioId] || 0) + 1;
  }

  return { unidadesPorEspacio, plantasPorEspacio };
}

function primerFalloConsulta([espaciosRespuesta, unidadesRespuesta, plantasRespuesta]) {
  if (espaciosRespuesta.error) {
    return {
      etapa: "espacios",
      error: espaciosRespuesta.error,
      httpStatus: espaciosRespuesta.status,
    };
  }
  if (unidadesRespuesta.error) {
    return {
      etapa: "unidades",
      error: unidadesRespuesta.error,
      httpStatus: unidadesRespuesta.status,
    };
  }
  if (plantasRespuesta.error) {
    return {
      etapa: "plantas",
      error: plantasRespuesta.error,
      httpStatus: plantasRespuesta.status,
    };
  }
  return null;
}

async function consultarFilas(supabase) {
  return Promise.all([
    supabase.from("espacios").select("id, nombre, tipo").order("fecha_creacion", { ascending: true }),
    supabase.from("unidades_cultivo").select("id, espacio_id"),
    supabase.from("plantas").select("unidad_cultivo_id"),
    cargarCampañasBanner(),
  ]);
}

/**
 * Carga el listado de espacios con sesión sincronizada y reintentos acotados.
 * @param {{ requestId?: string, origen?: string }} opciones
 */
export async function cargarListadoEspacios(opciones = {}) {
  const requestId = opciones.requestId || randomUUID();
  const origen = opciones.origen || "servidor";
  const inicio = Date.now();

  const supabase = await crearClienteServidor();
  const sesion = await sincronizarSesionParaLectura(supabase);

  if (!sesion.ok) {
    const clasificado =
      sesion.tipo === "sin_sesion"
        ? { tipo: "sin_sesion", reintentable: false }
        : clasificarErrorConsulta({ code: sesion.codigo, message: sesion.mensaje });
    const diagnostico = {
      requestId,
      origen,
      etapa: "sesion",
      msTotal: Date.now() - inicio,
      intentos: 0,
      tipo: clasificado.tipo,
      codigoSupabase: sesion.codigo || undefined,
    };
    registrarDiagnosticoCarga("espacios", diagnostico);
    return {
      ok: false,
      requiereIngreso: sesion.tipo === "sin_sesion" || clasificado.tipo === "autorizacion",
      clasificado,
      diagnostico,
    };
  }

  let ultimoFallo = null;
  let ultimoClasificado = null;
  let intentosUsados = 0;

  for (let intento = 0; intento < MAX_INTENTOS; intento += 1) {
    intentosUsados = intento + 1;
    if (intento > 0) {
      await esperarReintento(ESPERA_ENTRE_INTENTOS_MS[intento] ?? 400);
      if (intento === 1) {
        await sincronizarSesionParaLectura(supabase);
      }
    }

    const respuestas = await consultarFilas(supabase);
    const fallo = primerFalloConsulta(respuestas);

    if (!fallo) {
      const [espaciosRespuesta, unidadesRespuesta, plantasRespuesta, banners] = respuestas;
      const unidades = unidadesRespuesta.data || [];
      const metricas = armarMetricas(unidades, plantasRespuesta.data || []);

      return {
        ok: true,
        espacios: espaciosRespuesta.data || [],
        banners,
        ...metricas,
        diagnostico: {
          requestId,
          origen,
          msTotal: Date.now() - inicio,
          intentos: intento + 1,
          etapa: "completo",
          tipo: "ok",
        },
      };
    }

    ultimoFallo = fallo;
    ultimoClasificado = clasificarErrorConsulta(fallo.error, { httpStatus: fallo.httpStatus });

    if (!consultaEsReintetable(ultimoClasificado) || intento === MAX_INTENTOS - 1) {
      break;
    }
  }

  const diagnostico = {
    requestId,
    origen,
    etapa: ultimoFallo?.etapa || "desconocida",
    msTotal: Date.now() - inicio,
    intentos: intentosUsados,
    tipo: ultimoClasificado?.tipo || "interno",
    codigoSupabase: ultimoFallo?.error?.code || undefined,
    httpStatus: ultimoFallo?.httpStatus || ultimoClasificado?.httpStatus || undefined,
  };
  registrarDiagnosticoCarga("espacios", diagnostico);

  return {
    ok: false,
    requiereIngreso:
      ultimoClasificado?.tipo === "sin_sesion" || ultimoClasificado?.tipo === "autorizacion",
    clasificado: ultimoClasificado,
    diagnostico,
  };
}
