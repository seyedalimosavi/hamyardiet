import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  ensureDbInitialized,
  users,
  clinicalProfiles,
  userRegimens,
  consultationThreads,
  consultationMessages,
  weightLogs,
  customMeals,
  desc,
} from "@/db/store";
import { PLANS_SEED } from "../../../../../shared/constants.js";
import { formatJalali } from "../../../../../shared/persian.js";

export async function GET(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "ADMIN";

    const allUsers = await db.select().from(users).orderBy(desc(users.lastLoginAt));
    const allProfiles = await db.select().from(clinicalProfiles);
    const allRegimens = await db.select().from(userRegimens).orderBy(desc(userRegimens.updatedAt));
    const allThreads = await db
      .select()
      .from(consultationThreads)
      .orderBy(desc(consultationThreads.lastMessageAt));
    const allMessages = await db
      .select()
      .from(consultationMessages)
      .orderBy(consultationMessages.createdAt);
    const allWeights = await db.select().from(weightLogs).orderBy(weightLogs.id);
    const allCustomMeals = await db.select().from(customMeals).orderBy(desc(customMeals.id));

    // Build unified Patient Case File objects for Consultant & Admin
    const patientUsers = allUsers.filter((u) => u.role === "USER");
    const cases = patientUsers.map((u) => {
      const prof = allProfiles.find((p) => p.userId === u.id) || null;
      const regs = allRegimens.filter((r) => r.userId === u.id);
      const latestRegimen = regs[0] || null;
      const userThreads = allThreads
        .filter((t) => t.userId === u.id)
        .map((t) => ({
          ...t,
          messages: allMessages.filter((m) => m.threadId === t.id),
        }));
      const uWeights = allWeights.filter((w) => w.userId === u.id);

      return {
        user: u,
        profile: prof,
        latestRegimen,
        regimenCount: regs.length,
        threads: userThreads,
        waitingReply: userThreads.some((t) => t.status === "WAITING_CONSULTANT"),
        weightLogs: uWeights,
      };
    });

    // Only Admin receives financial KPIs (MRR, CAC, conversion, settings); Consultant receives clinical cases & chats
    const adminStats =
      role === "ADMIN"
        ? {
            totalPatients: patientUsers.length,
            totalRegimensIssued: allRegimens.length,
            waitingConsultations: allThreads.filter((t) => t.status === "WAITING_CONSULTANT")
              .length,
            mrrToman: patientUsers.length * 495000,
            conversionRatePct: 6.4,
            plans: PLANS_SEED,
            customMeals: allCustomMeals,
          }
        : null;

    return NextResponse.json({
      ok: true,
      data: {
        cases,
        adminStats,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در دریافت اطلاعات پنل";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const action = body.action || "add_weight";

    if (action === "add_weight") {
      const userId = Number(body.userId) || 3;
      const weightKg = Number(body.weightKg);
      const waistCm = body.waistCm ? Number(body.waistCm) : null;
      const note = String(body.note || "ثبت روزانه").trim();
      const logDate = body.logDate || formatJalali(new Date());

      const [inserted] = await db
        .insert(weightLogs)
        .values({
          userId,
          logDate,
          weightKg,
          waistCm,
          note,
        })
        .returning();

      const allUserWeights = await db.select().from(weightLogs);
      return NextResponse.json({
        ok: true,
        data: {
          weightLog: inserted,
          weightLogs: allUserWeights.filter((w) => w.userId === userId),
        },
        message_fa: "وزن جدید شما با موفقیت ثبت شد.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در ثبت اطلاعات";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}
