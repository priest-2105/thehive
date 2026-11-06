# Repository Guidelines

## Project Structure

`src/App.jsx` contains the public mobile interface and the separate admin screens. `src/tournament.js` holds the eight teams, players, quarter-final draw, and bracket logic. `styles.css` defines the visual system; `index.html` is the Vite entry point. `server.mjs` serves the shared results API and built site. `chat.txt` is the original WhatsApp export; `chat.md` is its Markdown rendering and the source for tournament facts. Keep new code and generated files separate from these exports.

## Development Commands

- `npm install` installs React, Vite, and development tooling.
- `npm run dev` starts the API and Vite together; open the URL Vite prints. The public view is `/`, and the password-protected admin view is `/admin`.
- `npm run build` creates the production site in `dist/`.
- `npm start` serves `dist/` and the API after building.

Set `ADMIN_PASSWORD` in the server environment or a root `.env` file before starting. Keep `.env`, `results.json`, `node_modules/`, and `dist/` out of version control.

## Coding and Data Conventions

Use two-space indentation in JavaScript and JSX. Name React components in PascalCase and functions and variables in camelCase. Keep team IDs and match IDs stable: saved results refer to them. Change rosters or fixtures only after checking the relevant chat messages. Preserve the original wording, order, and timestamps in `chat.txt`; do not infer missing media content.

## Validation

There is no automated test suite or coverage target yet. Run `npm run build` after code changes. Check the public Fixtures, Teams, Matches, and Bracket tabs at a phone width. Confirm that admin score entry handles draws with a penalty winner, advances teams, and clears affected later results when an earlier winner changes. Avoid adding test scores to shared tournament data.

## Privacy and Contributions

The exports contain names, phone numbers, and private conversations. Do not put raw chat excerpts or credentials in issues, screenshots, or public examples. This directory has no Git history to establish a commit convention; use short descriptive subjects. Pull requests should state what changed, how it was checked, and whether tournament data or access rules were affected.
