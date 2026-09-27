# Lernbuch

A web app that turns German lessons into complete, interactive study units, from A1 to B1.

Each lesson becomes **Overview → Vocabulary → Grammar → Classwork → Homework → Quiz**. Every mistake a learner makes feeds a spaced-repetition review queue and a per-skill weakness report.

## What makes it different

- **Nouns are never shown bare.** Every noun appears with its article and plural, coloured by gender (der blue, die red, das green). Because red means feminine, errors are never shown in red: they use amber, an icon and text.
- **Case is always visible.** Sentences carry Nominativ, Akkusativ and Dativ chips under the phrases that change.
- **The Satzklammer is drawn.** Example sentences bracket the conjugated verb in position two to the rest of the verb at the end of the clause.
- **Every exercise answers "why".** A solution never appears without its reason and a takeaway rule.
- **Homework uses staged hints.** A nudge, then the rule, then the answer, and only on request.
- **Spaced repetition and weak skills.** Wrong answers pull the linked vocabulary and grammar forward in the review queue, and skills below 70% are offered as a drill.
- **Umlauts are one keystroke away.** A persistent ä ö ü ß strip, plus Alt+a / o / u / s.

## Accounts

- **Anyone can sign up** with a username and password; no email is needed. Signup and login are rate-limited per IP and per username, and the signup form has a honeypot against bots.
- **Learners manage their own accounts** under Settings: display name, password, and account deletion, which removes all of their progress.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript · Postgres (Neon in production) · Drizzle ORM · Auth.js (credentials, JWT sessions, Argon2id) · Tailwind CSS 4 · Vitest · Playwright

## Running it locally

Requires **Node 20+**, **pnpm** and **Docker**.

```bash
pnpm install
cp .env.example .env.local      # then set AUTH_SECRET
pnpm db:up                      # Postgres + a WebSocket proxy, see docker-compose.yml
pnpm db:migrate
pnpm ingest                     # loads the lesson files in CONTENT_DIR
pnpm dev                        # http://localhost:3000
```

The app talks to Postgres through the Neon serverless driver, which speaks WebSocket. Locally, `docker-compose.yml` runs Neon's `wsproxy` in front of a stock Postgres, and `src/db/client.ts` switches to it whenever `DATABASE_URL` points at `localhost`. The same code therefore runs locally and in production.

### Environment

| Variable | Needed by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | app, scripts | Postgres connection string. For Neon, keep `?sslmode=require` |
| `AUTH_SECRET` | app | Session signing key: `openssl rand -base64 32` |
| `AUTH_URL` | app | The site's public URL |
| `CONTENT_DIR` | `ingest` | Folder of lesson files |
| `NEXT_PUBLIC_APP_NAME` | app | Defaults to `Lernbuch` |

## Lesson files

A lesson is one Markdown file named `YYYY-MM-DD-lektion-NN.md`. It has YAML frontmatter (the `slug` must equal the file name without `.md`), prose under `##` headings, and structured data in fenced blocks whose info string is `yaml <blocktype>`:

| Block | Holds |
| --- | --- |
| `vocab` | Words. Nouns need `article` and `plural`; verbs need `verbForms.praesens` and `.aux` |
| `grammar` | Rules, tables with highlighted cells, examples, common mistakes |
| `classwork` | Exercises, each with `solution`, `why` and `takeaway` |
| `homework` | The same, plus staged `hints`, `dueDate` and `revealPolicy` |
| `quiz` | A quiz and its questions |
| `errors` | Mistakes made in class. They become drilled review items |

[`tests/fixtures/2099-01-01-lektion-99.md`](tests/fixtures/2099-01-01-lektion-99.md) is a complete worked example that uses every block type and all seventeen exercise types. Skill tags must come from [`src/config/skills.ts`](src/config/skills.ts); unknown tags are rejected on purpose, so a typo cannot silently create a new skill.

Re-importing a lesson updates it in place. Content ids are permanent, so learners' progress and review history survive every re-import. Run `pnpm validate` to check files without touching the database. It reports the exact YAML path of any problem.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build. Run it, not just `typecheck`: some Next.js constraints only surface here |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm test` | Vitest: parser, grading, SRS, ingest idempotency, action isolation (needs the database) |
| `pnpm test:e2e` | Playwright against a dev server |
| `pnpm db:up` | Start the local database |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply Drizzle migrations |
| `pnpm ingest` / `pnpm ingest:force` | Import lesson files from `CONTENT_DIR` |
| `pnpm validate` | Parse and validate lesson files without a database |

Two e2e runs must not overlap, and source files must not be edited while one runs: global setup and teardown share database state, and the dev server hot-reloads mid-run.

## Deploying

Any Node host works; Vercel with Neon is the tested path.

1. Create a Neon database, then run `pnpm db:migrate` and `pnpm ingest` against it from your machine.
2. Import the repository into Vercel and set `DATABASE_URL` and `AUTH_SECRET`.
3. Set `regions` in `vercel.json` to the region closest to your database.

Lessons are stored in the database, not in the build, so adding a lesson never needs a redeploy.

## Security notes

- Passwords are hashed with Argon2id (OWASP baseline parameters). An unknown username costs the same verification time as a wrong password, and every login failure returns the same message.
- Every Server Action takes the user id from the session, never from client input, and re-reads the user row. A suspended or deleted account is therefore locked out immediately, even while its session token is still valid.
- A strict Content Security Policy is set with no `unsafe-eval` in production, along with `frame-ancestors 'none'` and `nosniff`.
- Homework solutions and hints are never serialised into the page. They are fetched on request.

## Project layout

```
src/app/          routes: (auth) sign in/up, (app) the learner app, welcome
src/actions/      Server Actions
src/components/   german/ exercise/ quiz/ review/ shell/ ui/
src/lib/          content/ grading/ srs/ homework/, auth, session, rate limiting
src/db/           schema, client, queries
scripts/          migrate, ingest, validate
tests/            unit tests, e2e specs, fixtures
drizzle/          migrations
```
