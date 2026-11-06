import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // better-sqlite3 driver: synchronous query via drizzle's get().
    const row = db.get<{ ok: number }>(sql`select 1 as ok`);
    if (!row || row.ok !== 1) {
      return Response.json({ ok: false }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
