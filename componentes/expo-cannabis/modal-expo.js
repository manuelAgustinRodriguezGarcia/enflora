"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import { motion } from "motion/react";
import { useExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { expoCannabis, ESTADOS_EXPO } from "@/lib/expo-cannabis/configuracion";
import { describirRestante, dosDigitos } from "@/lib/expo-cannabis/tiempo";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.96, y: 18 };

const UNIDADES = [
  { clave: "dias", etiqueta: "Días" },
  { clave: "horas", etiqueta: "Horas" },
  { clave: "minutos", etiqueta: "Minutos" },
];

function ContadorModal({ restante }) {
  return (
    <div className="expo-modal__contador">
      <p className="expo-sr">{restante ? describirRestante(restante) : ""}</p>
      <ol className="expo-modal__unidades" aria-hidden="true">
        {UNIDADES.map((unidad) => (
          <li key={unidad.clave} className="expo-modal__unidad">
            <span className="expo-modal__numero">
              {restante ? dosDigitos(restante[unidad.clave]) : "--"}
            </span>
            <span className="expo-modal__unidad-etiqueta">{unidad.etiqueta}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ContenidoModalExpo({ abierto, acciones, onIrARegalos }) {
  const { estado, restante } = useExpo();
  const textos = expoCannabis.textos.modal;
  const t = textos[estado] ?? textos.proximo;

  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        render={
          <motion.div
            className="expo-modal__fondo"
            initial={{ opacity: 0 }}
            animate={{ opacity: abierto ? 1 : 0 }}
            transition={{ duration: 0.22 }}
          />
        }
      />
      <Dialog.Viewport className="expo-modal__vista">
        <Dialog.Popup
          aria-modal="true"
          render={
            <motion.div
              className="expo-modal__panel"
              initial={panelCerrado}
              animate={abierto ? panelAbierto : panelCerrado}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onAnimationComplete={() => {
                if (!abierto) acciones.current?.unmount();
              }}
            />
          }
        >
          <span className="expo-modal__decoracion" aria-hidden="true" />
          <Dialog.Close className="expo-modal__cerrar" aria-label={textos.cerrar}>
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </Dialog.Close>

          <p className="expo-modal__etiqueta">{t.etiqueta}</p>
          <Dialog.Title className="expo-modal__titulo">{t.titulo}</Dialog.Title>
          <Dialog.Description className="expo-modal__texto">{t.descripcion}</Dialog.Description>

          {estado === ESTADOS_EXPO.proximo ? (
            <ContadorModal restante={restante} />
          ) : (
            <p className="expo-modal__estado">{t.estado}</p>
          )}

          <p className="expo-modal__info">
            <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{textos.info}</span>
          </p>

          <button
            type="button"
            className="landing__accion landing__accion--principal expo-modal__cta"
            onClick={onIrARegalos}
          >
            {t.cta}
            <ArrowUpRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
