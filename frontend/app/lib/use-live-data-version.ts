"use client";

import { useEffect, useState } from "react";
import { OPERATIONS_CHANGED_EVENT } from "./auth-client";

/** Revalidate visible reporting views after changes, tab focus, or elapsed visits. */
export function useLiveDataVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "hidden") setVersion((current) => current + 1);
    };
    const onStorage = (event: StorageEvent) => { if (event.key === OPERATIONS_CHANGED_EVENT) update(); };
    const timer = window.setInterval(update, 15_000);
    window.addEventListener(OPERATIONS_CHANGED_EVENT, update);
    window.addEventListener("focus", update);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OPERATIONS_CHANGED_EVENT, update);
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return version;
}
