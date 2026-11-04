const TOPE_ENTRADAS = 500;

function claveConsumo(alcance, ventana) {
  return `${alcance}|${ventana}`;
}

export function crearAlmacenMemoria() {
  const entradas = new Map();
  const conteos = new Map();

  function recordar(clave) {
    const actual = entradas.get(clave);
    if (!actual) return;
    entradas.delete(clave);
    entradas.set(clave, actual);
  }

  return {
    async leer(clave, ahora) {
      const entrada = entradas.get(clave);
      if (!entrada) return null;
      if (entrada.venceEn <= ahora) {
        entradas.delete(clave);
        return null;
      }
      recordar(clave);
      return entrada.cuerpo;
    },
    async guardar(clave, cuerpo, obtenidoEn, venceEn) {
      if (entradas.has(clave)) entradas.delete(clave);
      entradas.set(clave, { cuerpo, obtenidoEn, venceEn });
      while (entradas.size > TOPE_ENTRADAS) {
        const primera = entradas.keys().next().value;
        entradas.delete(primera);
      }
    },
    async leerConsumo(alcance, ventana) {
      return conteos.get(claveConsumo(alcance, ventana)) || 0;
    },
    async consumir(alcance, ventana, limite) {
      const clave = claveConsumo(alcance, ventana);
      const actual = conteos.get(clave) || 0;
      if (actual >= limite) return { permitido: false };
      conteos.set(clave, actual + 1);
      return { permitido: true };
    },
    async devolver(alcance, ventana) {
      const clave = claveConsumo(alcance, ventana);
      const actual = conteos.get(clave) || 0;
      conteos.set(clave, Math.max(0, actual - 1));
    },
  };
}

let compartido;

export function almacenCompartido() {
  if (!compartido) compartido = crearAlmacenMemoria();
  return compartido;
}

export function crearAlmacenCompuesto(local, remoto) {
  let remotoActivo = Boolean(remoto);

  async function remotoSeguro(metodo, args) {
    if (!remotoActivo || typeof remoto?.[metodo] !== "function") return { omitido: true };
    try {
      const valor = await remoto[metodo](...args);
      if (valor && valor.ausente) {
        remotoActivo = false;
        return { omitido: true };
      }
      return { omitido: false, valor };
    } catch {
      return { omitido: true };
    }
  }

  return {
    async leer(clave, ahora) {
      const localHit = await local.leer(clave, ahora);
      if (localHit) return localHit;
      const remotoHit = await remotoSeguro("leer", [clave, ahora]);
      if (remotoHit.omitido || !remotoHit.valor?.cuerpo) return null;
      if (remotoHit.valor.venceEn <= ahora) return null;
      await local.guardar(clave, remotoHit.valor.cuerpo, remotoHit.valor.obtenidoEn, remotoHit.valor.venceEn);
      return remotoHit.valor.cuerpo;
    },
    async guardar(clave, cuerpo, obtenidoEn, venceEn) {
      await local.guardar(clave, cuerpo, obtenidoEn, venceEn);
      await remotoSeguro("guardar", [clave, cuerpo, obtenidoEn, venceEn]);
    },
    async leerConsumo(alcance, ventana) {
      const remotoConsumo = await remotoSeguro("leerConsumo", [alcance, ventana]);
      if (!remotoConsumo.omitido && Number.isInteger(remotoConsumo.valor)) return remotoConsumo.valor;
      return local.leerConsumo(alcance, ventana);
    },
    async consumir(alcance, ventana, limite) {
      const remotoConsumo = await remotoSeguro("consumir", [alcance, ventana, limite]);
      if (!remotoConsumo.omitido && remotoConsumo.valor && typeof remotoConsumo.valor.permitido === "boolean") {
        return remotoConsumo.valor;
      }
      return local.consumir(alcance, ventana, limite);
    },
    async devolver(alcance, ventana) {
      const remotoDevuelto = await remotoSeguro("devolver", [alcance, ventana]);
      if (remotoDevuelto.omitido) await local.devolver(alcance, ventana);
    },
  };
}
