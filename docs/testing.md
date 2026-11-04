# FoundIt testing

Verified on 5 November 2026 with Jest 29 and ts-jest. Supertest exercises selected
Express routes. All Prisma calls in service and HTTP tests are mocked. Real bcrypt
hashing, JWT verification, validation, matching and DTO functions are exercised.
No real database, OneMap account or shared credentials are required.

```sh
cd backend
npm ci
npx prisma generate
npm test
npm run test:coverage
npm run build
```

## Results

206 tests passed across 10 suites. TypeScript build passed. Backend coverage is
79.49% statements, 61.62% branches, 67.79% functions and 81.67% lines. The matching
maths, DTO and validation modules each have 100% statement and branch coverage.
Coverage excludes the server entry point and Prisma connection module; frontend
code is outside this report. Coverage percentages do not imply complete SRS coverage.

| File in backend/tests | Checks | Focus |
|---|---:|---|
| accounts.test.ts | 6 | Password hashing, duplicate registration, login, account updates |
| validation.test.ts | 71 | Registration, report fields, dropdowns, dates, thresholds, query and claim input |
| reports.test.ts | 28 | Create, update, delete, ownership, pending locks, browsing, matching triggers |
| matching.equivalence.test.ts | 18 | Matching equivalence classes and numerical boundaries |
| matching.basispath.test.ts | 17 | Matching basis paths and similar-colour pairs |
| matching.service.test.ts | 22 | Report eligibility, notification thresholds, deduplication and re-evaluation |
| claims.test.ts | 17 | Submission, access, review, approval, rejection and notifications |
| privacy.test.ts | 8 | Public DTO fields, private descriptions and contact release |
| api.test.ts | 16 | Protected routes, JWT errors, logout, validation, browse and match responses |
| notifications.test.ts | 3 | Recipient scoping, linked reports, read state and unread count |

## Requirement scope

- REQ-1 to REQ-7: backend registration, login and account checks.
- REQ-8: authenticated logout API; browser token removal still needs a UI check.
- REQ-9 to REQ-40: report validation, service writes, ownership, state guards and
  privacy. Location coordinates are checked, but real OneMap marker interaction
  and upload transport still need browser/integration checks. Database default
  statuses are configured in Prisma; persistence is not exercised by mocks.
- REQ-41 to REQ-55: matching maths, triggers, eligibility, notification decisions,
  duplicate prevention, threshold re-evaluation and selected match HTTP responses.
- REQ-56 to REQ-60: browse/search/filter query construction and public HTTP DTOs.
- REQ-61 to REQ-72: claim submission/review services, participant access, state
  updates, notification writes and description/contact DTO rules.
- NFR-5 and NFR-7 to NFR-11: automated privacy, authentication, ownership and lock checks.
- NFR-16: repeated sequential matching produces one notification with a stateful
  database mock. Concurrent transactions are not exercised.
- NFR-6 and NFR-17: source review of the feature boundary and module structure.
- NFR-1 to NFR-4, NFR-12 to NFR-15: timed deployment, browser usability and live
  persistence verification remain outstanding. Backend form validation partly
  supports NFR-13 but does not establish browser usability.

## Defects found and fixed

The expanded date tests exposed acceptance of impossible dates such as 30 February
and rejection of the current Singapore date just after local midnight while UTC
was still on the previous day. Shared lost/found date validation now requires a
real calendar date and compares against today's date in Singapore (UTC+8).
Both regression checks pass.

The earlier manual review records a different-brand score of 93. Current SRS
weights and automated fixtures produce 95 when all other fields match. Keep the
manual record separate and recheck its original input before changing that result.
The SRS Appendix C's 34 checks are a separate record, not part of the 206-test count.
