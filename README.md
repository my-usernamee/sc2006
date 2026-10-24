# FoundIt — presentation setup

Start here: [Deployment and API key setup](docs/DEPLOYMENT.md). The app starts empty; register your own accounts and upload your own item photos.

This is the existing React/Tailwind, Express/TypeScript and Prisma/PostgreSQL application, updated against the supplied final FoundIt SRS. The original pages, matching formula and project structure are retained. Start with the instructions below; the ZIP intentionally contains no personal credentials, database or uploaded user photos.

## Open and run in VS Code

1. Extract the ZIP. In VS Code, choose **File → Open Folder** and select `foundit`, the folder containing this README and the root `package.json`.
2. Install Node.js 22 LTS or later and PostgreSQL, or use your existing Neon PostgreSQL database.
3. Open **Terminal → New Terminal** in VS Code and run:

```sh
npm ci
npm run install:all
```

4. Copy `backend/.env.example` to `backend/.env` using the file explorer. Fill in `DATABASE_URL`, a long random `JWT_SECRET`, and your `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` (or a valid `ONEMAP_TOKEN`). Keep this file private. The retained `JWT_SECRET` setting signs location selections; login now uses revocable cookie sessions rather than JWTs.
5. Apply migrations, then start the existing frontend and backend together:

```sh
npm run db:deploy
npm run dev
```

6. Open **http://localhost:5173**. Register two different `@e.ntu.edu.sg` accounts to try the owner/Finder workflow. Registration signs you in. OneMap must be configured for report location selection to succeed. A failed lookup deliberately prevents submission.

The Vite development server proxies `/api` and `/uploads` to the backend. Keep the default `CORS_ORIGIN=http://localhost:5173` for this setup. Do not open the Vite app on a different host/port without updating that setting.

`npm run db:seed` is now a harmless no-op: sample accounts, reports and downloaded photos have been removed from the seed script. Use a new empty database and run migrations to start fresh. Changing the seed does not erase data in an existing remote database.

## Existing database upgrade

Back up your database and `backend/uploads` before upgrading. `npm run db:deploy` applies the new integrity/session migration without resetting your database. Existing users and reports remain; users log in again because old local-storage tokens are no longer accepted. The migration removes duplicate match notifications, backfills match eligibility and adds database constraints.

If your old database already has multiple Pending claims for the same report, the new unique index intentionally refuses migration. Resolve those conflicting claims through an agreed review of the existing records, then rerun migration. Do not reset a database containing work you need. Use a pooled Neon URL for runtime if appropriate and a provider-supported migration connection for deployment.

## Build and run the compiled app

```sh
npm run build
npm start
```

The backend serves both the compiled frontend and API at http://localhost:3000. For this mode set `CORS_ORIGIN=http://localhost:3000` in `backend/.env`. Set `NODE_ENV=production` when deploying behind HTTPS, and set `CORS_ORIGIN` to the exact public HTTPS origin. Production cookies are Secure and therefore require HTTPS; use development mode for local HTTP.

The app uses a single origin so protected photo URLs and HttpOnly session cookies work together. Put TLS termination in front of Express. Preserve `backend/uploads` across restarts and deployments and back it up alongside PostgreSQL. Do not put a production instance on an ephemeral filesystem without a persistent volume.

## Docker alternative

Set `JWT_SECRET` and OneMap credentials in your shell or a private root `.env`, then run:

```sh
docker compose up --build
```

Open http://localhost:3000. Compose provides PostgreSQL and persistent database/photo volumes. The provided Compose configuration is local development. For public deployment use HTTPS, production mode, the real public origin and private database credentials. Do not use `docker compose down -v` if you need to retain data.

## Tests

```sh
npm test
```

Runs matching and validation unit tests. Database tests are skipped unless explicitly enabled.

For integration tests, create a **separate disposable database with `foundit_test` in its name**, apply both migrations to it, and set `TEST_DATABASE_URL` in your shell before running:

```sh
npm run test:integration
```

**Integration tests truncate application tables in that test database. Never use your application database.** The runner rejects database names without `foundit_test`. You can apply migrations with `DATABASE_URL` temporarily set to that test database in a separate terminal. Restore your normal value before running the app.

Browser tests use a dedicated test server and a deterministic OneMap fixture, never a production fallback. Build the frontend first, install Playwright Chromium with `cd frontend` then `npx playwright install chromium`, return to the root, and start `backend/scripts/e2e-server.ts` using `npx tsx` from the backend folder with `DATABASE_URL` pointing to the migrated disposable database, `NODE_ENV=test`, a test `JWT_SECRET`, `ONEMAP_TOKEN=fixture`, and `CORS_ORIGIN=http://127.0.0.1:3000`. In another terminal run `npm run test:e2e` from the root. The test server refuses non-test mode/databases. See `docs/TEST_RESULTS.md` for the checks actually performed.

## What changed and where to look

- [Changes](docs/CHANGES.md)
- [SRS traceability](docs/TRACEABILITY.md)
- [Implementation and design alignment](docs/DESIGN_ALIGNMENT.md)
- [Test results and verification limits](docs/TEST_RESULTS.md)

The implementation is complete for the documented feature set. Your real Neon connection, live OneMap account, HTTPS host and production response times must still be checked in your deployment. Supplied Lab 3 PDFs/images were reference inputs and have not been rewritten. Use the design alignment notes when updating final submission diagrams.
