"use client";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import {
  API_BASE_URL,
  cacheSession,
  clearSessionCache,
  responseMessage,
  restoreSession,
  type AuthenticationResult,
} from "../lib/auth-client";
import PortalLegalDialog, {
  type PortalLegalPanel,
} from "../portal-legal-dialog";
import LoginAccessIcon from "./login-access-icon";
import HomeBrandIntro, { queueDashboardIntro } from "../home-brand-intro";
import { openCookiePreferences } from "../lib/cookie-preferences";

const PASSWORD_REQUIREMENTS = [
  {
    label: "Mindestens 12 Zeichen",
    test: (value: string) => value.length >= 12,
  },
  {
    label: "Je ein Groß- und Kleinbuchstabe",
    test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value),
  },
  {
    label: "Mindestens eine Zahl",
    test: (value: string) => /\d/.test(value),
  },
  {
    label: "Mindestens ein Sonderzeichen",
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
] as const;

function PortalLegalSummary({
  onOpen,
}: {
  onOpen: (panel: PortalLegalPanel) => void;
}) {
  return (
    <section
      className="invitationLegalSummary"
      aria-label="Datenschutz & Rechtliches"
    >
      <div className="invitationLegalActions">
        <button type="button" onClick={() => onOpen("privacy")}>
          Datenschutzerklärung
        </button>
        <button type="button" onClick={() => onOpen("impressum")}>
          Impressum
        </button>
        <button type="button" onClick={openCookiePreferences}>Cookie-Einstellungen</button>
      </div>
    </section>
  );
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return "";
}

function clearInvitationFromAddress() {
  window.history.replaceState({}, "", window.location.pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const locationSearch = useSyncExternalStore(
    subscribeToLocation,
    getLocationSearch,
    getServerLocationSearch,
  );
  const invitationToken =
    new URLSearchParams(locationSearch).get("invitation") ?? "";
  const [invitationDismissed, setInvitationDismissed] = useState(false);
  const invitationMode = Boolean(invitationToken) && !invitationDismissed;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [legalPanel, setLegalPanel] = useState<PortalLegalPanel | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [error, setError] = useState("");

  const passwordChecks = PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    valid: requirement.test(newPassword),
  }));
  const passwordMeetsRequirements = passwordChecks.every(
    (requirement) => requirement.valid,
  );
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  useEffect(() => {
    let isActive = true;

    if (invitationMode) {
      return () => {
        isActive = false;
      };
    }

    async function restoreSavedSession() {
      try {
        const restoredSession = await restoreSession();
        if (isActive && restoredSession) {
          cacheSession(restoredSession);
          window.location.replace("/dashboard");
          return;
        }
      } catch {
        clearSessionCache();
      } finally {
        if (isActive) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreSavedSession();
    return () => {
      isActive = false;
    };
  }, [invitationMode]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(email.includes("@") ? { email: email.trim() } : { identifier: email.trim() }),
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const result = (await response.json()) as AuthenticationResult;
      cacheSession(result);
      setPassword("");
      queueDashboardIntro();
      window.location.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the backend. Make sure it is running.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    if (!passwordMeetsRequirements) {
      setError("Das Passwort erfüllt noch nicht alle Sicherheitsanforderungen.");
      return;
    }

    if (!humanConfirmed || companyWebsite) {
      setError("Bitte bestätigen Sie, dass Sie ein Mensch sind.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/accept-invitation`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitationToken, newPassword }),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const result = (await response.json()) as AuthenticationResult;
      cacheSession(result);
      setNewPassword("");
      setConfirmPassword("");
      clearInvitationFromAddress();
      queueDashboardIntro();
      window.location.replace("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Die Einladung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`loginPage invitationPage${invitationMode ? "" : " isLoginMode"}`}>
      <HomeBrandIntro trigger="access" />
      <section
        className="brandPanel invitationBrandPanel"
        aria-labelledby="product-title"
      >
        <div className="brandMark" aria-label="Glanzio Reinigung team portal">
          <img
            className="loginBrandLogo"
            src="/glanzio-reinigung-logo.png"
            alt="Glanzio Reinigung"
          />
        </div>

        <div className="invitationBrandCopy">
          <p className="eyebrow">
            {invitationMode ? "Willkommen im Glanzio Team" : "Glanzio Teamportal"}
          </p>
          <h1 id="product-title">
            {invitationMode
              ? "Ihr persönlicher Zugang. Sicher eingerichtet."
              : "Ihr Arbeitstag. Klar organisiert."}
          </h1>
          <p className="brandDescription">
            {invitationMode
              ? "Aktivieren Sie Ihr Mitarbeiterkonto, um Einsatzpläne, Arbeitszeiten und persönliche Informationen geschützt abzurufen."
              : "Melden Sie sich sicher an und behalten Sie Einsatzpläne, Teams und Arbeitszeiten zuverlässig im Blick."}
          </p>

          <div className="invitationSteps" aria-label="Vorteile Ihres Zugangs">
            <article>
              <div>
                <strong>Einsatzpläne im Blick</strong>
                <p>Ihre bestätigten Termine und Einsatzorte an einem Ort.</p>
              </div>
            </article>
            <article>
              <div>
                <strong>Persönlich und geschützt</strong>
                <p>Der Zugang gehört ausschließlich Ihnen.</p>
              </div>
            </article>
            <article>
              <div>
                <strong>Arbeitszeiten transparent</strong>
                <p>Nachvollziehbare Monats- und Stundenübersichten.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className="accessPanel invitationAccessPanel"
        aria-labelledby="access-title"
      >
        <div className="accessCard invitationAccessCard">
          {invitationMode ? (
            <>
              <img
                className="mobileBrandLogo"
                src="/glanzio-reinigung-logo.png"
                alt="Glanzio Reinigung"
              />
              <LoginAccessIcon />
              <p className="eyebrow">Sichere Mitarbeitereinladung</p>
              <h2 id="access-title">Konto aktivieren</h2>
              <p className="formIntroduction">
                Legen Sie Ihr persönliches Passwort fest und bestätigen Sie kurz,
                dass Sie ein Mensch sind. Danach gelangen Sie direkt zu Ihrem Dashboard.
              </p>

              <form
                className="loginForm invitationForm"
                onSubmit={handleInvitation}
                noValidate
              >
                <label htmlFor="new-password">Neues Passwort</label>
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Sicheres Passwort eingeben"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError("");
                  }}
                  aria-describedby="password-requirements"
                  aria-invalid={newPassword.length > 0 && !passwordMeetsRequirements}
                  required
                />

                <div
                  id="password-requirements"
                  className="passwordRequirements"
                  aria-label="Passwortanforderungen"
                >
                  {passwordChecks.map((requirement) => (
                    <span
                      key={requirement.label}
                      className={
                        newPassword.length === 0
                          ? ""
                          : requirement.valid
                            ? "isValid"
                            : "isInvalid"
                      }
                    >
                      <i aria-hidden="true">{requirement.valid ? "✓" : "•"}</i>
                      {requirement.label}
                    </span>
                  ))}
                </div>

                {newPassword.length > 0 && !passwordMeetsRequirements ? (
                  <p className="passwordAlert" role="status">
                    Das Passwort erfüllt noch nicht alle Anforderungen.
                  </p>
                ) : null}

                <label className="confirmPasswordLabel" htmlFor="confirm-password">
                  Passwort bestätigen
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Passwort wiederholen"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                  required
                />
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <p className="passwordAlert" role="status">
                    Die Passwörter stimmen noch nicht überein.
                  </p>
                ) : null}

                <label
                  className={`humanConfirmation${humanConfirmed ? " isConfirmed" : ""}`}
                  htmlFor="human-confirmation"
                >
                  <input
                    id="human-confirmation"
                    name="humanConfirmation"
                    type="checkbox"
                    checked={humanConfirmed}
                    onChange={(event) => {
                      setHumanConfirmed(event.target.checked);
                      setError("");
                    }}
                  />
                  <span>
                    <strong>
                      {humanConfirmed ? "Bestätigt" : "Ich bin ein Mensch"}
                    </strong>
                    <small>
                      {humanConfirmed
                        ? "Sie haben die persönliche Kontoaktivierung bestätigt."
                        : "Ich führe diese Kontoaktivierung selbst durch."}
                    </small>
                  </span>
                </label>

                <div className="botField" aria-hidden="true">
                  <label htmlFor="company-website">Website</label>
                  <input
                    id="company-website"
                    name="companyWebsite"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={companyWebsite}
                    onChange={(event) => setCompanyWebsite(event.target.value)}
                  />
                </div>

                {error ? (
                  <p className="formError" role="alert">{error}</p>
                ) : null}

                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !passwordMeetsRequirements ||
                    !passwordsMatch ||
                    !humanConfirmed
                  }
                >
                  {isSubmitting ? "Konto wird aktiviert…" : "Konto aktivieren"}
                </button>
              </form>

              <PortalLegalSummary onOpen={setLegalPanel} />

              <button
                className="textButton invitationBackButton"
                type="button"
                onClick={() => {
                  setInvitationDismissed(true);
                  setError("");
                  clearInvitationFromAddress();
                }}
              >
                Zurück zur Anmeldung
              </button>
            </>
          ) : isRestoringSession ? (
            <div className="sessionLoading" role="status">
              <span className="loadingDot" aria-hidden="true" />
              Checking your session…
            </div>
          ) : (
            <>
              <img
                className="mobileBrandLogo"
                src="/glanzio-reinigung-logo.png"
                alt="Glanzio Reinigung"
              />
              <LoginAccessIcon />
              <p className="eyebrow">Sicherer Teamzugang</p>
              <h2 id="access-title">Einloggen</h2>
              <p className="formIntroduction">
                Melden Sie sich mit Ihrem persönlichen Glanzio-Konto an.
              </p>

              <form className="loginForm" onSubmit={handleLogin} noValidate>
                <label htmlFor="email">Identifikationsnummer oder E-Mail-Adresse</label>
                <input
                  id="email"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="z. B. AMT359 / Admin-E-Mail"
                  maxLength={320}
                  autoCapitalize="none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <label className="loginPasswordLabel" htmlFor="password">Passwort</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Passwort eingeben"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                {error ? (
                  <p className="formError" role="alert">{error}</p>
                ) : null}

                <button
                  className="primaryButton"
                  type="submit"
                  disabled={isSubmitting || !email || !password}
                >
                  {isSubmitting ? "Anmeldung läuft…" : "Anmelden"}
                </button>
              </form>

              <p className="accountHelp">
                Noch kein Konto? Ihr Administrator erstellt Ihren persönlichen
                Mitarbeiterzugang.
              </p>
              <PortalLegalSummary onOpen={setLegalPanel} />
            </>
          )}
        </div>

        <p className="securityNote">
          Geschützt durch verschlüsselte Zugangsdaten und rollenbasierte Berechtigungen.
        </p>
      </section>

      {legalPanel ? (
        <PortalLegalDialog
          panel={legalPanel}
          onClose={() => setLegalPanel(null)}
        />
      ) : null}
    </main>
  );
}
