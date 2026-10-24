# Presentation deployment

## Where to enter credentials

For local development, edit **backend/.env** (a private, ignored file created for you). The `.env.example` file is only a template: never enter real keys there.

| Setting | What to enter |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for a **new, empty presentation database**, including the provider's SSL settings. Use a new Neon project/database, not a branch copied from populated data. |
| `JWT_SECRET` | Generate with `openssl rand -base64 48` and paste the output. |
| `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` | Your OneMap developer account credentials. The server obtains and refreshes tokens. |
| `ONEMAP_TOKEN` | Optional alternative to email/password; leave blank when using credentials. A supplied token takes priority and expires. |
| `CORS_ORIGIN` | `http://localhost:5173` locally; the exact public HTTPS origin for a custom domain. No trailing slash. |
| `UPLOAD_DIR` | Leave blank locally. The Render blueprint sets the persistent directory. |

No secret belongs in frontend code or a `VITE_` variable. Local `.env` settings are not uploaded to hosting: enter hosting values separately.

## Deploy on Render

The existing app uses private, authenticated photos stored on disk. This setup hosts frontend and API together, with a persistent disk. Render requires a paid web service for disks; review the displayed service and disk charges before creating resources.

1. Use `https://github.com/my-usernamee/sc2006` and select the `deploy/render-ready` branch in Render. The deployment files are at the repository root. Secrets, dependencies, and uploaded photos are excluded from Git.
2. In your existing Neon account, select your empty presentation database and copy its PostgreSQL connection string (including SSL parameters). Paste only the URL, without `psql` or surrounding quotes. Do not point the presentation at the previous populated database.
3. In Render, choose **New → Blueprint**, connect the GitHub repository, select `deploy/render-ready`, and use the root `render.yaml`.
4. In the Blueprint prompts enter `DATABASE_URL`, `ONEMAP_EMAIL`, and `ONEMAP_PASSWORD`. `JWT_SECRET` is generated automatically. If using a token instead, supply the OneMap settings under the service's **Environment** settings with `ONEMAP_TOKEN`; leave email/password blank.
5. Create the service after reviewing the cost. The build installs dependencies and compiles both apps. Startup applies database migrations without adding records, then starts the server.
6. Render provides an HTTPS URL. The backend automatically uses `RENDER_EXTERNAL_URL` as the allowed origin. Do not copy the localhost `CORS_ORIGIN` to Render. For a custom domain, set `CORS_ORIGIN` to its exact HTTPS origin.
7. Open `/api/health` on the deployed domain; expect `{"ok":true}`. Then register accounts and perform the checks below.

Uploaded images go to `/var/data/uploads` on the mounted disk. Keep this disk attached and back it up with the database. A free service's ephemeral disk would lose photos on deployment/restart.

Official references: [Render persistent disks](https://render.com/docs/disks), [Blueprint configuration](https://render.com/docs/blueprint-spec).

## Start empty and enter your own details

The old seed dataset has been removed. `npm run db:seed` no longer creates or deletes anything. Migrations only create/upgrade the schema: they do **not** empty an existing database. No remote database has been cleared by these changes.

For local use after filling `backend/.env`:

```sh
npm ci
npm run install:all
npm run prisma:generate --prefix backend
npm run db:deploy
npm run dev
```

Open http://localhost:5173. Register two different `@e.ntu.edu.sg` accounts using details and passwords you choose. One acts as finder and the other as owner (loser); there is no fixed role selector. Use separate browser profiles or normal/incognito windows to stay signed into both.

Add AirPods, an iPad, and a water bottle yourself using real photos. Use matching category, colour, brand, location and suitable dates for pairs you want to match. Found reports require a photo. Location selection requires working OneMap credentials.

## Presentation test record

Use a separate disposable database containing `foundit_test` in its name for automated integration/browser tests. Those tests clear their own database. Never run them against presentation data.

Record the actual result and evidence after each check; these are pending live deployment checks, not claimed passes.

| Check | Expected result | Live result |
| --- | --- | --- |
| Register finder and owner; log out/in | Separate working sessions | Pending |
| Edit profile and Telegram username | Changes saved | Pending |
| Create lost report; select real OneMap location | Report saved, invalid inputs rejected | Pending |
| Upload real photo in found report | Report and photo visible | Pending |
| Search/filter found items | Correct matching results | Pending |
| Matching and notification | Eligible pair appears with score/notification | Pending |
| Submit ownership claim | Finder notified; pending reports locked | Pending |
| Reject a claim | Reports unlocked; owner notified | Pending |
| Approve a subsequent claim | Reports closed; contacts revealed to participants | Pending |
| Try viewing another user's private data | Access denied or private fields omitted | Pending |
| Restart/redeploy service | Accounts, reports and photos retained | Pending |
| Refresh a nested page and test on phone | App loads and workflows remain usable | Pending |

Existing historical test evidence is in `TEST_RESULTS.md`; new execution results are recorded separately there. Live OneMap, hosting, and presentation data must be checked on the deployed service.
