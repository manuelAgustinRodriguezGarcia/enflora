"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Plus, Search } from "lucide-react";
import { listarMisGeneticas } from "@/app/geneticas/acciones";
import { FormularioGenetica } from "@/componentes/formulario-genetica";
import { FiguraGenetica, ModalGenetica } from "@/componentes/modal-genetica";
import { filtrarGeneticasPropias } from "@/lib/geneticas/reglas";

let pedidoGeneticas = null;
const oyentesGeneticas = new Set();

export function observarGeneticas(oyente) {
  oyentesGeneticas.add(oyente);
  return () => oyentesGeneticas.delete(oyente);
}

function avisarGeneticas(evento) {
  for (const oyente of oyentesGeneticas) oyente(evento);
}

function pedirGeneticas(iniciales) {
  if (iniciales) {
    pedidoGeneticas = Promise.resolve({ geneticas: iniciales });
    return pedidoGeneticas;
  }
  if (!pedidoGeneticas) {
    pedidoGeneticas = listarMisGeneticas().then((resultado) => {
      if (resultado?.error) pedidoGeneticas = null;
      return resultado;
    });
  }
  return pedidoGeneticas;
}

export function recordarGenetica(detalle) {
  const previo = pedidoGeneticas || Promise.resolve({ geneticas: [] });
  pedidoGeneticas = previo.then((resultado) => {
    const actuales = resultado?.geneticas || [];
    return {
      geneticas: [detalle, ...actuales.filter((item) => item.id !== detalle.id)],
    };
  });
  avisarGeneticas({ tipo: "guardar", detalle });
}

export function olvidarGenetica(id) {
  const previo = pedidoGeneticas || Promise.resolve({ geneticas: [] });
  pedidoGeneticas = previo.then((resultado) => ({
    geneticas: (resultado?.geneticas || []).filter((item) => item.id !== id),
  }));
  avisarGeneticas({ tipo: "borrar", id });
}

function medirLista(ancla) {
  const rect = ancla.getBoundingClientRect();
  const separacion = 6;
  const reserva = 96;
  const abajo = window.innerHeight - rect.bottom - reserva;
  const arriba = rect.top - reserva;
  const abrirArriba = abajo < 180 && arriba > abajo;
  const maxHeight = Math.max(140, Math.min(280, (abrirArriba ? arriba : abajo) - 8));
  return {
    left: rect.left,
    width: rect.width,
    maxHeight,
    top: abrirArriba ? "auto" : rect.bottom + separacion,
    bottom: abrirArriba ? window.innerHeight - rect.top + separacion : "auto",
  };
}

export function BuscadorGenetica({
  id,
  etiqueta = "Genética",
  placeholder = "Buscar mis genéticas",
  deshabilitado = false,
  iniciales = null,
  onElegir,
  onCreada,
  onConsulta,
  permitirCrear = true,
}) {
  const reactId = useId();
  const campoId = id || reactId;
  const listaId = `${campoId}-lista`;
  const anclaRef = useRef(null);
  const listaRef = useRef(null);
  const cargado = useRef(Array.isArray(iniciales));
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [crear, setCrear] = useState(false);
  const [geneticas, setGeneticas] = useState(() => (Array.isArray(iniciales) ? iniciales : []));
  const [origen, setOrigen] = useState(iniciales);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [activo, setActivo] = useState(-1);
  const [caja, setCaja] = useState(null);

  if (Array.isArray(iniciales) && origen !== iniciales) {
    setOrigen(iniciales);
    setGeneticas(iniciales);
    cargado.current = true;
  }

  const coincidencias = filtrarGeneticasPropias(geneticas, consulta);
  const opciones = [
    ...(permitirCrear ? [{ tipo: "crear", clave: "crear", etiqueta: "Crear genética" }] : []),
    ...coincidencias.map((genetica) => ({
      tipo: "genetica",
      clave: genetica.id,
      etiqueta: genetica.nombre,
      genetica,
    })),
  ];

  useLayoutEffect(() => {
    if (!abierto) return undefined;
    function medir() {
      if (anclaRef.current) setCaja(medirLista(anclaRef.current));
    }
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto, coincidencias.length]);

  useEffect(() => observarGeneticas((evento) => {
    if (evento.tipo === "guardar") {
      setGeneticas((actuales) => [
        evento.detalle,
        ...actuales.filter((item) => item.id !== evento.detalle.id),
      ]);
      return;
    }
    if (evento.tipo === "borrar") {
      setGeneticas((actuales) => actuales.filter((item) => item.id !== evento.id));
    }
  }), []);

  useEffect(() => {
    if (!abierto) return undefined;
    function cerrarSiSale(evento) {
      const destino = evento.target;
      if (anclaRef.current?.contains(destino) || listaRef.current?.contains(destino)) return;
      setAbierto(false);
      setActivo(-1);
    }
    document.addEventListener("pointerdown", cerrarSiSale);
    return () => document.removeEventListener("pointerdown", cerrarSiSale);
  }, [abierto]);

  async function abrir() {
    if (deshabilitado) return;
    setAbierto(true);
    if (cargado.current) return;
    setCargando(true);
    setError("");
    const resultado = await pedirGeneticas(iniciales);
    setCargando(false);
    cargado.current = true;
    if (resultado?.error) {
      setError(resultado.error);
      setGeneticas([]);
      return;
    }
    setGeneticas(resultado?.geneticas || []);
  }

  function escribir(valor) {
    setConsulta(valor);
    onConsulta?.(valor);
  }

  function elegir(genetica) {
    setAbierto(false);
    setActivo(-1);
    escribir("");
    onElegir?.(genetica);
  }

  function abrirCrear() {
    setAbierto(false);
    setActivo(-1);
    setCrear(true);
  }

  function alTeclado(evento) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (!abierto) abrir();
      setActivo((actual) => Math.min(opciones.length - 1, actual + 1));
      return;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActivo((actual) => Math.max(0, actual - 1));
      return;
    }
    if (evento.key === "Escape") {
      setAbierto(false);
      setActivo(-1);
      return;
    }
    if (evento.key === "Enter" && abierto && activo >= 0) {
      evento.preventDefault();
      const opcion = opciones[activo];
      if (!opcion) return;
      if (opcion.tipo === "crear") abrirCrear();
      else elegir(opcion.genetica);
    }
  }

  const lista =
    abierto && caja && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={listaRef}
            id={listaId}
            className="genetica-lista"
            role="listbox"
            style={{
              top: caja.top,
              bottom: caja.bottom,
              left: caja.left,
              width: caja.width,
              maxHeight: caja.maxHeight,
            }}
          >
            {opciones.map((opcion, indice) => (
              <button
                key={opcion.clave}
                id={`${campoId}-${opcion.clave}`}
                type="button"
                role="option"
                aria-selected={activo === indice}
                className={opcion.tipo === "crear" ? "genetica-lista__crear" : "genetica-lista__opcion"}
                onMouseDown={(evento) => evento.preventDefault()}
                onMouseEnter={() => setActivo(indice)}
                onClick={() => (opcion.tipo === "crear" ? abrirCrear() : elegir(opcion.genetica))}
              >
                {opcion.tipo === "crear" ? (
                  <Plus className="genetica-lista__crear-icono" strokeWidth={2.25} aria-hidden="true" />
                ) : null}
                {opcion.etiqueta}
              </button>
            ))}
            {cargando ? <p className="genetica-lista__carga">Buscando…</p> : null}
            {!cargando && coincidencias.length === 0 ? (
              <p className="genetica-lista__vacio">
                {consulta.trim() ? "No hay genéticas con ese nombre." : "Todavía no cargaste genéticas."}
              </p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="genetica-buscador">
      <label htmlFor={campoId}>{etiqueta}</label>
      <span className="campo-busqueda" ref={anclaRef}>
        <Search className="campo-busqueda__icono" size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          id={campoId}
          className="campo-busqueda__input"
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${campoId}-${opciones[activo]?.clave}` : undefined}
          placeholder={placeholder}
          value={consulta}
          disabled={deshabilitado}
          autoComplete="off"
          onFocus={abrir}
          onChange={(evento) => {
            escribir(evento.target.value);
            setActivo(-1);
            abrir();
          }}
          onKeyDown={alTeclado}
        />
      </span>
      {error ? <p className="genetica-buscador__estado genetica-buscador__estado--error">{error}</p> : null}
      {lista}
      {permitirCrear ? (
        <FormularioGenetica
          abierto={crear}
          nombreInicial={consulta.trim()}
          onCerrar={() => setCrear(false)}
          onCreada={(detalleCreado) => {
            setGeneticas((actuales) => [
              detalleCreado,
              ...actuales.filter((item) => item.id !== detalleCreado.id),
            ]);
            recordarGenetica(detalleCreado);
            escribir("");
            setCrear(false);
            onCreada?.(detalleCreado);
          }}
        />
      ) : null}
    </div>
  );
}

export function textoPillGenetica(campo) {
  if (campo?.valor != null && Number.isFinite(Number(campo.valor))) {
    return `${String(campo.valor).replace(".", ",")}%`;
  }
  if (campo?.min != null && campo?.max != null) {
    return `${String(campo.min).replace(".", ",")}–${String(campo.max).replace(".", ",")}%`;
  }
  return "—";
}

export function SelectorGenetica({ id, nombre = "", detalle = null, onChange, deshabilitado = false }) {
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const confirmada = Boolean(String(nombre || "").trim());
  const titulo = detalle?.nombre || nombre;

  function publicar(seleccion) {
    onChange({
      nombre: seleccion.nombre || "",
      id: seleccion.id || "",
      detalle: seleccion.detalle || null,
    });
  }

  return (
    <div className="formulario__campo">
      {confirmada ? (
        <div className="genetica-tarjeta">
          <FiguraGenetica detalle={detalle} nombre={nombre} />
          <div className="genetica-tarjeta__cuerpo">
            <span className="genetica-tarjeta__nombre">{titulo}</span>
            <span className="genetica-tarjeta__pills">
              <span className="genetica-tarjeta__pill genetica-tarjeta__pill--thc">
                THC {textoPillGenetica(detalle?.thc)}
              </span>
              <span className="genetica-tarjeta__pill genetica-tarjeta__pill--cbd">
                CBD {textoPillGenetica(detalle?.cbd)}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="genetica-tarjeta__datos"
            aria-label={`Ver datos de ${titulo}`}
            onClick={() => setFichaAbierta(true)}
          >
            <Eye strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <BuscadorGenetica
        id={id}
        deshabilitado={deshabilitado}
        onElegir={(genetica) =>
          publicar({ nombre: genetica.nombre, id: genetica.id, detalle: genetica })
        }
        onCreada={(detalleCreado) =>
          publicar({
            nombre: detalleCreado.nombre,
            id: detalleCreado.id,
            detalle: detalleCreado,
          })
        }
      />
      <ModalGenetica
        abierto={fichaAbierta}
        detalle={detalle}
        nombre={nombre}
        onCerrar={() => setFichaAbierta(false)}
        onActualizada={(siguiente) => {
          recordarGenetica(siguiente);
          if (detalle?.id === siguiente.id) {
            publicar({ nombre: siguiente.nombre, id: siguiente.id, detalle: siguiente });
          }
        }}
        onEliminada={(id) => {
          olvidarGenetica(id);
          if (detalle?.id === id) {
            publicar({ nombre: detalle?.nombre || nombre, id: "", detalle: null });
            setFichaAbierta(false);
          }
        }}
      />
    </div>
  );
}
