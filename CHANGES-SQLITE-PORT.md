# CHANGES-SQLITE-PORT.md — PostgreSQL → SQLite port notes

> Scope of this port: run the exact same app (site + core engine + database) on a single
> Node.js process, targeting shared hosting (cPanel with Node.js) that has no PostgreSQL.
> The clinical engine (`server/engine/*`), shared modules, UI components, pages and API
> route logic are **untouched**. All 33 golden-vector/engine tests pass unchanged.

## 1. Why

The original stack requires PostgreSQL (`pg` driver + Drizzle `pg-core`). Typical cPanel
Node.js shared hosting offers no PostgreSQL, and a remote free-tier Postgres adds latency
and availability risk. SQLite via `better-sqlite3` keeps everything on one host, with the
database as a single file — and the app is a single-process Passenger app, which is
exactly SQLite's sweet spot.

## 2. Files changed

| File | Change |
|---|---|
| `src/db/schema.ts` | Rewritten on `drizzle-orm/sqlite-core` (was `pg-core`). Same table/column/field names, same defaults. |
| `src/db/index.ts` | `pg.Pool` + `drizzle-orm/node-postgres` → `better-sqlite3` + `drizzle-orm/better-sqlite3`. New env var `SQLITE_DB_PATH` (default `./dietdata/diet.sqlite`). Enables WAL, `synchronous=NORMAL`, `busy_timeout=5000`. |
| `src/db/store.ts` | Runtime bootstrap DDL rewritten in SQLite syntax; seeding logic unchanged; same `ensureDbInitialized()` behavior on first request. |
| `src/app/api/health/route.ts` | `db.execute(sql\`select 1\`)` → `db.get(sql\`select 1 as ok\`)` (the sync SQLite driver has no `.execute`). Same response shapes. |
| `package.json` | `pg`/`@types/pg` removed; `better-sqlite3` added. `argon2` moved to devDependencies (it is only used by `tests/security-credentials.test.mjs` and was never imported by the app — native modules are the #1 shared-host install failure; switch to `hash-wasm` when real auth lands). Added `npm test` script (Node built-in runner — `PROGRESS.md` already claimed it existed). |
| `drizzle.config.json` | `dialect: "sqlite"`, file-path credentials (for future `drizzle-kit generate`). |
| `Dockerfile` | No `DATABASE_URL` build arg needed; SQLite data dir declared as a volume. |
| `compose.yaml` | `db` service removed; named volume `diet_database` mounted at `/app/dietdata`. |
| `.env.example` / `.dockerignore` | `DATABASE_URL` → `SQLITE_DB_PATH`; `dietdata` ignored. |
| `server.js` | **New**: Passenger/cPanel startup file (`node server.js`). |
| `CHANGES-SQLITE-PORT.md`, `DEPLOY-CPANEL.md` | **New**: this file and the deployment guide. |

## 3. Type mapping used everywhere

| PostgreSQL | SQLite (Drizzle) | Notes |
|---|---|---|
| `serial` PK | `INTEGER PRIMARY KEY AUTOINCREMENT` | Same `id` semantics |
| `text` | `text` | unchanged |
| `doublePrecision` | `real` | |
| `boolean` | `integer { mode: "boolean" }` | stored 0/1, JS `true/false` |
| `jsonb` | `text { mode: "json" }` | stored as JSON string, parsed on read; `DEFAULT '[]'` preserved |
| `timestamp` (no tz) | `integer { mode: "timestamp_ms" }` | unix millis; routes keep writing `new Date()`, reads return `Date` objects like `pg` did, JSON responses stay ISO strings |

## 4. Deliberate behavior-preserving decisions

- **No foreign keys added** — the original schema has none; adding them would change
  error behavior on bad writes. Planned properly in the P0 security roadmap
  (`نقشه-دیتابیس-و-امنیت.md`). `PRAGMA foreign_keys = OFF` keeps parity.
- **`weight_logs.log_date` stays a Jalali display string** (e.g. `۱۴۰۴/۱۲/۰۱`) because
  the admin API and UI use it verbatim. Converting to ISO dates is a UI+API change,
  listed as a follow-up.
- **No unique index on `weight_logs(user_id, log_date)`** — the current API allows
  same-day duplicate entries; enforcing uniqueness would 500 on a flow that used to
  succeed. Follow-up material.
- **CHECK constraints added** (runtime DDL only, verified against every write path):
  `users.role IN ('USER','CONSULTANT','ADMIN')`,
  `user_regimens.status IN ('FINAL_ACTIVE','PROFESSIONAL_REVIEW_REQUIRED')`,
  `consultation_threads.status IN ('WAITING_CONSULTANT','ANSWERED','CLOSED')`.
- **Read indexes added** (pure speed, no semantics change):
  `idx_regimens_user`, `idx_threads_user`, `idx_messages_thread`, `idx_weights_user`.

## 5. Existing PostgreSQL data

There is **no automatic data migration** — this port targets fresh deployments (the
project's own handover doc states the current DB contains only synthetic demo data).
If you ever have real data in a PostgreSQL dump, migrate deliberately: export each table
to JSON, transform `jsonb` → JSON strings, timestamps → unix millis, booleans → 0/1,
and load into the SQLite file inside a transaction. Do it as a reviewed script, with a
backup and a restore test.

## 6. Verification performed on this port

- `npm test` — 33/33 engine & security tests pass (incl. golden vectors GV-1..GV-8).
- `npm run typecheck` — clean. `npm run build` — all routes compile.
- Production smoke test (`next start` and `node server.js`):
  health check, patient login (auto-create), staff login, regimen generation
  (engine + JSON round-trip: 6 slots, calorie sum exactly equals `targetCal`),
  add weight log, food scan, home / calories / calories/[slug] / sitemap all 200.
- SQLite file checks: `journal_mode = wal`, `integrity_check = ok`, all 8 tables seeded,
  CHECK constraint rejects an invalid role, indexes present.
- Production lock verified under `node server.js`: without `ALLOW_UNSAFE_DEMO`,
  every page/API returns 503 (`UNSAFE_DEMO_DISABLED`).
