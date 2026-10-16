"use client";

import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import "./text-type.css";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const EFFECTS = {
  fade: {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options: { duration: 360, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  },
  blur: {
    keyframes: [
      { opacity: 0, filter: "blur(0.3em)" },
      { opacity: 1, filter: "blur(0em)" },
    ],
    options: { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  },
  rise: {
    keyframes: [
      { opacity: 0, top: "0.6em" },
      { opacity: 1, top: "0em" },
    ],
    options: { duration: 480, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" },
  },
};

const graphemes = (value) => {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);
  }
  return Array.from(value);
};

export default function TextType({
  text,
  as: Component = "div",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorStyle = "character",
  cursorCharacter = "|",
  cursorColor = "currentColor",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  cursorGlide = true,
  typeEffect = "none",
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  onTypingComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}) {
  const [textIndex, setTextIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const containerRef = useRef(null);
  const caretRef = useRef(null);
  const cursorRef = useRef(null);
  const blinkRef = useRef(null);
  const blinkTimeline = useRef(null);
  const blinkResume = useRef(null);
  const caretPosition = useRef(null);
  const placeCursor = useRef(() => {});
  const typingDoneRef = useRef(false);
  const onSentenceCompleteRef = useRef(onSentenceComplete);
  const onTypingCompleteRef = useRef(onTypingComplete);

  const textKey = Array.isArray(text) ? text.join("\u0000") : String(text ?? "");
  const textArray = useMemo(() => textKey.split("\u0000"), [textKey]);
  const index = textIndex % Math.max(textArray.length, 1);
  const chars = useMemo(() => graphemes(textArray[index] || ""), [textArray, index]);
  const total = chars.length;
  const shown = Math.min(count, total);
  const minSpeed = variableSpeed?.min ?? typingSpeed;
  const maxSpeed = variableSpeed?.max ?? typingSpeed;
  const pace = (minSpeed + maxSpeed) / 2;
  const glideTime = Math.min(0.18, Math.max(0.06, pace * 0.0016));

  useEffect(() => {
    onSentenceCompleteRef.current = onSentenceComplete;
  }, [onSentenceComplete]);

  useEffect(() => {
    onTypingCompleteRef.current = onTypingComplete;
  }, [onTypingComplete]);

  useEffect(() => {
    typingDoneRef.current = false;
    setCount(0);
    setIsDeleting(false);
    setTextIndex(0);
  }, [textKey]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    const blink = blinkRef.current;
    if (!showCursor || !blink) return undefined;
    gsap.set(blink, { opacity: 1 });
    if (reduceMotion || cursorBlinkDuration <= 0) return undefined;
    const hold = cursorBlinkDuration * 0.7;
    const fade = cursorBlinkDuration * 0.45;
    const timeline = gsap.timeline({ repeat: -1 });
    timeline
      .to(blink, { opacity: 0, duration: fade, ease: "sine.inOut" }, hold)
      .to(blink, { opacity: 1, duration: fade, ease: "sine.inOut" }, hold + fade + cursorBlinkDuration * 0.4);
    blinkTimeline.current = timeline;
    return () => {
      timeline.kill();
      blinkResume.current?.kill();
      gsap.killTweensOf(blink);
      blinkTimeline.current = null;
    };
  }, [showCursor, cursorBlinkDuration, reduceMotion]);

  useIsomorphicLayoutEffect(() => {
    caretPosition.current = null;
  }, [showCursor]);

  useIsomorphicLayoutEffect(() => {
    placeCursor.current = (instant) => {
      const caret = caretRef.current;
      const cursor = cursorRef.current;
      if (!caret || !cursor) return;
      const x = caret.offsetLeft;
      const y = caret.offsetTop;
      const last = caretPosition.current;
      if (last && Math.abs(last.x - x) < 0.5 && Math.abs(last.y - y) < 0.5) return;
      caretPosition.current = { x, y };
      if (instant || !last || !cursorGlide || reduceMotion || Math.abs(last.y - y) > 1) {
        gsap.killTweensOf(cursor);
        gsap.set(cursor, { x, y });
      } else {
        gsap.to(cursor, { x, y, duration: glideTime, ease: "power3.out", overwrite: true });
      }
      const timeline = blinkTimeline.current;
      const blink = blinkRef.current;
      if (instant || !timeline || !blink) return;
      timeline.pause();
      blinkResume.current?.kill();
      gsap.to(blink, { opacity: 1, duration: 0.12, ease: "power1.out" });
      blinkResume.current = gsap.delayedCall(0.12, () => timeline.restart());
    };
    placeCursor.current(false);
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => placeCursor.current(true));
    observer.observe(node);
    return () => observer.disconnect();
  }, [Component]);

  useEffect(() => {
    if (!isVisible) return undefined;
    let timeout;
    const wait = (ms, next) => {
      timeout = setTimeout(next, ms);
    };
    const speed = () => minSpeed + Math.random() * (maxSpeed - minSpeed);

    if (!isDeleting) {
      if (shown < total) {
        const lead = shown === 0 ? initialDelay : 0;
        if (reduceMotion) {
          wait(lead, () => setCount(total));
        } else {
          wait(lead + speed(), () => setCount(shown + 1));
        }
      } else if (total > 0 && !typingDoneRef.current) {
        typingDoneRef.current = true;
        onTypingCompleteRef.current?.(textArray[index], index);
        if (loop || index < textArray.length - 1) {
          wait(pauseDuration, () => setIsDeleting(true));
        }
      } else if (loop || index < textArray.length - 1) {
        wait(pauseDuration, () => setIsDeleting(true));
      }
    } else if (shown > 0) {
      if (reduceMotion) {
        wait(0, () => setCount(0));
      } else {
        wait(deletingSpeed, () => setCount(shown - 1));
      }
    } else {
      onSentenceCompleteRef.current?.(textArray[index], index);
      typingDoneRef.current = false;
      setIsDeleting(false);
      setTextIndex((index + 1) % textArray.length);
    }

    return () => clearTimeout(timeout);
  }, [
    isVisible,
    isDeleting,
    shown,
    total,
    index,
    textArray,
    loop,
    deletingSpeed,
    pauseDuration,
    initialDelay,
    minSpeed,
    maxSpeed,
    reverseMode,
    reduceMotion,
  ]);

  const animateChar = useCallback(
    (node) => {
      const effect = EFFECTS[typeEffect];
      if (!node || !effect || reduceMotion || typeof node.animate !== "function") return;
      node.animate(effect.keyframes, effect.options);
    },
    [typeEffect, reduceMotion],
  );

  const start = reverseMode ? total - shown : 0;
  const correct = chars.slice(start, start + shown).map((char, i) => (
    <span key={`${start + i}-${char}`} ref={animateChar} className="text-type__char">
      {char}
    </span>
  ));

  const caret = (
    <span ref={caretRef} className="text-type__caret" aria-hidden="true">
      {"\u200B"}
    </span>
  );
  const color = textColors.length ? textColors[index % textColors.length] : "inherit";
  const typing = shown < total || isDeleting;
  const hideCursor = hideCursorWhileTyping && typing;
  const customCursorColor = cursorColor && cursorColor !== "currentColor" ? { color: cursorColor } : undefined;

  return createElement(
    Component,
    {
      ref: containerRef,
      className: `text-type ${className}`.trim(),
      style: { color },
      ...props,
    },
    <span className="text-type__sr">{textArray.join(" ")}</span>,
    <span aria-hidden="true">
      {reverseMode && caret}
      {correct}
      {!reverseMode && caret}
    </span>,
    showCursor ? (
      <span
        ref={cursorRef}
        aria-hidden="true"
        className={`text-type__cursor text-type__cursor--${cursorStyle} ${hideCursor ? "text-type__cursor--hidden" : ""} ${cursorClassName}`.trim()}
        style={customCursorColor}
      >
        <span ref={blinkRef} className="text-type__blink">
          {cursorStyle === "character" ? cursorCharacter : <span className="text-type__shape" />}
        </span>
      </span>
    ) : null,
  );
}
