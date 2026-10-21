export const GIRO_MINIMO_TUQUERO = 6;

export const GIRO_MINIMO_PICADOR = 11;

export const PESOS_PROVISIONALES = true;

export const PESOS_RULETA_FINAL = {
  GRINDER: 1,
  TUBE: 1,
  BONUS_PACK: 1,
  CONSOLATION: 1,
};

export const CANTIDADES_PREMIO = {
  SAFE_PACK: { stickers: 2, filtros: 2 },
  GRINDER: { picadores: 1 },
  TUBE: { tuqueros: 1 },
  BONUS_PACK: { stickers: 4, filtros: 3 },
  CONSOLATION: { stickers: 1, filtros: 1 },
};

export const AVISO_PESOS_PROVISIONALES =
  "Estas probabilidades son provisorias y se reparten entre los premios disponibles en este giro.";

const NOMBRES_LEYENDA = {
  GRINDER: "Picador",
  TUBE: "Tuquero",
  BONUS_PACK: "Pack especial",
  CONSOLATION: "Nada",
};

const MOTIVOS = {
  consecutivo: "no sale después del premio especial anterior",
  stock: "sin stock",
  peso: "no participa",
};

const MOTIVOS_GIRO = {
  GRINDER: `entra desde el giro ${GIRO_MINIMO_PICADOR}`,
  TUBE: `entra desde el giro ${GIRO_MINIMO_TUQUERO}`,
};

export function describirLeyenda(elegibles) {
  const lista = Array.isArray(elegibles) ? elegibles : [];
  const total = lista.reduce((suma, item) => suma + (Number(item.peso) > 0 ? Number(item.peso) : 0), 0);
  if (total <= 0) return "No hay premios disponibles para arriesgar en este giro.";

  return lista
    .map((item) => {
      const nombre = NOMBRES_LEYENDA[item.id] || item.id;
      const peso = Number(item.peso);
      if (!(peso > 0)) {
        const detalle = item.motivo === "giro" ? MOTIVOS_GIRO[item.id] : MOTIVOS[item.motivo] || "no disponible";
        return `${nombre}: no sale (${detalle})`;
      }
      const porcentaje = (peso / total) * 100;
      const texto = Number.isInteger(porcentaje)
        ? String(porcentaje)
        : porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 1 });
      return `${nombre}: ${texto}%`;
    })
    .join(" · ");
}
