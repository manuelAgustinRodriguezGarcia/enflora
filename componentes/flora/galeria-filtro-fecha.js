"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parse } from "date-fns";
import { IconoCalendario } from "@/componentes/iconos-ui";
import { formatearFecha } from "@/lib/etapas";
import { parsearFechaFiltroGaleria, rangoConfirmadoFechaGaleria } from "@/lib/flora-galeria-fotos";
import "react-day-picker/style.css";

function aFecha(valor) {
  if (!valor) return undefined;
  const fecha = parse(String(valor), "yyyy-MM-dd", new Date());
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

function aTexto(fecha) {
  if (!fecha) return "";
  return format(fecha, "yyyy-MM-dd");
}

function rangoDesdeConfirmado(desde, hasta) {
  const confirmado = rangoConfirmadoFechaGaleria(desde, hasta);
  if (!confirmado.desde) return { from: undefined, to: undefined };
  const from = aFecha(confirmado.desde);
  const to = aFecha(confirmado.hasta);
  if (!from) return { from: undefined, to: undefined };
  if (!to || confirmado.desde === confirmado.hasta) return { from, to: from };
  return { from, to };
}

function textoBotonFecha(desde, hasta) {
  const confirmado = rangoConfirmadoFechaGaleria(desde, hasta);
  if (!confirmado.desde) return null;
  if (confirmado.desde === confirmado.hasta) {
    return { tipo: "unica", lineas: [formatearFecha(confirmado.desde)] };
  }
  return {
    tipo: "rango",
    lineas: [formatearFecha(confirmado.desde), formatearFecha(confirmado.hasta)],
  };
}

export function GaleriaFiltroFecha({ id, fechaDesde, fechaHasta, onConfirmar, deshabilitado = false }) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState({ from: undefined, to: undefined });

  function abrirCalendario() {
    setBorrador(rangoDesdeConfirmado(fechaDesde, fechaHasta));
    setAbierto(true);
  }

  function cerrarSinConfirmar() {
    setAbierto(false);
  }

  function confirmar() {
    const desde = aTexto(borrador.from);
    const hasta = borrador.to ? aTexto(borrador.to) : desde;
    const confirmado = rangoConfirmadoFechaGaleria(desde, hasta);
    onConfirmar(confirmado);
    setAbierto(false);
  }

  function limpiar() {
    onConfirmar({ desde: "", hasta: "" });
    setBorrador({ from: undefined, to: undefined });
    setAbierto(false);
  }

  function manejarDia(diaSeleccionado) {
    if (!diaSeleccionado) return;
    setBorrador((prev) => {
      if (prev.from && prev.to) {
        return { from: diaSeleccionado, to: undefined };
      }
      if (!prev.from) {
        return { from: diaSeleccionado, to: undefined };
      }
      if (prev.from.getTime() === diaSeleccionado.getTime()) {
        return { from: diaSeleccionado, to: diaSeleccionado };
      }
      const [from, to] =
        diaSeleccionado.getTime() < prev.from.getTime()
          ? [diaSeleccionado, prev.from]
          : [prev.from, diaSeleccionado];
      return { from, to };
    });
  }

  const etiqueta = textoBotonFecha(fechaDesde, fechaHasta);
  const mesInicial =
    borrador.from ||
    aFecha(parsearFechaFiltroGaleria(fechaDesde)) ||
    aFecha(parsearFechaFiltroGaleria(fechaHasta)) ||
    new Date();

  return (
    <div className="flora-modal-fotos__filtro-fecha selector-fecha selector-fecha--sin-icono">
      <Popover.Root
        open={abierto}
        onOpenChange={(siguiente) => {
          if (siguiente) abrirCalendario();
          else cerrarSinConfirmar();
        }}
      >
        <Popover.Trigger
          id={id}
          className="selector-fecha__trigger flora-modal-fotos__fecha-trigger"
          disabled={deshabilitado}
          type="button"
          aria-label="Fecha del registro"
        >
          {etiqueta ? (
            <span className="flora-modal-fotos__fecha-texto">
              {etiqueta.lineas.map((linea) => (
                <span key={linea} className="flora-modal-fotos__fecha-linea">
                  {linea}
                </span>
              ))}
            </span>
          ) : (
            <span className="selector-fecha__texto selector-fecha__vacio flora-modal-fotos__fecha-placeholder">
              Fecha
            </span>
          )}
          <IconoCalendario className="selector-fecha__icono" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="selector-fecha__positioner flora-modal-fotos__fecha-positioner"
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="selector-fecha__popup flora-modal-fotos__fecha-popup">
              <p className="flora-modal-fotos__fecha-ayuda">
                Elija una fecha o dos fechas para buscar en un período específico.
              </p>
              <DayPicker
                mode="range"
                locale={es}
                selected={borrador}
                onDayClick={manejarDia}
                defaultMonth={mesInicial}
                numberOfMonths={1}
              />
              <div className="flora-modal-fotos__fecha-acciones">
                <button type="button" className="flora-modal-fotos__fecha-limpiar" onClick={limpiar}>
                  Limpiar
                </button>
                <button
                  type="button"
                  className="flora-modal-fotos__fecha-ok"
                  onClick={confirmar}
                  disabled={!borrador.from}
                >
                  OK
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
