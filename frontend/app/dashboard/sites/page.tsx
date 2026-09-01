"use client";

import { useEffect } from "react";

export default function SitesRedirectPage() {
  useEffect(() => {
    window.location.replace("/dashboard/assignments");
  }, []);

  return (
    <main className="managementGate">
      Moving site management into the assignment calendar...
    </main>
  );
}
