# Contributing to TravelerHub

Thanks for your interest in making group travel less painful. This doc covers the
shortest path from a fresh clone to a merged PR.

## Local setup

The full operator-facing setup lives in [SETUP.md](SETUP.md). The minimum to
hack on the codebase:

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in at least SUPABASE_*, JWT_SECRET_KEY
uvicorn main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env  # fill in at least VITE_SUPABASE_*, VITE_API_URL
npm run dev
```

You can develop most non-realtime features against a free Supabase project
without paying for any third-party API. Mapbox/Google keys are only required
for the routes that hit them.

## Branch & PR flow

1. Fork or branch off `main` — feature branches use `feat/`, `fix/`, `chore/`,
   or `docs/` prefixes.
2. Keep PRs scoped. One reviewable change per PR is much better than three
   bundled together.
3. Run the relevant checks before pushing:
   - `cd backend && pytest`
   - `cd frontend && npm run lint && npm run test`
4. PR titles follow conventional-commit style (`feat(scope): …`,
   `fix(scope): …`). The scope is usually the router or page touched.
5. CI must be green before merge. If you intentionally need to skip a check,
   say so in the PR description.

## Code style

- **Python**: target 3.11. Type hints on public functions. Use `slowapi`
  decorators for any new public endpoint that hits an external API or the
  database without auth.
- **JavaScript/JSX**: target React 19 + Vite. Functional components only. Keep
  feature-flagged dead code out of `main`.
- **SQL migrations**: append-only, numeric prefix one higher than the highest
  existing file. Never rewrite a migration that has shipped.
- **Comments**: explain *why*, not *what*. Inline TODOs should reference an
  issue.

## Tests

- Backend tests live in `backend/tests/` and run with `pytest`. Mirror the
  router name when adding new files (`test_<router>.py`).
- Frontend tests use Vitest + Testing Library and live alongside the file
  under test as `*.test.jsx`.
- Anything that touches money, auth, or geolocation needs a regression test.

## Security disclosures

Please **don't** open public issues for security problems. See
[SECURITY.md](SECURITY.md) for the disclosure process.

## Code of conduct

By participating, you agree to abide by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Be kind. Assume good faith. Disagree with the idea, not the person.
