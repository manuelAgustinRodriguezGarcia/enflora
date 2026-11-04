"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { PackageOpen } from "lucide-react";
import { duplicarRecetaMezcla, establecerRecetaActiva } from "@/app/registros/mezclas-acciones";
import { EnlaceBoton } from "@/componentes/boton";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { FormularioReceta } from "@/componentes/mezclas/formulario-receta";
import { textoMedida } from "@/lib/mezclas/calculo";

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
    if (estadoRef.current.guardando) {
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

  async function duplicar(id) {
    setError("");
    const resultado = await duplicarRecetaMezcla(id);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function cambiarActiva(receta) {
    setError("");
    const resultado = await establecerRecetaActiva(receta.id, !receta.activa);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
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
              {confirmarDescarte ? (
                <div className="mezclas__descarte" role="alertdialog" aria-labelledby="mezcla-descarte-titulo">
                  <p className="mezclas__alta-titulo" id="mezcla-descarte-titulo">
                    ¿Descartar los cambios?
                  </p>
                  <p className="mezclas__meta">Si salís ahora, se pierde lo que modificaste en esta mezcla.</p>
                  <div className="mezclas__acciones mezclas__acciones--alta">
                    <button type="button" className="boton boton--secundario" onClick={() => setConfirmarDescarte(false)}>
                      Seguir editando
                    </button>
                    <button type="button" className="boton boton--destructivo" onClick={cerrarEditor}>
                      Descartar
                    </button>
                  </div>
                </div>
              ) : null}
              {editor ? (
                <div inert={confirmarDescarte ? true : undefined}>
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
                </div>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      {error ? <p className="formulario__error">{error}</p> : null}
      <ul className="mezclas__lista">
        {recetas.map((receta) => (
          <li key={receta.id} className={receta.activa ? "" : "mezclas__item--archivado"}>
            <div>
              <p className="mezclas__nombre">{receta.nombre}</p>
              <p className="mezclas__meta">
                {textoMedida(receta.volumen_agua, receta.unidad_volumen)}
                {` · ${(receta.componentes || receta.receta_componentes || []).length} componentes`}
                {receta.activa ? "" : " · Archivada"}
              </p>
            </div>
            <div className="mezclas__acciones">
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => {
                  estadoRef.current = { sucio: false, guardando: false };
                  setError("");
                  setEditor({ receta });
                }}
              >
                Editar
              </button>
              <button type="button" className="boton boton--secundario" onClick={() => duplicar(receta.id)}>
                Duplicar
              </button>
              <button type="button" className="boton boton--ghost" onClick={() => cambiarActiva(receta)}>
                {receta.activa ? "Archivar" : "Activar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
