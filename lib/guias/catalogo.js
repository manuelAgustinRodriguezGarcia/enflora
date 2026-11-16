export const VERSION_GUIAS = 1;

export const ID_BIENVENIDA = "bienvenida";
export const ID_ESPACIO = "crear-espacio";
export const ID_UNIDADES = "unidades-plantas";
export const ID_FLORA = "conocer-flora";

export const EJEMPLO_FLORA = "¿Cómo vienen mis plantas?";

export const ESTADOS_GUIA = ["no_iniciado", "en_progreso", "pausado", "completado", "omitido"];

export const GUIAS = [
  {
    id: ID_ESPACIO,
    version: VERSION_GUIAS,
    titulo: "Crear un espacio",
    descripcion: "Aprendé a crear el lugar donde organizás tus cultivos.",
    pasos: [
      {
        id: "crear-boton",
        titulo: "Tu espacio",
        icono: "cultivos",
        texto:
          "Primero vamos a crear tu espacio de cultivo. Acá vas a organizar todo lo que cultivás.",
        objetivos: ["guia-crear-cultivo"],
        avance: { tipo: "ruta", valor: "cultivos-nuevo" },
        manualEnExplicativo: true,
        lado: "top",
      },
      {
        id: "tipo-espacio",
        titulo: "Interior o exterior",
        texto:
          "Elegí interior o exterior. Enflora usa esa elección para proponerte carpas y salas, o invernadero y aire libre.",
        objetivos: ["guia-espacio-tipo"],
        avance: { tipo: "manual" },
        cuando: "espacio",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "nombre-espacio",
        titulo: "El nombre",
        texto: "Poné un nombre para reconocer este espacio entre tus cultivos.",
        objetivos: ["guia-espacio-nombre"],
        avance: { tipo: "manual" },
        cuando: "espacio",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "organizacion",
        titulo: "Cómo se organiza",
        texto:
          "El espacio agrupa las unidades y las plantas. Cuando el nombre y el tipo estén listos, tocá Continuar. Si falta un dato, el asistente se queda en este paso.",
        textoExplicativo:
          "El espacio agrupa las unidades y las plantas. Si querés crear uno nuevo, usá el flujo normal. Esta guía no guarda datos por vos.",
        objetivos: ["guia-asistente-continuar"],
        avance: { tipo: "wizard", valor: "tipo_unidad" },
        manualEnExplicativo: true,
        cuando: "espacio",
        requiereRuta: "cultivos-nuevo",
      },
    ],
  },
  {
    id: ID_UNIDADES,
    version: VERSION_GUIAS,
    titulo: "Configurar unidades y plantas",
    descripcion: "Recorré cómo se arma una unidad y cómo se dan de alta las plantas.",
    pasos: [
      {
        id: "tipo-unidad",
        titulo: "La unidad",
        texto:
          "Una unidad es el lugar donde viven tus plantas. Puede ser una carpa, una sala, un invernadero o un espacio al aire libre.",
        objetivos: ["guia-unidad-tipo"],
        avance: { tipo: "wizard", valor: "cantidad_unidades" },
        manualEnExplicativo: true,
        cuando: "tipo_unidad",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "nombres-unidades",
        titulo: "Nombre y cantidad",
        texto: "Indicá cuántas unidades hay y ajustá el nombre de cada una si hace falta.",
        objetivos: ["guia-unidad-cantidad"],
        avance: { tipo: "wizard", valor: "cantidad_plantas" },
        manualEnExplicativo: true,
        cuando: "cantidad_unidades",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "cantidad-plantas",
        titulo: "Tus plantas",
        texto:
          "Ahora agregá tus plantas. Enflora va a permitirte seguir su evolución y registrar todo lo que sucede.",
        objetivos: ["guia-plantas-cantidad"],
        avance: { tipo: "wizard", valor: "configuracion" },
        manualEnExplicativo: true,
        cuando: "cantidad_plantas",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "modo-plantas",
        titulo: "Cómo se configuran",
        texto: "Podés compartir genética o método entre las plantas, o definir cada una por separado.",
        objetivos: ["guia-plantas-modo"],
        avance: { tipo: "manual" },
        cuando: "configuracion",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "metodo-plantas",
        titulo: "Método de cultivo",
        texto: "Elegí el método. Si corresponde, Enflora te va a pedir el sustrato.",
        objetivos: ["guia-plantas-metodo"],
        avance: { tipo: "manual" },
        cuando: "configuracion",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "sustrato-plantas",
        titulo: "Sustrato",
        texto: "Si el método usa sustrato, anotalo acá. Si no usa, este paso no aparece.",
        objetivos: ["guia-plantas-sustrato"],
        avance: { tipo: "manual" },
        cuando: "configuracion",
        requiereRuta: "cultivos-nuevo",
        opcional: true,
      },
      {
        id: "etapa-plantas",
        titulo: "Datos iniciales",
        texto:
          "Indicá la etapa en la que están las plantas y desde cuándo. Así el seguimiento arranca con datos reales.",
        objetivos: ["guia-plantas-etapa"],
        avance: { tipo: "wizard", valor: "resumen" },
        manualEnExplicativo: true,
        cuando: "etapa",
        requiereRuta: "cultivos-nuevo",
      },
      {
        id: "replicar",
        titulo: "Varias unidades",
        texto: "Si tenés más de una unidad, podés repetir la configuración o ajustar cada una.",
        objetivos: ["guia-asistente-continuar"],
        avance: { tipo: "wizard", valor: "resumen" },
        manualEnExplicativo: true,
        cuando: "cierre_unidad",
        requiereRuta: "cultivos-nuevo",
        opcional: true,
      },
      {
        id: "confirmar",
        titulo: "Listo para guardar",
        texto:
          "¡Perfecto! Ya tenés tu cultivo listo para comenzar a registrar. Tocá Crear espacio cuando quieras guardarlo.",
        textoExplicativo:
          "¡Perfecto! Ya viste cómo se confirma un cultivo. Si decidís crear uno nuevo, el guardado es el del asistente. La guía no inventa datos.",
        objetivos: ["guia-resumen-confirmar"],
        avance: { tipo: "guardado" },
        manualEnExplicativo: true,
        cuando: "resumen",
        requiereRuta: "cultivos-nuevo",
      },
    ],
  },
  {
    id: ID_FLORA,
    version: VERSION_GUIAS,
    titulo: "Conocer a Flora",
    descripcion: "Aprendé dónde preguntarle a Flora y qué puede mirar de tus cultivos.",
    pasos: [
      {
        id: "flora-nav",
        titulo: "Flora",
        texto:
          "¡Ahora te presento a Flora! Tu asistente de cultivo, que puede ayudarte a entender lo que sucede con tus plantas.",
        objetivos: ["guia-flora-nav"],
        avance: { tipo: "ruta", valor: "flora" },
        lado: "top",
      },
      {
        id: "flora-input",
        titulo: "Preguntale",
        texto:
          "Acá podés hacerle preguntas sobre tus cultivos. Flora puede consultar información registrada para ayudarte con respuestas contextualizadas.",
        ejemplo: EJEMPLO_FLORA,
        objetivos: ["guia-flora-input"],
        avance: { tipo: "manual" },
        requiereRuta: "flora",
        lado: "top",
      },
      {
        id: "flora-datos",
        titulo: "Qué puede mirar",
        texto:
          "Flora puede trabajar con los registros, las mediciones y otros datos que ya tengas, según las herramientas habilitadas. No afirma conocer datos que todavía no registraste.",
        objetivos: ["guia-flora-input"],
        avance: { tipo: "manual" },
        requiereRuta: "flora",
        lado: "top",
      },
      {
        id: "flora-cierre",
        titulo: "¡Ya conocés lo esencial de Enflora!",
        texto: "Ahora podés empezar a registrar tus cultivos y consultar a Flora cuando lo necesites.",
        objetivos: [],
        avance: { tipo: "manual" },
        textoBoton: "Ir a mis cultivos",
        centrado: true,
      },
    ],
  },
];

const POR_ID = new Map(GUIAS.map((guia) => [guia.id, guia]));

export function guiaPorId(id) {
  const guia = POR_ID.get(id);
  if (!guia) {
    throw new Error(`Guía desconocida: ${id}`);
  }
  return guia;
}

export function listarGuias() {
  return GUIAS.map((guia) => ({
    id: guia.id,
    version: guia.version,
    titulo: guia.titulo,
    descripcion: guia.descripcion,
    cantidadPasos: guia.pasos.length,
  }));
}

export function progresoInicial() {
  const progreso = {
    [ID_BIENVENIDA]: { estado: "no_iniciado", pasoId: null, version: VERSION_GUIAS },
  };
  for (const guia of GUIAS) {
    progreso[guia.id] = { estado: "no_iniciado", pasoId: null, version: guia.version };
  }
  return progreso;
}

export function rutaDeInicio(guiaId, tieneEspacios, rutaActual = "") {
  const ruta = String(rutaActual || "").split("?")[0];
  if (guiaId === ID_ESPACIO) {
    if (ruta === "/inicio" || ruta === "/cultivos" || ruta === "/cultivos/nuevo") return null;
    return "/cultivos";
  }
  if (guiaId === ID_UNIDADES) {
    if (!tieneEspacios && ruta !== "/cultivos/nuevo") return "/cultivos/nuevo";
    if (tieneEspacios && ruta !== "/cultivos" && ruta !== "/cultivos/nuevo") return "/cultivos";
    return null;
  }
  return null;
}

export function rutaCoincide(valor, ruta) {
  const path = String(ruta || "").split("?")[0];
  if (valor === "cultivos-nuevo") return path === "/cultivos/nuevo";
  if (valor === "flora") return path === "/flora" || path.startsWith("/flora/");
  if (valor === "cultivo-creado") {
    return /^\/cultivos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
  }
  return false;
}

export function esEstadoGuia(valor) {
  return ESTADOS_GUIA.includes(valor);
}
