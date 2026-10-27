"use client";

import { useEffect, useRef, useState } from "react";
import BlockRevealText from "./block-reveal-text";

const germanNetworkCopy: Record<string, string> = {
  "What sets Glanzio apart": "Was Glanzio auszeichnet",
  "Quality in": "Qualität in",
  "every detail.": "jedem Detail.",
  "Four principles shape every Glanzio service.":
    "Vier Grundsätze prägen jeden Einsatz bei Glanzio.",
  "Glanzio stands for excellent cleaning services at Lake Constance.":
    "Glanzio steht für exzellente Reinigungs\u00addienst\u00adleistungen am Bodensee.",
  "Our aim is not only to clean, but to preserve value and create feel-good atmospheres.":
    "Unser Anspruch ist es, nicht nur zu reinigen, sondern Werte zu erhalten und Wohlfühlatmosphären zu schaffen.",
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export default function StandardsNetwork({ language }: { language: "de" | "en" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const t = (text: string) => language === "de" ? (germanNetworkCopy[text] ?? text) : text;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pointer = { x: -1000, y: -1000, active: false };
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const seedParticles = () => {
      const count = Math.max(34, Math.min(82, Math.round(width / 20)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
      }));
    };

    const resize = () => {
      const rectangle = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rectangle.width;
      height = rectangle.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seedParticles();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const linkDistance = Math.min(145, Math.max(105, width / 10));

      particles.forEach((particle, index) => {
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -12 || particle.x > width + 12) particle.vx *= -1;
          if (particle.y < -12 || particle.y > height + 12) particle.vy *= -1;
        }

        for (
          let nextIndex = index + 1;
          nextIndex < particles.length;
          nextIndex += 1
        ) {
          const next = particles[nextIndex];
          const distance = Math.hypot(particle.x - next.x, particle.y - next.y);
          if (distance >= linkDistance) continue;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(next.x, next.y);
          context.strokeStyle = `rgba(199, 244, 110, ${(1 - distance / linkDistance) * 0.25})`;
          context.lineWidth = 0.8;
          context.stroke();
        }

        if (pointer.active) {
          const pointerDistance = Math.hypot(
            particle.x - pointer.x,
            particle.y - pointer.y,
          );
          if (pointerDistance < 180) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(pointer.x, pointer.y);
            context.strokeStyle = `rgba(255, 255, 255, ${(1 - pointerDistance / 180) * 0.3})`;
            context.lineWidth = 0.8;
            context.stroke();
          }
        }

        context.beginPath();
        context.arc(particle.x, particle.y, 1.6, 0, Math.PI * 2);
        context.fillStyle = "rgba(225, 255, 168, 0.72)";
        context.fill();
      });

      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rectangle = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rectangle.left;
      pointer.y = event.clientY - rectangle.top;
      pointer.active = true;
    };
    const handlePointerLeave = () => {
      pointer.active = false;
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw();
    });

    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    resize();
    draw();

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <section
      id="about"
      className={`connectedStandards${isVisible ? " isVisible" : ""}`}
      aria-labelledby="connected-standards-title"
      ref={sectionRef}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="connectedStandardsContent">
        <div className="connectedStandardsIntro">
          <p>{t("What sets Glanzio apart")}</p>
          <h2 id="connected-standards-title">
            {t("Quality in")}{" "}
            <br />
            {t("every detail.")}
          </h2>
          <span>{t("Four principles shape every Glanzio service.")}</span>
        </div>
        <blockquote className="connectedStandardsStatement">
          <BlockRevealText text={t("Glanzio stands for excellent cleaning services at Lake Constance.")} />
          <BlockRevealText text={t("Our aim is not only to clean, but to preserve value and create feel-good atmospheres.")} />
        </blockquote>
      </div>
    </section>
  );
}
