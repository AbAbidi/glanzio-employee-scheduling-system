"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardNavigationProps = {
  role: "ADMIN" | "EMPLOYEE";
};

export default function DashboardNavigation({
  role,
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const links =
    role === "ADMIN"
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
    <nav className="dashboardWorkspaceNav" aria-label="Operations workspace">
      {links.map((link) => {
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
              {link.label}
              <small>{link.note}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
