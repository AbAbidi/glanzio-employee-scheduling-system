# Glanzio Reinigung frontend

Public website and secure operations interface for the Employee Scheduling
System. It uses React, Next.js-compatible app routes, Vinext, and Vite.

## Routes

- `/` — public cleaning-company landing page
- `/login` — sign in and employee invitation acceptance
- `/dashboard` — authenticated admin or employee scheduling summary

## Local setup

The frontend expects the NestJS API at `http://localhost:3000/api/v1`.
Copy `.env.example` to `.env.local` if `.env.local` does not already exist:

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"
NEXT_PUBLIC_WHATSAPP_NUMBER="+49 176 83446967"
```

Install and run:

```powershell
npm install
npm run dev
```

The development server opens on `http://localhost:5173`.

## Verification

```powershell
npm run lint
npm run test:auth
npm test
```

The public contact section displays Glanzio Reinigung&apos;s configured telephone,
WhatsApp, email, business hours, and Impressum address. The enquiry form remains
a presentation interface until an email or CRM delivery provider is connected.

## Session renewal

Dashboard analysis, the assignment calendar, and the student monthly preview
revalidate every 15 seconds while visible, on tab focus, and after relevant API
changes. A recurring visit's completion is independent from its siblings.
Student credit previews open under the selected employee and display at most
five allocation rows before scrolling. The preview has no download, refresh,
or closure buttons; exports stay in the employee directory. Finished student
months are closed automatically by the server, and their final PDFs are frozen.
The preview retains the simulation explanation; exports add no extra PDF lines.

Dashboard API calls use `authenticatedFetch` from `app/lib/auth-client.ts`.
It keeps access tokens in memory, renews them shortly before expiration using
the existing HttpOnly refresh cookie, and retries an authentication rejection
once. Concurrent calls share one refresh; Web Locks also serialize cookie
rotation across tabs in supporting browsers. Network failures, validation
errors, and permission failures are not automatically replayed. A genuinely
expired/revoked refresh session requires sign-in again without clearing the
open form. No token lifetime or backend authorization rule is weakened.

Run the mocked browser regression with the frontend dev server running:

```powershell
npx cypress run --spec cypress/e2e/session_refresh.ui.cy.ts
```

## Homepage feedback, glass story and cookie notice

The homepage uses real backend feedback, with publication permission off by default and admin moderation at `/dashboard/feedback`. Empty/error states never substitute invented reviews. The glass story uses the original rainy-street/windowsill and foamy-window photographs, with no dense v7 overlay. A simple black photographic squeegee with a little attached foam follows the smoothed scroll-controlled wipe; there is no glass-fluid canvas, glowing liquid bank, generated tool runoff, or WebGL initialization for this section. The original subtle window runoff remains, paused offscreen. Reduced motion shows the static clear window. The tool asset is documented in `../docs/glass-squeegee-v6-assets.md`. The v7 experiment and assets are retained only as historical source, not loaded by the homepage. The continuously flowing horizontal-gallery lines also support reduced motion, with line colours following the green-to-beige scroll blend.

On the first homepage visit, a cookie notice allows either acceptance or necessary-only continuation. It does not open automatically on `/login` or invitation links, and direct privacy/imprint links remain accessible without a cookie gate. There are currently no optional analytics/marketing cookies. The choice stores only its mode, version and timestamp in this browser for 180 days, with a session fallback if storage is unavailable. Cookie preferences can be reopened from the homepage footer and access-page legal links. This is not a gate requiring consent to tracking.
