# FoundIt

A lost-and-found web application for NTU students.
CE2006/CZ2006 Software Engineering project.

Built to the requirements in the FoundIt Software Requirements Specification v1.0.

---

## What it does

| Feature | SRS |
|---|---|
| Register with an `@e.ntu.edu.sg` address, log in, edit your account | 4.1 |
| Report a lost item (photo optional) | 4.2 |
| Report a found item (photo required) | 4.3 |
| Automatic matching and in-app match notifications | 4.4 |
| Browse, search and filter found items | 4.5 |
| Submit, review, approve or reject ownership claims, then exchange Telegram usernames | 4.6 |

---

## Technology

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS (mobile-first) |
| Map | Leaflet showing OneMap tiles |
| Backend | Node.js + Express + TypeScript (REST API) |
| Database | PostgreSQL (Neon free tier) via Prisma |
| Auth | Email + password, bcrypt hashing, JWT |
| Images | Saved to `backend/uploads`, served as static files |
| Testing | Vitest |

Everything used is free. There is no AI, no machine learning, no external
matching service and no paid API.

---

## Getting started

> **Already on the team and just want it running?** Jump to
> [Working on this as a team](#working-on-this-as-a-team) - it is three
> commands. The section below is the long form, for setting it up from
> nothing.

### 1. Requirements

- Node.js 18 or newer
- A PostgreSQL database. The free tier at https://neon.tech is enough.
- A OneMap account: https://www.onemap.gov.sg/apidocs/register

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Then edit `backend/.env`. If you are joining a project that is already running,
ask a teammate for the `DATABASE_URL` and fill the rest in yourself:

| Variable | What to put in it |
|---|---|
| `DATABASE_URL` | The connection string from Neon |
| `JWT_SECRET` | Any long random string. Generate one with `openssl rand -base64 48` |
| `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | Your OneMap account login (recommended) |
| `ONEMAP_TOKEN` | Alternative to the two above, if you already have a token |
| `PORT` | `3000` |

`backend/.env` is git-ignored and must never be committed.

**About the OneMap credentials.** OneMap tokens expire after a few days. If you
set `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`, the backend logs in by itself and
refreshes the token whenever it runs out, so nobody has to keep pasting a new
one into `.env`. If you would rather paste a token directly, set `ONEMAP_TOKEN`
and it is used instead.

If your OneMap documentation shows different URLs from the ones we used, they
are all at the top of `backend/src/services/onemap.service.ts` and are the only
place that needs changing.

### 3. Set up the database and start the backend

```bash
cd backend
npm install
npx prisma migrate dev --name init   # creates the tables
npm run seed                         # optional: demo accounts and reports
npm run dev                          # http://localhost:3000
```

The seed creates two accounts, both with the password `password123`:

- `alice001@e.ntu.edu.sg` - has a lost item report
- `ben002@e.ntu.edu.sg` - has two found item reports

### 4. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Vite forwards `/api` and `/uploads` to the backend, so there is nothing else to
configure.

### 5. Run the tests

```bash
cd backend
npm test
```

---

## Working on this as a team

### Quick start for a new teammate

```bash
git clone https://github.com/my-usernamee/sc2006.git
cd sc2006

cp backend/.env.example backend/.env
#  ^ then paste in the real values (see "Secrets" below)

./start.sh          # installs deps if needed, runs backend + frontend
```

Open http://localhost:5173. Press `Ctrl+C` once to stop both servers.

If `./start.sh` will not run, `chmod +x start.sh` first, or start the two
servers by hand in two terminals:

```bash
cd backend  && npm install && npm run dev     # API  on :3000
cd frontend && npm install && npm run dev     # site on :5173
```

### Secrets

`backend/.env` is **not** in the repository and never will be - it is listed in
`.gitignore`. Cloning the repo gives you the code but no credentials, so the
backend will refuse to start until you create the file.

`backend/.env.example` **is** in the repository. It lists every variable with
empty values, so it doubles as the checklist of what you need.

| Variable | Where it comes from | Must everyone use the same value? |
|---|---|---|
| `DATABASE_URL` | The Neon connection string | **Yes** - this is what makes us share one database |
| `JWT_SECRET` | Any long random string: `openssl rand -base64 48` | No - generate your own |
| `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | A free account at https://www.onemap.gov.sg/apidocs/register | No - register your own, it takes a minute |
| `PORT` | `3000` | Yes |
| `CORS_ORIGIN` | `http://localhost:5173` | Yes |

So in practice only `DATABASE_URL` actually has to be passed around. Everything
else a teammate can fill in themselves from the table above.

**How to pass it around.** Send it in a direct message, not in a public channel
and never in a commit, a screenshot or the lab report. A group chat is
acceptable for a course project on a free-tier database with no real user data,
as long as the chat is only the five of us. Two things to keep in mind:

- The string contains the database password. Anyone holding it can read and
  delete everything in our database.
- Chat history is searchable forever. If the string leaks, rotate the password
  in the Neon dashboard and re-send the new string; nothing in the code changes.

For a real product this is exactly what you would not do - you would use a
secret manager and give each developer their own credentials. Worth a sentence
in the report if the lab asks about deployment practices.

### Everyday git

```bash
git pull                       # before you start
git switch -c feature/claims   # one branch per piece of work
# ...edit...
git add -A
git commit -m "Add claim rejection reason"
git push -u origin feature/claims
```

Then open a pull request on GitHub so someone else reads it before it lands on
`main`.

Two things that are already handled for you, so do not fight them:

- `node_modules/`, `dist/`, `backend/.env` and uploaded photos are gitignored.
  If `git status` ever offers to commit one of those, something is wrong - stop
  and ask.
- The database schema lives in `backend/prisma/schema.prisma`. If you change
  it, run `npx prisma migrate dev --name what_you_changed` and commit the
  generated migration folder. After pulling someone else's migration, run
  `npx prisma migrate dev` yourself so your local client matches.

---

## The general flow

### What the user does

```
register / log in
        |
        +--> report a lost item      --\
        |                              |
        +--> report a found item     --+--> matching runs automatically
        |                              |
        |                          match score >= threshold?
        |                              |
        |                              v
        +--> notifications  <-------- "we found a possible match"
        |
        +--> browse / search found items
        |
        +--> submit a claim on a found item
                   |
                   v
        the finder reviews it  -->  approve  -->  both sides see each
                   |                              other's Telegram handle
                   +------------->  reject   -->  claimant may try again
```

### What happens inside, for one request

Every request takes the same path, which is worth remembering because it is the
answer to "where do I put this code?":

```
 browser
    |  fetch()                       frontend/src/api/
    v
 route            backend/src/routes/        HTTP in and out, nothing else
    |
    v
 validation       backend/src/validation/    reject a bad body before any work
    |
    v
 service          backend/src/services/      all the business rules
    |   |
    |   +-------> domain/matching.ts         pure maths, no database
    |   |
    |   +-------> dto/index.ts               strip fields the caller may not see
    v
 Prisma  ----->  PostgreSQL
```

The rule of thumb: **routes are dumb, services are smart, domain is pure.** If
you are writing an `if` about what a user is allowed to do, it belongs in a
service, not a route.

### Matching, specifically

This is the part markers ask about, so it is worth knowing.

When a report is created or edited, `matching.service.ts` compares it against
every other Active and Open report of the **same category**, and for each pair
asks `domain/matching.ts` for a score out of 100:

| Attribute | Weight | How it scores |
|---|---|---|
| Location | 40 | closer = higher |
| Date | 30 | nearer in time = higher |
| Colour | 25 | 100 identical, 50 for a listed similar pair, else 0 |
| Brand | 5 | exact match, and "Unknown" never penalises |

Two rejection checks come first and force the score straight to 0 (different
category, or the found date being before the lost date). If the weighted result
clears the user's threshold and that exact pair has never notified before, a
notification row is written. A pair never notifies twice.

The maths is a pure function on purpose - no database, no network - which is
what makes `backend/tests/matching.*.test.ts` possible.

### The API surface

| Prefix | What lives there |
|---|---|
| `/api/auth` | register, log in |
| `/api/users` | view and edit your own account |
| `/api/lost-reports` | create, list, edit, close your lost reports |
| `/api/found-reports` | create, browse, search, edit found reports |
| `/api/claims` | submit, approve, reject |
| `/api/notifications` | list and mark read |
| `/api/onemap` | address search, proxied so the token stays server-side |
| `/uploads` | the photo files, served statically |

`GET /` is deliberately a 404 - there is no page at the root of the API, only
the routes above. Seeing that 404 means the backend is up.

---

## How the code is organised

```
backend/src/
  index.ts        start-up: checks config, connects to the database, listens
  app.ts          builds the Express app (middleware, routes, error handler)

  routes/         «boundary»  one file per resource, HTTP in and out only
  services/       «control»   all the business rules live here
  domain/         pure functions with no database access (the matching maths)
  dto/            decides who is allowed to see which fields
  validation/     checks the request body before a service runs
  middleware/     authentication, file upload, error handling
  prisma/         the database schema

frontend/src/
  pages/          one file per screen (matches the dialog map)
  components/     shared pieces: layout, report form, map picker
  api/            typed wrappers around fetch
  auth/           who is logged in
```

The request path is always the same and is worth remembering:

```
route  ->  validation  ->  service  ->  Prisma  ->  PostgreSQL
                              |
                              +-> domain (matching maths)
                              +-> dto    (strip private fields)
```

---

## Where to find each part of the SRS

| What | Where |
|---|---|
| The Match Score calculation (SRS 4.4.4) | `backend/src/domain/matching.ts` |
| When matching runs (REQ-41 to REQ-44, REQ-54) | `backend/src/services/matching.service.ts` |
| The claim state machine (REQ-60 to REQ-71) | `backend/src/services/claim.service.ts` |
| Every privacy rule (REQ-19, 35, 59, 66, 70) | `backend/src/dto/index.ts` |
| The `@e.ntu.edu.sg` rule (REQ-2) | `backend/src/validation/schemas.ts` |
| Report freezing during a claim (REQ-63) | `assertNoPendingClaim` in `claim.service.ts` |
| Black box tests (Lab 4, 3.2.1) | `backend/tests/matching.equivalence.test.ts` |
| White box tests (Lab 4, 3.2.2) | `backend/tests/matching.basispath.test.ts` |

---

## Decisions we made where the SRS did not say

The SRS does not cover these cases, so we chose the behaviour below. They are
worth mentioning in the Lab 5 documentation.

1. **Editing a report can trigger a notification.** REQ-54 only mentions the
   threshold changing, but REQ-51 reads as a standing rule, so if an edit pushes
   a score above the threshold and that pair has never notified before, we
   notify. A pair still never notifies twice (REQ-52).
2. **You cannot claim your own found item report.**
3. **Only one claim may be pending on a report at a time**, otherwise the
   freeze in REQ-63 would be ambiguous.
4. **A rejected claim may be submitted again**, because rejection is not a ban.
5. **Dates in the future are rejected**, since they would produce a meaningless
   date similarity score.
6. **A score of 0 never notifies**, even if the threshold is 0, because REQ-47
   says a rejected pair must not generate a notification.
7. **Match results are kept after a claim is approved** as a record, but the
   reports are no longer compared, since matching only looks at Active and Open
   reports (REQ-44).

## Known limitations

- Images are stored on the server's own disk. This is fine for the demo, but on
  a hosting service that resets its filesystem the images would be lost.
- Photo URLs are unguessable random names rather than access-controlled routes.
- There is no password reset and no email verification. Neither is in the SRS.
