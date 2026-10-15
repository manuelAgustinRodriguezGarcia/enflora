"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { TIPOS_VALOR } from "@/lib/seguimiento";
import { transicionVista } from "@/lib/animaciones";

export function ModalOpcionSeguimiento({
  borrador,
  marca,
  pendiente,
  error,
  accion,
  onCerrar,
  onQuitar,
  pendienteQuitar,
  errorQuitar,
}) {
  const [nombre, setNombre] = useState(borrador?.nombre || "");
  const [tipoValor, setTipoValor] = useState(borrador?.tipo_valor || "numero");
  const [unidad, setUnidad] = useState(borrador?.unidad || "");
  const reducido = useReducedMotion();
  const esParametro = borrador?.categoria === "parametro";
  const titulo = borrador?.id
    ? esParametro
      ? "Editar parámetro"
      : "Editar acción"
    : esParametro
      ? "Nuevo parámetro"
      : "Nueva acción";
  const indiceTipo = Math.max(
    0,
    TIPOS_VALOR.findIndex((tipo) => tipo.valor === tipoValor),
  );

  return (
    <ModalConfirmacion
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      textoConfirmar={pendiente ? "Guardando..." : "Guardar"}
      pendiente={pendiente || pendienteQuitar}
      error={error || errorQuitar}
      accion={accion}
      className="modal--opcion-seguimiento"
    >
      <input type="hidden" name="marca" value={marca} />
      <input type="hidden" name="categoria" value={borrador?.categoria || ""} />
      <input type="hidden" name="tipo_valor" value={tipoValor} />
      {borrador?.id ? <input type="hidden" name="opcion_id" value={borrador.id} /> : null}
      {esParametro ? (
        <div className="formulario__campo tipo-valor">
          <span className="tipo-valor__etiqueta">Tipo de valor</span>
          <div className="tipo-valor__opciones" role="group" aria-label="Tipo de valor">
            <motion.span
              className="tipo-valor__deslizante"
              aria-hidden="true"
              initial={false}
              animate={{ x: `${indiceTipo * 100}%` }}
              transition={reducido ? { duration: 0 } : transicionVista}
            />
            {TIPOS_VALOR.map((tipo) => {
              const activo = tipoValor === tipo.valor;
              return (
                <button
                  key={tipo.valor}
                  type="button"
                  className={`tipo-valor__boton${activo ? " tipo-valor__boton--activo" : ""}`}
                  aria-pressed={activo}
                  disabled={pendiente || pendienteQuitar}
                  onClick={() => {
                    setTipoValor(tipo.valor);
                    if (tipo.valor === "texto") setUnidad("");
                  }}
                >
                  {tipo.etiqueta}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <label className="formulario__campo">
        Nombre
        <input
          name="nombre"
          value={nombre}
          maxLength={60}
          required
          onChange={(evento) => setNombre(evento.target.value)}
        />
      </label>
      {esParametro ? (
        <>
          {tipoValor === "texto" ? <input type="hidden" name="unidad" value="" /> : null}
          <AnimatePresence initial={false}>
            {tipoValor !== "texto" ? (
              <motion.div
                key="unidad"
                className="tipo-valor__unidad"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transicionVista}
              >
                <label className="formulario__campo">
                  Unidad
                  <input
                    name="unidad"
                    value={unidad}
                    maxLength={16}
                    placeholder="°C, %, ppm..."
                    onChange={(evento) => setUnidad(evento.target.value)}
                  />
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
      {borrador?.id ? (
        <Boton
          className="boton boton--destructivo"
          type="button"
          onClick={onQuitar}
          disabled={pendiente || pendienteQuitar}
        >
          {pendienteQuitar ? "Quitando..." : "Quitar"}
        </Boton>
      ) : null}
    </ModalConfirmacion>
  );
}
