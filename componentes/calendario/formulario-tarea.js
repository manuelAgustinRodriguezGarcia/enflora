"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { guardarTarea } from "@/app/calendario/acciones";
import { Boton } from "@/componentes/boton";
import { Selector } from "@/componentes/selector";
import { TEXTOS_PUSH, useNotificacionesPush } from "@/componentes/usar-notificaciones-push";
import { transicionRapida, transicionVista } from "@/lib/animaciones";
import { hrefCalendario, notasVisibles, TIPOS_TAREA } from "@/lib/calendario/modelo";

const panelAbierto = { opacity: 1, y: 0, scale: 1 };
const panelCerrado = { opacity: 0, y: 12, scale: 0.98 };

function valoresIniciales(espacios, filtros, tarea) {
  if (tarea) {
    return {
      id: tarea.id,
      espacioId: tarea.espacioId,
      unidadId: tarea.unidadId,
      tipo: tarea.tipo,
      descripcion: notasVisibles(tarea),
      fecha: tarea.fecha,
      hora: tarea.hora,
      plantaIds: tarea.plantaIds || [],
      avisoPush: tarea.avisoPush !== false,
    };
  }

  const espacio =
    espacios.find((item) => item.unidades.some((unidad) => unidad.id === filtros.unidad)) || espacios[0];
  const unidad = espacio?.unidades.find((item) => item.id === filtros.unidad) || espacio?.unidades[0];
  return {
    id: "",
    espacioId: espacio?.id || "",
    unidadId: unidad?.id || "",
    tipo: "riego",
    descripcion: "",
    fecha: filtros.fecha || filtros.hoy || "",
    hora: "09:00",
    plantaIds: [],
    avisoPush: true,
  };
}

function EstadoAviso({ push }) {
  if (push.estado === "cargando") return null;
  if (push.estado === "activado") {
    return <p className="calendario__ayuda">Aviso programado para esa hora.</p>;
  }

  const puedeActivar = push.estado === "desactivado" || push.estado === "disponible";
  const texto =
    TEXTOS_PUSH[push.estado] ||
    "Este teléfono no tiene los avisos de Enflora activados. Activalos para recibir el recordatorio.";

  return (
    <div className="calendario__ayuda">
      <p>{puedeActivar ? "Este teléfono no tiene los avisos de Enflora activados. Activalos para recibir el recordatorio." : texto}</p>
      {puedeActivar ? (
        <Boton type="button" variante="ghost" disabled={push.ocupado} onClick={() => push.activar()}>
          Activar avisos
        </Boton>
      ) : null}
    </div>
  );
}

export function FormularioTarea({ espacios, filtros, tarea = null, onCerrar = null }) {
  const router = useRouter();
  const acciones = useRef(null);
  const inicial = useMemo(() => valoresIniciales(espacios, filtros, tarea), [espacios, filtros, tarea]);
  const [espacioId, setEspacioId] = useState(inicial.espacioId);
  const [unidadId, setUnidadId] = useState(inicial.unidadId);
  const [tipo, setTipo] = useState(inicial.tipo);
  const [plantas, setPlantas] = useState(() => new Set(inicial.plantaIds));
  const [aviso, setAviso] = useState(inicial.avisoPush);
  const [abierto, setAbierto] = useState(true);
  const abiertoRef = useRef(true);
  const salio = useRef(false);
  const [estado, accion, pendiente] = useActionState(guardarTarea, null);
  const push = useNotificacionesPush("app");

  const espacio = espacios.find((item) => item.id === espacioId) || null;
  const unidades = espacio?.unidades || [];
  const unidad = unidades.find((item) => item.id === unidadId) || null;
  const cerrar = hrefCalendario({
    mes: filtros.mes,
    unidad: filtros.unidad,
    estado: filtros.estado,
    fecha: filtros.fecha,
  });

  function cambiarEspacio(id) {
    const siguiente = espacios.find((item) => item.id === id);
    setEspacioId(id);
    setUnidadId(siguiente?.unidades[0]?.id || "");
    setPlantas(new Set());
  }

  function cambiarUnidad(id) {
    setUnidadId(id);
    setPlantas(new Set());
  }

  function alternarPlanta(id) {
    setPlantas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function salir() {
    if (salio.current) return;
    salio.current = true;
    acciones.current?.unmount();
    if (onCerrar) {
      onCerrar();
      return;
    }
    router.replace(cerrar);
  }

  function pedirCierre(detalles) {
    if (pendiente) {
      detalles?.cancel();
      return;
    }
    if (!abiertoRef.current) return;
    detalles?.preventUnmountOnClose?.();
    abiertoRef.current = false;
    setAbierto(false);
    window.setTimeout(salir, 240);
  }

  function alTerminar() {
    if (abiertoRef.current) return;
    salir();
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente, detalles) => { if (!siguiente) pedirCierre(detalles); }} actionsRef={acciones}>
      <Dialog.Portal>
        <Dialog.Backdrop
          render={
            <motion.div
              className="modal__fondo"
              initial={{ opacity: 0 }}
              animate={{ opacity: abierto ? 1 : 0 }}
              transition={transicionRapida}
            />
          }
        />
        <Dialog.Viewport className="modal__vista">
          <Dialog.Popup
            render={
              <motion.div
                className="modal__panel modal__panel--con-cerrar calendario__modal"
                initial={panelCerrado}
                animate={abierto ? panelAbierto : panelCerrado}
                transition={transicionVista}
                onAnimationComplete={alTerminar}
              />
            }
          >
            <Dialog.Close className="flora-modal-fotos__cerrar" aria-label="Cerrar">
              <X strokeWidth={2} aria-hidden="true" />
            </Dialog.Close>
            <form action={accion} className="calendario__editor">
      <div className="calendario__editor-cabecera">
        <Dialog.Title className="calendario__modal-titulo">{inicial.id ? "Editar tarea" : "Nueva tarea"}</Dialog.Title>
      </div>

      <input type="hidden" name="id" value={inicial.id} />
      <input type="hidden" name="retorno_mes" value={filtros.mes} />
      <input type="hidden" name="retorno_unidad" value={filtros.unidad} />
      <input type="hidden" name="retorno_estado" value={filtros.estado} />
      <input type="hidden" name="retorno_fecha" value={filtros.fecha} />

      <Selector
        id="tarea-espacio"
        etiqueta="Espacio"
        nombre="espacio_id"
        valor={espacioId}
        requerido
        onChange={cambiarEspacio}
        opciones={espacios.map((item) => ({ valor: item.id, etiqueta: item.nombre }))}
      />

      <Selector
        id="tarea-unidad"
        etiqueta="Unidad"
        nombre="unidad_id"
        valor={unidad?.id || ""}
        requerido
        deshabilitado={!unidades.length}
        placeholder="Sin unidades"
        onChange={cambiarUnidad}
        opciones={unidades.map((item) => ({ valor: item.id, etiqueta: item.nombre }))}
      />

      <fieldset className="calendario__plantas">
        <legend>Plantas</legend>
        <p className="calendario__ayuda">Si no elegís ninguna, la tarea queda en toda la unidad.</p>
        {(unidad?.plantas || []).length ? (
          <ul>
            {(unidad?.plantas || []).map((planta) => (
              <li key={planta.id}>
                <label>
                  <input
                    type="checkbox"
                    name="planta_id"
                    value={planta.id}
                    checked={plantas.has(planta.id)}
                    onChange={() => alternarPlanta(planta.id)}
                  />
                  <span>{planta.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="calendario__ayuda">Esta unidad no tiene plantas activas.</p>
        )}
      </fieldset>

      <label className="formulario__campo">
        <span>Tipo</span>
        <select name="tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
          {TIPOS_TAREA.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <div className="calendario__cuando-campos">
        <label className="formulario__campo">
          <span>Fecha</span>
          <input type="date" name="fecha" defaultValue={inicial.fecha} required />
        </label>
        <label className="formulario__campo">
          <span>Hora</span>
          <input type="time" name="hora" defaultValue={inicial.hora} required />
        </label>
      </div>

      <label className="formulario__campo">
        <span>{tipo === "personalizada" ? "Descripción" : "Notas"}</span>
        <textarea
          name="descripcion"
          rows={3}
          maxLength={500}
          defaultValue={inicial.descripcion}
          required={tipo === "personalizada"}
          placeholder={tipo === "personalizada" ? "Qué hay que hacer" : "Opcional"}
        />
      </label>

      <label className="calendario__aviso">
        <input type="checkbox" name="aviso_push" value="1" checked={aviso} onChange={(evento) => setAviso(evento.target.checked)} />
        <span>Quiero un recordatorio a esa hora</span>
      </label>
      {aviso ? <EstadoAviso push={push} /> : null}

      {estado?.error ? (
        <p className="formulario__error" role="alert">
          {estado.error}
        </p>
      ) : null}

      <Boton type="submit" className="boton--ancho" disabled={pendiente || !unidad}>
        {inicial.id ? "Guardar cambios" : "Crear tarea"}
      </Boton>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
