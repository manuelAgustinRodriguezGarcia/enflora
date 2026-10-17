"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const INERCIA_MIN = 0.35;
const INERCIA_FRICTACION = 0.935;

export const OptionWheel = forwardRef(function OptionWheel(
  {
    items,
    defaultSelected = 0,
    indice = null,
    onChange,
    onPosicion,
    onInteraccion,
    textColor = "#7a9a48",
    activeColor = "#A4C85B",
    side = "left",
    fontSize = 3,
    spacing = 1.4,
    curve = 1,
    tilt = 6,
    blur = 2,
    fade = 0.25,
    minOpacity = 0.05,
    smoothing = 200,
    inset = 80,
    loop = false,
    draggable = true,
    snapAlSoltar = true,
    inercia = false,
    capturarRueda = true,
    className = "",
    ariaLabel = "Opciones",
  },
  ref,
) {
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const posRef = useRef(defaultSelected);
  const targetRef = useRef(defaultSelected);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const cfgRef = useRef({});
  const onChangeRef = useRef(onChange);
  const onPosicionRef = useRef(onPosicion);
  const onInteraccionRef = useRef(onInteraccion);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef(null);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const velocityRef = useRef(0);
  const inerciaRafRef = useRef(null);
  const remPxRef = useRef(16);
  const runFrameRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPosicionRef.current = onPosicion;
  }, [onPosicion]);

  useEffect(() => {
    onInteraccionRef.current = onInteraccion;
  }, [onInteraccion]);

  useEffect(() => {
    remPxRef.current = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    cfgRef.current = {
      count: items.length,
      items,
      rowH: Math.max(fontSize * spacing * remPxRef.current, 1),
      curve,
      tilt,
      blur,
      fade,
      minOpacity,
      side,
      loop,
      smoothing,
      draggable,
      inercia,
    };
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing, draggable, inercia]);

  const pintarItems = useCallback((next) => {
    const cfg = cfgRef.current;
    const els = itemRefs.current;
    const n = cfg.count;
    const centrado = cfg.side === "center";
    const mirror = cfg.side === "right" ? -1 : 1;
    const tiltRad = centrado ? 0 : (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;

    for (let i = 0; i < n; i++) {
      const el = els[i];
      if (!el) continue;
      let d = i - next;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let x = 0;
      let y = d * cfg.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      const desplazamientoX = centrado ? `calc(-50% + ${x.toFixed(2)}px)` : `${x.toFixed(2)}px`;
      el.style.transform = `translate(${desplazamientoX}, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
      el.style.filter = cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : "none";
      el.style.setProperty("--ow-p", Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
    }
  }, []);

  useEffect(() => {
    runFrameRef.current = (now) => {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const cfg = cfgRef.current;
      const tau = Math.max(cfg.smoothing, 1) / 1000;
      const k = 1 - Math.exp(-dt / tau);

      const target = targetRef.current;
      const cur = posRef.current;
      let next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      posRef.current = next;
      pintarItems(next);

      rafRef.current = settled ? null : requestAnimationFrame((t) => runFrameRef.current?.(t));
    };
  }, [pintarItems]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame((t) => runFrameRef.current?.(t));
  }, []);

  const pintarAhora = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastRef.current = performance.now();
    runFrameRef.current?.(lastRef.current);
  }, []);

  const detenerInercia = useCallback(() => {
    if (inerciaRafRef.current != null) {
      cancelAnimationFrame(inerciaRafRef.current);
      inerciaRafRef.current = null;
    }
    velocityRef.current = 0;
  }, []);

  const applyTarget = useCallback(
    (value, snap, silencioso = false, inmediato = false) => {
      const cfg = cfgRef.current;
      let v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      if (snap) v = Math.round(v);
      targetRef.current = v;
      if (inmediato) posRef.current = v;
      const idx = ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
      if (idx !== selectedRef.current) {
        selectedRef.current = idx;
        setSelectedIndex(idx);
        if (!silencioso) onChangeRef.current?.(idx, cfg.items[idx]);
      }
      onPosicionRef.current?.(v);
      if (inmediato) {
        pintarAhora();
        return;
      }
      startLoop();
    },
    [pintarAhora, startLoop],
  );

  const lanzarInercia = useCallback(
    (velInicial) => {
      detenerInercia();
      let vel = velInicial;
      let ultimo = performance.now();
      onInteraccionRef.current?.(true);

      const tick = (now) => {
        const dt = Math.min((now - ultimo) / 1000, 0.05);
        ultimo = now;
        const cfg = cfgRef.current;
        let siguiente = posRef.current + vel * dt;
        if (!cfg.loop) {
          if (siguiente <= 0) {
            siguiente = 0;
            vel = 0;
          } else if (siguiente >= cfg.count - 1) {
            siguiente = cfg.count - 1;
            vel = 0;
          }
        }
        posRef.current = siguiente;
        targetRef.current = siguiente;
        pintarItems(siguiente);

        const idx = ((Math.round(siguiente) % cfg.count) + cfg.count) % cfg.count;
        if (idx !== selectedRef.current) {
          selectedRef.current = idx;
          setSelectedIndex(idx);
        }
        onPosicionRef.current?.(siguiente);

        vel *= Math.pow(INERCIA_FRICTACION, dt * 60);
        velocityRef.current = vel;

        if (Math.abs(vel) < 0.045) {
          inerciaRafRef.current = null;
          velocityRef.current = 0;
          onInteraccionRef.current?.(false);
          return;
        }
        inerciaRafRef.current = requestAnimationFrame(tick);
      };

      inerciaRafRef.current = requestAnimationFrame(tick);
    },
    [detenerInercia, pintarItems],
  );

  useImperativeHandle(
    ref,
    () => ({
      setPosicion(valor, { inmediato = false, silencioso = true } = {}) {
        if (dragRef.current || inerciaRafRef.current != null) return;
        applyTarget(valor, false, silencioso, inmediato);
      },
    }),
    [applyTarget],
  );

  useEffect(() => {
    if (!capturarRueda) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;

    const onWheel = (evento) => {
      const cfg = cfgRef.current;
      const delta = evento.deltaMode === 1 ? evento.deltaY * 24 : evento.deltaY;
      const actual = targetRef.current;
      const enInicio = !cfg.loop && actual <= 0 && delta < 0;
      const enFinal = !cfg.loop && actual >= cfg.count - 1 && delta > 0;
      if (enInicio || enFinal) return;

      evento.preventDefault();
      const step = Math.max(-1, Math.min(1, delta / cfg.rowH));
      applyTarget(actual + step, false);
      if (!snapAlSoltar) return;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget, capturarRueda, snapAlSoltar]);

  useEffect(() => {
    if (indice == null || !Number.isFinite(indice)) return;
    if (dragRef.current || inerciaRafRef.current != null) return;
    const max = Math.max(items.length - 1, 0);
    const siguiente = Math.min(Math.max(indice, 0), max);
    if (Math.abs(targetRef.current - siguiente) < 0.001) return;
    applyTarget(siguiente, snapAlSoltar, true);
  }, [indice, items.length, applyTarget, snapAlSoltar]);

  const handlePointerDown = useCallback(
    (evento) => {
      if (!cfgRef.current.draggable) return;
      detenerInercia();
      dragRef.current = {
        y: evento.clientY,
        start: posRef.current,
        id: evento.pointerId,
        t: performance.now(),
      };
      dragMovedRef.current = false;
      velocityRef.current = 0;
      setIsDragging(true);
      onInteraccionRef.current?.(true);
    },
    [detenerInercia],
  );

  const handlePointerMove = useCallback(
    (evento) => {
      const drag = dragRef.current;
      if (!drag) return;
      const now = performance.now();
      const dy = evento.clientY - drag.y;
      if (!dragMovedRef.current && Math.abs(dy) > 4) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (!dragMovedRef.current) return;

      const rowH = cfgRef.current.rowH;
      const siguiente = drag.start - dy / rowH;
      const dt = Math.max((now - drag.t) / 1000, 0.001);
      const desplazamiento = -(evento.clientY - (drag.prevY ?? drag.y)) / rowH;
      velocityRef.current = desplazamiento / dt;
      drag.prevY = evento.clientY;
      drag.t = now;
      applyTarget(siguiente, false, true, true);
    },
    [applyTarget],
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    const movio = dragMovedRef.current;
    const vel = velocityRef.current;
    dragRef.current = null;
    setIsDragging(false);

    if (!movio) {
      onInteraccionRef.current?.(false);
      return;
    }

    if (cfgRef.current.inercia && Math.abs(vel) >= INERCIA_MIN) {
      lanzarInercia(vel);
      return;
    }

    applyTarget(targetRef.current, snapAlSoltar, true, !snapAlSoltar);
    onInteraccionRef.current?.(false);
  }, [applyTarget, lanzarInercia, snapAlSoltar]);

  const handleItemClick = useCallback(
    (index) => {
      if (dragMovedRef.current) return;
      const cfg = cfgRef.current;
      const cur = targetRef.current;
      let d = index - (((cur % cfg.count) + cfg.count) % cfg.count);
      if (cfg.loop && cfg.count > 1) {
        if (d > cfg.count / 2) d -= cfg.count;
        else if (d < -cfg.count / 2) d += cfg.count;
      }
      applyTarget(cur + d, true);
    },
    [applyTarget],
  );

  const handleKeyDown = useCallback(
    (evento) => {
      let delta = null;
      if (evento.key === "ArrowUp" || evento.key === "ArrowLeft") delta = -1;
      else if (evento.key === "ArrowDown" || evento.key === "ArrowRight") delta = 1;
      if (delta == null) return;
      evento.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
    },
    [applyTarget],
  );

  useEffect(() => {
    applyTarget(targetRef.current, false);
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing, applyTarget]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (inerciaRafRef.current != null) cancelAnimationFrame(inerciaRafRef.current);
      inerciaRafRef.current = null;
    },
    [],
  );

  const clases = [
    "option-wheel",
    side === "right" ? "option-wheel--right" : "",
    side === "center" ? "option-wheel--center" : "",
    isDragging ? "option-wheel--dragging" : "",
    !capturarRueda && !draggable ? "option-wheel--scroll" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-activedescendant={`option-wheel-${selectedIndex}`}
      className={clases}
      style={{
        "--ow-text-color": textColor,
        "--ow-active-color": activeColor,
        "--ow-font-size": `${fontSize}rem`,
        "--ow-inset": `${inset}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          id={`option-wheel-${index}`}
          ref={(nodo) => {
            itemRefs.current[index] = nodo;
          }}
          role="option"
          aria-selected={selectedIndex === index}
          className={`option-wheel__item${selectedIndex === index ? " option-wheel__item--selected" : ""}`}
          onClick={() => handleItemClick(index)}
        >
          {label}
        </div>
      ))}
    </div>
  );
});
