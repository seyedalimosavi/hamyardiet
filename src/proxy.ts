import { NextRequest, NextResponse } from "next/server";

// Fail closed by default in production while authentication/authorization remain a demo.
// ALLOW_UNSAFE_DEMO is ONLY for an isolated, local test with synthetic data.
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_UNSAFE_DEMO !== "true") {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ok:false,error:{code:"UNSAFE_DEMO_DISABLED",message_fa:"نسخه آزمایشی برای انتشار عمومی آماده نیست."}}, {status:503,headers:{"Cache-Control":"no-store"}});
    }
    return new NextResponse('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>نسخه آزمایشی غیرفعال است</title><body style="font-family:sans-serif;max-width:42rem;margin:4rem auto;padding:1rem;line-height:2"><h1>نسخه آزمایشی برای انتشار آماده نیست</h1><p>احراز هویت و کنترل دسترسی واقعی هنوز پیاده‌سازی نشده‌اند. برای راه‌اندازی امن، راهنمای تحویل به برنامه‌نویس را مطالعه کنید.</p></body></html>',{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
