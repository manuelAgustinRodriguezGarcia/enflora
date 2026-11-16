import {
  ESTADOS_GUIA,
  GUIAS,
  ID_BIENVENIDA,
  ID_ESPACIO,
  ID_FLORA,
  ID_UNIDADES,
  VERSION_GUIAS,
  esEstadoGuia,
  guiaPorId,
  progresoInicial,
  rutaCoincide,
  rutaDeInicio,
} from "@/lib/guias/catalogo";

const PASO_PENDIENTE = "pendiente-guardado";

export function filaGuia(estado, pasoId, version = VERSION_GUIAS) {
  return { estado, pasoId, version };
}

export function normalizarProgreso(entrada) {
  const base = progresoInicial();
  if (!entrada || typeof entrada !== "object") return base;

  const bienvenida = entrada[ID_BIENVENIDA];
  if (bienvenida && esEstadoGuia(bienvenida.estado)) {
    base[ID_BIENVENIDA] = filaGuia(bienvenida.estado, null, VERSION_GUIAS);
  }

  for (const guia of GUIAS) {
    const fila = entrada[guia.id];
    if (!fila || fila.version !== guia.version || !esEstadoGuia(fila.estado)) continue;
    const pasoId = typeof fila.pasoId === "string" && fila.pasoId ? fila.pasoId : null;
    base[guia.id] = filaGuia(fila.estado, pasoId, guia.version);
  }

  return base;
}

export function debeOfrecerBienvenida({ tieneEspacios, progreso, activa }) {
  if (tieneEspacios || activa) return false;
  const bienvenida = progreso?.[ID_BIENVENIDA];
  if (!bienvenida) return true;
  return bienvenida.estado === "no_iniciado";
}

export function estadoInicialGuias(tieneEspacios = false) {
  return {
    tieneEspacios: Boolean(tieneEspacios),
    ruta: "",
    pasoWizard: "",
    progreso: progresoInicial(),
    activa: null,
    aviso: "",
  };
}

function resultado(estado, efecto = null, persistir = []) {
  return { estado, efecto, persistir };
}

function conGuia(estado, guiaId, parcial) {
  const actual = estado.progreso[guiaId];
  return {
    ...estado,
    progreso: {
      ...estado.progreso,
      [guiaId]: { ...actual, ...parcial },
    },
  };
}

function indiceDePaso(guia, pasoId) {
  if (!pasoId || pasoId === PASO_PENDIENTE) return 0;
  const indice = guia.pasos.findIndex((paso) => paso.id === pasoId);
  return indice < 0 ? 0 : indice;
}

function modoDe(guiaId, tieneEspacios) {
  if (guiaId === ID_FLORA) return "explicativo";
  return tieneEspacios ? "explicativo" : "creacion";
}

function activar(estado, guiaId, indice, reiniciar) {
  const guia = guiaPorId(guiaId);
  const guardado = estado.progreso[guiaId];
  const desde = reiniciar ? 0 : indiceDePaso(guia, guardado.pasoId);
  let siguiente = estado;
  if (estado.activa && estado.activa.guiaId !== guiaId) {
    const previa = estado.activa.guiaId;
    const fila = estado.progreso[previa];
    if (fila.estado === "en_progreso") {
      siguiente = conGuia(siguiente, previa, { estado: "pausado" });
    }
  }
  const modo = modoDe(guiaId, siguiente.tieneEspacios);
  const paso = guia.pasos[desde];
  if (siguiente.progreso[ID_BIENVENIDA].estado === "no_iniciado") {
    siguiente = conGuia(siguiente, ID_BIENVENIDA, { estado: "completado", pasoId: null });
  }
  siguiente = conGuia(siguiente, guiaId, { estado: "en_progreso", pasoId: paso.id, version: guia.version });
  siguiente = {
    ...siguiente,
    aviso: "",
    activa: { guiaId, indice: desde, modo, forzarManual: false },
  };
  const destino = rutaDeInicio(guiaId, siguiente.tieneEspacios, siguiente.ruta);
  const efecto = destino && !rutaYaEn(destino, siguiente.ruta) ? { tipo: "navegar", href: destino } : null;
  return resultado(siguiente, efecto, [guiaId, ID_BIENVENIDA, estado.activa?.guiaId].filter(Boolean));
}

function rutaYaEn(destino, ruta) {
  if (destino === "/cultivos/nuevo") return ruta === "/cultivos/nuevo";
  if (destino === "/cultivos") return ruta === "/cultivos";
  return ruta === destino;
}

export function pasoVisible(estado) {
  if (!estado.activa) return null;
  const guia = guiaPorId(estado.activa.guiaId);
  return guia.pasos[estado.activa.indice] || null;
}

export function botonesDelPaso(paso, indice, pasos, modo, forzarManual) {
  if (!paso) {
    return { siguiente: false, finalizar: false, atras: false, saltar: false, cerrar: false };
  }
  const manual = permiteManual(paso, indice, pasos, modo, forzarManual);
  const esUltimo = indice >= pasos.length - 1;
  return {
    siguiente: manual && !esUltimo,
    finalizar: manual && esUltimo,
    atras: indice > 0,
    saltar: true,
    cerrar: true,
    textoBoton: paso.textoBoton || (esUltimo ? "Finalizar" : "Siguiente"),
  };
}

function permiteManual(paso, indice, pasos, modo, forzarManual) {
  if (forzarManual) {
    const proximo = pasos[indice + 1];
    if (proximo) return true;
    return paso.avance.tipo === "manual" || modo === "explicativo";
  }
  const explicativo = modo === "explicativo" && (paso.avance.tipo === "manual" || paso.manualEnExplicativo);
  const manual = paso.avance.tipo === "manual";
  if (!explicativo && !manual) return false;
  if (modo === "creacion" && paso.cuando) {
    const proximo = pasos[indice + 1];
    if (proximo && proximo.cuando !== paso.cuando) return false;
  }
  return true;
}

export function bloqueaInterfaz() {
  return false;
}

function avanzarIndice(estado) {
  const activa = estado.activa;
  if (!activa) return resultado(estado);
  const guia = guiaPorId(activa.guiaId);
  const siguienteIndice = activa.indice + 1;
  if (siguienteIndice < guia.pasos.length) {
    const paso = guia.pasos[siguienteIndice];
    const conIndice = {
      ...conGuia(estado, activa.guiaId, { estado: "en_progreso", pasoId: paso.id }),
      activa: { ...activa, indice: siguienteIndice, forzarManual: false },
      aviso: "",
    };
    return resultado(conIndice, null, [activa.guiaId]);
  }
  return cerrarGuia(estado, "completado");
}

function cerrarGuia(estado, estadoFinal) {
  const activa = estado.activa;
  if (!activa) return resultado(estado);
  let siguiente = conGuia(estado, activa.guiaId, {
    estado: estadoFinal,
    pasoId: pasoVisible(estado)?.id || estado.progreso[activa.guiaId].pasoId,
  });
  const efecto =
    activa.guiaId === ID_FLORA && estadoFinal === "completado"
      ? { tipo: "navegar", href: "/cultivos" }
      : null;
  siguiente = { ...siguiente, activa: null, aviso: "" };
  return resultado(siguiente, efecto, [activa.guiaId]);
}

function encadenarUnidades(estado) {
  let siguiente = conGuia(estado, ID_ESPACIO, { estado: "pausado", pasoId: PASO_PENDIENTE });
  const guia = guiaPorId(ID_UNIDADES);
  const paso = guia.pasos[0];
  const modo = estado.activa?.modo || modoDe(ID_UNIDADES, estado.tieneEspacios);
  siguiente = conGuia(siguiente, ID_UNIDADES, { estado: "en_progreso", pasoId: paso.id });
  siguiente = {
    ...siguiente,
    aviso: "",
    activa: { guiaId: ID_UNIDADES, indice: 0, modo, forzarManual: false },
  };
  return resultado(siguiente, null, [ID_ESPACIO, ID_UNIDADES]);
}

function sincronizarUnidades(estado, pasoWizard) {
  const guia = guiaPorId(ID_UNIDADES);
  const activa = estado.activa;
  const actual = guia.pasos[activa.indice];
  if (actual?.cuando === pasoWizard) {
    return resultado({ ...estado, pasoWizard, aviso: "" });
  }
  const indice = guia.pasos.findIndex((paso) => paso.cuando === pasoWizard);
  if (indice < 0) {
    return resultado({ ...estado, pasoWizard, aviso: "" });
  }
  const paso = guia.pasos[indice];
  const siguiente = {
    ...conGuia(estado, ID_UNIDADES, { estado: "en_progreso", pasoId: paso.id }),
    pasoWizard,
    aviso: "",
    activa: { ...activa, indice, forzarManual: false },
  };
  return resultado(siguiente, null, [ID_UNIDADES]);
}

function incompatible(paso, ruta, modo) {
  if (!paso || modo === "explicativo") return false;
  if (paso.avance?.tipo === "ruta") return false;
  if (!paso.requiereRuta) return false;
  return !rutaCoincide(paso.requiereRuta, ruta);
}

function completarPorGuardado(estado) {
  const paso = pasoVisible(estado);
  const enCurso =
    estado.progreso[ID_UNIDADES].estado === "en_progreso" ||
    estado.progreso[ID_UNIDADES].estado === "pausado" ||
    estado.progreso[ID_ESPACIO].pasoId === PASO_PENDIENTE;
  const espera = paso?.avance?.tipo === "guardado" || (estado.pasoWizard === "resumen" && enCurso);
  if (!espera) return resultado(estado);

  let siguiente = { ...estado, aviso: "", tieneEspacios: true };
  const persistir = [];
  for (const id of [ID_ESPACIO, ID_UNIDADES]) {
    const fila = siguiente.progreso[id];
    if (fila.estado === "en_progreso" || fila.estado === "pausado") {
      siguiente = conGuia(siguiente, id, { estado: "completado", pasoId: fila.pasoId });
      persistir.push(id);
    }
  }
  const eraCreacion = estado.activa?.modo === "creacion" || estado.progreso[ID_ESPACIO].pasoId === PASO_PENDIENTE;
  const flora = siguiente.progreso[ID_FLORA];
  if (eraCreacion && flora.estado === "no_iniciado") {
    const guia = guiaPorId(ID_FLORA);
    siguiente = conGuia(siguiente, ID_FLORA, { estado: "en_progreso", pasoId: guia.pasos[0].id });
    siguiente = {
      ...siguiente,
      activa: { guiaId: ID_FLORA, indice: 0, modo: "explicativo", forzarManual: false },
    };
    persistir.push(ID_FLORA);
  } else {
    siguiente = { ...siguiente, activa: null };
  }
  return resultado(siguiente, null, persistir);
}

function aplicarRuta(estado, ruta) {
  let siguiente = { ...estado, ruta };
  const activa = siguiente.activa;
  if (!activa) return resultado(siguiente);
  const guia = guiaPorId(activa.guiaId);
  const paso = guia.pasos[activa.indice];
  if (!paso) return resultado(siguiente);

  if (paso.avance.tipo === "ruta" && rutaCoincide(paso.avance.valor, ruta)) {
    return avanzarIndice(siguiente);
  }

  if (incompatible(paso, ruta, activa.modo)) {
    const pausado = conGuia(siguiente, activa.guiaId, { estado: "pausado", pasoId: paso.id });
    return resultado({ ...pausado, activa: null, aviso: "" }, null, [activa.guiaId]);
  }

  return resultado(siguiente);
}

export function reducirGuias(estado, accion) {
  switch (accion.tipo) {
    case "hidratar": {
      const progreso = normalizarProgreso(accion.progreso);
      const tieneEspacios = Boolean(accion.tieneEspacios);
      const base = {
        ...estadoInicialGuias(tieneEspacios),
        ruta: accion.ruta || "",
        progreso,
      };
      const orden = [ID_UNIDADES, ID_ESPACIO, ID_FLORA];
      const guiaId = orden.find((id) => progreso[id].estado === "en_progreso");
      if (!guiaId) return resultado(base);
      const guia = guiaPorId(guiaId);
      const indice = indiceDePaso(guia, progreso[guiaId].pasoId);
      return resultado({
        ...base,
        activa: {
          guiaId,
          indice,
          modo: modoDe(guiaId, tieneEspacios),
          forzarManual: false,
        },
      });
    }
    case "aceptar-bienvenida": {
      const conBienvenida = conGuia(estado, ID_BIENVENIDA, { estado: "completado", pasoId: null });
      return activar(conBienvenida, ID_ESPACIO, 0, true);
    }
    case "posponer-bienvenida": {
      if (estado.progreso[ID_BIENVENIDA].estado !== "no_iniciado") return resultado(estado);
      return resultado(conGuia(estado, ID_BIENVENIDA, { estado: "omitido", pasoId: null }), null, [ID_BIENVENIDA]);
    }
    case "iniciar":
      return activar(estado, accion.guiaId, 0, accion.reiniciar !== false);
    case "pausar": {
      if (!estado.activa) return resultado(estado);
      const paso = pasoVisible(estado);
      const pausado = conGuia(estado, estado.activa.guiaId, {
        estado: "pausado",
        pasoId: paso?.id || null,
      });
      return resultado({ ...pausado, activa: null }, null, [estado.activa.guiaId]);
    }
    case "saltar": {
      if (!estado.activa) return resultado(estado);
      return cerrarGuia(estado, "omitido");
    }
    case "siguiente": {
      const paso = pasoVisible(estado);
      if (!paso || !estado.activa) return resultado(estado);
      const guia = guiaPorId(estado.activa.guiaId);
      const botones = botonesDelPaso(
        paso,
        estado.activa.indice,
        guia.pasos,
        estado.activa.modo,
        estado.activa.forzarManual
      );
      if (!botones.siguiente && !botones.finalizar) return resultado(estado);
      return avanzarIndice(estado);
    }
    case "atras": {
      if (!estado.activa || estado.activa.indice <= 0) return resultado(estado);
      const guia = guiaPorId(estado.activa.guiaId);
      const indice = estado.activa.indice - 1;
      const paso = guia.pasos[indice];
      const siguiente = {
        ...conGuia(estado, estado.activa.guiaId, { estado: "en_progreso", pasoId: paso.id }),
        activa: { ...estado.activa, indice, forzarManual: false },
        aviso: "",
      };
      return resultado(siguiente, null, [estado.activa.guiaId]);
    }
    case "wizard": {
      if (accion.error) {
        return resultado({ ...estado, pasoWizard: accion.paso || estado.pasoWizard, aviso: accion.error });
      }
      const conPaso = { ...estado, pasoWizard: accion.paso || "", aviso: "" };
      if (!conPaso.activa) return resultado(conPaso);
      if (
        conPaso.activa.guiaId === ID_ESPACIO &&
        accion.paso &&
        accion.paso !== "espacio"
      ) {
        return encadenarUnidades(conPaso);
      }
      if (conPaso.activa.guiaId === ID_UNIDADES && accion.paso) {
        const actual = pasoVisible(conPaso);
        if (actual?.avance?.tipo === "wizard" && actual.avance.valor === accion.paso) {
          const avanzado = avanzarIndice(conPaso);
          if (avanzado.estado.activa?.guiaId === ID_UNIDADES) {
            return sincronizarUnidades(avanzado.estado, accion.paso);
          }
          return avanzado;
        }
        return sincronizarUnidades(conPaso, accion.paso);
      }
      return resultado(conPaso);
    }
    case "ruta":
      return aplicarRuta(estado, accion.ruta || "");
    case "guardado-ok":
      return completarPorGuardado(estado);
    case "guardado-error":
      return resultado({
        ...estado,
        aviso: accion.mensaje || "No se pudo guardar el cultivo.",
      });
    case "objetivo-ausente": {
      if (!estado.activa) return resultado(estado);
      return resultado({
        ...estado,
        activa: { ...estado.activa, forzarManual: true },
      });
    }
    case "saltar-opcional": {
      const paso = pasoVisible(estado);
      if (!paso?.opcional || !estado.activa) return resultado(estado);
      return avanzarIndice({
        ...estado,
        activa: { ...estado.activa, forzarManual: true },
      });
    }
    default: {
      const nunca = accion.tipo;
      throw new Error(`Acción de guía no contemplada: ${nunca}`);
    }
  }
}

export function etiquetaEstado(estado) {
  switch (estado) {
    case "no_iniciado":
      return "Sin empezar";
    case "en_progreso":
      return "En progreso";
    case "pausado":
      return "En pausa";
    case "completado":
      return "Completada";
    case "omitido":
      return "Omitida";
    default: {
      const nunca = estado;
      throw new Error(`Estado de guía no contemplado: ${nunca}`);
    }
  }
}

export function textoAccionGuia(estado) {
  switch (estado) {
    case "en_progreso":
    case "pausado":
      return "Continuar";
    case "completado":
    case "omitido":
      return "Repetir";
    case "no_iniciado":
      return "Empezar";
    default: {
      const nunca = estado;
      throw new Error(`Estado de guía no contemplado: ${nunca}`);
    }
  }
}

export function reiniciaAlIniciar(estado) {
  return estado === "completado" || estado === "omitido" || estado === "no_iniciado";
}

export { ESTADOS_GUIA, PASO_PENDIENTE };
