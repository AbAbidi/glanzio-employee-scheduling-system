"use client";

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
        <span>Employee invitation link</span>
        {expiry ? <small>Expires {expiry}</small> : null}
      </div>

      <div className="invitationLinkControls">
        <input
          aria-label="Employee invitation URL"
          type="text"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" onClick={copyInvitation}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a href={url} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>

      <p>Send this complete address to the employee. Generating a new link disables the previous one.</p>
    </div>
  );
}
