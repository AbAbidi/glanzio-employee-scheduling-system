"use client";

import { useDashboardLanguage } from "../dashboard-language";

import { useState } from "react";

type InvitationLinkPanelProps = {
  url: string;
  expiresAt?: string;
  compact?: boolean;
};

function formattedExpiry(value?: string) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InvitationLinkPanel({
  url,
  expiresAt,
  compact = false,
}: InvitationLinkPanelProps) {
  const { t } = useDashboardLanguage();
  const [copied, setCopied] = useState(false);

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  const expiry = formattedExpiry(expiresAt);

  return (
    <div className={`invitationLinkPanel${compact ? " invitationLinkPanelCompact" : ""}`}>
      <div className="invitationLinkHeading">
        <span>{t("Employee invitation link")}</span>
        {expiry ? <small>{t("Expires ")}{expiry}</small> : null}
      </div>

      <div className="invitationLinkControls">
        <input
          aria-label={t("Employee invitation URL")}
          type="text"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" onClick={copyInvitation}>
          {copied ? t("Copied!") : t("Copy link")}
        </button>
        <a href={url} target="_blank" rel="noreferrer">{t("Open")}</a>
      </div>

      <p>{t("Send this complete address to the employee. Generating a new link disables the previous one.")}</p>
    </div>
  );
}
