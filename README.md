# The Hive Cup

Mobile tournament fixtures, results, bracket, and shared match timer.

## Local development

Run `npm install`, add `ADMIN_PASSWORD=your-password` to a root `.env` file, then run `npm run dev`. Vite serves the app at `http://localhost:5173`; the local Node API runs on port 3001. The public app is `/`, the read-only clock is `/timer`, and admin sign-in is `/admin` (including `/admin/timer`). Local results are saved in `results.json` and the clock in `timer.json`.

Run `npm run build` to create `dist/`. Run `npm test` to check the Vercel API flow.

## Vercel deployment

Use the **Vite** framework preset and `dist` output directory. `vercel.json` rewrites `/admin`, `/admin/timer`, and `/timer` to the Vite app, while files under `api/` run as Vercel Functions.

Add these environment variables in the Vercel project for every environment you deploy:

- `ADMIN_PASSWORD`: the shared admin sign-in password.
- `UPSTASH_REDIS_REST_URL`: the HTTPS REST endpoint of an Upstash Redis database.
- `UPSTASH_REDIS_REST_TOKEN`: its standard REST token (not the read-only token).

The API also accepts `KV_REST_API_URL` and `KV_REST_API_TOKEN` if an existing Vercel Redis integration provides those names. Keep all credentials server-side; do not prefix them with `VITE_`. Redeploy after adding or changing environment variables. The deployed app stores shared results, sessions, and timer state in Redis. Local `results.json` and `timer.json` are not uploaded automatically.

## Source of tournament facts

`chat.txt` is the original chat export and `chat.md` is the readable rendering. Check both before changing teams, fixtures, or rules. Do not publish raw chat excerpts or credentials.
