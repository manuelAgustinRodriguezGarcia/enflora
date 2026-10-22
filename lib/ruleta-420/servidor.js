import { createClient } from "@supabase/supabase-js";
import { CANTIDADES_PREMIO, PESOS_RULETA_FINAL } from "@/lib/ruleta-420/premios";
import { planificarRonda, buscarPregunta } from "@/lib/ruleta-420/logica";
import { PREGUNTAS } from "@/lib/ruleta-420/preguntas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MENSAJES = [
  ["No hay stock suficiente", "No hay stock para ese premio."],
  ["No hay premios disponibles", "No hay premios disponibles para arriesgar."],
  ["no está habilitada", "Esta partida no puede recibir un premio."],
  ["ya fue respondida", "Esa pregunta ya fue respondida."],
  ["no acepta preguntas", "Esta partida ya no acepta preguntas."],
  ["pregunta especial", "La pregunta de ENFLORA tiene que aparecer en esta partida."],
  ["No se encontró la partida", "No se encontró la partida."],
  ["Falta el estado global", "Falta ejecutar la migración de la ruleta en Supabase."],
  ["schema cache", "Falta ejecutar la migración de la ruleta en Supabase."],
  ["Could not find", "Falta ejecutar la migración de la ruleta en Supabase."],
  ["expo_ruleta", "Falta ejecutar la migración de la ruleta en Supabase."],
];

function servicioRuleta() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function leerJson(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

function fallo(error) {
  const texto = typeof error === "string" ? error : String(error?.message || "");
  const conocido = MENSAJES.find(([fragmento]) => texto.includes(fragmento));
  return { ok: false, error: conocido ? conocido[1] : "No se pudo continuar la partida.", estado: 400 };
}

function preguntaEspecial() {
  return PREGUNTAS.find((pregunta) => pregunta.isSpecial) ?? null;
}

function publicarPregunta(pregunta, revelar) {
  if (!pregunta) return null;
  const publica = {
    id: pregunta.id,
    category: pregunta.category,
    difficulty: pregunta.difficulty,
    question: pregunta.question,
    options: pregunta.options,
    image: pregunta.image,
    isSpecial: Boolean(pregunta.isSpecial),
  };
  if (revelar) {
    publica.explanation = pregunta.explanation || "";
    publica.correctAnswer = pregunta.correctAnswer;
  }
  return publica;
}

async function llamar(servicio, nombre, argumentos) {
  const { data, error } = await servicio.rpc(nombre, argumentos);
  if (error) throw error;
  return leerJson(data);
}

export async function atenderRuleta(visitorId, cuerpo) {
  const visitor = String(visitorId || "").toLowerCase();
  const accion = String(cuerpo?.accion || "");
  const partidaId = String(cuerpo?.partidaId || "").toLowerCase();
  if (!UUID.test(visitor)) return { ok: false, error: "No se pudo identificar la partida.", estado: 400 };

  const servicio = servicioRuleta();
  if (!servicio) return { ok: false, error: "Falta la clave de servicio de Supabase en el servidor.", estado: 503 };

  const especial = preguntaEspecial();
  if (!especial) return { ok: false, error: "Falta la pregunta de ENFLORA.", estado: 500 };

  try {
    if (accion === "empezar") {
      const creada = await llamar(servicio, "crear_partida_ruleta", {
        p_visitor: visitor,
        p_ronda: 1 + Math.floor(Math.random() * 2),
      });
      if (!creada?.id) return fallo("No se pudo crear la partida.");
      return { ok: true, partidaId: creada.id, rondaEspecial: creada.rondaEspecial, estado: 200 };
    }

    if (!UUID.test(partidaId)) return { ok: false, error: "No se encontró la partida.", estado: 400 };

    if (accion === "estado") {
      const partida = await llamar(servicio, "leer_partida_ruleta", {
        p_visitor: visitor,
        p_partida: partidaId,
      });
      if (!partida?.id) return { ok: false, error: "No se encontró la partida.", estado: 404 };
      const pendiente = partida.preguntaId && partida.respondida === false;
      const pregunta = pendiente ? publicarPregunta(buscarPregunta(partida.preguntaId), false) : null;
      return { ok: true, partida: { ...partida, pregunta }, estado: 200 };
    }

    if (accion === "planificar") {
      const actual = await llamar(servicio, "leer_partida_ruleta", {
        p_visitor: visitor,
        p_partida: partidaId,
      });
      if (!actual?.id) return { ok: false, error: "No se encontró la partida.", estado: 404 };

      let preguntaId = actual.preguntaId;
      let categoriaId = actual.categoriaId;
      let ronda = actual.ronda;
      let usadas = actual.usadas || [];

      if (!(preguntaId && actual.respondida === false)) {
        const plan = planificarRonda({
          ronda: actual.ronda,
          rondaEspecial: actual.rondaEspecial,
          usadas,
          excluidas: actual.excluidas || [],
          rotacionCategoria: 0,
        });
        if (!plan) return { ok: false, error: "No hay más preguntas disponibles.", estado: 400 };
        const elegida = buscarPregunta(plan.preguntaId);
        if (!elegida) return { ok: false, error: "No hay más preguntas disponibles.", estado: 400 };
        const fijada = await llamar(servicio, "fijar_pregunta_ruleta", {
          p_visitor: visitor,
          p_partida: partidaId,
          p_pregunta: elegida.id,
          p_categoria: plan.categoriaId,
          p_correcta: elegida.correctAnswer,
          p_especial: especial.id,
        });
        preguntaId = fijada?.preguntaId;
        categoriaId = fijada?.categoriaId;
        ronda = fijada?.ronda;
        usadas = fijada?.usadas || usadas;
      }

      const pregunta = publicarPregunta(buscarPregunta(preguntaId), false);
      if (!pregunta) return { ok: false, error: "No se pudo preparar la pregunta.", estado: 400 };
      return {
        ok: true,
        preguntaId: pregunta.id,
        categoriaId: categoriaId || pregunta.category,
        ronda,
        usadas,
        pregunta,
        estado: 200,
      };
    }

    if (accion === "responder") {
      const indice = cuerpo?.indice;
      if (!Number.isInteger(indice) || indice < 0 || indice > 3) {
        return { ok: false, error: "La respuesta no es válida.", estado: 400 };
      }
      const resultado = await llamar(servicio, "responder_pregunta_ruleta", {
        p_visitor: visitor,
        p_partida: partidaId,
        p_indice: indice,
      });
      const pregunta = buscarPregunta(resultado?.preguntaId);
      return {
        ok: true,
        acerto: Boolean(resultado?.acerto),
        correcta: resultado?.correcta,
        aciertos: resultado?.aciertos,
        vidas: resultado?.vidas,
        fase: resultado?.estado,
        explanation: pregunta?.explanation || "",
        estado: 200,
      };
    }

    if (accion === "disponibilidad") {
      const datos = await llamar(servicio, "disponibilidad_premio_ruleta", {
        p_visitor: visitor,
        p_partida: partidaId,
        p_especial: especial.id,
        p_cantidades: CANTIDADES_PREMIO.SAFE_PACK,
      });
      return {
        ok: true,
        habilitada: Boolean(datos?.habilitada),
        seguro: Boolean(datos?.seguro),
        estado: 200,
      };
    }

    if (accion === "preview") {
      const datos = await llamar(servicio, "preview_ruleta", {
        p_pesos: PESOS_RULETA_FINAL,
        p_cantidades: CANTIDADES_PREMIO,
      });
      return {
        ok: true,
        giro: datos?.giro ?? null,
        elegibles: datos?.elegibles || [],
        estado: 200,
      };
    }

    if (accion === "asegurar" || accion === "arriesgar") {
      const datos = await llamar(servicio, "resolver_premio_ruleta", {
        p_visitor: visitor,
        p_partida: partidaId,
        p_modo: accion === "asegurar" ? "seguro" : "arriesgar",
        p_especial: especial.id,
        p_pesos: PESOS_RULETA_FINAL,
        p_cantidades: CANTIDADES_PREMIO,
      });
      if (!datos?.premioId) return fallo("No se pudo resolver el premio.");
      return {
        ok: true,
        premioId: datos.premioId,
        cantidades: datos.cantidades || CANTIDADES_PREMIO[datos.premioId] || null,
        elegibles: datos.elegibles || [],
        giro: datos.giro ?? null,
        repetido: Boolean(datos.repetido),
        estado: 200,
      };
    }

    return { ok: false, error: "La acción no es válida.", estado: 400 };
  } catch (error) {
    return fallo(error);
  }
}
