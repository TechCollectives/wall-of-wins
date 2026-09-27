# TIQC Sticky Wall

A live sticky-note wall for events. People scan a QR code, post a wish, a win or a thank-you from their phone, and watch it land on the big screen.

**Live:** https://wall-of-wins-8x46.vercel.app

## Stack

Vite + React + TypeScript on Vercel, with Supabase (Postgres, row-level security, Realtime).

## Local development

Needs Node 24+, Docker and the Supabase CLI.

```bash
npm install
supabase start                # local database in Docker
cp .env.example .env.local    # fill in from: supabase status -o env
npm run seed:demo             # demo wall; prints its links
npm run dev
```

## Tests

```bash
npm test          # unit tests
npm run test:db   # database security tests
npm run build     # type-check + production build
```

## Creating walls

```bash
npm run new-event:cloud -- "Wall Title" wall-slug
npm run walls:cloud
```

The full operations and maintenance guide is kept by the maintainer outside this repo.
