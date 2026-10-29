const curva = [0.22, 1, 0.36, 1];

export const transicionRapida = { duration: 0.16, ease: curva };

export const transicionVista = { duration: 0.22, ease: curva };

export const toque = { scale: 0.98 };

export const toqueFab = { scale: 0.92 };

export const transicionToque = { duration: 0.12, ease: curva };

export const transicionToqueFab = { duration: 0.14, ease: curva };

export const entradaVista = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: transicionVista,
};

export const variantesPaso = {
  entrar: (direccion) => ({ opacity: 0, y: direccion >= 0 ? 8 : -8 }),
  centro: { opacity: 1, y: 0, transition: transicionVista },
  salir: (direccion) => ({
    opacity: 0,
    y: direccion >= 0 ? -6 : 6,
    transition: { duration: 0.12, ease: curva },
  }),
};

export const itemLista = {
  oculto: { opacity: 0, y: 6 },
  visible: (indice) => ({
    opacity: 1,
    y: 0,
    transition: { ...transicionRapida, delay: Math.min(indice * 0.02, 0.1) },
  }),
};
