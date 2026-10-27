/* eslint-disable @next/next/no-img-element -- The logo is needed before React or the image optimizer starts. */
import { BRAND_INTRO_BOOTSTRAP } from "./brand-intro-bootstrap";

// Critical styling also covers the interval before the full stylesheet arrives.
const criticalStyles = `
.homeBrandIntro{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,#fffdf7 0%,transparent 65%),#f3eddf}
.homeBrandIntro[hidden]{display:none}
.homeBrandIntroLogo{display:block;width:min(68vw,340px)}
.homeBrandIntroLogo img{display:block;width:100%;height:auto}
@media(prefers-reduced-motion:reduce){.homeBrandIntro{display:none}}
`;

export default function BrandIntroShell() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalStyles }} />
      <div
        id="glanzio-brand-intro"
        className="homeBrandIntro"
        hidden
        aria-hidden="true"
        data-intro-trigger="none"
        suppressHydrationWarning
      >
        <span className="homeBrandIntroLogo">
          <img src="/glanzio-reinigung-logo.png" alt="" width={781} height={269} fetchPriority="high" />
        </span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: BRAND_INTRO_BOOTSTRAP }} />
    </>
  );
}
