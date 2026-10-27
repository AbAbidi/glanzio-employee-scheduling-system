"use client";

import { useDashboardLanguage } from "./dashboard-language";
import { isManagementRole, type AccountRole } from "../lib/access-policy";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardNavigationProps = {
  role: AccountRole;
};

export default function DashboardNavigation({
  role,
}: DashboardNavigationProps) {
  const { t } = useDashboardLanguage();
  const pathname = usePathname();
  const links =
    isManagementRole(role)
      ? [
          {
            href: "/dashboard",
            label: "Overview",
            note: "Dashboard",
            icon: "◫",
          },
          {
            href: "/dashboard/assignments",
            label: "Assignments",
            note: "Calendar",
            icon: "◷",
          },
          {
            href: "/dashboard/employees",
            label: "Employees",
            note: "Team",
            icon: "◎",
          },
          {
            href: "/dashboard/clients",
            label: "Clients",
            note: "Customers",
            icon: "◇",
          },
          {
            href: "/dashboard/archive",
            label: "Archived records",
            note: "Retained history",
            icon: "▣",
          },
          { href: "/dashboard/feedback", label: "Feedback", note: "Moderation", icon: "✉" },
        ]
      : [
          {
            href: "/dashboard",
            label: "Overview",
            note: "Dashboard",
            icon: "◫",
          },
          {
            href: "/dashboard/assignments",
            label: "Assignments",
            note: "My calendar",
            icon: "◷",
          },
          {
            href: "/dashboard/profile",
            label: "My profile",
            note: "Account",
            icon: "◎",
          },
        ];

  return (
    <nav className="dashboardWorkspaceNav" aria-label={t("Operations workspace")}>
      {[...links.filter((link) => role === "ADMIN" || !["/dashboard/archive", "/dashboard/feedback"].includes(link.href)), ...(role === "MANAGER" ? [{ href: "/dashboard/profile", label: "My profile", note: "Account", icon: "◎" }] : [])].map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            className={active ? "isActive" : ""}
            href={link.href}
            key={link.href}
          >
            <i aria-hidden="true">{link.icon}</i>
            <span>
              {t(link.label)}
              <small>{t(link.note)}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
