import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import {
  argumentosAltaCampana,
  campanaPuedeActivarse,
  presentarResumenPartners,
  validarCampana,
} from "../lib/admin/partners-reglas.js";
import { PRECIO_PLUS_USD } from "../lib/pagos/plus/constantes.js";
import {
  DESTINO_PLUS,
  ESPERA_MODAL_MS,
  FRECUENCIA_MODAL_GRATUITO_DIAS,
  FRECUENCIA_MODAL_PLUS_DIAS,
  beneficiosAnunciablesPlus,
  destinoPromocion,
  diasEsperaModal,
  evaluarCampanaPublica,
  modalEnVentana,
  segmentosDeCuenta,
  superficiePermitePublicidad,
  textoPromocionPlus,
} from "../lib/promociones.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_COMERCIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HOY = "2026-11-19";
const AHORA = new Date("2026-11-19T15:00:00.000Z");

function campana(extra = {}) {
  return {
    estado: "activa",
    ubicacion: "inicio",
    formato: "banner",
    tipo: "comercial",
    segmentos: ["gratuito", "plus", "licencia"],
    inicio: HOY,
    fin: "",
    comercio_id: ID_COMERCIO,
    comercioHabilitado: true,
    es_upsell_plus: false,
    titulo: "Marca",
    descripcion: "Una pieza",
    cta: "Ver",
    enlace: "https://marca.example/oferta",
    frecuencia_dias: 0,
    prioridad: 1,
    ...extra,
  };
}

function ver(extra, segmentos, marca = null) {
  return evaluarCampanaPublica({
    campana: campana(extra),
    segmentosUsuario: segmentos,
    marca,
    ahora: AHORA,
    hoy: HOY,
    superficie: extra.ubicacion || "inicio",
  });
}

test("separa gratuito, Plus y pago único sin tratar la licencia como Plus", () => {
  assert.deepEqual(segmentosDeCuenta({}), ["gratuito"]);
  assert.deepEqual(segmentosDeCuenta({ plusActivo: true }), ["plus"]);
  assert.deepEqual(segmentosDeCuenta({ licenciaVigente: true }), ["licencia"]);
  assert.deepEqual(segmentosDeCuenta({ plusActivo: true, licenciaVigente: true }), ["plus", "licencia"]);
  assert.equal(segmentosDeCuenta({ licenciaVigente: true }).includes("plus"), false);
  assert.equal(segmentosDeCuenta({ licenciaVigente: true }).includes("gratuito"), false);
});

test("no publica borradores ni comerciales sin aprobación y no ofrece Plus a quien ya lo tiene", () => {
  assert.equal(ver({ estado: "borrador" }, ["gratuito"]).mostrar, false);
  assert.equal(ver({ estado: "pausada" }, ["gratuito"]).mostrar, false);
  assert.equal(ver({ comercioHabilitado: false }, ["gratuito"]).motivo, "comercio");
  assert.equal(ver({ tipo: "beneficio", comercioHabilitado: false }, ["plus"]).mostrar, false);
  assert.equal(ver({ tipo: "interna", comercio_id: null, es_upsell_plus: true, enlace: DESTINO_PLUS, formato: "modal" }, ["gratuito"]).mostrar, true);
  assert.equal(ver({ tipo: "interna", comercio_id: null, es_upsell_plus: true, enlace: DESTINO_PLUS, formato: "modal" }, ["plus"]).motivo, "plus");
  assert.equal(ver({ tipo: "interna", comercio_id: ID_COMERCIO, es_upsell_plus: false, enlace: DESTINO_PLUS }, ["gratuito"]).motivo, "anunciante");
  assert.equal(ver({ segmentos: ["gratuito"] }, ["licencia"]).mostrar, false);
  assert.equal(ver({ segmentos: ["plus"], tipo: "comercial" }, ["plus"]).mostrar, true);
});

test("el modal respeta 7 días en gratuito y una espera mayor en Plus", () => {
  const reciente = { cierre_en: "2026-11-18T15:00:00.000Z" };
  const viejo = { cierre_en: "2026-10-01T15:00:00.000Z" };
  const modalGratis = { tipo: "interna", comercio_id: null, formato: "modal", segmentos: ["gratuito"], enlace: DESTINO_PLUS, es_upsell_plus: true, frecuencia_dias: 0 };
  const modalPlus = { tipo: "interna", comercio_id: null, formato: "modal", segmentos: ["plus"], enlace: "/inicio", es_upsell_plus: false, frecuencia_dias: 7 };
  assert.equal(diasEsperaModal(modalGratis, ["gratuito"]), FRECUENCIA_MODAL_GRATUITO_DIAS);
  assert.equal(diasEsperaModal(modalPlus, ["plus"]), FRECUENCIA_MODAL_PLUS_DIAS);
  assert.equal(ver(modalGratis, ["gratuito"], reciente).motivo, "frecuencia");
  assert.equal(ver(modalGratis, ["gratuito"], viejo).mostrar, true);
  assert.equal(ver(modalPlus, ["plus"], { impresion_en: "2026-11-01T15:00:00.000Z" }).motivo, "frecuencia");
  assert.equal(ver({ formato: "banner" }, ["gratuito"], reciente).mostrar, true);
  assert.equal(modalEnVentana({ marca: null, dias: 7, ahora: AHORA }), true);
  assert.equal(ESPERA_MODAL_MS >= 10000, true);
});

test("el precio sale del plan y los beneficios futuros no se anuncian como disponibles", () => {
  const texto = textoPromocionPlus({ anunciarFuturos: false });
  assert.equal(PRECIO_PLUS_USD, 4.2);
  assert.equal(texto.precio, "US$ 4,20");
  assert.equal(texto.href, DESTINO_PLUS);
  assert.equal(beneficiosAnunciablesPlus(false).some((item) => item.etiqueta), false);
  assert.equal(beneficiosAnunciablesPlus(false).some((item) => /pendiente|próximamente/i.test(item.texto)), false);
  const futuros = beneficiosAnunciablesPlus(true);
  assert.equal(futuros.some((item) => item.etiqueta === "Próximamente" || item.etiqueta === "En definición"), true);
  assert.equal(destinoPromocion("javascript:alert(1)"), null);
  assert.equal(destinoPromocion("http://marca.example"), null);
  assert.equal(destinoPromocion("https://marca.example/a"), "https://marca.example/a");
  assert.equal(destinoPromocion("/pagos/plus", { interno: true }), DESTINO_PLUS);
  assert.equal(destinoPromocion("/admin/partners", { interno: true }), null);
  assert.equal(superficiePermitePublicidad("/inicio"), true);
  assert.equal(superficiePermitePublicidad("/flora"), false);
  assert.equal(superficiePermitePublicidad("/flora/soluciones"), false);
  assert.equal(superficiePermitePublicidad("/registro"), false);
  assert.equal(superficiePermitePublicidad("/pagos/plus"), false);
  assert.equal(superficiePermitePublicidad("/onboarding"), false);
});

test("el admin no deja activar un upsell de Plus ni publicar sin permiso", () => {
  assert.equal(validarCampana({
    tipo: "interna",
    formato: "modal",
    ubicacion: "inicio",
    nombre: "Plus",
    titulo: "PLAN 420",
    descripcion: "Toda la cuenta",
    cta: "Quiero Plus",
    pieza: "",
    enlace: "",
    inicio: HOY,
    fin: "",
    prioridad: 10,
    frecuencia: 7,
    segmentos: ["gratuito", "plus"],
    es_upsell_plus: "si",
  }).ok, false);
  const valida = validarCampana({
    tipo: "interna",
    formato: "modal",
    ubicacion: "inicio",
    nombre: "Plus",
    titulo: "PLAN 420",
    descripcion: "Toda la cuenta",
    cta: "Quiero Plus",
    pieza: "",
    enlace: "",
    inicio: HOY,
    fin: "",
    prioridad: 10,
    frecuencia: 7,
    segmentos: ["gratuito"],
    es_upsell_plus: "si",
    anunciar_futuros: "si",
  });
  assert.equal(valida.ok, true);
  assert.equal(valida.esUpsellPlus, true);
  assert.equal(valida.enlace, DESTINO_PLUS);
  assert.equal(valida.comercio, "");
  const alta = argumentosAltaCampana(ID_ADMIN, valida);
  assert.equal("p_estado" in alta, false);
  assert.equal(alta.p_upsell, "si");
  assert.equal(alta.p_tipo, "interna");
  const destino = { origen: "https://proyecto-falso.supabase.test" };
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.partners, {
    metodo: "POST",
    url: `${destino.origen}/rest/v1/rpc/alta_campana_partners_admin`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo: JSON.stringify(alta),
  }, destino).ok, true);
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.flora_ia, {
    metodo: "POST",
    url: `${destino.origen}/rest/v1/rpc/alta_campana_partners_admin`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo: JSON.stringify(alta),
  }, destino).ok, false);
  assert.equal(campanaPuedeActivarse({
    tipo: "interna",
    titulo: "PLAN 420",
    cta: "Quiero Plus",
    enlace: DESTINO_PLUS,
    esUpsellPlus: true,
    segmentos: ["gratuito"],
    fin: "",
    hoy: HOY,
  }), true);
  assert.equal(campanaPuedeActivarse({
    tipo: "interna",
    titulo: "PLAN 420",
    cta: "Quiero Plus",
    enlace: DESTINO_PLUS,
    esUpsellPlus: true,
    segmentos: ["plus"],
    fin: "",
    hoy: HOY,
  }), false);
  assert.equal(validarCampana({
    tipo: "comercial",
    formato: "banner",
    ubicacion: "listado_cultivos",
    nombre: "Marca",
    titulo: "Sin anuncios",
    descripcion: "",
    cta: "",
    pieza: "",
    enlace: "",
    inicio: HOY,
    fin: "",
    prioridad: 0,
    comercio: ID_COMERCIO,
  }).ok, false);
});

test("el resumen sigue aceptando la ubicación histórica y la de inicio", () => {
  const consulta = {
    desde: "2026-11-13T03:00:00.000Z",
    hasta: "2026-11-20T03:00:00.000Z",
    dias: ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"],
  };
  const base = {
    ok: true,
    publicidad_en_flora: false,
    desde: consulta.desde,
    hasta: consulta.hasta,
    medido_en: AHORA.toISOString(),
    comercios: 0,
    aprobados: 0,
    pendientes: 0,
    rechazados: 0,
    activos: 0,
    solicitudes: 0,
    solicitudes_recibidas: 0,
    campanas_borrador: 0,
    campanas_programadas: 0,
    campanas_activas: 0,
    campanas_pausadas: 0,
    campanas_finalizadas: 0,
    impresiones: 0,
    clics: 0,
    serie: consulta.dias.map((dia) => ({ dia, impresiones: 0, clics: 0 })),
    por_ubicacion: [
      { ubicacion: "inicio", impresiones: 0, clics: 0 },
      { ubicacion: "listado_cultivos", impresiones: 0, clics: 0 },
    ],
  };
  assert.equal(presentarResumenPartners(base, consulta).ok, true);
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/promociones.sql"), "utf8");
  assert.equal(/drop table public\.comercios_asociados/.test(sql), false);
  assert.match(sql, /estado = 'activa'/);
  assert.match(sql, /partners_frecuencia/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.equal(/service_role/.test(fs.readFileSync(path.join(RAIZ, "componentes/promociones/modal-promocional.js"), "utf8")), false);
  const flora = fs.readdirSync(path.join(RAIZ, "componentes/flora")).join("\n");
  assert.equal(flora.includes("modal-promocional"), false);
  assert.equal(flora.includes("promocion-inicio"), false);
  assert.equal(fs.readFileSync(path.join(RAIZ, "app/flora/page.js"), "utf8").includes("promocion"), false);
});
