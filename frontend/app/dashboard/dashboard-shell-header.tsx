"use client";

import { useDashboardLanguage } from "./dashboard-language";
import type { AccountRole } from "../lib/access-policy";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */

import Link from "next/link";
import { useEffect } from "react";
import { signOut } from "../lib/auth-client";
import DashboardNavigation from "./dashboard-navigation";

type DashboardShellHeaderProps = {
  email: string | null;
  loginCode?: string;
  role: AccountRole;
};

export default function DashboardShellHeader({
  email,
  loginCode,
  role,
}: DashboardShellHeaderProps) {
  const { t, language, setLanguage } = useDashboardLanguage();
  const identity = role !== "ADMIN" && loginCode ? `ID ${loginCode}` : email || "Glanzio Team";
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previous; };
  }, [language]);
  async function handleSignOut() {
    await signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Full reload clears authenticated client memory after logout.
    window.location.href = "/";
  }

  return (
    <section className="dashboardShellHeader">
      <header className="dashboardUnifiedTopbar">
        <Link className="dashboardUnifiedBrand" href="/dashboard">
          <img
            className="dashboardUnifiedBrandLogo"
            src="/glanzio-reinigung-logo.png"
            alt="Glanzio Reinigung"
          />
        </Link>
        <DashboardNavigation role={role} />
        <div className={`dashboardUnifiedIdentity${role === "MANAGER" ? " isManager" : ""}`}>
          <span className="dashboardUserAvatar" aria-hidden="true">
            {identity.charAt(0).toUpperCase()}
          </span>
          <span className="dashboardUserDetails">
            <small>{identity}</small>
            <strong>{role === "MANAGER" ? "Admin / Gestionnaire" : t(role)}</strong>
          </span>
          {role === "MANAGER" ? <span className="managerAccessBadge">Admin / Gestionnaire</span> : null}
          <button
            className="dashboardLanguageButton"
            type="button"
            aria-label={language === "en" ? "Switch dashboard to German" : "Dashboard auf Englisch umstellen"}
            onClick={() => setLanguage(language === "en" ? "de" : "en")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c4 5 4 13 0 18-4-5-4-13 0-18Z" /></svg>
            {language === "en" ? "Deutsch" : "English"}
          </button>
          <button type="button" onClick={handleSignOut}>{t("Sign out")}</button>
        </div>
      </header>
    </section>
  );
}
