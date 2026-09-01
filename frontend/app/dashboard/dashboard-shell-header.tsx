"use client";

import Link from "next/link";
import { signOut } from "../lib/auth-client";
import DashboardNavigation from "./dashboard-navigation";

type DashboardShellHeaderProps = {
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export default function DashboardShellHeader({
  email,
  role,
}: DashboardShellHeaderProps) {
  async function handleSignOut() {
    await signOut();
    window.location.href = "/";
  }

  return (
    <section className="dashboardShellHeader">
      <header className="dashboardUnifiedTopbar">
        <Link className="dashboardUnifiedBrand" href="/dashboard">
          <span aria-hidden="true">CC</span>
          <strong>
            Clarity Clean
            <small>Operations</small>
          </strong>
        </Link>
        <DashboardNavigation role={role} />
        <div className="dashboardUnifiedIdentity">
          <span className="dashboardUserAvatar" aria-hidden="true">
            {email.charAt(0).toUpperCase() || "A"}
          </span>
          <span className="dashboardUserDetails">
            <small>{email}</small>
            <strong>{role}</strong>
          </span>
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
    </section>
  );
}
