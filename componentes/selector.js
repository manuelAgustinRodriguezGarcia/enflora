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
  ariaLabel = "",
  requerido = false,
  ancla = null,
  alinear = "end",
}) {
  const valorActual = valor === undefined || valor === null || valor === "" ? null : valor;

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
        required={requerido}
        disabled={deshabilitado}
      >
        <Select.Trigger
          className="selector__trigger"
          aria-label={!etiqueta && ariaLabel ? ariaLabel : undefined}
        >
          <span className="selector__valor">
            {valorActual == null ? (
              <span className="selector__placeholder">{placeholder}</span>
            ) : (
              <Select.Value>
                {(selected) => {
                  const opcion = opciones.find((item) => item.valor === selected);
                  if (renderValor) return renderValor(opcion, selected);
                  return opcion?.etiqueta || String(selected ?? "");
                }}
              </Select.Value>
            )}
          </span>
          <Select.Icon className="selector__icono">
            <IconoChevron />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            className={`selector__positioner${ancla ? " selector__positioner--ancla" : ""}`}
            anchor={ancla || undefined}
            side="bottom"
            align={alinear}
            sideOffset={6}
            alignItemWithTrigger={false}
          >
            <Select.Popup className={`selector__popup${className ? ` ${className}` : ""}`}>
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
