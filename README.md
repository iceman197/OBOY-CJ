# 𝖆𝖈𝖊𝖞 𝖆𝖏 — Code Studio

Mobile-first coding studio with a single-file HTML/CSS/JS frontend, Node.js/Express backend, Gemini assistant, local developer utilities, coding labs, project/snippet storage, visitor counts, and a safe Termux-style **simulator**.

## Important notes

- `public/index.html` contains the complete frontend styling and browser behavior in one HTML file.
- Your supplied image is bundled at `public/assets/user-background.jpg` and is used as the page background.
- The Termux-style terminal is intentionally a simulator. It does **not** run arbitrary shell commands or install real packages on the server. A real terminal requires a separately provisioned, isolated execution environment.
- AI requires a Gemini API key and internet access. Usage is subject to provider quotas and billing.
- Visitor counts are in-memory and reset on server restart; they are not a count of unique humans. Behind multiple instances, use a shared store such as Redis for consistent counts. Visitor IPs are hashed for counting and not displayed in the public dashboard.
- Browser-saved projects, snippets, and notes are stored only in that browser's local storage. Export important work.
- The public app does not expose a visitor IP list. If you need an operator-only visitor report, add proper access control and a privacy notice before collecting/displaying identifiable IP addresses.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
# Edit .env and add your real GEMINI_API_KEY
npm start
```

Open `http://localhost:3000`.

## Deploy to Render

1. Push this folder to a GitHub repository.
2. Create a Render **Web Service** connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in Render:
   - `GEMINI_API_KEY` = your private Gemini API key
   - `GEMINI_MODEL` = `gemini-2.5-flash` (change if your account/provider does not offer it)
   - `NODE_ENV` = `production`
   - `VISITOR_HASH_SALT` = a long random private string
6. Deploy and visit `/api/health`. Expected JSON includes `ok: true` and whether AI is configured.

Do not commit `.env` or put the API key in `public/index.html`.
