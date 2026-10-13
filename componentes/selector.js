"use client";

import { Select } from "@base-ui/react/select";
import { IconoChevron } from "@/componentes/iconos-ui";

export function Selector({
  etiqueta,
  valor,
  onChange,
  opciones = [],
  placeholder = "Seleccionar",
  nombre,
  id,
  deshabilitado = false,
  error = false,
  renderValor,
  renderOpcion,
  className = "",
}) {
  const valorActual = valor === undefined || valor === null ? null : valor;

  return (
    <div className={`selector${error ? " selector--error" : ""}${className ? ` ${className}` : ""}`}>
      {etiqueta ? (
        <label className="selector__etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
      ) : null}
      <Select.Root
        value={valorActual}
        onValueChange={(siguiente) => onChange?.(siguiente ?? "")}
        name={nombre}
        id={id}
        disabled={deshabilitado}
      >
        <Select.Trigger className="selector__trigger">
          <span className="selector__valor">
            <Select.Value placeholder={<span className="selector__placeholder">{placeholder}</span>}>
              {(selected) => {
                const opcion = opciones.find((item) => item.valor === selected);
                if (renderValor) return renderValor(opcion, selected);
                return opcion?.etiqueta || String(selected ?? "");
              }}
            </Select.Value>
          </span>
          <Select.Icon className="selector__icono">
            <IconoChevron />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} className="selector__positioner" alignItemWithTrigger={false}>
            <Select.Popup className="selector__popup">
              <Select.List>
                {opciones.map((opcion) => (
                  <Select.Item
                    key={String(opcion.valor)}
                    value={opcion.valor}
                    label={opcion.etiqueta}
                    className="selector__opcion"
                    disabled={opcion.deshabilitado}
                  >
                    {renderOpcion ? renderOpcion(opcion) : <Select.ItemText>{opcion.etiqueta}</Select.ItemText>}
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
