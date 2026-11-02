"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormularioGenetica } from "@/componentes/formulario-genetica";
import { FiguraGenetica, ModalGenetica } from "@/componentes/modal-genetica";
import { crearCacheResultados } from "@/lib/geneticas/cache";
import { crearControlBusqueda } from "@/lib/geneticas/control-busqueda";

const cacheBusqueda = crearCacheResultados();

async function pedirSugerencias(consulta, signal) {
  const respuesta = await fetch(`/api/geneticas/buscar?q=${encodeURIComponent(consulta)}`, {
    signal,
    headers: { accept: "application/json" },
  });
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new Error(cuerpo?.error || "No se pudo buscar.");
    error.estado = respuesta.status;
    throw error;
  }
  return cuerpo;
}

async function leerFicha(sugerencia) {
  if (sugerencia.id) {
    const respuesta = await fetch(`/api/geneticas/fichas/${sugerencia.id}`, {
      headers: { accept: "application/json" },
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !cuerpo?.detalle) {
      return { detalle: null, error: cuerpo?.error || "No se pudo leer la genética." };
    }
    return { detalle: cuerpo.detalle };
  }

  const respuesta = await fetch("/api/geneticas/strainapi", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ slug: sugerencia.slug }),
  });
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !cuerpo?.detalle?.id) {
    return {
      detalle: cuerpo?.detalle?.nombre ? { ...cuerpo.detalle, id: cuerpo.detalle.id || "" } : null,
      error: cuerpo?.error || "StrainAPI no responde. Podés seguir con el nombre.",
    };
  }
  return { detalle: cuerpo.detalle };
}

function medirLista(ancla) {
  const rect = ancla.getBoundingClientRect();
  const reserva = 96;
  const abajo = window.innerHeight - rect.bottom - reserva;
  const arriba = rect.top - 12;
  const abrirArriba = abajo < 180 && arriba > abajo;
  const maxAlto = Math.max(140, Math.min(280, (abrirArriba ? arriba : abajo) - 8));
  return {
    left: Math.max(12, rect.left),
    width: Math.min(rect.width, window.innerWidth - 24),
    maxAlto,
    top: abrirArriba ? undefined : rect.bottom + 4,
    bottom: abrirArriba ? window.innerHeight - rect.top + 4 : undefined,
  };
}

export function SelectorGenetica({ id, nombre = "", detalle = null, onChange, deshabilitado = false }) {
  const reactId = useId();
  const campoId = id || reactId;
  const listaId = `${campoId}-lista`;
  const ancla = useRef(null);
  const control = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [crear, setCrear] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [activo, setActivo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [posicion, setPosicion] = useState(null);
  const [busqueda, setBusqueda] = useState({ fase: "idle", sugerencias: [], aviso: null });

  if (control.current == null) {
    control.current = crearControlBusqueda({ esperar: 350, buscar: pedirSugerencias });
  }

  const texto = nombre.trim();
  const consultaActiva = abierto && texto.length >= 2;
  const cacheada = consultaActiva ? cacheBusqueda.leer(texto) : null;
  const busquedaVisible = !consultaActiva
    ? { fase: "idle", sugerencias: [], aviso: null }
    : cacheada
      ? { fase: "listo", sugerencias: cacheada.sugerencias, aviso: cacheada.aviso }
      : busqueda.consulta === texto
        ? busqueda
        : { fase: "idle", sugerencias: [], aviso: null };
  const sugerencias = busquedaVisible.sugerencias || [];
  const totalOpciones = sugerencias.length + 1;
  const confirmada = Boolean(nombre.trim()) && (!abierto || detalle?.nombre === nombre);
  const origen = detalle?.origen === "personalizada"
    ? "Mi genética"
    : detalle?.origen === "strainapi"
      ? "StrainAPI"
      : nombre.trim()
        ? "Solo el nombre"
        : "";

  useEffect(() => () => control.current?.cancelar(), []);

  useEffect(() => {
    if (!consultaActiva || cacheada) {
      control.current?.cancelar();
      return undefined;
    }
    control.current?.programar(texto, {
      alEmpezar() {
        setBusqueda({ consulta: texto, fase: "cargando", sugerencias: [], aviso: null });
      },
      alRecibir(recibo) {
        if (!recibo.ok) {
          setBusqueda({ consulta: texto, fase: "error", sugerencias: [], aviso: "strainapi" });
          setMensaje(
            recibo.error?.estado === 401
              ? "Volvé a ingresar para buscar. Podés seguir con el nombre."
              : "No se pudo buscar. Podés crear una genética o seguir con el nombre."
          );
          return;
        }
        const resultado = {
          sugerencias: recibo.resultado.sugerencias || [],
          aviso: recibo.resultado.aviso || null,
        };
        cacheBusqueda.guardar(texto, resultado);
        setBusqueda({ consulta: texto, fase: "listo", ...resultado });
        setMensaje("");
      },
    });
    return undefined;
  }, [cacheada, consultaActiva, texto]);

  useEffect(() => {
    if (!abierto) return undefined;
    function colocar() {
      if (ancla.current) setPosicion(medirLista(ancla.current));
    }
    colocar();
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocar, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocar, true);
    };
  }, [abierto, sugerencias.length, busquedaVisible.fase]);

  useEffect(() => {
    if (!abierto) return undefined;
    function cerrar(evento) {
      if (ancla.current?.contains(evento.target)) return;
      if (evento.target?.closest?.(".genetica-lista")) return;
      setAbierto(false);
    }
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);

  function publicar(seleccion) {
    onChange({
      nombre: seleccion.nombre || "",
      id: seleccion.id || "",
      detalle: seleccion.detalle || null,
    });
  }

  function escribir(valor) {
    setMensaje("");
    setActivo(0);
    setAbierto(true);
    setBusqueda({ consulta: "", fase: "idle", sugerencias: [], aviso: null });
    if (detalle && valor !== detalle.nombre) {
      publicar({ nombre: valor, id: "", detalle: null });
      return;
    }
    publicar({ nombre: valor, id: detalle?.id || "", detalle: valor === detalle?.nombre ? detalle : null });
  }

  async function elegir(sugerencia) {
    setGuardando(true);
    setMensaje("");
    publicar({ nombre: sugerencia.nombre, id: "", detalle: null });
    const resultado = await leerFicha(sugerencia);
    setGuardando(false);
    if (resultado.detalle?.id) {
      publicar({ nombre: resultado.detalle.nombre, id: resultado.detalle.id, detalle: resultado.detalle });
      setAbierto(false);
      return;
    }
    publicar({ nombre: sugerencia.nombre, id: "", detalle: resultado.detalle });
    setMensaje(resultado.error || "Podés seguir con el nombre.");
    setAbierto(false);
  }

  function elegirActiva() {
    if (activo === 0) {
      setCrear(true);
      setAbierto(false);
      return;
    }
    const sugerencia = sugerencias[activo - 1];
    if (sugerencia) elegir(sugerencia);
  }

  function tecla(evento) {
    if (evento.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAbierto(true);
      setActivo((actual) => {
        const delta = evento.key === "ArrowDown" ? 1 : -1;
        return (actual + delta + totalOpciones) % totalOpciones;
      });
      return;
    }
    if (evento.key === "Enter") {
      evento.preventDefault();
      if (abierto) elegirActiva();
    }
  }

  const aviso = busquedaVisible.aviso === "limite"
    ? "Demasiadas búsquedas. Tus genéticas siguen disponibles."
    : busquedaVisible.aviso === "strainapi"
      ? "StrainAPI no responde. Tus genéticas siguen disponibles."
      : "";

  const lista = abierto && posicion
    ? createPortal(
        <div
          id={listaId}
          className="genetica-lista"
          role="listbox"
          style={{
            left: posicion.left,
            width: posicion.width,
            maxHeight: posicion.maxAlto,
            top: posicion.top,
            bottom: posicion.bottom,
          }}
        >
          <button
            type="button"
            id={`${campoId}-opcion-0`}
            className="genetica-buscador__crear genetica-lista__crear"
            role="option"
            aria-selected={activo === 0}
            onMouseEnter={() => setActivo(0)}
            onClick={() => {
              setCrear(true);
              setAbierto(false);
            }}
          >
            + Crear genética
          </button>
          {busquedaVisible.fase === "cargando" ? <p className="genetica-lista__carga">Buscando…</p> : null}
          {busquedaVisible.fase === "error" ? (
            <p className="genetica-lista__vacio">No se pudo consultar StrainAPI.</p>
          ) : null}
          {busquedaVisible.fase === "listo" && sugerencias.length === 0 ? (
            <p className="genetica-lista__vacio">Sin coincidencias.</p>
          ) : null}
          {aviso ? <p className="genetica-lista__vacio">{aviso}</p> : null}
          {nombre.trim().length < 2 ? (
            <p className="genetica-lista__vacio">Escribí al menos 2 letras para buscar.</p>
          ) : null}
          {sugerencias.map((sugerencia, indice) => (
            <button
              key={sugerencia.clave}
              id={`${campoId}-opcion-${indice + 1}`}
              type="button"
              className="genetica-buscador__opcion genetica-lista__opcion"
              role="option"
              aria-selected={activo === indice + 1}
              disabled={guardando}
              onMouseEnter={() => setActivo(indice + 1)}
              onClick={() => elegir(sugerencia)}
            >
              <span>{sugerencia.nombre}</span>
              <span className="genetica-lista__marca">
                {sugerencia.propia ? "Mi genética" : "StrainAPI"}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  const tarjeta = confirmada ? (
    <div className="genetica-tarjeta">
      <FiguraGenetica detalle={detalle} nombre={nombre} />
      <div className="genetica-tarjeta__cuerpo">
        <span className="genetica-tarjeta__nombre">{detalle?.nombre || nombre}</span>
        {origen ? <span className="genetica-tarjeta__origen">{origen}</span> : null}
        <button type="button" className="genetica-tarjeta__datos" onClick={() => setFichaAbierta(true)}>
          Datos de la genética
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="genetica-buscador formulario__campo" ref={ancla}>
      {tarjeta}
      <label htmlFor={campoId}>Genética</label>
      <input
        id={campoId}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={abierto ? `${campoId}-opcion-${activo}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Buscá tu genética o agregala..."
        disabled={deshabilitado || guardando}
        value={nombre}
        onChange={(evento) => escribir(evento.target.value)}
        onFocus={() => setAbierto(true)}
        onKeyDown={tecla}
      />
      {mensaje ? <p className="genetica-buscador__estado genetica-buscador__estado--error">{mensaje}</p> : null}
      {lista}
      <ModalGenetica
        abierto={fichaAbierta}
        detalle={detalle}
        nombre={nombre}
        onCerrar={() => setFichaAbierta(false)}
      />
      <FormularioGenetica
        abierto={crear}
        nombreInicial={nombre}
        onCerrar={() => setCrear(false)}
        onCreada={(detalleCreado) => {
          publicar({
            nombre: detalleCreado.nombre,
            id: detalleCreado.id,
            detalle: detalleCreado,
          });
          setMensaje("");
          setCrear(false);
          setAbierto(false);
        }}
      />
    </div>
  );
}
