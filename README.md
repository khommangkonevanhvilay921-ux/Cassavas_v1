This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## CassavaLink local demo

The farmer, factory, middleman, and admin workspaces share a persistent local JSON store at `.local-data/cassavalink-demo.json`. It is created and seeded on the first API request and is intentionally ignored by Git. Schema version 4 adds email/phone registration, KYC uploads, verification and approval statuses, and official factory prices while preserving existing farm, listing, offer, reference-price, message, and factory data. The store is a local prototype adapter, not suitable for Vercel or multi-instance production deployment. Replace `app/lib/demo-store.ts` with a production database repository before launch.

Start the app from this directory with `npm run dev`. On `/register`, users can register a Farmer, Factory, or Middleman account using email or phone, select a Family Book, National ID Card, or optional Passport upload, and complete a simulated OTP step. The page displays demo code `246810`; no real email or SMS is sent. Uploads accept JPG, PNG, or WebP images up to 2 MB each, with a maximum of 6 Family Book pages, 2 National ID images, or 1 Passport image. Accounts remain `Pending Admin Approval` after verification and cannot access role-specific pages until approved at `/admin/registrations`. Approval does not verify a Factory business profile; the existing factory verification step remains separate. In local development, `/login` also offers fictional Farmer, Factory, and Middleman sample workspaces. Verified factories can publish today's official buying prices; middlemen can request purchases only at the matched official price and cannot offer or negotiate a different price. Any sale and payment take place directly outside CassavaLink.

Set these values in an untracked `.env.local` file to use the administrator workspace:

```env
DEMO_SESSION_SECRET=<unique random value of at least 32 characters>
DEMO_ADMIN_SECRET=<separate unique random value of at least 16 characters>
```

The administrator signs in with `DEMO_ADMIN_SECRET`; the administrator role cannot be requested during registration or selected as a demo account. In production, set `DEMO_SESSION_SECRET` or `AUTH_SECRET` and `DEMO_ADMIN_SECRET` to independently generated secrets. Do not commit these values. The local JSON store and sample identities are for development only and are not safe for production hosting.

All official prices, reference prices, farm listings, factories, and offers are fictional demo data. KYC files are stored locally in the prototype's JSON data file; use only test documents. Approval, OTP verification, and image review are simulated frontend flows, not secure identity verification or production authorization. CassavaLink provides market information and buyer contacts; parties arrange any sale and payment outside the platform. Mock quality checks are simulated visual assessments, not laboratory measurements.

Run checks with `npm run lint`, `npm test`, and `npm run build`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
