"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardLanguage } from "../dashboard-language";

export default function ClientArchiveDialog({ name, onConfirm, onClose }: {
  name: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useDashboardLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("The client could not be archived."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="clientArchiveDialog" aria-labelledby="client-archive-title" aria-describedby="client-archive-description" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <span className="clientArchiveIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 9h16v11H4zM3 4h18v5H3zm6 9h6" /></svg></span>
        <button type="button" aria-label={t("Close")} disabled={busy} onClick={onClose}>×</button>
      </header>
      <p className="clientArchiveEyebrow">{t("Archive client")}</p>
      <h2 id="client-archive-title">{name}</h2>
      <p id="client-archive-description">{t("This client and its active sites will leave the directory. Previous assignments and accounting history are preserved in the admin archive.")}</p>
      <p className="clientArchiveHint">{t("Resolve future or ongoing assignments before archiving.")}</p>
      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      <footer>
        <button ref={cancelRef} type="button" disabled={busy} onClick={onClose}>{t("Cancel")}</button>
        <button className="clientArchiveConfirm" type="button" disabled={busy} onClick={() => void confirm()}>{t(busy ? "Archiving…" : "Archive client")}</button>
      </footer>
    </dialog>
  );
}
