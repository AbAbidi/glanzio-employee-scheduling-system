# Clarity Clean frontend

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
npm test
```

The enquiry form is currently a presentation-ready interface. Connect it to
an email or CRM endpoint after the company's final contact details and delivery
provider have been chosen.
