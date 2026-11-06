import { etiquetaEtapa } from "@/lib/etapas";
import { etiquetaMetodo } from "@/lib/metodos";
import {
  esUnidadPorLitro,
  etiquetaTipoProducto,
  redondearCantidad,
  textoMedida,
  cantidadesEquivalentes,
} from "@/lib/mezclas/calculo";
import { MEDICIONES_MEZCLA } from "@/lib/mezclas/reglas";

export function mezclaDeRegistro(registro) {
  const valor = registro?.registro_mezclas;
  if (!valor) return null;
  if (Array.isArray(valor)) return valor[0] || null;
  return valor;
}

export function componentesDeMezcla(mezcla) {
  return [...(mezcla?.registro_mezcla_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
}

export function textoComponenteHistorial(componente) {
  const nombre = [componente?.nombre_producto, componente?.fabricante].filter(Boolean).join(" · ");
  const aplicado = textoMedida(componente?.cantidad_aplicada, componente?.unidad_aplicada);
  const receta = textoMedida(componente?.cantidad_receta, componente?.unidad_receta);
  const misma =
    componente?.unidad_aplicada === componente?.unidad_receta &&
    cantidadesEquivalentes(componente?.cantidad_aplicada, componente?.cantidad_receta);
  if (misma && aplicado) return `${nombre} · ${aplicado}`;
  const porLitro = esUnidadPorLitro(componente?.unidad_receta);
  if (porLitro && receta) return `${nombre} · ${aplicado} (${receta})`;
  const distinta =
    componente?.unidad_receta &&
    (componente.unidad_aplicada !== componente.unidad_receta ||
      !cantidadesEquivalentes(componente.cantidad_aplicada, componente.cantidad_receta));
  if (distinta && receta) return `${nombre} · ${aplicado} · mezcla ${receta}`;
  return `${nombre} · ${aplicado}`;
}

export function textoVolumenHistorial(mezcla) {
  return textoMedida(mezcla?.volumen_agua, mezcla?.unidad_volumen);
}

export function textoResumenReceta(receta, productos = []) {
  const componentes = [...(receta?.componentes || receta?.receta_componentes || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  const nombres = componentes
    .map((item) => {
      const producto = productos.find((entrada) => entrada.id === item.producto_id);
      if (producto?.nombre) return producto.nombre;
      return item.producto_id ? "Producto" : "";
    })
    .filter(Boolean);
  const volumen = receta?.volumen_agua;
  const agua =
    volumen === null || volumen === undefined || volumen === ""
      ? ""
      : textoMedida(volumen, receta?.unidad_volumen);
  const lista = nombres.join(", ");
  const aguaTexto = agua ? `${agua} agua` : "";
  if (lista && aguaTexto) return `${lista} + ${aguaTexto}`;
  return lista || aguaTexto;
}

function textoMedicion(valor, unidad) {
  const numero = redondearCantidad(valor, unidad === "ppm" ? 2 : 3);
  if (numero === null) return "";
  return unidad ? `${numero} ${unidad}` : String(numero);
}

export function medicionesDeMezcla(mezcla) {
  if (!mezcla) return [];
  return MEDICIONES_MEZCLA.filter((item) => {
    const valor = mezcla[item.campo];
    return valor !== null && valor !== undefined && valor !== "";
  }).map((item) => ({
    clave: item.claveNativa,
    nombre: item.nombre,
    texto: textoMedicion(mezcla[item.campo], item.unidad),
  }));
}

export function parametrosSinMedicionRepetida(parametros, mezcla) {
  if (!mezcla) return parametros || [];
  return (parametros || []).filter((fila) => {
    if (fila?.origen !== "nativa") return true;
    const medicion = MEDICIONES_MEZCLA.find((item) => item.claveNativa === fila.clave_nativa);
    if (!medicion) return true;
    const valor = mezcla[medicion.campo];
    if (valor === null || valor === undefined || valor === "") return true;
    return !cantidadesEquivalentes(fila.valor_numero, valor);
  });
}

export function detalleMezcla(mezcla) {
  if (!mezcla) return null;
  const extras = [
    mezcla.metodo ? etiquetaMetodo(mezcla.metodo) : "",
    mezcla.etapa ? etiquetaEtapa(mezcla.etapa) : "",
  ].filter((item) => item && item !== "—");
  return {
    titulo: mezcla.nombre_receta || "Agua preparada",
    volumen: textoVolumenHistorial(mezcla),
    ajustada: Boolean(mezcla.ajustada),
    extras,
    componentes: componentesDeMezcla(mezcla).map((item) => ({
      id: item.id,
      texto: textoComponenteHistorial(item),
      tipo: etiquetaTipoProducto(item.tipo_producto),
    })),
    mediciones: medicionesDeMezcla(mezcla),
  };
}
