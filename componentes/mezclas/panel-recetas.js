"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { PackageOpen } from "lucide-react";
import { eliminarRecetaMezcla } from "@/app/registros/mezclas-acciones";
import { EnlaceBoton } from "@/componentes/boton";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { FormularioReceta } from "@/componentes/mezclas/formulario-receta";
import { MenuAccionesProducto } from "@/componentes/mezclas/menu-acciones-producto";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { textoResumenReceta } from "@/lib/mezclas/presentacion";

export function PanelRecetas({
  recetas = [],
  productos = [],
  disponible = false,
  sinProductos = false,
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const estadoRef = useRef({ sucio: false, guardando: false });

  function recordarEstado(estado) {
    estadoRef.current = estado;
  }

  function cerrarEditor() {
    estadoRef.current = { sucio: false, guardando: false };
    setConfirmarDescarte(false);
    setEditor(null);
  }

  function pedirCierre(detalles) {
    if (estadoRef.current.guardando || confirmarDescarte) {
      detalles?.cancel?.();
      return;
    }
    if (estadoRef.current.sucio) {
      detalles?.cancel?.();
      setConfirmarDescarte(true);
      return;
    }
    cerrarEditor();
  }

  function alCambiarApertura(siguiente, detalles) {
    if (siguiente) return;
    pedirCierre(detalles);
  }

  async function confirmarEliminar() {
    if (!porEliminar || eliminando) return;
    setEliminando(true);
    setError("");
    const resultado = await eliminarRecetaMezcla(porEliminar.id);
    setEliminando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    if (editor?.receta?.id === porEliminar.id) cerrarEditor();
    setPorEliminar(null);
    router.refresh();
  }

  if (!disponible) {
    return (
      <p className="registro-crear__ayuda">
        Falta aplicar supabase/mezclas.sql en Supabase. Después de eso vas a poder guardar mezclas.
      </p>
    );
  }

  if (sinProductos) {
    return (
      <div className="mezclas__sin-productos">
        <p className="registros__intro">
          Para crear una mezcla tenés que anotar los producto que usás en la lista de Mis Productos.
        </p>
        <EnlaceBoton href="/registros/productos" className="mezclas__ir-productos">
          <PackageOpen strokeWidth={1.75} aria-hidden="true" />
          Ir a Mis productos
        </EnlaceBoton>
      </div>
    );
  }

  return (
    <div className="mezclas__panel">
      <FabNuevoChatFlora
        ariaLabel="Nueva mezcla"
        onClick={() => {
          estadoRef.current = { sucio: false, guardando: false };
          setError("");
          setEditor({ receta: null });
        }}
      />
      <Dialog.Root open={Boolean(editor)} onOpenChange={alCambiarApertura}>
        <Dialog.Portal>
          <Dialog.Backdrop className="modal__fondo" />
          <Dialog.Viewport className="modal__vista">
            <Dialog.Popup className="modal__panel mezclas__modal">
              {editor ? (
                <FormularioReceta
                  key={editor.receta?.id || "nueva"}
                  receta={editor.receta}
                  productos={productos}
                  titulo={editor.receta ? "Editar mezcla" : "Crear mezcla"}
                  onEstado={recordarEstado}
                  onCancelar={() => pedirCierre()}
                  onGuardado={() => {
                    cerrarEditor();
                    router.refresh();
                  }}
                />
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      <ul className="mezclas__lista">
        {recetas.map((receta) => {
          const resumen = textoResumenReceta(receta, productos);
          return (
          <li key={receta.id} className={receta.activa ? "" : "mezclas__item--archivado"}>
            <div className="mezclas__cuerpo">
              <p className="mezclas__nombre">{receta.nombre}</p>
              {resumen || !receta.activa ? (
                <div className="mezclas__resumen-fila">
                  {resumen ? <span className="mezclas__resumen-pill">{resumen}</span> : null}
                  {receta.activa ? null : <span className="mezclas__meta">Archivada</span>}
                </div>
              ) : null}
            </div>
            <MenuAccionesProducto
              etiqueta="Acciones de la mezcla"
              onEditar={() => {
                estadoRef.current = { sucio: false, guardando: false };
                setError("");
                setEditor({ receta });
              }}
              onEliminar={() => {
                setError("");
                setPorEliminar(receta);
              }}
            />
          </li>
          );
        })}
      </ul>
      <ModalConfirmacion
        abierto={confirmarDescarte}
        encima
        onCerrar={() => setConfirmarDescarte(false)}
        titulo="¿Descartar los cambios?"
        descripcion="Si salís ahora, se pierde lo que modificaste en esta mezcla."
        textoConfirmar="Descartar"
        textoCancelar="Seguir editando"
        varianteConfirmar="destructivo"
        onConfirmar={cerrarEditor}
      />
      <ModalConfirmacion
        abierto={Boolean(porEliminar)}
        onCerrar={() => {
          if (eliminando) return;
          setPorEliminar(null);
          setError("");
        }}
        titulo="¿Eliminar esta mezcla?"
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
