# PickleRally

A mobile-app-style web app for pickleball game events and player finding, backed by Supabase.

## Features

- **Events** — Browse open play, leagues, and tournaments. Search by name or location. Create events (when Supabase + auth configured).
- **Find Players** — Discover players by skill level (2.0–5.0) and location. Filter and search.
- **Profile** — Sign in, edit profile, manage events (coming soon).

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, copy the **Project URL** and **anon public** key.
3. In **supabase/config.js**, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. In **SQL Editor**, run the contents of **supabase/schema.sql** to create tables and seed data.

Without Supabase, the app uses mock data.

## Run Locally

1. Open `index.html` in a browser, or
2. `npx serve .` — then open the URL shown

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Supabase (PostgreSQL, Auth)
- Mobile-first, responsive layout
- No build step required
