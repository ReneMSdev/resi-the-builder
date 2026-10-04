@AGENTS.md

# Frontend (Next.js)

Run from `frontend/`: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

- Demo-mode code paths must stay out of the real app's behavior, and the Live/Demo toggle must stay out of the public demo build.
- Demo fixtures live in `app/lib/demoFixtures/`.
- Add `hover:cursor-pointer` to every button.
