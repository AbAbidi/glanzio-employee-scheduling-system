"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_BASE_URL, responseMessage } from "./lib/auth-client";

type PublishedFeedback = { id: string; displayName: string; message: string; rating: number | null; createdAt: string };

export default function CustomerFeedback({ onPrivacy }: { onPrivacy: () => void }) {
  const [items, setItems] = useState<PublishedFeedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submission = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/feedback/published`, { signal: controller.signal, credentials: "omit" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<PublishedFeedback[]>; })
      .then((rows) => { if (!controller.signal.aborted) { setItems(rows); setLoaded(true); } })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      displayName: String(values.get("displayName") ?? "").trim(),
      message: String(values.get("message") ?? "").trim(),
      ...(rating ? { rating } : {}),
      allowPublic: values.get("allowPublic") === "on",
      website: String(values.get("website") ?? ""),
    };
    const signature = JSON.stringify(payload);
    if (submission.current?.signature !== signature) submission.current = { signature, key: crypto.randomUUID() };
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionKey: submission.current!.key }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSuccess(payload.allowPublic ? "Vielen Dank! Ihre Rückmeldung ist eingegangen und wird vor einer möglichen Veröffentlichung geprüft." : "Vielen Dank! Ihr Feedback wurde vertraulich an unser Team übermittelt und wird nicht veröffentlicht.");
      form.reset(); setRating(0); submission.current = null;
    } catch {
      setError("Ihr Feedback konnte nicht gesendet werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.");
    } finally { setBusy(false); }
  }

  return (
    <section className="customerFeedback" id="feedback" aria-labelledby="feedback-title">
      <div className="feedbackIntro"><p className="landingEyebrow">Ihre Erfahrung zählt</p><h2 id="feedback-title">Guter Service.<br /><em>Ehrliches Feedback.</em></h2><p>Was hat Ihnen gefallen? Was können wir verbessern? Teilen Sie Ihre Erfahrung mit Glanzio.</p>
        <div className="publishedFeedback" aria-live="polite">
          {loadError ? <p className="feedbackEmpty">Öffentliche Rückmeldungen sind momentan nicht abrufbar.</p> : !loaded ? <p className="feedbackEmpty">Rückmeldungen werden geladen…</p> : !items.length ? <p className="feedbackEmpty">Noch keine veröffentlichten Rückmeldungen. Ihre Erfahrung kann den Anfang machen.</p> : items.map((item) => <article key={item.id}>
            <header><strong>{item.displayName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("de-DE")}</time></header>
            {item.rating ? <span className="feedbackRating" aria-label={`${item.rating} von 5 Sternen`}>{"★".repeat(item.rating)}<span aria-hidden="true">{"☆".repeat(5 - item.rating)}</span></span> : null}
            <p>{item.message}</p>
          </article>)}
        </div>
      </div>
      <form className="feedbackForm" onSubmit={submit} aria-label="Feedback senden">
        <h3>Ihre Rückmeldung</h3>
        <p>Öffentlich nur mit Ihrer Erlaubnis und nach Prüfung. Bitte keine vertraulichen Daten eintragen.</p>
        <label>Name oder Pseudonym <span>(optional)</span><input name="displayName" maxLength={80} autoComplete="nickname" /></label>
        <fieldset><legend>Ihre Bewertung <span>(optional)</span></legend><div className="feedbackStars">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={rating >= value ? "isSelected" : ""}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><span aria-hidden="true">★</span><span className="feedbackSrOnly">{value} von 5 Sternen</span></label>)}</div>{rating ? <button type="button" className="feedbackTextButton" onClick={() => setRating(0)}>Bewertung entfernen</button> : null}</fieldset>
        <label>Ihr Feedback<textarea name="message" rows={5} minLength={10} maxLength={2000} required /></label>
        <label className="feedbackHoneypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="feedbackPermission"><input name="allowPublic" type="checkbox" /><span>Glanzio darf meinen Text, meinen Namen bzw. mein Pseudonym und meine Bewertung nach Prüfung auf dieser Website veröffentlichen.</span></label>
        <p className="feedbackPrivacy">Ohne Häkchen bleibt Ihr Feedback privat. <button type="button" onClick={onPrivacy}>Datenschutz</button></p>
        <button className="feedbackSubmit" type="submit" disabled={busy}>{busy ? "Wird gesendet…" : "Feedback senden"}<span aria-hidden="true">↗</span></button>
        {error ? <p className="feedbackError" role="alert">{error}</p> : null}
        {success ? <p className="feedbackSuccess" role="status">{success}</p> : null}
      </form>
    </section>
  );
}
