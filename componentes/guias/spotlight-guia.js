"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { guiaPorId } from "@/lib/guias/catalogo";
import { publicarGuia } from "@/lib/guias/eventos";
import { botonesDelPaso, pasoVisible } from "@/lib/guias/maquina";
import { ajustarPopover, ladoPreferido } from "@/lib/guias/posicion";

function iconoSprout() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icono-navegacion");
  for (const d of [
    "M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3",
    "M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4",
    "M5 21h14",
  ]) {
    const trazo = document.createElementNS(ns, "path");
    trazo.setAttribute("d", d);
    svg.append(trazo);
  }
  return svg;
}

function iconoDeGuia(clave) {
  switch (clave) {
    case "cultivos":
      return iconoSprout();
    default:
      return null;
  }
}

function iconoFlecha() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.25");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icono-navegacion", "enflora-guia__flecha");
  for (const d of ["M5 12h14", "m12 5 7 7-7 7"]) {
    const trazo = document.createElementNS(ns, "path");
    trazo.setAttribute("d", d);
    svg.append(trazo);
  }
  return svg;
}

function buscarObjetivo(ids) {
  for (const id of ids || []) {
    const nodos = document.querySelectorAll(`[data-tour="${CSS.escape(id)}"]`);
    for (const nodo of nodos) {
      const rect = nodo.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return nodo;
    }
  }
  return null;
}

function limitesPantalla() {
  const vista = window.visualViewport;
  const alto = vista?.height || window.innerHeight;
  const ancho = vista?.width || window.innerWidth;
  const desplazamiento = vista?.offsetTop || 0;
  const nav = document.querySelector(".bottom-nav");
  const techoNav = nav ? nav.getBoundingClientRect().top : desplazamiento + alto;
  const safeTop = desplazamiento + 12;
  return { ancho, alto: desplazamiento + alto, techoNav, safeTop };
}

function hayModalAjeno() {
  for (const panel of document.querySelectorAll(".modal__panel")) {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return true;
  }
  return false;
}

function colocar(wrapper) {
  const limites = limitesPantalla();
  const caja = wrapper.getBoundingClientRect();
  const ajustada = ajustarPopover(
    { left: caja.left, top: caja.top, width: caja.width, height: caja.height },
    limites
  );
  wrapper.style.left = `${ajustada.left}px`;
  wrapper.style.top = `${ajustada.top}px`;
}

export function SpotlightGuia({ estado, onSiguiente, onAtras, onSaltar, onCerrar, onAusente, onOpcional }) {
  const acciones = useRef({});
  const paso = pasoVisible(estado);
  const activa = estado.activa;
  const clave = paso && activa ? `${activa.guiaId}:${activa.indice}:${paso.id}:${activa.forzarManual ? 1 : 0}` : "";
  const contexto = useRef({ paso: null, activa: null });

  useLayoutEffect(() => {
    acciones.current = { onSiguiente, onAtras, onSaltar, onCerrar, onAusente, onOpcional };
    contexto.current = { paso, activa };
  });

  useEffect(() => {
    const actual = contexto.current;
    if (!clave || !actual.paso || !actual.activa) return undefined;

    const pasoActual = actual.paso;
    const guiaActiva = actual.activa;
    const nodoInicial = pasoActual.centrado ? null : buscarObjetivo(pasoActual.objetivos);
    if (pasoActual.opcional && !nodoInicial) {
      acciones.current.onOpcional();
      return undefined;
    }

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const guia = guiaPorId(guiaActiva.guiaId);
    const botones = botonesDelPaso(
      pasoActual,
      guiaActiva.indice,
      guia.pasos,
      guiaActiva.modo,
      guiaActiva.forzarManual
    );
    const sigueRuta = pasoActual.avance?.tipo === "ruta";
    const etiqueta = botones.finalizar && !sigueRuta ? botones.textoBoton : "Siguiente";
    const mostrar = [];
    if (botones.atras) mostrar.push("previous");
    if (botones.siguiente || botones.finalizar || sigueRuta) mostrar.push("next");
    mostrar.push("close");

    const texto =
      guiaActiva.modo === "explicativo" && pasoActual.textoExplicativo
        ? pasoActual.textoExplicativo
        : pasoActual.texto;
    const descripcion = pasoActual.ejemplo ? `${texto} Por ejemplo: “${pasoActual.ejemplo}”.` : texto;
    let instancia;
    let ignorar = false;
    let ocultoPorModal = false;
    let reenganchando = false;

    function crear(elemento) {
      const limites = limitesPantalla();
      const rect = elemento?.getBoundingClientRect();
      instancia = driver({
        animate: !reducido,
        overlayColor: "#04150e",
        overlayOpacity: 0.72,
        smoothScroll: !reducido,
        stagePadding: 8,
        stageRadius: 16,
        popoverClass: "enflora-guia",
        popoverOffset: 12,
        allowClose: true,
        overlayClickBehavior: "none",
        allowPageInteraction: false,
        disableActiveInteraction: false,
        advanceOn: false,
        allowKeyboardControl: false,
        showProgress: true,
        progressText: `${guiaActiva.indice + 1} de ${guia.pasos.length}`,
        showButtons: mostrar,
        nextBtnText: etiqueta,
        prevBtnText: "Atrás",
        doneBtnText: etiqueta,
        closeBtnLabel: "Cerrar",
        onNextClick: () => {
          if (sigueRuta) {
            const nodo = buscarObjetivo(pasoActual.objetivos);
            if (nodo instanceof HTMLElement) nodo.click();
            return;
          }
          if (botones.finalizar || botones.siguiente) acciones.current.onSiguiente();
        },
        onPrevClick: () => acciones.current.onAtras(),
        onCloseClick: (_elemento, _step, opts) => {
          acciones.current.onCerrar();
          opts.driver.destroy();
        },
        onPopoverRender: (popover) => {
          popover.wrapper.setAttribute("role", "dialog");
          popover.wrapper.setAttribute("aria-modal", "false");
          popover.description.id = "enflora-guia-texto";
          popover.wrapper.setAttribute("aria-describedby", "enflora-guia-texto");
          if (pasoActual.icono && !popover.title.querySelector(".enflora-guia__icono")) {
            const grafico = iconoDeGuia(pasoActual.icono);
            if (grafico) {
              const marca = document.createElement("span");
              marca.className = "enflora-guia__icono";
              marca.append(grafico);
              popover.title.prepend(marca);
            }
          }
          if (mostrar.includes("next") && !popover.nextButton.querySelector(".enflora-guia__flecha")) {
            popover.nextButton.classList.add("enflora-guia__siguiente");
            if (etiqueta === "Siguiente") popover.nextButton.append(iconoFlecha());
          }
          if (!popover.footer.querySelector(".enflora-guia__salto")) {
            const saltar = document.createElement("button");
            saltar.type = "button";
            saltar.className = "enflora-guia__salto";
            saltar.textContent = "Saltar";
            saltar.addEventListener("click", () => acciones.current.onSaltar());
            popover.footer.prepend(saltar);
          }
          if (pasoActual.ejemplo && !popover.footer.querySelector(".enflora-guia__ejemplo")) {
            const ejemplo = document.createElement("button");
            ejemplo.type = "button";
            ejemplo.className = "enflora-guia__ejemplo";
            ejemplo.textContent = "Usar ejemplo";
            ejemplo.addEventListener("click", () => {
              publicarGuia({ tipo: "flora-ejemplo", texto: pasoActual.ejemplo });
            });
            popover.footerButtons.prepend(ejemplo);
          }
        },
        onPopoverPositioned: (popover) => colocar(popover.wrapper),
        onElementMissing: () => {
          if (ignorar) return false;
          if (pasoActual.opcional) acciones.current.onOpcional();
          else acciones.current.onAusente();
          return false;
        },
        onDestroyStarted: (_elemento, _step, opts) => {
          if (opts.reason === "escape") acciones.current.onCerrar();
          opts.driver.destroy();
        },
      });

      const highlight = {
        disableActiveInteraction: false,
        allowPageInteraction: false,
        popover: {
          title: pasoActual.titulo,
          description: guiaActiva.forzarManual && !elemento
            ? `${descripcion} No encontré el control en esta pantalla. Podés seguir o saltar la guía.`
            : descripcion,
          side: ladoPreferido(pasoActual, rect, limites),
          align: "center",
          showButtons: mostrar,
          showProgress: true,
          nextBtnText: etiqueta,
          prevBtnText: "Atrás",
          progressText: `${guiaActiva.indice + 1} de ${guia.pasos.length}`,
        },
      };

      if (elemento) highlight.element = elemento;
      else if (pasoActual.objetivos?.length && !guiaActiva.forzarManual && !pasoActual.centrado) {
        highlight.element = () => buscarObjetivo(pasoActual.objetivos) || undefined;
        highlight.waitForElement = 2500;
      }

      instancia.highlight(highlight);
    }

    function alCambiarPantalla() {
      if (ignorar || reenganchando) return;
      const modal = hayModalAjeno();
      if (modal) {
        ocultoPorModal = true;
        if (instancia?.isActive()) instancia.destroy();
        return;
      }
      if (ocultoPorModal) {
        ocultoPorModal = false;
        crear(pasoActual.centrado ? null : buscarObjetivo(pasoActual.objetivos));
        return;
      }
      const objetivo = pasoActual.centrado ? null : buscarObjetivo(pasoActual.objetivos);
      if (objetivo && document.getElementById("driver-dummy-element")) {
        reenganchando = true;
        if (instancia?.isActive()) instancia.destroy();
        crear(objetivo);
        reenganchando = false;
        return;
      }
      const pop = document.querySelector(".enflora-guia");
      if (pop) colocar(pop);
      else instancia?.refresh();
    }

    if (!hayModalAjeno()) crear(nodoInicial);
    else ocultoPorModal = true;

    const observado = new MutationObserver(alCambiarPantalla);
    observado.observe(document.body, { childList: true, subtree: true });
    const vista = window.visualViewport;
    vista?.addEventListener("resize", alCambiarPantalla);
    vista?.addEventListener("scroll", alCambiarPantalla);
    window.addEventListener("resize", alCambiarPantalla);

    function tecla(evento) {
      const etiqueta = evento.target?.tagName;
      const escribe = etiqueta === "INPUT" || etiqueta === "TEXTAREA" || evento.target?.isContentEditable;
      if (evento.key === "Escape") {
        evento.preventDefault();
        acciones.current.onCerrar();
        return;
      }
      if (escribe) return;
      if (evento.key === "ArrowRight" && (botones.siguiente || botones.finalizar)) {
        acciones.current.onSiguiente();
      } else if (evento.key === "ArrowLeft" && botones.atras) {
        acciones.current.onAtras();
      }
    }
    document.addEventListener("keydown", tecla);

    return () => {
      ignorar = true;
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", alCambiarPantalla);
      vista?.removeEventListener("resize", alCambiarPantalla);
      vista?.removeEventListener("scroll", alCambiarPantalla);
      observado.disconnect();
      if (instancia?.isActive()) instancia.destroy();
    };
  }, [clave]);

  return null;
}
