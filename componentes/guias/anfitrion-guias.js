"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { SpotlightGuia } from "@/componentes/guias/spotlight-guia";
import "@/estilos/componentes/_recorrido-guias.scss";
import { EVENTO_GUIA } from "@/lib/guias/eventos";
import { rutaCoincide } from "@/lib/guias/catalogo";
import {
  debeOfrecerBienvenida,
  estadoInicialGuias,
  reducirGuias,
} from "@/lib/guias/maquina";
import {
  esTablaAusente,
  filasParaGuardar,
  fusionarProgreso,
  guardarLocal,
  leerLocal,
  limpiarGuiasLocales,
} from "@/lib/guias/persistencia";
import { esRutaApp } from "@/lib/navegacion";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { publicarGuias, reiniciarTiendaGuias, useGuias } from "@/lib/guias/tienda";

export function AnfitrionGuias({ usuarioId }) {
  const ruta = usePathname() || "";
  const router = useRouter();
  const estadoRef = useRef(estadoInicialGuias(false));
  const listoRef = useRef(false);
  const remotoRef = useRef(true);
  const confirmarBienvenida = useRef(false);
  const rutaRef = useRef(ruta);
  const guias = useGuias();

  useLayoutEffect(() => {
    rutaRef.current = ruta;
  }, [ruta]);

  function publicar() {
    const estado = estadoRef.current;
    publicarGuias({
      listo: listoRef.current,
      tieneEspacios: estado.tieneEspacios,
      progreso: estado.progreso,
      activa: estado.activa,
      aviso: estado.aviso,
      iniciar(guiaId, reiniciar = true) {
        despachar({ tipo: "iniciar", guiaId, reiniciar });
      },
      saltar() {
        despachar({ tipo: "saltar" });
      },
      pausar() {
        despachar({ tipo: "pausar" });
      },
    });
  }

  function persistir(ids) {
    const unicos = [...new Set(ids)];
    if (!unicos.length || !usuarioId) return;
    const progreso = estadoRef.current.progreso;
    const marca = new Date().toISOString();
    guardarLocal(usuarioId, progreso, undefined, marca);
    if (!remotoRef.current) return;
    const filas = filasParaGuardar(usuarioId, progreso, unicos, marca);
    crearClienteNavegador()
      .from("progreso_guias")
      .upsert(filas, { onConflict: "usuario_id,guia_id" })
      .then(({ error }) => {
        if (error && esTablaAusente(error)) remotoRef.current = false;
      });
  }

  function despachar(accion) {
    const rutaActual = rutaRef.current;
    const aplicado = reducirGuias({ ...estadoRef.current, ruta: rutaActual }, accion);
    estadoRef.current = { ...aplicado.estado, ruta: aplicado.estado.ruta || rutaActual };
    persistir(aplicado.persistir);
    publicar();
    if (aplicado.efecto?.tipo === "navegar" && aplicado.efecto.href !== rutaActual) {
      router.push(aplicado.efecto.href);
    }
  }

  const despacharRef = useRef(despachar);
  useLayoutEffect(() => {
    despacharRef.current = despachar;
  });

  useEffect(() => {
    let vivo = true;
    listoRef.current = false;
    remotoRef.current = true;

    const supabase = crearClienteNavegador();
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") {
        limpiarGuiasLocales();
        reiniciarTiendaGuias();
      }
    });

    async function cargar() {
      const [espacios, remoto] = await Promise.all([
        supabase.from("espacios").select("id", { count: "exact", head: true }),
        supabase
          .from("progreso_guias")
          .select("guia_id, version, estado, paso_id, actualizado_en")
          .eq("usuario_id", usuarioId),
      ]);
      if (!vivo) return;
      if (remoto.error && esTablaAusente(remoto.error)) remotoRef.current = false;
      const tieneEspacios = Boolean(espacios.error) || (espacios.count || 0) > 0;
      const progreso = fusionarProgreso(leerLocal(usuarioId), remoto.error ? [] : remoto.data);
      const hidratado = reducirGuias(estadoInicialGuias(false), {
        tipo: "hidratar",
        progreso,
        tieneEspacios,
        ruta: estadoRef.current.ruta || ruta,
      });
      const sincronizado = reducirGuias(hidratado.estado, {
        tipo: "ruta",
        ruta: hidratado.estado.ruta,
      });
      estadoRef.current = sincronizado.estado;
      listoRef.current = true;
      guardarLocal(usuarioId, sincronizado.estado.progreso);
      if (sincronizado.persistir.length && remotoRef.current) {
        const marca = new Date().toISOString();
        const filas = filasParaGuardar(usuarioId, sincronizado.estado.progreso, sincronizado.persistir, marca);
        supabase.from("progreso_guias").upsert(filas, { onConflict: "usuario_id,guia_id" });
      }
      publicar();
    }

    cargar();

    function alEvento(evento) {
      const detalle = evento.detail || {};
      if (detalle.tipo === "wizard-paso") {
        despacharRef.current({ tipo: "wizard", paso: detalle.paso, error: detalle.error || "" });
      } else if (detalle.tipo === "guardado-error") {
        despacharRef.current({ tipo: "guardado-error", mensaje: detalle.mensaje || "" });
      }
    }
    window.addEventListener(EVENTO_GUIA, alEvento);

    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_GUIA, alEvento);
      suscripcion.subscription.unsubscribe();
      reiniciarTiendaGuias();
    };
    // La ruta se sincroniza en el efecto siguiente. Recargar al cambiar de usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  useEffect(() => {
    const anterior = estadoRef.current.ruta;
    if (!listoRef.current) {
      estadoRef.current = { ...estadoRef.current, ruta };
      return undefined;
    }
    if (anterior === ruta) return undefined;
    const destino = ruta;
    const desde = anterior;
    let vivo = true;
    queueMicrotask(() => {
      if (!vivo) return;
      if (rutaCoincide("cultivos-nuevo", desde) && rutaCoincide("cultivo-creado", destino)) {
        despacharRef.current({ tipo: "guardado-ok" });
      }
      despacharRef.current({ tipo: "ruta", ruta: destino });
    });
    return () => {
      vivo = false;
    };
  }, [ruta]);

  const estado = {
    tieneEspacios: guias.tieneEspacios,
    progreso: guias.progreso,
    activa: guias.activa,
    aviso: guias.aviso,
    ruta,
    pasoWizard: "",
  };
  const mostrarBienvenida =
    guias.listo &&
    guias.progreso &&
    esRutaApp(ruta) &&
    ruta !== "/onboarding" &&
    debeOfrecerBienvenida({
      tieneEspacios: guias.tieneEspacios,
      progreso: guias.progreso,
      activa: guias.activa,
    });

  return (
    <>
      <ModalConfirmacion
        abierto={mostrarBienvenida}
        onCerrar={() => {
          if (confirmarBienvenida.current) {
            confirmarBienvenida.current = false;
            return;
          }
          despachar({ tipo: "posponer-bienvenida" });
        }}
        onConfirmar={() => {
          confirmarBienvenida.current = true;
          despachar({ tipo: "aceptar-bienvenida" });
        }}
        titulo="¡Qué bueno tenerte acá!"
        descripcion="Antes de empezar, Flora quiere enseñarte cómo usar Enflora de manera sencilla y rápida."
        textoConfirmar="Siguiente"
        textoCancelar="Saltar"
        icono={
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/images/flora-saluda.png" alt="" />
        }
        className="modal--guia"
      />
      {estado.activa && esRutaApp(ruta) ? (
        <SpotlightGuia
          estado={estado}
          onSiguiente={() => despachar({ tipo: "siguiente" })}
          onAtras={() => despachar({ tipo: "atras" })}
          onSaltar={() => despachar({ tipo: "saltar" })}
          onCerrar={() => despachar({ tipo: "pausar" })}
          onAusente={() => despachar({ tipo: "objetivo-ausente" })}
          onOpcional={() => despachar({ tipo: "saltar-opcional" })}
        />
      ) : null}
    </>
  );
}
