"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  establecerProductoActivo,
  guardarProductoCultivo,
} from "@/app/registros/mezclas-acciones";
import { etiquetaTipoProducto, TIPOS_PRODUCTO } from "@/lib/mezclas/calculo";

const VACIO = { id: "", nombre: "", fabricante: "", tipo: "fertilizante", caracteristicas: "" };

export function PanelProductos({ productos = [], disponible = false }) {
  const router = useRouter();
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    const resultado = await guardarProductoCultivo(formulario);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    setFormulario(null);
    router.refresh();
  }

  async function cambiarActivo(producto) {
    setError("");
    const resultado = await establecerProductoActivo(producto.id, !producto.activo);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  if (!disponible) {
    return (
      <p className="registro-crear__ayuda">
        Falta aplicar supabase/mezclas.sql en Supabase. Después de eso vas a poder cargar productos.
      </p>
    );
  }

  return (
    <div className="mezclas__panel">
      {formulario ? (
        <form className="formulario mezclas__formulario" onSubmit={guardar}>
          <label className="formulario__campo">
            Nombre
            <input
              value={formulario.nombre}
              onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
              maxLength={80}
              required
              disabled={guardando}
            />
          </label>
          <label className="formulario__campo">
            Fabricante
            <input
              value={formulario.fabricante}
              onChange={(evento) => setFormulario({ ...formulario, fabricante: evento.target.value })}
              maxLength={80}
              disabled={guardando}
            />
          </label>
          <label className="formulario__campo">
            Tipo
            <select
              value={formulario.tipo}
              onChange={(evento) => setFormulario({ ...formulario, tipo: evento.target.value })}
              disabled={guardando}
            >
              {TIPOS_PRODUCTO.map((tipo) => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="formulario__campo">
            Características
            <textarea
              value={formulario.caracteristicas}
              onChange={(evento) =>
                setFormulario({ ...formulario, caracteristicas: evento.target.value })
              }
              maxLength={2000}
              rows={3}
              disabled={guardando}
            />
          </label>
          {error ? <p className="formulario__error">{error}</p> : null}
          <div className="mezclas__acciones">
            <button className="boton" type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar producto"}
            </button>
            <button
              className="boton boton--secundario"
              type="button"
              onClick={() => setFormulario(null)}
              disabled={guardando}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className="boton" type="button" onClick={() => setFormulario(VACIO)}>
          Nuevo producto
        </button>
      )}

      {error && !formulario ? <p className="formulario__error">{error}</p> : null}

      <ul className="mezclas__lista">
        {productos.map((producto) => (
          <li key={producto.id} className={producto.activo ? "" : "mezclas__item--archivado"}>
            <div>
              <p className="mezclas__nombre">{producto.nombre}</p>
              <p className="mezclas__meta">
                {etiquetaTipoProducto(producto.tipo)}
                {producto.fabricante ? ` · ${producto.fabricante}` : ""}
                {producto.activo ? "" : " · Archivado"}
              </p>
              {producto.caracteristicas ? <p className="mezclas__meta">{producto.caracteristicas}</p> : null}
            </div>
            <div className="mezclas__acciones">
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() =>
                  setFormulario({
                    id: producto.id,
                    nombre: producto.nombre || "",
                    fabricante: producto.fabricante || "",
                    tipo: producto.tipo,
                    caracteristicas: producto.caracteristicas || "",
                  })
                }
              >
                Editar
              </button>
              <button type="button" className="boton boton--ghost" onClick={() => cambiarActivo(producto)}>
                {producto.activo ? "Archivar" : "Activar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {productos.length === 0 ? <p className="registro-crear__ayuda">Todavía no cargaste productos.</p> : null}
    </div>
  );
}
