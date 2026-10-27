"use client";

import { useDashboardLanguage } from "../dashboard-language";

import { useEffect } from "react";

export default function SitesRedirectPage() {
  const { t } = useDashboardLanguage();
  useEffect(() => {
    window.location.replace("/dashboard/assignments");
  }, []);

  return (
    <main className="managementGate">{t("Moving site management into the assignment calendar...")}</main>
  );
}
