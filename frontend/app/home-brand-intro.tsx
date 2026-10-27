"use client";

import { useLayoutEffect } from "react";
import { DASHBOARD_INTRO_KEY, type BrandIntroController, type IntroTrigger } from "./brand-intro-bootstrap";

export function queueDashboardIntro() {
  try {
    window.sessionStorage.setItem(DASHBOARD_INTRO_KEY, String(Date.now()));
  } catch {
    // A decorative transition must never interrupt a successful sign-in.
  }
}

export default function HomeBrandIntro({ trigger = "home" }: { trigger?: IntroTrigger }) {
  useLayoutEffect(() => {
    // Initial documents already started their intro before any page content.
    // The route check prevents hydration from starting it for a second time.
    (window as Window & { __glanzioBrandIntro?: BrandIntroController })
      .__glanzioBrandIntro?.enter(trigger);
  }, [trigger]);

  return null;
}
