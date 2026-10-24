# Deployment preparation — 25 October 2026

Checks executed in this session:

- Prisma client generation: passed.
- Backend TypeScript build: passed.
- Frontend TypeScript/Vite production build: passed.
- Matching and validation unit tests: **48 passed**.
- API/database integration tests: **25 skipped**, no disposable database configured.
- Browser tests and live OneMap/HTTPS checks: not run; require a running configured backend.
- Docker database testing unavailable: Docker daemon is not running.
- No remote database was created, cleared or migrated, and no hosting deployment was made.
- Dependency installation reported 13 backend and 8 frontend audit findings. These have not been triaged or remediated in this deployment configuration change.

The evidence below is the pre-existing historical report, not a rerun in this session.

---

# Verification of this update

Verification date: 20 October 2026. Tests were run against the updated existing source, not a replacement mock application.

## Recorded checks

| Check                                                                     | Result    |
| ------------------------------------------------------------------------- | --------- |
| Backend TypeScript build                                                  | Passed    |
| Frontend TypeScript/Vite production build                                 | Passed    |
| Matching equivalence/boundary/basis-path tests retained from supplied app | 35 passed |
| New validation tests                                                      | 13 passed |
| API/database regression suite                                             | 25 passed |
| Total backend tests with integration enabled                              | 73 passed |
| Chromium browser workflows                                                | 3 passed  |

API checks use Supertest against the real Express app, Prisma and SQL schema. Database verification in this execution environment used PGlite PostgreSQL with its wire-protocol server and both migrations, with one database connection. Simultaneous-request tests check final constraints and outcomes, but this is not a native PostgreSQL multi-connection load test. The included integration suite can also run against a disposable native PostgreSQL database.

OneMap success/outage/unnamed-place responses were deterministic fixtures. No live OneMap account, Neon account, public HTTPS host or user-owned deployment credentials were available. External service credentials and deployment timings therefore remain to be checked using the README. Browser checks used headless Chromium; cross-browser/mobile-device certification is not claimed.

## Expected and actual outcomes

| Scenario                                                                        | Expected                                                         | Actual |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| Unauthenticated report/claim/account/photo request                              | 401                                                              | Passed |
| Non-NTU email / duplicate email / wrong password                                | Reject                                                           | Passed |
| Profile edit                                                                    | Persist display name and Telegram without exposing password hash | Passed |
| Cross-origin/form write                                                         | Reject                                                           | Passed |
| Lost photo omitted / found photo omitted                                        | Accept / reject                                                  | Passed |
| Fake image bytes with image MIME                                                | Reject                                                           | Passed |
| Blank numbers, threshold outside 0–100, impossible date, missing location proof | Reject                                                           | Passed |
| Another user's report mutation                                                  | 403                                                              | Passed |
| Browse/match public data                                                        | No private descriptions or contacts                              | Passed |
| Combined name/category/colour filters                                           | Only matching Open found reports                                 | Passed |
| Repeated matching                                                               | One notification per report pair                                 | Passed |
| Threshold zero and incompatible pair                                            | No notification                                                  | Passed |
| Threshold zero and eligible rounded-zero pair                                   | Notify once                                                      | Passed |
| Pending claim                                                                   | Both reports locked; Finder notified                             | Passed |
| Unrelated/claimant review request                                               | No Finder decision permission                                    | Passed |
| Rejection then report deletion                                                  | Unlock, hide report, retain readable claim                       | Passed |
| Approval                                                                        | Both statuses and notification committed; contacts revealed      | Passed |
| Closed report and threshold change                                              | No new match notification                                        | Passed |
| Simultaneous claim submissions                                                  | One success, one conflict                                        | Passed |
| Competing approve/reject                                                        | Exactly one decision and one decision notification               | Passed |
| OneMap outage/unnamed location                                                  | Block; no raw-coordinate bypass                                  | Passed |
| Logout with copied session cookie                                               | Cookie cannot authenticate afterwards                            | Passed |
| Browser registration → profile edit → logout → protected URL                    | Correct navigation and session behaviour                         | Passed |
| Browser failed map lookup                                                       | Submit disabled                                                  | Passed |
| Browser owner/Finder workflow                                                   | Notification → score → claim → review → approval → two contacts  | Passed |

## Test design

The original equivalence/boundary tests cover colour, brand, date, distance, unknown-brand normalisation, rejection and rounding. Validation extends threshold boundaries (including 0 and 100), blank and fractional input, exact calendar dates and signed location data. Original white-box tests describe four high-level paths through `calculateMatchScore` and three through `colourSimilarity`; the colour helper is supplementary and should not be presented as one of the application's most complex methods.

For the claim control, the API suite additionally covers missing claims, unavailable reports, permitted approval/rejection, non-Finder rejection, already-reviewed rejection and competing decisions. A fault-injection test forces notification storage to fail inside a real transaction and verifies that the new claim is rolled back and the report remains unlocked. The fault replaces only that transaction's notification create operation; persistence and rollback use the actual database. This is functional path evidence; draw the final control-flow graphs and count independent paths before presenting it as a complete Lab 4 basis-path report. Team reflections and demonstration recordings are separate deliverables.

## Local prototype timing sample

With 100 additional Open found reports (plus the regression fixtures), report creation including automatic matching took **594 ms** and a filtered search took **265 ms** in the local test environment. This is one recorded sample, not a deployed load or latency guarantee.

## Before a public/demo deployment

Use a real OneMap account, verify report creation/location/photo persistence, run the native PostgreSQL integration suite with more than one connection, check restart persistence and measure the stated 3/5-second SRS targets at the intended prototype dataset size. Run through the workflow on a phone. These environment-specific checks are separate from the passing local functional tests.
