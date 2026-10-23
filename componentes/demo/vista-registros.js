"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { FormularioRegistroCultivo } from "@/componentes/formulario-registro-cultivo";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { TransicionVista } from "@/componentes/transicion-vista";
import { AccionesDemo } from "@/componentes/demo/acciones-demo";
import { ActividadDemo } from "@/componentes/demo/actividad-demo";
import { Conversion } from "@/componentes/demo/conversion";
import { GuiaDemo } from "@/componentes/demo/guia-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { VolverDemo } from "@/componentes/demo/volver-demo";
import { puedeRegistrar } from "@/lib/demo/estado-demo";
import {
  ACCIONES_OCULTAS_DEMO,
  AVISO_FOTOS_DEMO,
  LIMITE_REGISTROS_DEMO,
  ordenarPorEvento,
  registrosDelDia,
  resumenRegistroDemo,
  seguimientoDemo,
  unidadesParaRegistro,
} from "@/lib/demo/registros-demo";

const SEGUIMIENTO_DEMO = seguimientoDemo();

function nombreOrigen(estado, origen) {
  if (!origen) return "";
  if (origen.fase === "planta") return estado.plantas.find((item) => item.id === origen.plantaId)?.nombre || "";
  return estado.unidades.find((item) => item.id === origen.unidadId)?.nombre || "";
}

function LimiteRegistros() {
  const { reiniciar } = useDemo();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="vacio demo-limite">
      <p>
        Llegaste al límite de {LIMITE_REGISTROS_DEMO} registros de esta demo. Tus registros siguen guardados
        abajo. Para cargar más, reiniciá la demo.
      </p>
      <Boton type="button" variante="secundario" onClick={() => setConfirmando(true)}>
        Reiniciar demo
      </Boton>
      <ModalConfirmacion
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="¿Reiniciar la demo?"
        descripcion="Se van a borrar los espacios, plantas y registros simulados de esta sesión."
        textoConfirmar="Reiniciar"
        varianteConfirmar="destructivo"
        onConfirmar={() => {
          setConfirmando(false);
          reiniciar();
        }}
      />
    </div>
  );
}

export function VistaRegistros() {
  const { estado, guardarRegistroLocal, cargarRegistroLocal, irACrear, atras, descartarConversion } = useDemo();
  const [guardado, setGuardado] = useState(null);
  const confirmacionRef = useRef(null);
  const seleccion = estado.navegacion.registro;
  const origen = seleccion?.origen || null;
  const unidades = useMemo(
    () => unidadesParaRegistro({ espacios: estado.espacios, unidades: estado.unidades, plantas: estado.plantas }),
    [estado.espacios, estado.unidades, estado.plantas]
  );
  const registrosHoy = registrosDelDia(estado.registros);
  const todos = ordenarPorEvento(estado.registros);
  const claveFormulario = seleccion
    ? `${seleccion.unidadId}:${seleccion.tipo}:${seleccion.plantaIds.join(",")}`
    : "libre";

  useEffect(() => {
    if (!guardado) return undefined;
    const nodo = confirmacionRef.current;
    if (!nodo) return undefined;
    const timer = window.setTimeout(() => {
      const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nodo.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [guardado]);

  if (!estado.espacios.length) {
    return (
      <TransicionVista>
        <section className="registros demo-modulo">
          <h1>Nuevo registro</h1>
          <div className="vacio">
            <p>Para registrar una actividad necesitás al menos un cultivo con plantas.</p>
            <Boton type="button" onClick={irACrear}>
              Crear mi primer cultivo
            </Boton>
          </div>
          <AccionesDemo />
        </section>
      </TransicionVista>
    );
  }

  const destino = nombreOrigen(estado, origen);

  return (
    <TransicionVista>
      <section className="registros demo-modulo">
        {origen ? <VolverDemo etiqueta={destino ? `Volver a ${destino}` : "Volver"} /> : null}
        <GuiaDemo />
        <h1>Nuevo registro</h1>
        <p className="demo__aviso">
          En la demo usás el seguimiento Profesional ya configurado. En la aplicación completa podés elegir tus
          acciones y parámetros prioritarios. {AVISO_FOTOS_DEMO}
        </p>

        {puedeRegistrar(estado) ? (
          <FormularioRegistroCultivo
            key={claveFormulario}
            unidades={unidades}
            seguimientoInicial={SEGUIMIENTO_DEMO}
            registrosHoy={registrosHoy}
            registrosHoyControlados
            accionGuardar={guardarRegistroLocal}
            cargarRegistro={cargarRegistroLocal}
            seleccionInicial={seleccion}
            accionesOcultas={ACCIONES_OCULTAS_DEMO}
            onGuardado={(registro) => setGuardado({ registro, editado: Boolean(registro.fecha_actualizacion) })}
          />
        ) : (
          <LimiteRegistros />
        )}

        <div ref={confirmacionRef} className="demo-registros__confirmacion">
          <Aparecer visible={Boolean(guardado)}>
            <div className="demo-registros__exito">
              <div className="demo-confirmacion" role="status">
                <p>
                  <strong>{guardado?.editado ? "Registro actualizado." : "¡Registro guardado!"}</strong>{" "}
                  {guardado ? resumenRegistroDemo(guardado.registro) : ""}
                </p>
                {origen && destino ? (
                  <Boton type="button" variante="secundario" className="boton--ancho" onClick={atras}>
                    Volver a {destino}
                  </Boton>
                ) : null}
              </div>
              {!estado.conversion.descartada ? <Conversion onSeguir={descartarConversion} /> : null}
            </div>
          </Aparecer>
        </div>

        <ActividadDemo
          id="demo-actividad-registros"
          registros={todos}
          titulo="Tus registros"
          vacio="Todavía no guardaste registros en esta sesión."
        />
        <AccionesDemo />
      </section>
    </TransicionVista>
  );
}
