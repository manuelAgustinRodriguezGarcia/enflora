"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { validarCambioEtapa } from "@/lib/demo/etapas-demo";
import {
  CLAVE_DEMO,
  crearEstadoDemo,
  normalizarEstadoDemo,
  puedeRegistrar,
  reducirDemo,
} from "@/lib/demo/estado-demo";
import {
  LIMITE_REGISTROS_DEMO,
  construirRegistroDemo,
  idRegistroDemo,
  leerRegistroFormulario,
  prepararRegistroDemo,
} from "@/lib/demo/registros-demo";
import { fechaHoy } from "@/lib/etapas";

export { CLAVE_DEMO };

const VENTANA_DUPLICADO = 3000;
const DEMORA_GUARDADO = 350;

function leerGuardado() {
  try {
    const texto = sessionStorage.getItem(CLAVE_DEMO);
    if (!texto) return null;
    return normalizarEstadoDemo(JSON.parse(texto));
  } catch {
    return null;
  }
}

function esperar(ms) {
  return new Promise((resolver) => window.setTimeout(resolver, ms));
}

const ContextoDemo = createContext(null);

function crearSesion() {
  return { estado: crearEstadoDemo(), listo: false };
}

function reducirSesion(sesion, accion) {
  if (accion.type === "HIDRATAR") {
    const estado = accion.estado ? reducirDemo(sesion.estado, accion) : sesion.estado;
    return { estado, listo: true };
  }
  const estado = reducirDemo(sesion.estado, accion);
  return estado === sesion.estado ? sesion : { ...sesion, estado };
}

export function ProveedorDemo({ children }) {
  const [{ estado, listo }, dispatch] = useReducer(reducirSesion, null, crearSesion);
  const estadoRef = useRef(estado);
  const ultimoEnvio = useRef(null);
  const secuencia = useRef(0);

  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  useEffect(() => {
    dispatch({ type: "HIDRATAR", estado: leerGuardado() });
  }, []);

  useEffect(() => {
    if (!listo) return;
    try {
      sessionStorage.setItem(CLAVE_DEMO, JSON.stringify(estado));
    } catch {
      return;
    }
  }, [estado, listo]);

  const procesarRegistro = useCallback(async (entrada) => {
    await esperar(DEMORA_GUARDADO);
    const actual = estadoRef.current;
    const preparado = prepararRegistroDemo(entrada, actual);
    if (preparado.error) return { error: preparado.error };
    const { datos } = preparado;
    const anterior = datos.id ? actual.registros.find((item) => item.id === datos.id) : null;
    if (!anterior && !puedeRegistrar(actual)) {
      return {
        error: `Llegaste al límite de ${LIMITE_REGISTROS_DEMO} registros de la demo. Reiniciala para seguir probando.`,
      };
    }
    secuencia.current += 1;
    const id = anterior ? anterior.id : idRegistroDemo(Date.now(), secuencia.current);
    const registro = construirRegistroDemo(datos, { id, ahora: new Date().toISOString(), anterior });
    dispatch({ type: anterior ? "EDITAR_REGISTRO" : "AGREGAR_REGISTRO", registro });
    estadoRef.current = {
      ...actual,
      registros: anterior
        ? actual.registros.map((item) => (item.id === id ? registro : item))
        : [...actual.registros, registro],
    };
    return { ok: true, editado: Boolean(anterior), registro };
  }, []);

  const guardarRegistroLocal = useCallback(
    async (_previo, formulario) => {
      const entrada = leerRegistroFormulario(formulario);
      if (!entrada) return { error: "No se pudo leer el registro." };
      const huella = JSON.stringify(entrada);
      const ahora = Date.now();
      const ultimo = ultimoEnvio.current;
      if (ultimo && ultimo.huella === huella && ahora - ultimo.momento < VENTANA_DUPLICADO) {
        return ultimo.promesa;
      }
      const promesa = procesarRegistro(entrada);
      ultimoEnvio.current = { huella, momento: ahora, promesa };
      return promesa;
    },
    [procesarRegistro]
  );

  const cargarRegistroLocal = useCallback(async (registroId) => {
    const registro = estadoRef.current.registros.find((item) => item.id === registroId);
    if (!registro) return { error: "No se encontró el registro.", registro: null };
    return { error: "", registro };
  }, []);

  const valor = useMemo(
    () => ({
      estado,
      listo,
      guardarRegistroLocal,
      cargarRegistroLocal,
      comenzar() {
        dispatch({ type: "COMENZAR" });
      },
      volverBienvenida() {
        dispatch({ type: "VOLVER" });
      },
      ir(fase) {
        dispatch({ type: "IR", fase });
      },
      irACrear() {
        dispatch({ type: "IR", fase: "crear" });
      },
      irACultivos() {
        dispatch({ type: "IR", fase: "cultivos" });
      },
      atras() {
        dispatch({ type: "ATRAS" });
      },
      agregarCultivo(cultivo) {
        dispatch({ type: "AGREGAR_CULTIVO", cultivo });
      },
      verEspacio(espacioId) {
        dispatch({ type: "VER_ESPACIO", espacioId });
      },
      verUnidad(unidadId) {
        dispatch({ type: "VER_UNIDAD", unidadId });
      },
      verPlanta(plantaId) {
        dispatch({ type: "VER_PLANTA", plantaId });
      },
      cambiarEtapa(plantaId, etapa, fecha) {
        const hoy = fechaHoy();
        const planta = estado.plantas.find((item) => item.id === plantaId);
        const error = validarCambioEtapa(planta, etapa, fecha, hoy);
        if (error) return error;
        dispatch({ type: "CAMBIAR_ETAPA", plantaId, etapa, fecha, hoy });
        return "";
      },
      registrarDesde(unidadId, tipo, plantaIds = []) {
        dispatch({ type: "REGISTRAR_DESDE", unidadId, tipo, plantaIds });
      },
      ocultarGuia() {
        dispatch({ type: "OCULTAR_GUIA" });
      },
      mostrarGuia() {
        dispatch({ type: "MOSTRAR_GUIA" });
      },
      descartarConversion() {
        dispatch({ type: "DESCARTAR_CONVERSION" });
      },
      reiniciar() {
        try {
          sessionStorage.removeItem(CLAVE_DEMO);
        } catch {}
        ultimoEnvio.current = null;
        dispatch({ type: "REINICIAR" });
      },
    }),
    [estado, listo, guardarRegistroLocal, cargarRegistroLocal]
  );

  return <ContextoDemo.Provider value={valor}>{children}</ContextoDemo.Provider>;
}

export function useDemo() {
  const valor = useContext(ContextoDemo);
  if (!valor) throw new Error("useDemo requiere ProveedorDemo");
  return valor;
}
