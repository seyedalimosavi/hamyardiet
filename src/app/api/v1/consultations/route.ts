import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  ensureDbInitialized,
  users,
  consultationThreads,
  consultationMessages,
  eq,
  desc,
} from "@/db/store";

export async function GET(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role") || "USER";

    const allThreads = await db
      .select()
      .from(consultationThreads)
      .orderBy(desc(consultationThreads.lastMessageAt));

    const allMessages = await db
      .select()
      .from(consultationMessages)
      .orderBy(consultationMessages.createdAt);

    const filteredThreads =
      role === "CONSULTANT" || role === "ADMIN" || !userId
        ? allThreads
        : allThreads.filter((t) => t.userId === Number(userId));

    const threadsWithMessages = filteredThreads.map((t) => ({
      ...t,
      messages: allMessages.filter((m) => m.threadId === t.id),
    }));

    return NextResponse.json({
      ok: true,
      data: { threads: threadsWithMessages },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در دریافت پیام‌ها";
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
    const action = body.action || "send_message";

    if (action === "send_message") {
      const senderId = Number(body.senderId) || 3;
      const senderRole = body.senderRole || "USER";
      const senderName = body.senderName || "مراجع";
      const bodyText = String(body.bodyText || "").trim();
      let threadId = body.threadId ? Number(body.threadId) : null;

      if (!bodyText) {
        return NextResponse.json(
          { ok: false, error: { code: "EMPTY_MSG", message_fa: "متن پیام خالی است." } },
          { status: 400 }
        );
      }

      // If user doesn't have an active thread yet, find their existing thread or create one automatically (messenger style!)
      if (!threadId) {
        const targetUserId = Number(body.userId || senderId);
        const existingThreads = await db
          .select()
          .from(consultationThreads)
          .where(eq(consultationThreads.userId, targetUserId));

        if (existingThreads.length > 0 && !body.forceNewTopic) {
          threadId = existingThreads[0].id;
        } else {
          const [u] = await db.select().from(users).where(eq(users.id, targetUserId));
          const [createdThread] = await db
            .insert(consultationThreads)
            .values({
              userId: targetUserId,
              userName: u?.fullName || senderName,
              userPhone: u?.phone || "09120000003",
              subject: body.subject || bodyText.slice(0, 45),
              status: senderRole === "USER" ? "WAITING_CONSULTANT" : "ANSWERED",
            })
            .returning();
          threadId = createdThread.id;
        }
      }

      if (senderRole === "USER") {
        const [thread] = await db.select().from(consultationThreads).where(eq(consultationThreads.id, threadId));
        if (!thread || thread.userId !== senderId) return NextResponse.json({ok:false,error:{code:"INVALID_THREAD",message_fa:"این گفتگو متعلق به حساب فعلی نیست."}}, {status:403});
      }

      // Check smart quota rule: only count against quota if senderRole === 'USER' and previous message was not already from 'USER'
      const prevMsgs = await db
        .select()
        .from(consultationMessages)
        .where(eq(consultationMessages.threadId, threadId));
      const lastMsg = prevMsgs.length > 0 ? prevMsgs[prevMsgs.length - 1] : null;
      const countQuota =
        senderRole === "USER" && (!lastMsg || lastMsg.senderRole !== "USER");

      const [newMsg] = await db
        .insert(consultationMessages)
        .values({
          threadId,
          senderId,
          senderRole,
          senderName,
          bodyText,
          countedAgainstQuota: countQuota,
        })
        .returning();

      await db
        .update(consultationThreads)
        .set({
          status: senderRole === "USER" ? "WAITING_CONSULTANT" : "ANSWERED",
          lastMessageAt: new Date(),
        })
        .where(eq(consultationThreads.id, threadId));

      return NextResponse.json({
        ok: true,
        data: { message: newMsg, threadId },
        message_fa: "پیام ارسال شد.",
      });
    }

    if (action === "refund_quota") {
      const userId = Number(body.userId);
      const [u] = await db.select().from(users).where(eq(users.id, userId));
      if (u) {
        await db
          .update(users)
          .set({
            questionsQuota: (u.questionsQuota || 5) + 1,
          })
          .where(eq(users.id, userId));
      }
      return NextResponse.json({
        ok: true,
        message_fa: "۱ سهمیه سوال هدیه به پرونده بیمار اضافه شد.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در ارسال پیام";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}
