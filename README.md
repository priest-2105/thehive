# The Hive Cup

Mobile tournament fixtures, results, bracket, and admin match timer.

## Run locally

Run `npm install` and `npm run dev` for the interface. API routes require Vercel Functions and a connected Blob store; use `vercel dev` with the project environment variables for full local testing. The public view is `/`, and `/admin` contains score controls and the local timer. `/timer` redirects to `/admin/timer` on Vercel.

`npm run build` creates `dist/`, `npm run preview` serves that build locally, and `npm test` runs the tournament tests.

## Vercel

The existing Vercel deployment hosts both the Vite app and the `/api/*` functions. No separate server is needed:

1. In the Vercel project, open **Storage → Create Database → Blob**. Choose a **private** store and connect it to this project. Vercel supplies `BLOB_READ_WRITE_TOKEN` automatically.
2. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` for Production (and Preview if needed). Use a strong shared password.
3. Redeploy the latest commit so the functions receive both settings.
4. Sign in at `/admin` and record a test result. Check `/` on another phone. Scores refresh every 10 seconds and when the page regains focus.

Use the Vite preset and `dist` output directory. The Blob Hobby free allowance has usage limits.

## Data and access

Results and semi-final pairings live in one private Vercel Blob and are shared across devices. A Vercel Function checks the password and issues an HTTP-only admin cookie. The match timer remains in the admin browser's local storage and is not shared across devices. Clearing that browser's data resets its timer but does not erase scores.

In the admin Queue, save a **live score** after each goal or correction; the match stays editable there. Choose **Mark full time** only when play ends. A tied final score requires a penalty winner. Teams advance in the bracket only after full time. Older saved results without a status remain final.

## Source of tournament facts

`chat.txt` is the original chat export and `chat.md` is the readable rendering. Check both before changing teams, fixtures, or rules. Do not publish raw chat excerpts or credentials.
