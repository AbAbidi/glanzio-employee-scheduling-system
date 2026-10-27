"use client";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */
import { useEffect, useRef, type CSSProperties } from "react";
import { diagonalGlassStroke, fitGlassPane, SQUEEGEE_ART } from "./lib/glass-cleaning";

export type GlassStoryCopy = {
  sectionLabel: string;
  eyebrow: string;
  cleaning: string;
  storyDescription: string;
};

type GlassStoryProps = {
  copy: GlassStoryCopy;
};

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const soapDrops = [
  [20, 4.3, -2.1], [27, 6.2, -4.4], [35, 3.8, -1.7],
  [42, 5.4, -3.1], [49, 4.7, -0.9], [57, 6.5, -5.2],
  [65, 4.1, -2.8], [73, 5.8, -1.2], [81, 4.9, -3.7],
];

function Squeegee() {
  return <div className="glassStorySqueegee" data-side="exterior" style={{
    "--tool-anchor-x": `${(SQUEEGEE_ART.left + SQUEEGEE_ART.right) / 2 / SQUEEGEE_ART.size * 100}%`,
    "--tool-anchor-y": `${SQUEEGEE_ART.edgeY / SQUEEGEE_ART.size * 100}%`,
  } as CSSProperties}>
    <img src="/window-squeegee-foam-v6.webp" width={1254} height={1254} loading="lazy" alt="" draggable={false} />
  </div>;
}

export default function GlassStory({ copy }: GlassStoryProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const scene = sceneRef.current;
    if (!section || !scene) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let animationFrame = 0;
    let paneSize = { width: 0, height: 0 };
    let renderedProgress: number | null = null;
    let lastUpdate = 0;

    const updateStory = (time = performance.now()) => {
      const bounds = section.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const scrollDistance = Math.max(bounds.height - viewportHeight, 1);
      const target = motion.matches ? 1 : clamp(-bounds.top / scrollDistance);
      const elapsed = lastUpdate ? Math.max(0, time - lastUpdate) : 16;
      lastUpdate = time;
      if (renderedProgress === null || motion.matches) renderedProgress = target;
      else renderedProgress += (target - renderedProgress) * (1 - Math.exp(-elapsed / 65));
      if (Math.abs(target - renderedProgress) < .0003) renderedProgress = target;
      const progress = renderedProgress;
      section.dataset.reducedMotion = String(motion.matches);

      section.style.setProperty("--clean-progress", progress.toFixed(4));
      const stroke = diagonalGlassStroke(paneSize.width, paneSize.height, progress);
      section.style.setProperty("--soap-mask", stroke.foamClip);
      section.style.setProperty("--tool-x", `${stroke.x}px`);
      section.style.setProperty("--tool-y", `${stroke.y}px`);
      section.style.setProperty("--tool-size", `${stroke.spriteSize}px`);
      section.style.setProperty("--squeegee-opacity", String(motion.matches ? 0 : clamp((1 - progress) / 0.1)));
      const visible = !motion.matches && bounds.top < viewportHeight && bounds.bottom > 0 && !document.hidden;
      section.dataset.foamActive = String(visible);
      section.dataset.cleanState =
        motion.matches ? "clean" : progress < 0.02 ? "soapy" : progress > 0.98 ? "partial" : "transition";
      if (progress !== target && visible) animationFrame = window.requestAnimationFrame(updateStory);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateStory);
    };

    const measurePane = () => {
      const pane = fitGlassPane(scene.clientWidth, scene.clientHeight);
      paneSize = { width: pane.width, height: pane.height };
      for (const [key, value] of Object.entries(pane)) {
        const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        section.style.setProperty(`--pane-${name}`, `${value}px`);
      }
      section.dataset.glassReady = "true";
      scheduleUpdate();
    };
    const resizeObserver = new ResizeObserver(measurePane);
    resizeObserver.observe(scene);
    measurePane();
    updateStory();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    motion.addEventListener("change", scheduleUpdate);
    document.addEventListener("visibilitychange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      motion.removeEventListener("change", scheduleUpdate);
      document.removeEventListener("visibilitychange", scheduleUpdate);
    };
  }, []);

  return (
    <section
      aria-label={copy.sectionLabel}
      className="glassStory"
      data-clean-state="soapy"
      id="before-after"
      ref={sectionRef}
    >
      <p className="glassStoryDescription">{copy.storyDescription}</p>

      <article ref={sceneRef} className="glassStoryScene glassStoryCleaning">
        <div aria-hidden="true" className="glassStoryMedia">
          <div className="glassStoryCleanLayer">
            <img
              alt=""
              className="glassStoryBackground"
              height={941}
              loading="lazy"
              src="/glass-clean-windowsill-v4.webp"
              width={1672}
            />
          </div>
          <div className="glassStoryPane">
            <Squeegee />
            <div className="glassStoryFoamLayer">
              <img alt="" className="glassStoryFoamBackground" src="/glass-foam-windowsill-v4.webp" width={1672} height={941} loading="lazy" />
              <div className="glassStoryDrips">
                {soapDrops.map(([x, duration, delay], index) => <span key={x} className="glassStoryDrip" style={{
                  "--drop-x": `${x}%`, "--drop-duration": `${duration}s`, "--drop-delay": `${delay}s`, "--drop-width": `${index % 3 + 2}px`,
                } as CSSProperties} />)}
              </div>
            </div>
          </div>
          <div className="glassStoryShade" />
        </div>

        <div className="glassStoryCaption glassStoryCaptionRight">
          <span>{copy.eyebrow}</span>
          <h2>{copy.cleaning}</h2>
          <small className="glassStoryIllustration">Illustrative Darstellung</small>
        </div>
      </article>
    </section>
  );
}
