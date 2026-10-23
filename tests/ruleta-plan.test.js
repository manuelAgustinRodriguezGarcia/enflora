import assert from "node:assert/strict";
import test from "node:test";
import { PREGUNTAS } from "../lib/ruleta-420/preguntas.js";
import { planificarRonda } from "../lib/ruleta-420/logica.js";

const especial = PREGUNTAS.find((pregunta) => pregunta.isSpecial);

function partida(parcial) {
  return {
    ronda: 0,
    rondaEspecial: 4,
    usadas: [],
    excluidas: [],
    rotacionCategoria: 0,
    ...parcial,
  };
}

test("la pregunta de Enflora no sale antes de la tercera", () => {
  for (let indice = 0; indice < 40; indice += 1) {
    const primera = planificarRonda(partida({ ronda: 0, rondaEspecial: 3 }), () => indice / 40);
    const segunda = planificarRonda(partida({ ronda: 1, rondaEspecial: 5 }), () => indice / 40);
    assert.notEqual(primera.preguntaId, especial.id);
    assert.notEqual(segunda.preguntaId, especial.id);
  }
});

test("la pregunta de Enflora sale en la ronda prevista", () => {
  for (const rondaEspecial of [3, 4, 5]) {
    const plan = planificarRonda(partida({ ronda: rondaEspecial - 1, rondaEspecial }), () => 0.2);
    assert.equal(plan.preguntaId, especial.id);
    assert.equal(plan.categoriaId, "cultivo");
  }
});

test("no repite las preguntas del turno anterior", () => {
  const excluidas = PREGUNTAS.filter((pregunta) => !pregunta.isSpecial).slice(0, 8).map((pregunta) => pregunta.id);
  const vistas = new Set();
  let estado = partida({ excluidas, rondaEspecial: 4 });

  for (let paso = 0; paso < 6; paso += 1) {
    const plan = planificarRonda(estado, () => (paso + 1) / 7);
    assert.ok(plan);
    assert.equal(excluidas.includes(plan.preguntaId), false);
    assert.equal(vistas.has(plan.preguntaId), false);
    vistas.add(plan.preguntaId);
    estado = {
      ...estado,
      ronda: estado.ronda + 1,
      usadas: [...estado.usadas, plan.preguntaId],
    };
  }
});
