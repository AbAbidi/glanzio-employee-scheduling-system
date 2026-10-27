export const HOME_INTRO_SESSION_KEY = "glanzio.home-intro.seen.v1";
export const DASHBOARD_INTRO_KEY = "glanzio.dashboard-intro.pending.v1";
export type IntroTrigger = "home" | "access" | "dashboard";
export type BrandIntroController = { enter: (trigger: IntroTrigger) => void };

// Runs synchronously, immediately after the overlay markup and before page
// content. React only notifies this controller about subsequent client routes.
export const BRAND_INTRO_BOOTSTRAP = `
(function () {
  if (window.__glanzioBrandIntro) return;
  var intro = document.getElementById("glanzio-brand-intro");
  if (!intro) return;
  var homeKey = ${JSON.stringify(HOME_INTRO_SESSION_KEY)};
  var dashboardKey = ${JSON.stringify(DASHBOARD_INTRO_KEY)};
  var lastRoute = null;
  var navigation = window.performance.getEntriesByType("navigation")[0];
  var documentWasReloaded = navigation && navigation.type === "reload";
  var homeShown = false;
  var timer = 0;
  function dismiss() {
    intro.hidden = true;
    window.clearTimeout(timer);
  }
  function enter(trigger) {
    var route = window.location.pathname + window.location.search;
    if (route === lastRoute) return;
    var isRefresh = lastRoute === null && documentWasReloaded;
    lastRoute = route;
    dismiss();
    intro.setAttribute("data-intro-trigger", trigger);
    if (trigger === "dashboard") {
      try {
        var pending = window.sessionStorage.getItem(dashboardKey);
        window.sessionStorage.removeItem(dashboardKey);
        var age = Date.now() - Number(pending);
        if (!isRefresh && (!pending || !Number.isFinite(age) || age < 0 || age > 120000)) return;
      } catch (_) { if (!isRefresh) return; }
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (trigger === "home") {
      if (homeShown || (window.location.hash && !isRefresh)) return;
      try {
        if (!isRefresh && window.sessionStorage.getItem(homeKey) === "1") return;
        window.sessionStorage.setItem(homeKey, "1");
      } catch (_) {}
      homeShown = true;
    }
    // Flush the hidden state so animations restart on client-side navigation.
    void intro.offsetWidth;
    timer = window.setTimeout(dismiss, 2000);
    intro.hidden = false;
  }
  intro.addEventListener("animationend", function (event) {
    if (event.animationName === "homeBrandIntroExit") dismiss();
  });
  ["pointerdown", "wheel", "keydown"].forEach(function (event) {
    window.addEventListener(event, dismiss, { capture: true, passive: true });
  });
  window.addEventListener("pagehide", dismiss);
  window.__glanzioBrandIntro = { enter: enter };
  var path = window.location.pathname.replace(/\\/+$/, "") || "/";
  if (path === "/") enter("home");
  else if (path === "/login") enter("access");
  else if (path === "/dashboard" || (documentWasReloaded && path.indexOf("/dashboard/") === 0)) enter("dashboard");
})();
`;
