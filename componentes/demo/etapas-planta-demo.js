"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { IconoChevron, IconoFlecha } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { TextoConMarca } from "@/componentes/marca-enflora";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { OpcionesEtapa } from "@/componentes/opciones-etapa";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { transicionRapida } from "@/lib/animaciones";
import { ETAPAS, etiquetaEtapa, fechaHoy } from "@/lib/etapas";

export function EtapaProgresoDemo({ planta, dia = null, inicio = "" }) {
  const { cambiarEtapa } = useDemo();
  const indice = ETAPAS.findIndex((item) => item.valor === planta.etapa);
  const siguiente = indice >= 0 && indice < ETAPAS.length - 1 ? ETAPAS[indice + 1] : null;
  const puedeAvanzar = Boolean(planta.etapa !== "finalizado" && siguiente);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [paso, setPaso] = useState(null);
  const mostrarPie = dia !== null || Boolean(inicio);
  const modal = paso ?? (puedeAvanzar ? { actual: planta.etapa, siguiente } : null);

  function abrir() {
    setPaso({ actual: planta.etapa, siguiente });
    setError("");
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setError("");
  }

  function confirmar() {
    const resultado = cambiarEtapa(planta.id, modal.siguiente.valor, fechaHoy());
    if (resultado) {
      setError(resultado);
      return;
    }
    cerrar();
  }

  return (
    <section className="etapa-progreso" aria-labelledby="etapa-progreso-titulo">
      <div className="etapa-progreso__avance">
        <div className="etapa-progreso__bloque">
          <p className="etapa-progreso__etiqueta" id="etapa-progreso-titulo">
            Etapa actual
          </p>
          <IndicadorEtapa etapa={planta.etapa} tamano="normal" animar />
        </div>
        {puedeAvanzar ? (
          <button
            type="button"
            className={`etapa-progreso__siguiente etapa-progreso__siguiente--${siguiente.valor}`}
            onClick={abrir}
            aria-label={`Pasar a ${siguiente.etiqueta}`}
          >
            <p className="etapa-progreso__etiqueta">Siguiente etapa</p>
            <IndicadorEtapa etapa={siguiente.valor} tamano="compacto" />
          </button>
        ) : null}
      </div>
      {mostrarPie ? (
        <div className="etapa-progreso__pie">
          {inicio ? <p className="etapa-progreso__inicio">Inicio: {inicio}</p> : <span />}
          {dia === null ? null : <p className="etapa-progreso__dia">Día {dia}</p>}
        </div>
      ) : null}
      {modal ? (
        <ModalConfirmacion
          abierto={abierto}
          onCerrar={cerrar}
          titulo={
            <>
              ¿Seguro que querés pasar a la etapa <TextoConMarca texto={modal.siguiente.etiqueta} />?
            </>
          }
          textoConfirmar="Pasar"
          error={error}
          onConfirmar={confirmar}
          varianteIcono="etapas"
          icono={
            <>
              <IndicadorEtapa etapa={modal.actual} soloIcono />
              <IconoFlecha />
              <IndicadorEtapa etapa={modal.siguiente.valor} soloIcono />
            </>
          }
        />
      ) : null}
    </section>
  );
}

export function CambiarEtapaDemo({ planta, children }) {
  const { cambiarEtapa } = useDemo();
  const reducido = useReducedMotion();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(fechaHoy);
  const [etapa, setEtapa] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function guardar(evento) {
    evento.preventDefault();
    const resultado = cambiarEtapa(planta.id, etapa, fecha);
    if (resultado) {
      setError(resultado);
      setAviso("");
      return;
    }
    setAviso(`La planta pasó a ${etiquetaEtapa(etapa)}.`);
    setError("");
    setEtapa("");
    setAbierto(false);
  }

  return (
    <>
      <div className="acciones acciones--ancho">
        {children}
        <Boton
          type="button"
          className="boton boton--ancho cambiar-etapa__abrir"
          aria-expanded={abierto}
          onClick={() => {
            setAbierto((actual) => !actual);
            setAviso("");
          }}
        >
          Cambiar etapa
          <motion.span
            className="cambiar-etapa__chevron"
            animate={{ rotate: abierto ? 180 : 0 }}
            transition={reducido ? { duration: 0 } : transicionRapida}
          >
            <IconoChevron />
          </motion.span>
        </Boton>
      </div>
      <Aparecer visible={Boolean(aviso)}>
        <p className="registro-crear__ok" role="status">
          {aviso}
        </p>
      </Aparecer>
      <Aparecer visible={abierto}>
        <form className="formulario cambiar-etapa" onSubmit={guardar}>
          {error ? <p className="formulario__error">{error}</p> : null}
          <div className="cambiar-etapa__panel">
            <OpcionesEtapa nombre="etapa" valor={etapa} onChange={setEtapa} plegable />
            <SelectorFecha etiqueta="Fecha de inicio" nombre="fecha_inicio" valor={fecha} onChange={setFecha} />
          </div>
          <Boton type="submit" disabled={!etapa}>
            Guardar
          </Boton>
        </form>
      </Aparecer>
    </>
  );
}
