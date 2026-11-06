import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// SQLite database file location:
// - Set SQLITE_DB_PATH (absolute path recommended) to keep the database
//   OUTSIDE any web-served directory on shared hosts (cPanel).
// - Default keeps the database in ./dietdata/diet.sqlite next to the app.
//   This directory is NOT served by Next.js, but prefer the env var on hosting.
export const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(process.cwd(), "dietdata", "diet.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const globalForDb = globalThis as typeof globalThis & {
  __nutriClinicSqlite?: Database.Database;
};

export const sqlite = globalForDb.__nutriClinicSqlite ?? new Database(dbPath);

// Pragmas tuned for a single-process app server (cPanel Passenger / local dev):
// - WAL allows concurrent reads while writing and survives abrupt restarts.
// - busy_timeout avoids immediate "database is locked" on rare contention.
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
// Parity with the previous PostgreSQL setup, which had no FK constraints yet
// (adding them is part of the P0 security roadmap, not this port).
sqlite.pragma("foreign_keys = OFF");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nutriClinicSqlite = sqlite;
}

export const db = drizzle(sqlite);
