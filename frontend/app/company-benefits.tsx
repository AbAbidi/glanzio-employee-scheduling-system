"use client";

/* eslint-disable @next/next/no-img-element -- Static, optimized local WebP assets. */
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

type CompanyBenefit = { title: string; description: string; image: string; alt: string; width: number; height: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function CompanyBenefits({ items }: { items: CompanyBenefit[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollDistanceRef = useRef(0);
  const stopsRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!section || !track || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStaticLayout = () => motion.matches || window.innerHeight < 560;
    let active = true;
    let frame = 0;
    let travel = 0;
    let distance = 0;
    let needsMeasure = true;
    let moments: { element: HTMLElement; left: number; width: number }[] = [];
    const updateFlowVisibility = () => {
      const bounds = stage.getBoundingClientRect();
      section.dataset.flowActive = String(!motion.matches && !document.hidden && bounds.bottom > 0 && bounds.top < window.innerHeight);
    };

    const update = () => {
      frame = 0;
      updateFlowVisibility();
      if (!active || isStaticLayout()) return;
      if (needsMeasure) {
        section.style.setProperty("--gallery-width", `${stage.clientWidth}px`);
        const intro = track.querySelector<HTMLElement>(".qualityIntro");
        const last = track.querySelector<HTMLElement>(".qualityMoment:last-child");
        section.style.setProperty("--gallery-start", `${Math.max(22, (stage.clientWidth - (intro?.offsetWidth ?? stage.clientWidth)) / 2)}px`);
        section.style.setProperty("--gallery-end", `${Math.max(22, (stage.clientWidth - (last?.offsetWidth ?? stage.clientWidth)) / 2)}px`);
        travel = Math.max(0, track.scrollWidth - stage.clientWidth);
        distance = travel * 1.15 + stage.clientHeight * 0.4;
        scrollDistanceRef.current = distance;
        section.style.height = `${stage.clientHeight + distance}px`;
        moments = Array.from(track.querySelectorAll<HTMLElement>(".qualityMoment"), (element) => ({
          element, left: element.offsetLeft, width: element.offsetWidth,
        }));
        stopsRef.current = Array.from(track.children, (element) => {
          const item = element as HTMLElement;
          return clamp((item.offsetLeft + item.offsetWidth / 2 - stage.clientWidth / 2) / Math.max(1, travel));
        });
        needsMeasure = false;
      }
      const progress = clamp(-section.getBoundingClientRect().top / Math.max(1, distance));
      const x = -travel * progress;
      // A reversible, scroll-driven color blend, not a timed background loop.
      const from = [13, 60, 46];
      const to = [243, 234, 216];
      const rgb = from.map((channel, index) => Math.round(channel + (to[index] - channel) * progress));
      section.style.setProperty("--journey-bg", `rgb(${rgb.join(", ")})`);
      section.style.setProperty("--journey-ink", progress < 0.38 ? "#fffefa" : "#061a12");
      section.style.setProperty("--journey-progress", String(progress));
      const lineFrom = [207, 232, 183];
      const lineTo = [74, 109, 81];
      section.style.setProperty("--journey-line", lineFrom.map((channel, index) => Math.round(channel + (lineTo[index] - channel) * progress)).join(", "));
      section.style.setProperty("--gallery-x", `${x}px`);
      section.style.setProperty("--mini-x", `${x * 0.75}px`);
      section.style.setProperty("--flow-turn", `${-24 + progress * 76}deg`);
      section.style.setProperty("--flow-x", `${-28 + progress * 56}%`);
      section.style.setProperty("--flow-y", `${Math.sin(progress * Math.PI) * 22 - 12}%`);
      section.style.setProperty("--flow-scale", String(0.85 + progress * 0.55));
      for (const { element, left, width } of moments) {
        const position = Math.max(-1.5, Math.min(1.5, (left + width / 2 + x - stage.clientWidth / 2) / stage.clientWidth));
        element.style.setProperty("--moment-drift", `${Math.sin(position * Math.PI) * 10}px`);
        element.style.setProperty("--copy-drift", `${position * 10}px`);
      }
    };
    const scheduleUpdate = () => {
      if (active && !frame) frame = window.requestAnimationFrame(update);
    };
    const resize = () => {
      if (!active) return;
      if ((!isStaticLayout()) !== (section.dataset.scrollEnhanced === "true")) configure();
      else { needsMeasure = true; scheduleUpdate(); }
    };
    const configure = () => {
      updateFlowVisibility();
      if (isStaticLayout()) {
        section.removeAttribute("data-scroll-enhanced");
        section.removeAttribute("style");
        for (const moment of moments) moment.element.removeAttribute("style");
        scrollDistanceRef.current = 0;
      } else {
        section.dataset.scrollEnhanced = "true";
        needsMeasure = true;
        update();
      }
    };
    configure();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    observer.observe(track);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", scheduleUpdate);
    motion.addEventListener("change", configure);
    void document.fonts.ready.then(resize);
    return () => {
      active = false;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", scheduleUpdate);
      motion.removeEventListener("change", configure);
      section.removeAttribute("data-scroll-enhanced");
      section.removeAttribute("style");
    };
  }, []);

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const section = sectionRef.current;
    const distance = scrollDistanceRef.current;
    if (!section || !distance) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const top = window.scrollY + section.getBoundingClientRect().top;
    const progress = clamp((window.scrollY - top) / distance);
    const stops = stopsRef.current;
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 :
      event.key === "ArrowRight" ? (stops.find((stop) => stop > progress + 0.02) ?? 1) :
        (stops.findLast((stop) => stop < progress - 0.02) ?? 0);
    window.scrollTo({ top: top + distance * next, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} className="qualityJourney" aria-labelledby="quality-journey-heading">
      <div ref={stageRef} className="qualityJourneyStage">
        <div className="qualityJourneyBackdrop" aria-hidden="true">
          <span className="qualityBackdropWash" />
          <span className="qualityBackdropRibbon" />
          <span className="qualityBackdropVeil" />
          <span className="qualityBackdropGrain" />
          <svg className="qualityFlowLines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
            <g className="qualityFlowOrbits">
              <g className="qualityFlowOutline">
                <circle cx="520" cy="420" r="310" />
                <circle cx="520" cy="420" r="350" />
                <circle cx="970" cy="500" r="390" />
                <ellipse cx="720" cy="450" rx="660" ry="290" transform="rotate(-28 720 450)" />
                <ellipse cx="720" cy="450" rx="700" ry="330" transform="rotate(-28 720 450)" />
              </g>
              <g className="qualityFlowBase">
                <circle cx="520" cy="420" r="310" />
                <circle cx="520" cy="420" r="350" />
                <circle cx="970" cy="500" r="390" />
                <ellipse cx="720" cy="450" rx="660" ry="290" transform="rotate(-28 720 450)" />
                <ellipse cx="720" cy="450" rx="700" ry="330" transform="rotate(-28 720 450)" />
              </g>
              <g className="qualityFlowHighlights">
                <circle cx="520" cy="420" r="310" pathLength="1000" />
                <circle cx="970" cy="500" r="390" pathLength="1000" />
                <ellipse cx="720" cy="450" rx="700" ry="330" transform="rotate(-28 720 450)" pathLength="1000" />
              </g>
            </g>
          </svg>
        </div>
        <div className="qualityMiniLayer" aria-hidden="true">
          <img className="qualityMini qualityMiniOne" src="/quality-mono-window-v2.webp" width={360} height={360} alt="" loading="lazy" />
          <img className="qualityMini qualityMiniTwo" src="/quality-mono-detail-v2.webp" width={360} height={360} alt="" loading="lazy" />
          <img className="qualityMini qualityMiniThree" src="/quality-mono-tools-v2.webp" width={360} height={360} alt="" loading="lazy" />
        </div>
        <div className="qualityGalleryViewport" tabIndex={0} role="region"
          aria-label="Unsere vier Qualitätsgrundsätze" aria-describedby="quality-scroll-help" onKeyDown={handleKeyboard}>
          <ul ref={trackRef} className="qualityGalleryTrack">
            <li className="qualityIntro">
              <header className="qualityJourneyHeader">
                <div>
                  <p className="qualityEyebrow">Über Glanzio</p>
                  <h2 id="quality-journey-heading">Wir definieren <em>Sauberkeit neu.</em></h2>
                </div>
              </header>
            </li>
            {items.map((item, index) => (
              <li key={item.title} className="qualityMoment" data-quality-index={index}>
                <figure>
                  <div className="qualityMomentPhoto">
                    <img src={item.image} alt={item.alt} width={item.width} height={item.height} loading="eager" fetchPriority="low" decoding="async" />
                  </div>
                  <figcaption><h3>{item.title}</h3><p>{item.description}</p></figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
        <p id="quality-scroll-help" className="qualityScreenReaderHelp">
          Beim Scrollen bewegen sich die Bilder horizontal. Mit den Pfeiltasten links und rechts können Sie ebenfalls navigieren; Pos1 und Ende führen zum Anfang und Ende.
        </p>
      </div>
    </section>
  );
}
