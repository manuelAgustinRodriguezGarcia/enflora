"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { Boton } from "@/componentes/boton";
import { EditorPortadaUnidad } from "@/componentes/editor-portada-unidad";
import { EliminarUnidad } from "@/componentes/eliminar-unidad";
import { FormularioUnidad } from "@/componentes/formulario-unidad";
import { IconoLapiz } from "@/componentes/iconos-ui";
import { PortadaUnidad } from "@/componentes/portada-unidad";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

export function CabeceraUnidad({
  unidad,
  espacioId,
  tipoEspacio,
  cantidadPlantas = 0,
  portadaUrl = "",
  usuarioId,
  tienePortada = false,
}) {
  const [editando, setEditando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  function cambiar(siguiente, detalles) {
    if (!siguiente && bloqueado) {
      detalles?.cancel?.();
      return;
    }
    setEditando(Boolean(siguiente));
  }

  return (
    <header className="detalle-cabecera">
      <div className="detalle-cabecera__portada">
        <PortadaUnidad url={portadaUrl} vertical />
        <div className="detalle-cabecera__pie">
          <div className="detalle-cabecera__superior">
            <h1 className="detalle-cabecera__titulo">{unidad.nombre}</h1>
            <div className="detalle-cabecera__acciones">
              <Boton
                className="boton boton--secundario boton--icono"
                type="button"
                aria-label="Editar unidad"
                aria-haspopup="dialog"
                aria-expanded={editando}
                onClick={() => setEditando(true)}
              >
                <IconoLapiz />
              </Boton>
              <EliminarUnidad unidadId={unidad.id} espacioId={espacioId} />
            </div>
          </div>
          <div className="detalle-cabecera__fila">
            <span className="detalle-cabecera__chip">
              {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)}
            </span>
            <span className="detalle-cabecera__meta">{textoCantidad(cantidadPlantas)}</span>
          </div>
        </div>
      </div>
      <Dialog.Root open={editando} onOpenChange={cambiar}>
        <Dialog.Portal>
          <Dialog.Backdrop
            render={
              <motion.div
                className="modal__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: editando ? 1 : 0 }}
                transition={transicionRapida}
              />
            }
          />
          <Dialog.Viewport className="modal__vista">
            <Dialog.Popup
              render={
                <motion.div
                  className="modal__panel modal--editar-unidad"
                  initial={panelCerrado}
                  animate={editando ? panelAbierto : panelCerrado}
                  transition={transicionVista}
                />
              }
            >
              <div className="modal__barra">
                <Dialog.Title className="modal__titulo">Editar unidad</Dialog.Title>
                <Dialog.Close className="boton boton--ghost boton--icono" aria-label="Cerrar">
                  <X strokeWidth={1.75} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <FormularioUnidad unidad={unidad} espacioId={espacioId} tipoEspacio={tipoEspacio} />
              <EditorPortadaUnidad
                unidadId={unidad.id}
                espacioId={espacioId}
                usuarioId={usuarioId}
                urlActual={portadaUrl}
                tienePortada={tienePortada}
                abierto={editando}
                onBloqueado={setBloqueado}
              />
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
