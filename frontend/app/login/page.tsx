"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import {
  API_BASE_URL,
  cacheSession,
  clearSessionCache,
  responseMessage,
  restoreSession,
  signOut,
  type AuthenticationResult,
} from "../lib/auth-client";

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
  const [showPassword, setShowPassword] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<AuthenticationResult | null>(null);

  useEffect(() => {
    let isActive = true;

    async function restoreSavedSession() {
      try {
        const restoredSession = await restoreSession();
        if (isActive && restoredSession) {
          setSession(restoredSession);
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
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const result = (await response.json()) as AuthenticationResult;
      cacheSession(result);
      setSession(result);
      setPassword("");
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
      setError("The two passwords do not match.");
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
      setSession(result);
      setNewPassword("");
      setConfirmPassword("");
      clearInvitationFromAddress();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to accept the invitation. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");

    try {
      await signOut();
    } finally {
      setSession(null);
      setEmail("");
      setPassword("");
    }
  }

  return (
    <main className="loginPage">
      <section className="brandPanel" aria-labelledby="product-title">
        <div className="brandMark" aria-label="Employee Scheduling System">
          <span aria-hidden="true">ES</span>
          <span>Employee Scheduling</span>
        </div>

        <div className="brandCopy">
          <p className="eyebrow">Operations, beautifully organized</p>
          <h1 id="product-title">Every shift, site, and team in one calm view.</h1>
          <p className="brandDescription">
            Plan cleaning assignments, protect employee availability, and keep
            monthly working-hour insights close at hand.
          </p>

          <div className="featureList" aria-label="Platform highlights">
            <span>Live schedules</span>
            <span>Protected access</span>
            <span>Student-hour insights</span>
          </div>
        </div>

        <div className="schedulePreview" aria-label="Example daily schedule">
          <div className="scheduleHeader">
            <div>
              <span className="previewLabel">Today</span>
              <strong>Thursday, 31 July</strong>
            </div>
            <span className="shiftCount">3 assignments</span>
          </div>

          <div className="shiftRow">
            <time>08:00</time>
            <span className="shiftLine" aria-hidden="true" />
            <div>
              <strong>Riverside Offices</strong>
              <span>Morning service · 2 employees</span>
            </div>
          </div>
          <div className="shiftRow">
            <time>12:30</time>
            <span className="shiftLine shiftLineAccent" aria-hidden="true" />
            <div>
              <strong>Maison Verdi</strong>
              <span>Weekly visit · 1 employee</span>
            </div>
          </div>
          <div className="shiftRow">
            <time>17:00</time>
            <span className="shiftLine" aria-hidden="true" />
            <div>
              <strong>North Quarter</strong>
              <span>Evening service · 3 employees</span>
            </div>
          </div>
        </div>
      </section>

      <section className="accessPanel" aria-labelledby="access-title">
        <div className="accessCard">
          {isRestoringSession ? (
            <div className="sessionLoading" role="status">
              <span className="loadingDot" aria-hidden="true" />
              Checking your session…
            </div>
          ) : session ? (
            <div className="signedInState">
              <div className="successMark" aria-hidden="true">✓</div>
              <p className="eyebrow">Secure access confirmed</p>
              <h2 id="access-title">Welcome back</h2>
              <p className="signedInMessage">
                You are authenticated and ready to enter the scheduling system.
              </p>

              <dl className="accountSummary">
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{session.user.role}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{session.user.status}</dd>
                </div>
              </dl>

              <a className="primaryButton primaryLink" href="/dashboard">
                Continue to dashboard
              </a>
              <button className="textButton" type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : invitationMode ? (
            <>
              <div className="mobileBrand" aria-hidden="true">ES</div>
              <p className="eyebrow">Employee invitation</p>
              <h2 id="access-title">Create your password</h2>
              <p className="formIntroduction">
                Your administrator has approved this account. Choose a private
                password to activate it and sign in.
              </p>

              <form className="loginForm" onSubmit={handleInvitation} noValidate>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 12 characters"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={12}
                  required
                />

                <label className="confirmPasswordLabel" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={12}
                  required
                />

                {error ? (
                  <p className="formError" role="alert">{error}</p>
                ) : null}

                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    isSubmitting ||
                    newPassword.length < 12 ||
                    confirmPassword.length < 12
                  }
                >
                  {isSubmitting ? "Activating account…" : "Activate my account"}
                </button>
              </form>

              <button
                className="textButton invitationBackButton"
                type="button"
                onClick={() => {
                  setInvitationDismissed(true);
                  setError("");
                  clearInvitationFromAddress();
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div className="mobileBrand" aria-hidden="true">ES</div>
              <p className="eyebrow">Secure team access</p>
              <h2 id="access-title">Welcome back</h2>
              <p className="formIntroduction">
                Sign in with the account created for you by your administrator.
              </p>

              <form className="loginForm" onSubmit={handleLogin} noValidate>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <div className="passwordLabelRow">
                  <label htmlFor="password">Password</label>
                  <button
                    className="showPasswordButton"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
                  {isSubmitting ? "Signing in…" : "Sign in securely"}
                </button>
              </form>

              <p className="accountHelp">
                No account yet? Ask an administrator to create your employee
                account.
              </p>
            </>
          )}
        </div>

        <p className="securityNote">
          Protected by encrypted credentials and role-based access.
        </p>
      </section>
    </main>
  );
}

