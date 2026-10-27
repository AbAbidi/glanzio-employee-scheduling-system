"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { COOKIE_PREFERENCES_EVENT, readCookieChoice, saveCookieChoice, type CookieChoice } from "./lib/cookie-preferences";

export default function CookiePreferences() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const legal = new URLSearchParams(window.location.search).get("legal");
      const isLegalPage = legal === "privacy" || legal === "impressum";
      // Only open automatically here. A pending route effect must not close
      // preferences that the visitor has just opened using a footer link.
      if (pathname === "/" && !isLegalPage && !readCookieChoice()) setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  useEffect(() => {
    const show = () => { setDetails(false); setOpen(true); };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, show);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, show);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [open]);

  function choose(value: CookieChoice["choice"]) { saveCookieChoice(value); setOpen(false); }
  if (!open) return null;
  return <dialog ref={dialog} className="cookiePreferences" aria-labelledby="cookie-title" aria-describedby="cookie-description" onCancel={(event) => { event.preventDefault(); choose("necessary"); }}>
    <header><span aria-hidden="true">✧</span><button type="button" aria-label="Mit notwendigen Cookies fortfahren" onClick={() => choose("necessary")}>×</button></header>
    <p className="cookieEyebrow">Glanzio · Datenschutz</p><h2 id="cookie-title">Ihre Privatsphäre.<br /><em>Ihre Entscheidung.</em></h2>
    <p id="cookie-description">Für Anmeldung und Sicherheit verwenden wir technisch notwendige Cookies. Aktuell setzen wir keine Analyse- oder Marketing-Cookies ein. Beide Optionen erlauben Ihnen, die Website zu nutzen.</p>
    <button className="cookieDetailsToggle" type="button" aria-expanded={details} onClick={() => setDetails(!details)}>Cookie-Einstellungen {details ? "−" : "+"}</button>
    {details ? <div className="cookieDetails"><div><strong>Technisch notwendig</strong><span>Immer aktiv</span></div><p>Sitzungsverwaltung für den Teamzugang, Sicherheitsfunktionen und die Speicherung Ihrer Auswahl. Die Auswahl wird ohne persönliche Kennung für bis zu 180 Tage in diesem Browser gespeichert.</p><div><strong>Analyse & Marketing</strong><span>Nicht im Einsatz</span></div><p>Es gibt derzeit keine optionalen Tracking-Cookies. Sie können diese Information jederzeit über „Cookie-Einstellungen“ erneut öffnen.</p></div> : null}
    <div className="cookieChoices"><button type="button" onClick={() => choose("necessary")}>Nur notwendige</button><button type="button" onClick={() => choose("accept")}>Akzeptieren</button></div>
    <footer><a href="/?legal=privacy" target="_blank" rel="noopener noreferrer">Datenschutz</a><a href="/?legal=impressum" target="_blank" rel="noopener noreferrer">Impressum</a></footer>
  </dialog>;
}
