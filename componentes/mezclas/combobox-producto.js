"use client";

import { useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { IconoChevron } from "@/componentes/iconos-ui";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es");
}

function etiquetaProducto(producto) {
  if (!producto) return "";
  const marca = producto.fabricante ? ` · ${producto.fabricante}` : "";
  const archivo = producto.activo ? "" : " · archivado";
  return `${producto.nombre}${marca}${archivo}`;
}

export function ComboboxProducto({
  productos = [],
  ocupados = [],
  productoId = "",
  onChange,
  deshabilitado = false,
  id,
}) {
  const [consulta, setConsulta] = useState("");
  const ocupado = new Set(ocupados.filter(Boolean));
  const porId = new Map(productos.map((producto) => [producto.id, producto]));
  const visibles = productos.filter((producto) => {
    if (producto.id === productoId || ocupado.has(producto.id)) return true;
    return producto.activo;
  });
  const ids = visibles.map((producto) => producto.id);
  const elegido = productoId || null;

  function etiqueta(valor) {
    return etiquetaProducto(porId.get(valor));
  }

  function textoOpcion(valor) {
    const base = etiqueta(valor);
    if (ocupado.has(valor) && valor !== productoId) return `${base} · ya está en la mezcla`;
    return base;
  }

  function mensajeVacio() {
    const q = normalizar(consulta);
    if (q) return "No hay productos con ese nombre.";
    if (productos.length === 0) return "Todavía no hay productos para elegir.";
    return "Los productos disponibles ya están en la mezcla.";
  }

  return (
    <Combobox.Root
      items={ids}
      value={elegido}
      onValueChange={(valor) => onChange?.(valor || "")}
      itemToStringLabel={etiqueta}
      onInputValueChange={setConsulta}
      onOpenChange={(abierto) => {
        if (!abierto || !id) return;
        window.setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ block: "nearest" });
        }, 250);
      }}
      autoHighlight="always"
      disabled={deshabilitado}
      filter={(item, query) => {
        const q = normalizar(query);
        if (!q) return true;
        if (elegido && q === normalizar(etiqueta(elegido))) return true;
        return normalizar(etiqueta(item)).includes(q);
      }}
    >
      <Combobox.InputGroup className="mezclas__producto-campo">
        <Combobox.Input
          id={id}
          className="mezclas__producto-input"
          placeholder="Buscar producto"
          aria-label="Producto"
          autoComplete="off"
          disabled={deshabilitado}
        />
        <Combobox.Trigger className="mezclas__producto-trigger" aria-label="Ver productos" disabled={deshabilitado}>
          <Combobox.Icon className="mezclas__producto-icono">
            <IconoChevron />
          </Combobox.Icon>
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner
          className="selector__positioner selector__positioner--ancla mezclas__producto-positioner"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
        >
          <Combobox.Popup className="selector__popup mezclas__producto-popup">
            <Combobox.Empty className="mezclas__producto-vacio">{mensajeVacio()}</Combobox.Empty>
            <Combobox.List>
              {(item) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className="selector__opcion"
                  disabled={ocupado.has(item) && item !== productoId}
                >
                  {textoOpcion(item)}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
