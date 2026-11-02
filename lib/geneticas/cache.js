export function crearCacheStrain({ ttlMs = 5 * 60 * 1000, ahora = () => Date.now() } = {}) {
  const valores = new Map();
  const vuelos = new Map();

  return {
    async obtener(clave, cargar) {
      const guardado = valores.get(clave);
      if (guardado && guardado.exp > ahora()) return guardado.valor;
      if (vuelos.has(clave)) return vuelos.get(clave);

      const promesa = Promise.resolve()
        .then(cargar)
        .then((valor) => {
          if (valor?.ok) valores.set(clave, { exp: ahora() + ttlMs, valor });
          return valor;
        })
        .finally(() => {
          vuelos.delete(clave);
        });

      vuelos.set(clave, promesa);
      return promesa;
    },
  };
}

export function crearCupo({ limite, ventanaMs, ahora = () => Date.now() } = {}) {
  const marcas = new Map();
  return {
    permitir(clave) {
      const instante = ahora();
      const previas = (marcas.get(clave) || []).filter((marca) => instante - marca < ventanaMs);
      if (previas.length >= limite) {
        marcas.set(clave, previas);
        return false;
      }
      previas.push(instante);
      marcas.set(clave, previas);
      return true;
    },
  };
}

export function crearCacheResultados({ ttlMs = 3 * 60 * 1000, maximo = 40, ahora = () => Date.now() } = {}) {
  const valores = new Map();
  return {
    leer(consulta) {
      const clave = String(consulta || "").trim().toLocaleLowerCase("es");
      const guardado = valores.get(clave);
      if (!guardado || guardado.exp <= ahora()) {
        valores.delete(clave);
        return null;
      }
      return guardado.valor;
    },
    guardar(consulta, valor) {
      const clave = String(consulta || "").trim().toLocaleLowerCase("es");
      if (valores.has(clave)) valores.delete(clave);
      valores.set(clave, { exp: ahora() + ttlMs, valor });
      while (valores.size > maximo) {
        const primero = valores.keys().next().value;
        valores.delete(primero);
      }
    },
  };
}
