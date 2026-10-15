"use client";

import { useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parse } from "date-fns";
import { IconoCalendario } from "@/componentes/iconos-ui";
import { formatearFecha } from "@/lib/etapas";
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

export function SelectorFecha({
  etiqueta,
  valor,
  onChange,
  nombre,
  id,
  deshabilitado = false,
  placeholder = "Elegir fecha",
  sinIcono = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const [interno, setInterno] = useState(valor || "");
  const controlado = onChange !== undefined;
  const actual = controlado ? valor || "" : interno;
  const etiquetaFecha = actual ? formatearFecha(actual) : placeholder;

  useEffect(() => {
    if (!controlado) setInterno(valor || "");
  }, [valor, controlado]);

  function elegir(fecha) {
    const texto = aTexto(fecha);
    if (!controlado) setInterno(texto);
    onChange?.(texto);
    setAbierto(false);
  }

  return (
    <div className={`selector-fecha${sinIcono ? " selector-fecha--sin-icono" : ""}`}>
      {etiqueta ? (
        <label className="selector__etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
      ) : null}
      {nombre ? <input type="hidden" name={nombre} value={actual} /> : null}
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger
          id={id}
          className="selector-fecha__trigger"
          disabled={deshabilitado}
          type="button"
        >
          <span className={`selector-fecha__texto${actual ? "" : " selector-fecha__vacio"}`}>
            {etiquetaFecha}
          </span>
          {sinIcono ? null : <IconoCalendario className="selector-fecha__icono" />}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="selector-fecha__positioner"
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="selector-fecha__popup">
              <DayPicker
                mode="single"
                locale={es}
                selected={aFecha(actual)}
                onSelect={elegir}
                defaultMonth={aFecha(actual) || new Date()}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
