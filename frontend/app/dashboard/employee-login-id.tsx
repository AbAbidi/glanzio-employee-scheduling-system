"use client";

import { useDashboardLanguage } from "./dashboard-language";

export default function EmployeeLoginId({ code, prominent = false }: { code?: string; prominent?: boolean }) {
  const { t } = useDashboardLanguage();
  if (!code) return null;
  return (
    <aside className={`employeeLoginIdCard${prominent ? " isProminent" : ""}`} aria-label={t("Employee login ID")}>
      <span>{t("Employee login ID")}</span>
      <strong>{code}</strong>
    </aside>
  );
}
