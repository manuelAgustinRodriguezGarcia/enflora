"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "@/componentes/landing/magic-bento.css";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const THEMES = {
  light: {
    "--mb-surface": "linear-gradient(180deg, #ffffff 0%, #f7f9f2 100%)",
    "--mb-edge": "rgba(11, 61, 42, 0.1)",
    "--mb-highlight": "rgba(255, 255, 255, 1)",
    "--mb-shadow": "0 18px 40px -28px rgba(11, 61, 42, 0.28), 0 8px 16px -14px rgba(11, 61, 42, 0.12)",
    "--mb-ink": "#0b3d2a",
    "--mb-muted": "rgba(11, 61, 42, 0.62)",
    "--mb-focus": "rgba(11, 61, 42, 0.4)",
    "--mb-glow-alpha": 0.55,
    "--mb-spot-alpha": 0.045,
  },
  dark: {
    "--mb-surface": "linear-gradient(180deg, #1a1820 0%, #121116 100%)",
    "--mb-edge": "rgba(255, 255, 255, 0.07)",
    "--mb-highlight": "rgba(255, 255, 255, 0.06)",
    "--mb-shadow": "0 24px 48px -28px rgba(0, 0, 0, 0.85)",
    "--mb-ink": "#f4f4f5",
    "--mb-muted": "rgba(244, 244, 245, 0.6)",
    "--mb-focus": "rgba(244, 244, 245, 0.5)",
    "--mb-glow-alpha": 0.85,
    "--mb-spot-alpha": 0.07,
  },
};

const MIN_CELL = 150;
const MIN_PAIR = 200;
const STAGGER = 70;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseRgb = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  }
  return null;
};

export default function MagicBento({
  items = [],
  columns = 3,
  rowHeight = 150,
  gap = 12,
  radius = 20,
  theme = "light",
  glowColor = "#A4C85B",
  textAutoHide = false,
  enableBorderGlow = true,
  enableSpotlight = true,
  spotlightRadius = 250,
  enableStars = false,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = false,
  intro = true,
  disableAnimations = false,
  className = "",
  style,
}) {
  void enableStars;
  void enableTilt;
  void enableMagnetism;
  void clickEffect;

  const rootRef = useRef(null);
  const cellRefs = useRef([]);
  const cardRefs = useRef([]);
  const [cols, setCols] = useState(Math.max(1, Math.round(columns)));

  const palette = theme === "dark" ? "dark" : "light";
  const glow = parseRgb(glowColor) ?? [164, 200, 91];

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = !disableAnimations && !reduced;
    const playIntro = motion && intro;
    if (motion) root.dataset.motion = "";
    else delete root.dataset.motion;
    if (playIntro) root.dataset.intro = "";
    else delete root.dataset.intro;

    const pointer = { x: -1e5, y: -1e5, inside: false };
    const light = { x: -1e5, y: -1e5, near: 0, ready: false };
    const states = [];
    let rects = [];
    let bounds = null;
    let dirty = true;
    let raf = 0;
    let last = 0;
    let visible = true;
    let entered = !playIntro;
    let settleTimer = 0;

    const stateFor = (index) => {
      if (!states[index]) states[index] = { hot: 0, written: {} };
      return states[index];
    };

    const write = (element, state, name, value) => {
      if (state.written[name] === value) return;
      state.written[name] = value;
      element.style.setProperty(name, value);
    };

    const measure = () => {
      dirty = false;
      bounds = root.getBoundingClientRect();
      rects = cardRefs.current.map((card) => (card ? card.getBoundingClientRect() : null));
    };

    const frame = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (dirty) measure();
      let busy = false;

      const margin = spotlightRadius * 0.5;
      const near =
        pointer.inside &&
        bounds &&
        pointer.x > bounds.left - margin &&
        pointer.x < bounds.right + margin &&
        pointer.y > bounds.top - margin &&
        pointer.y < bounds.bottom + margin
          ? 1
          : 0;

      if (!light.ready && near) {
        light.x = pointer.x;
        light.y = pointer.y;
        light.ready = true;
      }

      const follow = 1 - Math.exp(-dt / 0.05);
      light.x += (pointer.x - light.x) * follow;
      light.y += (pointer.y - light.y) * follow;
      const fade = 1 - Math.exp(-dt / (near > light.near ? 0.12 : 0.4));
      light.near += (near - light.near) * fade;
      if (Math.abs(near - light.near) < 0.002) light.near = near;
      else busy = true;
      if (Math.abs(pointer.x - light.x) + Math.abs(pointer.y - light.y) > 0.3) busy = true;

      cardRefs.current.forEach((card, index) => {
        const rect = rects[index];
        if (!card || !rect) return;
        const state = stateFor(index);
        const lx = light.x - rect.left;
        const ly = light.y - rect.top;
        const px = pointer.x - rect.left;
        const py = pointer.y - rect.top;
        const inside = pointer.inside && entered && px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;
        const hotTarget = inside && enableSpotlight ? 1 : 0;
        state.hot += (hotTarget - state.hot) * (1 - Math.exp(-dt / (hotTarget > state.hot ? 0.14 : 0.32)));
        if (Math.abs(hotTarget - state.hot) < 0.002) state.hot = hotTarget;
        else busy = true;

        write(card, state, "--mb-x", `${lx.toFixed(1)}px`);
        write(card, state, "--mb-y", `${ly.toFixed(1)}px`);
        write(card, state, "--mb-near", (enableBorderGlow ? light.near : 0).toFixed(3));
        write(card, state, "--mb-hot", state.hot.toFixed(3));
      });

      if (busy && visible) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      wake();
    };

    const onPointerOut = (event) => {
      if (event.relatedTarget) return;
      pointer.inside = false;
      wake();
    };

    const onScroll = () => {
      dirty = true;
      wake();
    };

    const resizeObserver = new ResizeObserver(() => {
      const width = root.clientWidth;
      const cell = (count) => (width - gap * (count - 1)) / count;
      const next =
        cell(columns) >= MIN_CELL ? Math.max(1, Math.round(columns)) : columns >= 2 && cell(2) >= MIN_PAIR ? 2 : 1;
      setCols(next);
      dirty = true;
      wake();
    });
    resizeObserver.observe(root);

    const enter = () => {
      entered = true;
      let order = 0;
      cellRefs.current.forEach((cell) => {
        if (!cell) return;
        cell.style.setProperty("--mb-delay", `${order++ * STAGGER}ms`);
        cell.dataset.state = "in";
      });
      settleTimer = window.setTimeout(() => {
        cellRefs.current.forEach((cell) => cell?.style.setProperty("--mb-delay", "0ms"));
      }, order * STAGGER + 1200);
      wake();
    };

    let gate = null;
    if (playIntro && typeof IntersectionObserver !== "undefined") {
      gate = new IntersectionObserver(
        (entries, observer) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          enter();
        },
        { threshold: 0.15 }
      );
      gate.observe(root);
    } else {
      cellRefs.current.forEach((cell) => {
        if (!cell) return;
        cell.style.setProperty("--mb-delay", "0ms");
        cell.dataset.state = "in";
      });
    }

    const visibility = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        dirty = true;
        wake();
      }
    });
    visibility.observe(root);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("pointerout", onPointerOut);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      gate?.disconnect();
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, [
    columns,
    disableAnimations,
    enableBorderGlow,
    enableSpotlight,
    gap,
    glowColor,
    intro,
    items,
    spotlightRadius,
  ]);

  const corner = Math.max(0, radius);
  const span = Math.max(1, cols);

  return (
    <div
      ref={rootRef}
      className={`magic-bento ${className}`.trim()}
      data-autohide={textAutoHide ? "" : undefined}
      style={{
        ...THEMES[palette],
        "--mb-glow-rgb": glow.join(", "),
        "--mb-radius": `${corner}px`,
        "--mb-pad": `${Math.round(clamp(corner * 0.85, 14, 20))}px`,
        "--mb-spot-size": `${Math.max(40, spotlightRadius)}px`,
        "--mb-border-size": `${Math.round(Math.max(40, spotlightRadius) * 0.75)}px`,
        gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))`,
        gridAutoRows: `minmax(${rowHeight}px, auto)`,
        gap: `${Math.max(0, gap)}px`,
        ...style,
      }}
    >
      {items.map((item, index) => {
        const entry = item ?? {};
        return (
          <div
            key={entry.id ?? index}
            ref={(element) => {
              cellRefs.current[index] = element;
            }}
            className="magic-bento__cell"
          >
            <div
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              className="magic-bento__card"
            >
              {enableSpotlight ? <span className="magic-bento__light" /> : null}
              <div className="magic-bento__content">
                {entry.content ?? (
                  <>
                    {(entry.icon || entry.label) && (
                      <div className="magic-bento__header">
                        {entry.icon ? <span className="magic-bento__icon">{entry.icon}</span> : null}
                        {entry.label ? <span className="magic-bento__label">{entry.label}</span> : null}
                      </div>
                    )}
                    {(entry.title || entry.description) && (
                      <div className="magic-bento__text">
                        {entry.title ? <h3 className="magic-bento__title">{entry.title}</h3> : null}
                        {entry.description ? (
                          <p className="magic-bento__description">{entry.description}</p>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className="magic-bento__rim" />
              {enableBorderGlow ? <span className="magic-bento__border" /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
