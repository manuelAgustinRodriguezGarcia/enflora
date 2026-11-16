import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ID_ESPACIO, ID_FLORA, ID_UNIDADES, progresoInicial } from "../lib/guias/catalogo.js";
import {
  bloqueaInterfaz,
  botonesDelPaso,
  debeOfrecerBienvenida,
  estadoInicialGuias,
  pasoVisible,
  reducirGuias,
} from "../lib/guias/maquina.js";
import { ajustarPopover } from "../lib/guias/posicion.js";
import {
  claveLocal,
  crearMemoria,
  fusionarProgreso,
  guardarLocal,
  leerLocal,
} from "../lib/guias/persistencia.js";

function aplicar(estado, accion) {
  return reducirGuias(estado, accion).estado;
}

function nuevoEnAsistente() {
  let estado = estadoInicialGuias(false);
  estado = aplicar(estado, { tipo: "aceptar-bienvenida" });
  estado = aplicar(estado, { tipo: "ruta", ruta: "/cultivos/nuevo" });
  return estado;
}

test("usuario nuevo ve la bienvenida y al aceptar empieza a crear el espacio", () => {
  const progreso = progresoInicial();
  assert.equal(debeOfrecerBienvenida({ tieneEspacios: false, progreso, activa: null }), true);
  const aceptado = reducirGuias(estadoInicialGuias(false), { tipo: "aceptar-bienvenida" });
  assert.equal(aceptado.estado.progreso.bienvenida.estado, "completado");
  assert.equal(aceptado.estado.activa.guiaId, ID_ESPACIO);
  assert.equal(aceptado.estado.activa.modo, "creacion");
  assert.equal(aceptado.estado.progreso[ID_ESPACIO].estado, "en_progreso");
});

test("usuario con cultivos no recibe la bienvenida automática", () => {
  assert.equal(
    debeOfrecerBienvenida({ tieneEspacios: true, progreso: progresoInicial(), activa: null }),
    false
  );
});

test("posponer la bienvenida no la vuelve a ofrecer", () => {
  const pospuesta = aplicar(estadoInicialGuias(false), { tipo: "posponer-bienvenida" });
  assert.equal(pospuesta.progreso.bienvenida.estado, "omitido");
  assert.equal(debeOfrecerBienvenida({ tieneEspacios: false, progreso: pospuesta.progreso, activa: null }), false);
  const otra = aplicar(pospuesta, { tipo: "posponer-bienvenida" });
  assert.equal(otra.progreso.bienvenida.estado, "omitido");
});

test("inicio, pausa, reanudación y finalización de Flora", () => {
  let estado = aplicar(estadoInicialGuias(true), { tipo: "iniciar", guiaId: ID_FLORA, reiniciar: true });
  assert.equal(estado.activa.guiaId, ID_FLORA);
  assert.equal(pasoVisible(estado).id, "flora-nav");
  estado = aplicar(estado, { tipo: "pausar" });
  assert.equal(estado.activa, null);
  assert.equal(estado.progreso[ID_FLORA].estado, "pausado");
  assert.equal(estado.progreso[ID_FLORA].pasoId, "flora-nav");
  estado = aplicar(estado, { tipo: "iniciar", guiaId: ID_FLORA, reiniciar: false });
  assert.equal(pasoVisible(estado).id, "flora-nav");
  estado = aplicar(estado, { tipo: "ruta", ruta: "/flora" });
  assert.equal(pasoVisible(estado).id, "flora-input");
  estado = aplicar(estado, { tipo: "siguiente" });
  estado = aplicar(estado, { tipo: "siguiente" });
  const cierre = reducirGuias(estado, { tipo: "siguiente" });
  assert.equal(cierre.estado.progreso[ID_FLORA].estado, "completado");
  assert.equal(cierre.estado.activa, null);
  assert.equal(cierre.efecto.href, "/cultivos");
});

test("cambiar de ruta fuera del asistente pausa y conserva el paso", () => {
  let estado = nuevoEnAsistente();
  assert.equal(pasoVisible(estado).id, "tipo-espacio");
  estado = aplicar(estado, { tipo: "ruta", ruta: "/inicio" });
  assert.equal(estado.activa, null);
  assert.equal(estado.progreso[ID_ESPACIO].estado, "pausado");
  assert.equal(estado.progreso[ID_ESPACIO].pasoId, "tipo-espacio");
});

test("un objetivo ausente no bloquea la interfaz ni completa la guía", () => {
  let estado = nuevoEnAsistente();
  estado = aplicar(estado, { tipo: "objetivo-ausente" });
  assert.equal(bloqueaInterfaz(), false);
  assert.equal(estado.activa.forzarManual, true);
  assert.equal(estado.progreso[ID_ESPACIO].estado, "en_progreso");
  const guiaPasos = [
    { id: "a", avance: { tipo: "manual" }, cuando: "espacio" },
    { id: "b", avance: { tipo: "manual" }, cuando: "espacio" },
  ];
  const botones = botonesDelPaso(guiaPasos[0], 0, guiaPasos, "creacion", true);
  assert.equal(botones.siguiente, true);
});

test("una validación fallida del asistente no avanza el paso", () => {
  let estado = nuevoEnAsistente();
  estado = aplicar(estado, { tipo: "wizard", paso: "tipo_unidad", error: "" });
  assert.equal(estado.activa.guiaId, ID_UNIDADES);
  const indice = estado.activa.indice;
  estado = aplicar(estado, { tipo: "wizard", paso: "tipo_unidad", error: "El nombre es obligatorio." });
  assert.equal(estado.activa.indice, indice);
  assert.equal(estado.progreso[ID_UNIDADES].estado, "en_progreso");
  assert.equal(estado.aviso, "El nombre es obligatorio.");
});

test("un error de guardado no marca el cultivo como creado", () => {
  let estado = nuevoEnAsistente();
  for (const paso of ["tipo_unidad", "cantidad_unidades", "cantidad_plantas", "configuracion", "etapa", "resumen"]) {
    estado = aplicar(estado, { tipo: "wizard", paso, error: "" });
  }
  assert.equal(pasoVisible(estado).id, "confirmar");
  estado = aplicar(estado, { tipo: "guardado-error", mensaje: "No se pudo crear el espacio." });
  assert.equal(estado.progreso[ID_ESPACIO].estado === "completado", false);
  assert.equal(estado.progreso[ID_UNIDADES].estado, "en_progreso");
  assert.equal(estado.activa.guiaId, ID_UNIDADES);
  assert.match(estado.aviso, /No se pudo crear/);
});

test("el guardado exitoso completa la creación y presenta a Flora", () => {
  let estado = nuevoEnAsistente();
  for (const paso of ["tipo_unidad", "cantidad_unidades", "cantidad_plantas", "configuracion", "etapa", "resumen"]) {
    estado = aplicar(estado, { tipo: "wizard", paso, error: "" });
  }
  const guardado = reducirGuias(estado, { tipo: "guardado-ok" });
  assert.equal(guardado.estado.progreso[ID_ESPACIO].estado, "completado");
  assert.equal(guardado.estado.progreso[ID_UNIDADES].estado, "completado");
  assert.equal(guardado.estado.activa.guiaId, ID_FLORA);
  assert.equal(guardado.estado.progreso[ID_FLORA].estado, "en_progreso");
});

test("en una pantalla baja el popover queda sobre la navegación", () => {
  const ajustada = ajustarPopover(
    { left: 16, top: 620, width: 280, height: 180 },
    { ancho: 390, alto: 700, techoNav: 640, safeTop: 16 }
  );
  assert.equal(ajustada.top + 180 <= 632, true);
  assert.equal(ajustada.left >= 8, true);
  assert.equal(ajustada.left + 280 <= 382, true);
});

test("se puede repetir una guía ya completada", () => {
  let estado = applyCompletaFlora(estadoInicialGuias(true));
  assert.equal(estado.progreso[ID_FLORA].estado, "completado");
  estado = aplicar(estado, { tipo: "iniciar", guiaId: ID_FLORA, reiniciar: true });
  assert.equal(estado.progreso[ID_FLORA].estado, "en_progreso");
  assert.equal(pasoVisible(estado).id, "flora-nav");
});

test("el progreso sobrevive una recarga y no guarda datos del cultivo", () => {
  const memoria = crearMemoria();
  let estado = nuevoEnAsistente();
  estado.progreso[ID_ESPACIO].cultivo = "no debe persistir";
  guardarLocal("usuario-a", estado.progreso, memoria, "2026-11-16T12:00:00.000Z");
  const leido = leerLocal("usuario-a", memoria);
  assert.equal(leido.progreso[ID_ESPACIO].estado, "en_progreso");
  assert.equal(leido.progreso[ID_ESPACIO].cultivo, undefined);
  const hidratado = aplicar(estadoInicialGuias(false), {
    tipo: "hidratar",
    progreso: leido.progreso,
    tieneEspacios: false,
    ruta: "/cultivos/nuevo",
  });
  assert.equal(hidratado.progreso[ID_ESPACIO].pasoId, estado.progreso[ID_ESPACIO].pasoId);
  assert.equal(hidratado.activa.guiaId, ID_ESPACIO);
});

test("el progreso local de un usuario no se lee como el de otro", () => {
  const memoria = crearMemoria();
  const progreso = progresoInicial();
  progreso[ID_FLORA] = { estado: "completado", pasoId: "flora-cierre", version: 1 };
  guardarLocal("usuario-a", progreso, memoria);
  assert.equal(leerLocal("usuario-b", memoria), null);
  assert.equal(claveLocal("usuario-a") === claveLocal("usuario-b"), false);
  const fusion = fusionarProgreso(null, [
    {
      guia_id: ID_FLORA,
      estado: "completado",
      paso_id: "flora-cierre",
      version: 1,
      actualizado_en: "2026-11-16T15:00:00.000Z",
      nombre_espacio: "secreto",
    },
  ]);
  assert.equal(fusion[ID_FLORA].estado, "completado");
  assert.equal(fusion[ID_FLORA].nombre_espacio, undefined);
});

test("la migración aísla el progreso con RLS y no guarda cultivos", () => {
  const sql = fs.readFileSync(new URL("../supabase/guias-enflora.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\) = usuario_id/);
  assert.match(sql, /grant select, insert, update, delete on table public\.progreso_guias to authenticated/);
  assert.match(sql, /revoke all on table public\.progreso_guias from anon, authenticated/);
  assert.equal(sql.includes("espacio_id"), false);
  assert.equal(sql.includes("planta_id"), false);
  assert.equal(sql.includes("nombre_espacio"), false);
});

function applyCompletaFlora(estado) {
  let actual = aplicar(estado, { tipo: "iniciar", guiaId: ID_FLORA, reiniciar: true });
  actual = aplicar(actual, { tipo: "ruta", ruta: "/flora" });
  actual = aplicar(actual, { tipo: "siguiente" });
  actual = aplicar(actual, { tipo: "siguiente" });
  actual = aplicar(actual, { tipo: "siguiente" });
  return actual;
}
