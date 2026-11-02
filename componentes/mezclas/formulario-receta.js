"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarRecetaMezcla } from "@/app/registros/mezclas-acciones";
import { cantidadAplicada, textoMedida, UNIDADES_COMPONENTE, UNIDADES_VOLUMEN } from "@/lib/mezclas/calculo";

function estadoInicial(receta) {
  const componentes = [...(receta?.componentes || receta?.receta_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  return {
    id: receta?.id || "",
    nombre: receta?.nombre || "",
    volumen: receta?.volumen_agua === undefined || receta?.volumen_agua === null ? "" : String(receta.volumen_agua),
    unidadVolumen: receta?.unidad_volumen || "L",
    notas: receta?.notas || "",
    componentes: componentes.map((item) => ({
      productoId: item.producto_id,
      cantidad: String(item.cantidad),
      unidad: item.unidad,
    })),
  };
}

export function FormularioReceta({ receta = null, productos = [] }) {
  const router = useRouter();
  const [datos, setDatos] = useState(() => estadoInicial(receta));
  const [productoNuevo, setProductoNuevo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const activos = productos.filter(
    (item) => item.activo || datos.componentes.some((componente) => componente.productoId === item.id)
  );

  function cambiarComponente(indice, parcial) {
    setDatos({
      ...datos,
      componentes: datos.componentes.map((item, posicion) =>
        posicion === indice ? { ...item, ...parcial } : item
      ),
    });
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    const resultado = await guardarRecetaMezcla({
      id: datos.id,
      nombre: datos.nombre,
      volumenAgua: datos.volumen,
      unidadVolumen: datos.unidadVolumen,
      notas: datos.notas,
      componentes: datos.componentes,
    });
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.push("/registros/recetas");
    router.refresh();
  }

  return (
    <form className="formulario mezclas__formulario" onSubmit={guardar}>
      <label className="formulario__campo">
        Nombre
        <input
          value={datos.nombre}
          onChange={(evento) => setDatos({ ...datos, nombre: evento.target.value })}
          maxLength={80}
          required
          disabled={guardando}
        />
      </label>
      <div className="formulario__fila">
        <label className="formulario__campo">
          Volumen de agua
          <input
            inputMode="decimal"
            value={datos.volumen}
            onChange={(evento) => setDatos({ ...datos, volumen: evento.target.value })}
            disabled={guardando}
            required
          />
        </label>
        <label className="formulario__campo">
          Unidad
          <select
            value={datos.unidadVolumen}
            onChange={(evento) => setDatos({ ...datos, unidadVolumen: evento.target.value })}
            disabled={guardando}
          >
            {UNIDADES_VOLUMEN.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="mezclas__componentes">
        {datos.componentes.map((componente, indice) => {
          const producto = productos.find((item) => item.id === componente.productoId);
          const aplicado = cantidadAplicada({
            cantidad: componente.cantidad,
            unidad: componente.unidad,
            volumenAgua: datos.volumen,
            unidadVolumen: datos.unidadVolumen,
          });
          const total =
            aplicado && (componente.unidad === "ml/L" || componente.unidad === "g/L")
              ? textoMedida(aplicado.cantidad, aplicado.unidad)
              : "";
          return (
            <li key={`${componente.productoId}-${indice}`}>
              <p className="mezclas__nombre">
                {producto?.nombre || "Producto"}
                {producto && !producto.activo ? " · archivado" : ""}
              </p>
              <div className="mezclas__dosis">
                <input
                  inputMode="decimal"
                  aria-label="Cantidad"
                  value={componente.cantidad}
                  onChange={(evento) => cambiarComponente(indice, { cantidad: evento.target.value })}
                  disabled={guardando}
                />
                <select
                  aria-label="Unidad"
                  value={componente.unidad}
                  onChange={(evento) => cambiarComponente(indice, { unidad: evento.target.value })}
                  disabled={guardando}
                >
                  {UNIDADES_COMPONENTE.map((unidad) => (
                    <option key={unidad} value={unidad}>
                      {unidad}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="boton boton--ghost"
                  onClick={() =>
                    setDatos({
                      ...datos,
                      componentes: datos.componentes.filter((_, posicion) => posicion !== indice),
                    })
                  }
                  disabled={guardando}
                >
                  Quitar
                </button>
              </div>
              {total ? <p className="mezclas__meta">Para este volumen: {total}</p> : null}
            </li>
          );
        })}
      </ul>

      <div className="mezclas__agregar">
        <label className="formulario__campo">
          Producto
          <select
            value={productoNuevo}
            onChange={(evento) => setProductoNuevo(evento.target.value)}
            disabled={guardando}
          >
            <option value="">Elegir</option>
            {activos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre}
                {producto.activo ? "" : " · archivado"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="boton boton--secundario"
          type="button"
          disabled={guardando || !productoNuevo}
          onClick={() => {
            if (datos.componentes.some((item) => item.productoId === productoNuevo)) return;
            setDatos({
              ...datos,
              componentes: [...datos.componentes, { productoId: productoNuevo, cantidad: "", unidad: "ml/L" }],
            });
            setProductoNuevo("");
          }}
        >
          Agregar
        </button>
      </div>

      <label className="formulario__campo">
        Observaciones
        <textarea
          value={datos.notas}
          onChange={(evento) => setDatos({ ...datos, notas: evento.target.value })}
          maxLength={2000}
          rows={3}
          disabled={guardando}
        />
      </label>
      {error ? <p className="formulario__error">{error}</p> : null}
      <div className="mezclas__cta">
        <button className="boton boton--cta boton--ancho" type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar receta"}
        </button>
      </div>
    </form>
  );
}
