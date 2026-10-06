import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

/** ทุกหน้าของแดชบอร์ดต้องล็อกอินก่อน ยกเว้นเส้นทางสาธารณะใน matcher ด้านล่าง */
export function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? "";
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret.length >= 32 && isValidSession(session, secret)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // ไม่ต้องล็อกอิน: webhook, ลิงก์ติดตาม, หน้า login, นโยบายความเป็นส่วนตัว, ไฟล์ static
    "/((?!api/webhooks|api/health|r/|login|privacy|data-deletion|_next/static|_next/image|favicon.ico).*)",
  ],
};
