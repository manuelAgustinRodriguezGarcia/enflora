"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { guardarRecetaMezcla } from "@/app/registros/mezclas-acciones";
import { FilaDosisProducto } from "@/componentes/mezclas/fila-dosis-producto";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { Selector } from "@/componentes/selector";
import { LIMITE_COMPONENTES, parsearCantidad, textoCantidad, UNIDADES_VOLUMEN } from "@/lib/mezclas/calculo";
import { validarReceta } from "@/lib/mezclas/reglas";

function cantidadInicial(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  return textoCantidad(valor);
}

function filaVacia() {
  return { productoId: "", cantidad: "", unidad: "ml/L" };
}

function filaCompleta(fila) {
  const cantidad = parsearCantidad(fila?.cantidad);
  return Boolean(String(fila?.productoId || "").trim()) && cantidad !== null && cantidad > 0;
}

function puedeSumarProducto(filas) {
  return filas.length > 0 && filas.length < LIMITE_COMPONENTES && filas.every(filaCompleta);
}

function estadoInicial(receta) {
  const componentes = [...(receta?.componentes || receta?.receta_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  const filas = componentes.map((item) => ({
    productoId: item.producto_id,
    cantidad: cantidadInicial(item.cantidad),
    unidad: item.unidad || "ml/L",
  }));
  return {
    id: receta?.id || "",
    nombre: receta?.nombre || "",
    volumen: cantidadInicial(receta?.volumen_agua),
    unidadVolumen: receta?.unidad_volumen || "L",
    notas: receta?.notas || "",
    componentes: filas.length > 0 ? filas : [filaVacia()],
  };
}

export function FormularioReceta({
  receta = null,
  productos = [],
  titulo = "",
  onCancelar = null,
  onGuardado = null,
  onEstado = null,
}) {
  const router = useRouter();
  const [inicial] = useState(() => JSON.stringify(estadoInicial(receta)));
  const [datos, setDatos] = useState(() => estadoInicial(receta));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const sucio = JSON.stringify(datos) !== inicial;

  useEffect(() => {
    onEstado?.({ sucio, guardando });
  }, [sucio, guardando, onEstado]);

  function cambiarComponente(indice, parcial) {
    const ocupados = new Set(
      datos.componentes.flatMap((item, posicion) => (posicion === indice ? [] : item.productoId ? [item.productoId] : []))
    );
    if (parcial.productoId && ocupados.has(parcial.productoId)) {
      setError("Ese producto ya está en la mezcla.");
      return;
    }
    setError("");
    setDatos({
      ...datos,
      componentes: datos.componentes.map((item, posicion) =>
        posicion === indice ? { ...item, ...parcial } : item
      ),
    });
  }

  function cerrarDeVerdad() {
    if (onCancelar) onCancelar();
    else router.push("/mezclas");
  }

  function solicitarCierre() {
    if (guardando) return;
    if (onCancelar) {
      onCancelar();
      return;
    }
    if (sucio) {
      setConfirmarDescarte(true);
      return;
    }
    cerrarDeVerdad();
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError("");
    const previo = validarReceta(
      {
        nombre: datos.nombre,
        volumenAgua: datos.volumen,
        unidadVolumen: datos.unidadVolumen,
        notas: datos.notas,
        componentes: datos.componentes,
      },
      productos
    );
    if (previo.error) {
      setGuardando(false);
      setError(previo.error);
      return;
    }
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
    onEstado?.({ sucio: false, guardando: false });
    if (onGuardado) {
      onGuardado();
      return;
    }
    router.push("/mezclas");
    router.refresh();
  }

  return (
    <form className="formulario mezclas__formulario" onSubmit={guardar}>
      {titulo ? (
        <div className="modal__barra">
          <Dialog.Title className="mezclas__alta-titulo">{titulo}</Dialog.Title>
          <Dialog.Close className="boton boton--ghost boton--icono" aria-label="Cerrar" disabled={guardando}>
            <X strokeWidth={1.75} aria-hidden="true" />
          </Dialog.Close>
        </div>
      ) : null}
      <label className="formulario__campo">
        Nombre
        <input
          value={datos.nombre}
          onChange={(evento) => setDatos({ ...datos, nombre: evento.target.value })}
          placeholder="Riego con fertilizante"
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
            placeholder="2 (L) o 1500 (ml)"
            disabled={guardando}
            required
          />
        </label>
        <Selector
          etiqueta="Unidad"
          ariaLabel="Unidad"
          valor={datos.unidadVolumen}
          onChange={(unidad) => setDatos({ ...datos, unidadVolumen: unidad })}
          opciones={UNIDADES_VOLUMEN.map((unidad) => ({ valor: unidad, etiqueta: unidad }))}
          deshabilitado={guardando}
        />
      </div>

      <fieldset className="mezclas__productos">
        <legend>Productos</legend>
        <ul className="mezclas__componentes">
          {datos.componentes.map((componente, indice) => (
            <li key={`${componente.productoId || "nuevo"}-${indice}`}>
              <FilaDosisProducto
                id={`mezcla-producto-${indice}`}
                productos={productos}
                ocupados={datos.componentes.flatMap((item, posicion) =>
                  posicion === indice || !item.productoId ? [] : [item.productoId]
                )}
                productoId={componente.productoId}
                cantidad={componente.cantidad}
                unidad={componente.unidad}
                volumenAgua={datos.volumen}
                unidadVolumen={datos.unidadVolumen}
                deshabilitado={guardando}
                onChange={(parcial) => cambiarComponente(indice, parcial)}
                onQuitar={() => {
                  const restantes = datos.componentes.filter((_, posicion) => posicion !== indice);
                  setDatos({
                    ...datos,
                    componentes: restantes.length > 0 ? restantes : [filaVacia()],
                  });
                }}
              />
            </li>
          ))}
        </ul>
        <button
          className="boton boton--secundario mezclas__sumar"
          type="button"
          disabled={guardando || !puedeSumarProducto(datos.componentes)}
          onClick={() => setDatos({ ...datos, componentes: [...datos.componentes, filaVacia()] })}
        >
          Agregar otro producto
        </button>
      </fieldset>

      <label className="formulario__campo">
        Observaciones
        <textarea
          value={datos.notas}
          onChange={(evento) => setDatos({ ...datos, notas: evento.target.value })}
          placeholder="Regar con esta mezcla durante vegetación..."
          maxLength={2000}
          rows={3}
          disabled={guardando}
        />
      </label>
      {error ? <p className="formulario__error">{error}</p> : null}
      <div className="mezclas__acciones mezclas__acciones--alta">
        <button className="boton boton--secundario" type="button" onClick={solicitarCierre} disabled={guardando}>
          Cancelar
        </button>
        <button className="boton" type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar mezcla"}
        </button>
      </div>
      {onCancelar ? null : (
        <ModalConfirmacion
          abierto={confirmarDescarte}
          onCerrar={() => setConfirmarDescarte(false)}
          titulo="¿Descartar los cambios?"
          descripcion="Si salís ahora, se pierde lo que modificaste en esta mezcla."
          textoConfirmar="Descartar"
          textoCancelar="Seguir editando"
          varianteConfirmar="destructivo"
          onConfirmar={cerrarDeVerdad}
        />
      )}
    </form>
  );
}
