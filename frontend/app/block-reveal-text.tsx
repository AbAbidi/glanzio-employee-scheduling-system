"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type TextLine = { top: number; left: number; width: number; height: number };

export default function BlockRevealText({ text }: { text: string }) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const enteredRef = useRef(false);
  const [lines, setLines] = useState<TextLine[]>([]);
  const [entered, setEntered] = useState(false);
  const [complete, setComplete] = useState(false);

  useLayoutEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    let active = true;
    let previousLayout = "";

    const measure = () => {
      if (!active) return;
      const bounds = paragraph.getBoundingClientRect();
      const words = Array.from(paragraph.querySelectorAll<HTMLElement>(".blockRevealWord"));
      const rows = new Map<number, { top: number; left: number; right: number; bottom: number }>();
      for (const word of words) {
        // Inline words can fragment across lines on narrow screens; use every
        // fragment so long German compound words still get correctly sized masks.
        for (const rectangle of Array.from(word.getClientRects())) {
          if (!rectangle.width) continue;
          const key = Math.round(rectangle.top - bounds.top);
          const row = rows.get(key);
          const fragment = {
            top: rectangle.top - bounds.top,
            left: rectangle.left - bounds.left,
            right: rectangle.right - bounds.left,
            bottom: rectangle.bottom - bounds.top,
          };
          rows.set(key, row ? {
            top: Math.min(row.top, fragment.top), left: Math.min(row.left, fragment.left),
            right: Math.max(row.right, fragment.right), bottom: Math.max(row.bottom, fragment.bottom),
          } : fragment);
        }
      }
      const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b);
      const measuredLines = rowKeys.map((key) => {
        const row = rows.get(key)!;
        return { top: row.top - 1, left: row.left, width: row.right - row.left, height: row.bottom - row.top + 2 };
      });
      const layout = JSON.stringify(measuredLines);
      if (layout !== previousLayout) {
        if (previousLayout && enteredRef.current) setComplete(true);
        previousLayout = layout;
        setLines(measuredLines);
      }
    };
    const finishForReducedMotion = () => {
      if (motion.matches) setComplete(true);
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(paragraph);
    motion.addEventListener("change", finishForReducedMotion);
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      resizeObserver.disconnect();
      motion.removeEventListener("change", finishForReducedMotion);
    };
  }, [text]);

  useEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const bounds = paragraph.getBoundingClientRect();
      if (!enteredRef.current && bounds.bottom > 0 && bounds.top < window.innerHeight * 0.94) {
        enteredRef.current = true;
        setEntered(true);
      }
    };
    const scheduleCheck = () => {
      if (!frame && !enteredRef.current) frame = window.requestAnimationFrame(check);
    };
    // Check actual viewport coordinates as well as observer notifications. Text
    // remains readable even before either mechanism has fired.
    const observer = new IntersectionObserver(scheduleCheck, { threshold: 0.1 });
    observer.observe(paragraph);
    window.addEventListener("scroll", scheduleCheck, { passive: true, capture: true });
    window.addEventListener("resize", scheduleCheck, { passive: true });
    scheduleCheck();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleCheck, true);
      window.removeEventListener("resize", scheduleCheck);
    };
  }, []);

  useEffect(() => {
    if (!entered || !lines.length) return;
    // Normally the last mask's animationend finishes the reveal. This deadline
    // also releases the text if animations are disabled or interrupted externally.
    const timer = window.setTimeout(() => setComplete(true), 1000 + lines.length * 40);
    return () => window.clearTimeout(timer);
  }, [entered, lines.length]);

  const words = text.split(/\s+/);
  return (
    <p
      ref={paragraphRef}
      className={`statementBlockReveal${entered ? " isRevealed" : ""}${complete ? " isComplete" : ""}`}
      data-reveal-ready={lines.length > 0 ? "true" : undefined}
      onAnimationEnd={(event) => {
        if (event.animationName === "statementLineWipe" &&
            (event.target as HTMLElement).dataset.revealLast === "true") {
          setComplete(true);
        }
      }}
    >
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          <span className="blockRevealWord">{word}</span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
      {lines.map((line, index) => (
        <i
          key={index}
          className="blockRevealMask"
          aria-hidden="true"
          data-reveal-last={index === lines.length - 1 ? "true" : undefined}
          style={{
            top: line.top, left: line.left, width: line.width, height: line.height,
            "--reveal-delay": `${index * 40}ms`,
          } as CSSProperties}
        />
      ))}
    </p>
  );
}
