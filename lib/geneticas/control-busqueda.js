// Debounce y cancelación de la búsqueda. La respuesta de una consulta vieja no se entrega.
export function crearControlBusqueda({ esperar = 350, buscar }) {
  let temporizador = null;
  let secuencia = 0;
  let controlador = null;

  return {
    programar(consulta, { alEmpezar, alRecibir }) {
      if (temporizador) clearTimeout(temporizador);
      const actual = ++secuencia;
      temporizador = setTimeout(() => {
        temporizador = null;
        controlador?.abort();
        const propio = new AbortController();
        controlador = propio;
        alEmpezar?.();
        Promise.resolve()
          .then(() => buscar(consulta, propio.signal))
          .then((resultado) => {
            if (actual !== secuencia || propio.signal.aborted) return;
            alRecibir?.({ ok: true, resultado });
          })
          .catch((error) => {
            if (actual !== secuencia || propio.signal.aborted || error?.name === "AbortError") return;
            alRecibir?.({ ok: false, error });
          });
      }, esperar);
    },
    cancelar() {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
      secuencia += 1;
      controlador?.abort();
      controlador = null;
    },
  };
}
