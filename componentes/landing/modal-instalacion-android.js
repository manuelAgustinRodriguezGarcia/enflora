"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { Boton } from "@/componentes/boton";
import {
  IlustracionChromeAndroid,
  IlustracionIconoInicio,
  IlustracionPromptInstalar,
} from "@/componentes/landing/ilustraciones-instalacion";
import { PasoTutorialInstalacion } from "@/componentes/landing/paso-tutorial-instalacion";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.96, y: 10 };

const PASOS = [
  {
    titulo: "Abrí ENFLORA en Chrome",
    descripcion: "Desde tu celular Android, entrá a enflora.com.ar usando Google Chrome.",
    ilustracion: <IlustracionChromeAndroid />,
  },
  {
    titulo: "Instalá la app",
    descripcion:
      "Presioná el botón Instalar ENFLORA. Si tu navegador lo permite, aparecerá la confirmación de instalación.",
    ilustracion: <IlustracionPromptInstalar />,
  },
  {
    titulo: "Confirmá y listo",
    descripcion:
      "Confirmá la instalación. Cuando termine, vas a encontrar el ícono de ENFLORA entre tus aplicaciones.",
    ilustracion: <IlustracionIconoInicio />,
  },
];

const PASOS_MANUAL = [
  "Abrí ENFLORA en Chrome.",
  "Tocá el menú de los tres puntos.",
  'Buscá "Instalar app" o la opción equivalente para instalar la aplicación web.',
  "Confirmá la instalación.",
];

function ContenidoAndroid({ onCerrar, pwa }) {
  const [indice, setIndice] = useState(0);
  const [sentido, setSentido] = useState(1);
  const [instalando, setInstalando] = useState(false);
  const { instalada, puedeInstalarNativo, plataforma, solicitarInstalacion } = pwa;

  function ir(delta) {
    setSentido(delta);
    setIndice((actual) => Math.min(PASOS.length - 1, Math.max(0, actual + delta)));
  }

  async function instalar() {
    if (!puedeInstalarNativo || instalando) return;
    setInstalando(true);
    await solicitarInstalacion();
    setInstalando(false);
  }

  const paso = PASOS[indice];
  const esUltimo = indice === PASOS.length - 1;
  const enDesktop = plataforma.esDesktop;
  const mostrarManual = !puedeInstalarNativo && !instalada;

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
          Instalá ENFLORA en Android
        </Dialog.Title>
        <Dialog.Description className="modal__texto instalacion-modal__descripcion">
          Tené ENFLORA en tu pantalla de inicio, como una app más.
        </Dialog.Description>
      </div>

      {instalada ? (
        <p className="instalacion-modal__estado" role="status">
          ¡Ya tenés ENFLORA instalada!
        </p>
      ) : (
        <>
          <div className="instalacion-modal__cuerpo">
            <AnimatePresence mode="wait" initial={false} custom={sentido}>
              <PasoTutorialInstalacion
                key={indice + 1}
                paso={indice + 1}
                total={PASOS.length}
                titulo={paso.titulo}
                descripcion={paso.descripcion}
                ilustracion={paso.ilustracion}
                sentido={sentido}
              />
            </AnimatePresence>
          </div>

          {mostrarManual ? (
            <div className="instalacion-modal__manual">
              <p className="instalacion-modal__manual-titulo">Si no aparece Instalar ENFLORA</p>
              <ol>
                {PASOS_MANUAL.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p className="instalacion-modal__nota">
                En algunas versiones de Chrome, la opción puede aparecer dentro de &quot;Instalar y
                crear acceso directo&quot;.
              </p>
            </div>
          ) : null}

          {!enDesktop && puedeInstalarNativo ? (
            <Boton
              type="button"
              className="instalacion-modal__instalar"
              onClick={instalar}
              disabled={instalando}
            >
              {instalando ? "Abriendo…" : "Instalar ENFLORA"}
            </Boton>
          ) : null}
        </>
      )}

      <div className="instalacion-modal__nav">
        <Boton
          type="button"
          variante="ghost"
          onClick={() => ir(-1)}
          disabled={indice === 0 || instalada}
        >
          Anterior
        </Boton>
        {esUltimo || instalada ? (
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

export function ModalInstalacionAndroid({ abierto, onCerrar, pwa, reinicio }) {
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
              <ContenidoAndroid key={reinicio} onCerrar={onCerrar} pwa={pwa} />
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
