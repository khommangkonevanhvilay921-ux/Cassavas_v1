This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## CassavaLink local demo

The farmer, factory, and admin workspaces share a persistent local JSON store at `.local-data/cassavalink-demo.json`. It is created and seeded on the first API request and is intentionally ignored by Git. The store uses a versioned migration when its schema changes; it is a local prototype adapter, not suitable for Vercel or multi-instance production deployment. Replace `app/lib/demo-store.ts` with a PostgreSQL/Prisma repository before production.

Start the app from this directory with `npm run dev`. Visit `/login` and choose one of the three fictional demo accounts. No password is used in local demo mode. The HTTP-only role cookie is signed with a development-only local secret. Set `DEMO_SESSION_SECRET` (or `AUTH_SECRET`) to a unique random value before using demo sessions in a production deployment; the demo store itself is not production-safe.

All reference prices, farm listings, factories, offers, and transaction fixtures are fictional and labeled DEMO DATA. Payment confirmation records a status only; no payment is transferred. Mock quality checks are simulated visual assessments, not laboratory measurements.

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
