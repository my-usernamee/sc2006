# FoundIt

Lost-and-found web app. CE2006/CZ2006 project, built to the
FoundIt SRS v1.0.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind, Leaflet for maps |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL (Neon) via Prisma |
| Auth | Email + password, bcrypt, JWT |
| Tests | Vitest |

## Setup

```bash
git clone https://github.com/my-usernamee/sc2006.git
cd sc2006
cp backend/.env.example backend/.env    # fill it in, see below
./start.sh
```

Open http://localhost:5173. Ctrl+C stops both servers.

First time on a fresh database, before `./start.sh`:

```bash
cd backend && npx prisma migrate dev && npm run seed
```

Seeded logins, password `password123`: `alice001@e.ntu.edu.sg`,
`ben002@e.ntu.edu.sg`.

### backend/.env

Gitignored, never committed. **This repo is public — do not put real values in
any committed file.**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string — **ask the team, this is the only shared one** |
| `JWT_SECRET` | your own: `openssl rand -base64 48` |
| `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | your own free account at [onemap](https://www.onemap.gov.sg/apidocs/register) |
| `PORT` | `3000` |
| `CORS_ORIGIN` | `http://localhost:5173` |

Send the `DATABASE_URL` by DM, not in a public channel. If it leaks, rotate the
password in Neon and re-send — no code changes.

### Manual start

```bash
cd backend  && npm install && npm run dev     # :3000
cd frontend && npm install && npm run dev     # :5173
```

### Tests

```bash
cd backend && npm test
```

## Flow

```
register / log in
   ├── report lost item ──┐
   ├── report found item ─┴─> matching runs automatically
   │                              └─> score >= threshold -> notification
   ├── browse / search found items
   └── claim a found item -> finder approves -> Telegram handles exchanged
                                  └─ rejects  -> claimant may retry
```

Every request goes:

```
route -> validation -> service -> Prisma -> PostgreSQL
                          ├─> domain/matching.ts  (pure maths)
                          └─> dto/                (strip private fields)
```

Routes are dumb, services are smart, domain is pure. Business rules go in a
service, never a route.

### Matching

On create/edit, a report is compared against every Active+Open report in the
same category. Two rejection checks first (different category, found date before
lost date) force a 0. Otherwise a weighted score out of 100:

| Attribute | Weight |
|---|---|
| Location | 40 |
| Date | 30 |
| Colour | 25 (100 same, 50 similar pair, else 0) |
| Brand | 5 ("Unknown" never penalises) |

Clears the threshold and the pair has never notified before → notification. A
pair never notifies twice.

## Layout

```
backend/src/
  routes/       HTTP in and out only
  services/     business rules
  domain/       pure functions, no DB (the matching maths)
  dto/          who may see which fields
  validation/   request body checks
  middleware/   auth, upload, errors
  prisma/       schema + migrations

frontend/src/
  pages/        one per screen
  components/   layout, report form, map picker
  api/          typed fetch wrappers
  auth/         current user
```

API: `/api/auth`, `/api/users`, `/api/lost-reports`, `/api/found-reports`,
`/api/claims`, `/api/notifications`, `/api/onemap`, plus `/uploads` for photos.
`GET /` is a 404 on purpose — seeing it means the backend is up.

## Git

```bash
git pull
git switch -c feature/thing
git add -A && git commit -m "..."
git push -u origin feature/thing        # then open a PR
```

Changed `schema.prisma`? Run `npx prisma migrate dev --name what_changed` and
commit the migration folder. After pulling someone else's, run
`npx prisma migrate dev` so your client matches.

`node_modules/`, `dist/`, `backend/.env` and uploaded photos are gitignored. If
git offers to commit one, stop and ask.

## Where the SRS lives in the code

| What | Where |
|---|---|
| Match Score (4.4.4) | `backend/src/domain/matching.ts` |
| When matching runs (REQ-41..44, 54) | `backend/src/services/matching.service.ts` |
| Claim state machine (REQ-60..71) | `backend/src/services/claim.service.ts` |
| Privacy rules (REQ-19, 35, 59, 66, 70) | `backend/src/dto/index.ts` |
| `@e.ntu.edu.sg` rule (REQ-2) | `backend/src/validation/schemas.ts` |
| Black box tests | `backend/tests/matching.equivalence.test.ts` |
| White box tests | `backend/tests/matching.basispath.test.ts` |

## Decisions the SRS did not cover

1. Editing a report can trigger a notification, if the edit pushes a score over
   the threshold and that pair never notified before.
2. You cannot claim your own found report.
3. Only one pending claim per report, or the REQ-63 freeze is ambiguous.
4. A rejected claim may be resubmitted.
5. Future dates are rejected.
6. A score of 0 never notifies, even at threshold 0 (REQ-47).
7. Match results are kept after approval as a record, but the reports stop being
   compared (REQ-44).

## Limitations

- Images sit on the server's disk; a host that resets its filesystem loses them.
- Photo URLs are unguessable random names, not access-controlled routes.
- No password reset, no email verification. Neither is in the SRS.
