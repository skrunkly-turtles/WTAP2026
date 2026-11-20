# RBConnect

Voice of early talent. Co-op and new grad participants post concerns on a Piazza-style
board (public or anonymous, for everyone or admins/HR only) and join events. Admins/HR get an
AI-powered dashboard: program-wide insights from Gemini, a sentiment and theme overview, and a
list of participants at risk of leaving, with intervention briefs.

## Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router, TypeScript), Tailwind v4, Recharts, lucide-react |
| Backend | Flask, SQLAlchemy (SQLite, seeded from `backend/seed/*.json`) |
| NLP | VADER sentiment, keyword themes and risk phrases (`backend/services/`) |
| AI | Gemini via `google-genai`, structured JSON output, offline fallback |

Brand colours: `#005DAA` (blue) and `#FFD200` (yellow). Tokens live in `frontend/app/globals.css`.

## Run it
```bash
make setup          # venv + pip, npm install, creates backend/.env
# put your key in backend/.env  ->  GEMINI_API_KEY=...
make dev            # Flask on :5001, Next on :3000 (proxies /api -> Flask)
```
Open http://localhost:3000. Other commands: `make seed` (reset demo data), `make test` (pytest).

With no `GEMINI_API_KEY`, the AI features return a deterministic summary built from the same data,
marked "Offline fallback" in the UI.

## How it works
- **Identity (demo only).** There is no login. The app always runs as the admin account "RBConnect Team". The header
  switch toggles **Main ↔ Admin** dashboards. The frontend sends `X-User-Id` and the backend reads the role from the DB. This can be spoofed, so
  replace it with SSO before real data goes in (`backend/services/identity.py`).
- **Post visibility.** *Who can see:* Everyone, or Admins & HR only (a private thread with HR).
  *Show my name:* Yes, or Anonymous. Enforced on the server in `routes/posts.py` and `services/serializers.py`.
- **Reveal.** Anonymous authors are hidden from everyone, admins included. An admin can reveal one
  item by giving a reason. Reveals and AI risk briefs are still recorded in the `RevealLog` table
  (`GET /api/admin/reveals`), but the audit log view is currently hidden in the UI.
- **Risk score (0–100)** in `services/risk.py`: a low recent sentiment average, a drop from the
  person's own baseline, and weighted risk phrases ("other offer", "burnout", "not valued", …).
  Comments count for half as much as posts. Levels: high ≥ 65, medium ≥ 35.
- **Gemini agent** in `services/ai_agent.py` has three uses: program summary (concerns, recommendations,
  next steps), per-person risk brief, and an Ask-the-Agent chat. Prompts get pseudonyms (`P-12`) and
  post IDs only, never names or emails. Gemini summaries are cached in `AIInsight`; use Regenerate to refresh.

## Layout
```
backend/   app.py, models.py, routes/, services/, seed/, tests/
frontend/  app/ (/, /admin), components/, lib/api.ts
```
