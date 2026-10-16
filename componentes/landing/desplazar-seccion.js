import { ScrollTrigger } from "@/componentes/landing/gsap";

function yDeElemento(elemento, offset) {
  return Math.max(0, window.scrollY + elemento.getBoundingClientRect().top - offset);
}

function saltarPines(desdeY, hastaY) {
  const subiendo = hastaY < desdeY;
  let y = desdeY;

  ScrollTrigger.getAll().forEach((st) => {
    if (!st.pin) return;
    const inicio = st.start;
    const fin = st.end;
    if (!(Math.min(desdeY, hastaY) < fin && Math.max(desdeY, hastaY) > inicio)) return;
    if (subiendo) y = Math.min(y, inicio - 1);
    else y = Math.max(y, fin + 1);
  });

  return Math.max(0, y);
}

export function desplazarASeccion(id, { offset = 0, suave = true, onInicio, onFin } = {}) {
  const destino = document.getElementById(id);
  if (!destino) return;

  onInicio?.();

  const objetivo = yDeElemento(destino, offset);
  const actual = window.scrollY;
  const atajo = saltarPines(actual, objetivo);

  const terminar = () => {
    if (suave) {
      destino.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: yDeElemento(destino, offset), behavior: "auto" });
    }

    if (!onFin) return;

    if (!suave) {
      onFin();
      return;
    }

    let quieto = 0;
    let ultimo = window.scrollY;
    const limite = performance.now() + 2800;

    const vigilar = () => {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) < 1) quieto += 1;
      else quieto = 0;
      ultimo = y;

      const cerca = Math.abs(destino.getBoundingClientRect().top - offset) < 64;
      if ((cerca && quieto >= 4) || quieto >= 12 || performance.now() > limite) {
        onFin();
        return;
      }
      requestAnimationFrame(vigilar);
    };

    requestAnimationFrame(vigilar);
  };

  if (Math.abs(atajo - actual) > 8) {
    window.scrollTo({ top: atajo, behavior: "auto" });
    requestAnimationFrame(() => requestAnimationFrame(terminar));
    return;
  }

  terminar();
}
