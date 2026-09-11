# English Learning Hub / TEDUENGLISH

Next.js App Router frontend with a **Convex local backend**.

## Development

```bash
npm install
npx convex dev --once
npm run db:seed
npm run dev
```

Keep `npx convex dev` running in a second terminal while you develop, or use:

```bash
npm run dev:all
```

The app runs at [http://localhost:4173](http://localhost:4173). Convex local backend defaults to `http://127.0.0.1:3210`.

Demo password for development accounts: `Demo@12345`.

- Teacher / Admin: `teacher@example.test`
- Coordinator / Mod: `mod@example.test`
- Student: `student@example.test`
- Student outside seeded class: `outsider@example.test`

Never create these accounts in production.

## Production readiness

Implemented backend flows include account lifecycle and role defaults, student enrollment, class schedules, private learning materials, question-bank imports from CSV/JSON/TXT/DOCX/text-based PDF, practice and exam assignments, autosave/submission, automatic objective scoring, manual written-answer grading, audit logs, login throttling, production bootstrap, health checks, robots/sitemap, and Docker deployment.

Run before every release:

```bash
npm ci
npx convex deploy
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

See `docs/03-production-deploy.md` for the deployment order and optional AI question extraction configuration.
