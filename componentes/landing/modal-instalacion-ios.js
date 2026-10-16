"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { Boton } from "@/componentes/boton";
import {
  IlustracionAbrirAppWeb,
  IlustracionAgregarInicio,
  IlustracionCompartir,
  IlustracionSafari,
} from "@/componentes/landing/ilustraciones-instalacion";
import { PasoTutorialInstalacion } from "@/componentes/landing/paso-tutorial-instalacion";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.96, y: 10 };

const PASOS = [
  {
    titulo: "Abrí ENFLORA en Safari",
    descripcion: "Desde tu iPhone, abrí Safari y entrá a enflora.com.ar.",
    nota: "Si estás en Chrome, Instagram u otro navegador, continuá esta guía desde Safari.",
    ilustracion: <IlustracionSafari />,
  },
  {
    titulo: "Tocá Compartir",
    descripcion:
      "En Safari, tocá el botón Compartir. Según tu versión, puede aparecer directamente o dentro del menú de página.",
    ilustracion: <IlustracionCompartir />,
  },
  {
    titulo: "Elegí Agregar a Inicio",
    descripcion: "Deslizá las opciones del menú y seleccioná Agregar a Inicio.",
    nota: "¿No aparece? Revisá Editar acciones al final del menú.",
    ilustracion: <IlustracionAgregarInicio />,
  },
  {
    titulo: "Activá Abrir como app web",
    descripcion: "Activá la opción Abrir como app web y tocá Agregar.",
    ilustracion: <IlustracionAbrirAppWeb />,
  },
];

function ContenidoIOS({ onCerrar, plataforma }) {
  const [indice, setIndice] = useState(0);
  const [sentido, setSentido] = useState(1);

  function ir(delta) {
    setSentido(delta);
    setIndice((actual) => Math.min(PASOS.length - 1, Math.max(0, actual + delta)));
  }

  const paso = PASOS[indice];
  const esUltimo = indice === PASOS.length - 1;
  const avisoNavegador =
    plataforma?.esIos && !plataforma?.esSafari
      ? "Para seguir esta guía, abrí ENFLORA en Safari."
      : plataforma?.esDesktop
        ? "Para instalar ENFLORA en tu iPhone, abrí enflora.com.ar desde Safari en el celular."
        : null;

  return (
    <>
      <div className="instalacion-modal__encabezado">
        <img
          className="instalacion-modal__isotipo"
          src="/logos/enflora-isotipo-dark-green.svg"
          alt=""
          width={40}
          height={40}
        />
        <Dialog.Title className="modal__titulo instalacion-modal__titulo">
          Instalá ENFLORA en tu iPhone
        </Dialog.Title>
        <Dialog.Description className="modal__texto instalacion-modal__descripcion">
          En unos pasos podés agregar ENFLORA a tu pantalla de inicio y usarla como una app.
        </Dialog.Description>
      </div>

      {avisoNavegador ? <p className="instalacion-modal__aviso">{avisoNavegador}</p> : null}

      <div className="instalacion-modal__cuerpo">
        <AnimatePresence mode="wait" initial={false} custom={sentido}>
          <PasoTutorialInstalacion
            key={indice + 1}
            paso={indice + 1}
            total={PASOS.length}
            titulo={paso.titulo}
            descripcion={paso.descripcion}
            nota={paso.nota}
            ilustracion={paso.ilustracion}
            sentido={sentido}
          />
        </AnimatePresence>
      </div>

      {esUltimo ? (
        <div className="instalacion-modal__cierre">
          <p className="instalacion-modal__cierre-titulo">
            ¡Listo! ENFLORA ya puede estar en tu inicio.
          </p>
          <p className="instalacion-modal__paso-texto">
            Buscá el ícono de ENFLORA en tu pantalla de inicio y abrila desde ahí.
          </p>
        </div>
      ) : null}

      <div className="instalacion-modal__nav">
        <Boton type="button" variante="ghost" onClick={() => ir(-1)} disabled={indice === 0}>
          Anterior
        </Boton>
        {esUltimo ? (
          <Boton type="button" onClick={onCerrar}>
            Entendido
          </Boton>
        ) : (
          <Boton type="button" onClick={() => ir(1)}>
            Siguiente
          </Boton>
        )}
      </div>
    </>
  );
}

export function ModalInstalacionIOS({ abierto, onCerrar, plataforma, reinicio }) {
  const acciones = useRef(null);
  const reducir = useReducedMotion();

  function cambiar(siguiente, detalles) {
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      onCerrar();
    }
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar} actionsRef={acciones}>
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="modal__fondo instalacion-modal__fondo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={reducir ? { duration: 0 } : transicionRapida}
            />
          }
        />
        <Dialog.Viewport className="modal__vista">
          <Dialog.Popup
            render={
              <motion.div
                className="modal__panel instalacion-modal"
                layout
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={
                  reducir
                    ? { duration: 0 }
                    : {
                        ...transicionVista,
                        duration: 0.28,
                        layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                      }
                }
                onAnimationComplete={() => {
                  if (!abierto) acciones.current?.unmount();
                }}
              />
            }
          >
            {abierto ? (
              <ContenidoIOS key={reinicio} onCerrar={onCerrar} plataforma={plataforma} />
            ) : null}
            <Dialog.Close className="instalacion-modal__cerrar" aria-label="Cerrar">
              ×
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
