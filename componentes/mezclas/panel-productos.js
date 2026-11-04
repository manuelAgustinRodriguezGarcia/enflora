"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { PackagePlus, X } from "lucide-react";
import { eliminarProductoCultivo, guardarProductoCultivo } from "@/app/registros/mezclas-acciones";
import { DescripcionProducto } from "@/componentes/mezclas/descripcion-producto";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { IconoCategoriaProducto } from "@/componentes/mezclas/icono-categoria-producto";
import { MenuAccionesProducto } from "@/componentes/mezclas/menu-acciones-producto";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { Selector } from "@/componentes/selector";
import {
  etiquetaTipoProducto,
  formularioTipoProducto,
  TIPOS_PRODUCTO,
  TIPO_PRODUCTO_OTRO,
  tonoCategoriaProducto,
} from "@/lib/mezclas/calculo";

const VACIO = {
  id: "",
  nombre: "",
  fabricante: "",
  tipo: "fertilizantes_nutrientes",
  categoria: "",
  caracteristicas: "",
};

function formularioDeProducto(producto) {
  const tipo = formularioTipoProducto(producto.tipo);
  return {
    id: producto.id,
    nombre: producto.nombre || "",
    fabricante: producto.fabricante || "",
    tipo: tipo.tipo,
    categoria: tipo.categoria,
    caracteristicas: producto.caracteristicas || "",
  };
}

export function PanelProductos({ productos = [], disponible = false }) {
  const router = useRouter();
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

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

  async function confirmarEliminar() {
    if (!porEliminar || eliminando) return;
    setEliminando(true);
    setError("");
    const resultado = await eliminarProductoCultivo(porEliminar.id);
    setEliminando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    if (formulario?.id === porEliminar.id) setFormulario(null);
    setPorEliminar(null);
    router.refresh();
  }

  function cerrarFormulario(siguiente, detalles) {
    if (!siguiente && guardando) {
      detalles?.cancel?.();
      return;
    }
    if (!siguiente) {
      setFormulario(null);
      setError("");
    }
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
      <FabNuevoChatFlora
        ariaLabel="Nuevo producto"
        icono={<PackagePlus strokeWidth={2.25} aria-hidden="true" />}
        onClick={() => {
          setError("");
          setFormulario(VACIO);
        }}
      />
      <Dialog.Root open={Boolean(formulario)} onOpenChange={cerrarFormulario}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal__fondo" />
          <Dialog.Viewport className="modal__vista">
            <Dialog.Popup className="modal__panel mezclas__modal">
              {formulario ? (
                <form className="formulario mezclas__formulario" onSubmit={guardar}>
                  <div className="modal__barra">
                    <Dialog.Title className="mezclas__alta-titulo">
                      {formulario.id ? "Editar producto" : "Agregar producto a mi lista"}
                    </Dialog.Title>
                    <Dialog.Close className="boton boton--ghost boton--icono" aria-label="Cerrar" disabled={guardando}>
                      <X strokeWidth={1.75} aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <label className="formulario__campo">
                    Nombre
                    <input
                      value={formulario.nombre}
                      onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
                      maxLength={80}
                      required
                      disabled={guardando}
                      placeholder="Fertilizante de tu marca favorita"
                    />
                  </label>
                  <label className="formulario__campo">
                    Fabricante/marca
                    <input
                      value={formulario.fabricante}
                      onChange={(evento) => setFormulario({ ...formulario, fabricante: evento.target.value })}
                      maxLength={80}
                      disabled={guardando}
                      placeholder="Nombre de la marca"
                    />
                  </label>
                  <Selector
                    id="producto-tipo"
                    etiqueta="Tipo"
                    valor={formulario.tipo}
                    onChange={(tipo) => setFormulario({ ...formulario, tipo })}
                    opciones={TIPOS_PRODUCTO}
                    deshabilitado={guardando}
                  />
                  {formulario.tipo === TIPO_PRODUCTO_OTRO ? (
                    <label className="formulario__campo">
                      Categoría
                      <input
                        value={formulario.categoria}
                        onChange={(evento) => setFormulario({ ...formulario, categoria: evento.target.value })}
                        maxLength={80}
                        required
                        disabled={guardando}
                        placeholder="Escribí la categoría"
                      />
                    </label>
                  ) : null}
                  <label className="formulario__campo">
                    ¿Cuándo lo usás? (opcional)
                    <textarea
                      value={formulario.caracteristicas}
                      onChange={(evento) =>
                        setFormulario({ ...formulario, caracteristicas: evento.target.value })
                      }
                      maxLength={2000}
                      rows={3}
                      disabled={guardando}
                      placeholder="Lo uso para regular el pH del agua"
                    />
                  </label>
                  {error ? <p className="formulario__error">{error}</p> : null}
                  <div className="mezclas__acciones mezclas__acciones--alta">
                    <button
                      className="boton boton--secundario"
                      type="button"
                      onClick={() => cerrarFormulario(false)}
                      disabled={guardando}
                    >
                      Cancelar
                    </button>
                    <button className="boton" type="submit" disabled={guardando}>
                      {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {error && !formulario ? <p className="formulario__error">{error}</p> : null}

      <ul className="mezclas__lista">
        {productos.map((producto) => {
          const tono = tonoCategoriaProducto(producto.tipo);
          return (
          <li key={producto.id} className={producto.activo ? "" : "mezclas__item--archivado"}>
            <div className="mezclas__cuerpo">
              <p className="mezclas__categoria-fila">
                <span className="mezclas__categoria" data-tono={tono}>
                  <IconoCategoriaProducto tono={tono} />
                  {etiquetaTipoProducto(producto.tipo)}
                </span>
                {producto.activo ? null : <span className="mezclas__meta">Archivado</span>}
              </p>
              <p className="mezclas__nombre">
                <span>{producto.nombre}</span>
                {producto.fabricante ? <span className="mezclas__marca"> de {producto.fabricante}</span> : null}
              </p>
              {producto.caracteristicas ? <DescripcionProducto texto={producto.caracteristicas} /> : null}
            </div>
            <MenuAccionesProducto
              onEditar={() => {
                setError("");
                setFormulario(formularioDeProducto(producto));
              }}
              onEliminar={() => {
                setError("");
                setPorEliminar(producto);
              }}
            />
          </li>
          );
        })}
      </ul>
      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        onCerrar={() => {
          if (eliminando) return;
          setPorEliminar(null);
          setError("");
        }}
        titulo="¿Eliminar este producto?"
        descripcion="Se borra de tu lista. Los riegos que ya cargaste siguen igual."
        textoConfirmar="Eliminar"
        varianteConfirmar="destructivo"
        pendiente={eliminando}
        error={error}
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}
