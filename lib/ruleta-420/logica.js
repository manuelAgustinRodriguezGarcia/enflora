import {
  ACIERTOS_PARA_GANAR,
  CATEGORIAS,
  CATEGORIA_ESPECIAL,
  PREMIOS,
  PREMIO_ASEGURADO,
  RONDAS_POSIBLES_ESPECIAL,
  VIDAS_INICIALES,
  VUELTAS_MINIMAS,
} from "@/lib/ruleta-420/configuracion";
import { PREGUNTAS } from "@/lib/ruleta-420/preguntas";

export const FASES_PARTIDA = new Set([
  "category-wheel",
  "spinning-category",
  "category-result",
  "question",
  "answer-feedback",
]);

export function pantallaDeFase(fase) {
  switch (fase) {
    case "welcome":
    case "rules":
      return "bienvenida";
    case "category-wheel":
    case "spinning-category":
    case "category-result":
      return "ruleta";
    case "question":
    case "answer-feedback":
      return "pregunta";
    case "prize-decision":
    case "prize-confirmation":
      return "decision";
    case "prize-wheel":
    case "spinning-prize":
    case "prize-reveal":
      return "ruleta-premios";
    default:
      return fase;
  }
}

function elegirAlAzar(lista, azar) {
  return lista[Math.min(lista.length - 1, Math.floor(azar() * lista.length))];
}

export function elegirPorPeso(items, azar = Math.random) {
  const total = items.reduce((suma, item) => suma + item.peso, 0);
  let punto = azar() * total;
  for (const item of items) {
    punto -= item.peso;
    if (punto < 0) return item;
  }
  return items[items.length - 1];
}

export function calcularSectores(items) {
  const total = items.reduce((suma, item) => suma + (item.peso ?? 1), 0);
  let inicio = 0;
  return items.map((item) => {
    const amplitud = ((item.peso ?? 1) / total) * 360;
    const sector = { ...item, inicio, fin: inicio + amplitud, centro: inicio + amplitud / 2, amplitud };
    inicio += amplitud;
    return sector;
  });
}

export function calcularRotacion(rotacionActual, sector, azar = Math.random) {
  const margen = sector.amplitud * 0.3;
  const desvio = (azar() * 2 - 1) * margen;
  const destino = (((360 - sector.centro - desvio) % 360) + 360) % 360;
  const actual = ((rotacionActual % 360) + 360) % 360;
  const avance = (destino - actual + 360) % 360;
  const vueltas = VUELTAS_MINIMAS + Math.floor(azar() * 2);
  return rotacionActual + vueltas * 360 + avance;
}

export function buscarPregunta(id) {
  return PREGUNTAS.find((pregunta) => pregunta.id === id) ?? null;
}

export function buscarCategoria(id) {
  return CATEGORIAS.find((categoria) => categoria.id === id) ?? null;
}

export const SECTORES_CATEGORIAS = calcularSectores(CATEGORIAS);

export const SECTORES_PREMIOS = calcularSectores(PREMIOS);

export function crearPartida(azar = Math.random) {
  return {
    fase: "category-wheel",
    partidaId: null,
    vidas: VIDAS_INICIALES,
    aciertos: 0,
    ronda: 0,
    rondaEspecial: elegirAlAzar(RONDAS_POSIBLES_ESPECIAL, azar),
    usadas: [],
    categoriaId: null,
    preguntaId: null,
    pregunta: null,
    respuesta: null,
    acerto: null,
    rotacionCategoria: -SECTORES_CATEGORIAS[0].centro,
    rotacionPremio: -SECTORES_PREMIOS[0].centro,
    sectoresPremio: null,
    elegibles: null,
    premioId: null,
    modoPremio: null,
  };
}

export function estadoInicial() {
  return { ...crearPartida(() => 0), fase: "welcome" };
}

function preguntasDisponibles(usadas, excluidas) {
  const yaUsadas = new Set(usadas || []);
  const delTurnoAnterior = new Set(excluidas || []);
  const sinRepetir = PREGUNTAS.filter((item) => !item.isSpecial && !yaUsadas.has(item.id));
  const variadas = sinRepetir.filter((item) => !delTurnoAnterior.has(item.id));
  return variadas.length > 0 ? variadas : sinRepetir;
}

export function planificarRonda(estado, azar = Math.random) {
  const ronda = estado.ronda + 1;
  const especial = PREGUNTAS.find((pregunta) => pregunta.isSpecial);
  const especialPendiente = especial && !estado.usadas.includes(especial.id);

  let pregunta;
  if (especialPendiente && ronda === estado.rondaEspecial) {
    pregunta = especial;
  } else {
    const disponibles = preguntasDisponibles(estado.usadas, estado.excluidas);
    const categoriasConPreguntas = CATEGORIAS.filter((categoria) =>
      disponibles.some((item) => item.category === categoria.id)
    );
    if (categoriasConPreguntas.length === 0) return null;
    const categoria = elegirAlAzar(categoriasConPreguntas, azar);
    pregunta = elegirAlAzar(
      disponibles.filter((item) => item.category === categoria.id),
      azar
    );
  }

  const categoriaId = pregunta.isSpecial ? CATEGORIA_ESPECIAL : pregunta.category;
  const sector = SECTORES_CATEGORIAS.find((item) => item.id === categoriaId);

  return {
    categoriaId,
    preguntaId: pregunta.id,
    rotacion: calcularRotacion(estado.rotacionCategoria, sector, azar),
  };
}

export function sectoresDePremios() {
  return SECTORES_PREMIOS;
}

export function rotacionHasta(rotacionActual, sectores, id, azar = Math.random) {
  const sector = sectores.find((item) => item.id === id);
  if (!sector) return rotacionActual;
  return calcularRotacion(rotacionActual, sector, azar);
}

export function reducirRuleta(estado, accion) {
  switch (accion.type) {
    case "abrir-reglas":
      return estado.fase === "welcome" ? { ...estado, fase: "rules" } : estado;

    case "cerrar-reglas":
      return estado.fase === "rules" ? { ...estado, fase: "welcome" } : estado;

    case "empezar":
      if (estado.fase !== "welcome" && estado.fase !== "rules") return estado;
      return accion.partida;

    case "girar-categoria":
      if (estado.fase !== "category-wheel" || !accion.plan) return estado;
      return {
        ...estado,
        fase: "spinning-category",
        ronda: accion.plan.ronda,
        categoriaId: accion.plan.categoriaId,
        preguntaId: accion.plan.preguntaId,
        pregunta: accion.plan.pregunta,
        rotacionCategoria: accion.plan.rotacion,
        usadas: accion.plan.usadas,
        respuesta: null,
        acerto: null,
      };

    case "detener-categoria":
      return estado.fase === "spinning-category" ? { ...estado, fase: "category-result" } : estado;

    case "mostrar-pregunta":
      return estado.fase === "category-result" ? { ...estado, fase: "question" } : estado;

    case "responder": {
      if ((estado.fase !== "question" && estado.fase !== "answer-feedback") || typeof accion.acerto !== "boolean") {
        return estado;
      }
      return {
        ...estado,
        fase: "answer-feedback",
        respuesta: accion.indice,
        acerto: accion.acerto,
        aciertos: accion.aciertos,
        vidas: accion.vidas,
        pregunta: {
          ...estado.pregunta,
          correctAnswer: accion.correcta,
          explanation: accion.explanation ?? estado.pregunta?.explanation ?? "",
        },
      };
    }

    case "revertir-respuesta":
      if (estado.fase !== "answer-feedback") return estado;
      return {
        ...estado,
        fase: "question",
        respuesta: null,
        acerto: null,
        aciertos: accion.aciertos,
        vidas: accion.vidas,
      };

    case "siguiente":
      if (estado.fase !== "answer-feedback") return estado;
      if (estado.aciertos >= ACIERTOS_PARA_GANAR) return { ...estado, fase: "prize-decision", respuesta: null, acerto: null };
      if (estado.vidas <= 0) return { ...estado, fase: "defeat" };
      return { ...estado, fase: "category-wheel", pregunta: null, respuesta: null, acerto: null };

    case "ver-premios":
      return estado.fase === "victory" ? { ...estado, fase: "prize-decision" } : estado;

    case "asegurar":
      if (estado.fase !== "prize-decision" && estado.fase !== "prize-confirmation") return estado;
      if (accion.premioId !== PREMIO_ASEGURADO) return estado;
      return { ...estado, fase: "prize-result", premioId: PREMIO_ASEGURADO, modoPremio: "asegurado" };

    case "arriesgar":
      return estado.fase === "prize-decision" ? { ...estado, fase: "prize-confirmation" } : estado;

    case "cancelar-riesgo":
      return estado.fase === "prize-confirmation" ? { ...estado, fase: "prize-decision" } : estado;

    case "confirmar-riesgo":
      if (estado.fase !== "prize-confirmation" || !accion.sectores?.length) return estado;
      return {
        ...estado,
        fase: "prize-wheel",
        modoPremio: "arriesgado",
        sectoresPremio: accion.sectores,
        elegibles: accion.elegibles,
        rotacionPremio: -accion.sectores[0].centro,
      };

    case "girar-premio":
      if (estado.fase !== "prize-wheel" || estado.premioId || !accion.plan) return estado;
      return {
        ...estado,
        fase: "spinning-prize",
        premioId: accion.plan.premioId,
        rotacionPremio: accion.plan.rotacion,
        sectoresPremio: accion.plan.sectores,
        elegibles: accion.plan.elegibles,
      };

    case "mostrar-premio":
      if (!accion.premioId) return estado;
      return {
        ...estado,
        fase: "prize-result",
        premioId: accion.premioId,
        modoPremio: accion.premioId === PREMIO_ASEGURADO ? "asegurado" : "arriesgado",
        elegibles: accion.elegibles ?? estado.elegibles,
      };

    case "detener-premio":
      return estado.fase === "spinning-prize" ? { ...estado, fase: "prize-reveal" } : estado;

    case "mostrar-resultado":
      return estado.fase === "prize-reveal" ? { ...estado, fase: "prize-result" } : estado;

    case "reiniciar":
      return accion.partida;

    case "restaurar":
      return accion.estado;

    case "volver-inicio":
      return estadoInicial();

    default:
      return estado;
  }
}
