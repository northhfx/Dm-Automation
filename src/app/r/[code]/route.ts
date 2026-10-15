import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { events, links } from "@/db/schema";
import { createT, LOCALE_COOKIE, parseLocale } from "@/lib/i18n";
import { systemMessages } from "@/lib/i18n/messages/system";

// ระบบแชทจะเปิดลิงก์เองเพื่อทำภาพตัวอย่าง (link preview) — ไม่นับเป็นคลิกจากคน
const PREVIEW_BOTS = /facebookexternalhit|facebot|meta-external|whatsapp|bot\b|crawler|spider|preview/i;

/** ลิงก์นี้ไม่มีในระบบ — ภาษาตามคุกกี้ "lang" (ลูกค้าไม่มีคุกกี้ → ไทย / เจ้าของร้านที่เลือก English → อังกฤษ) */
function notFound(request: NextRequest): Response {
  const locale = parseLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  return new Response(createT(systemMessages, locale)("linkNotFound"), { status: 404 });
}

/** ลิงก์ติดตาม: นับคลิกแล้วพาไปยังปลายทางจริง */
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const db = getDb();

  if (PREVIEW_BOTS.test(request.headers.get("user-agent") ?? "")) {
    const link = await db.query.links.findFirst({ where: eq(links.code, code), columns: { targetUrl: true } });
    if (!link) return notFound(request);
    return new Response(null, { status: 302, headers: { Location: link.targetUrl, "Cache-Control": "no-store" } });
  }
  const [link] = await db
    .update(links)
    .set({ clicks: sql`${links.clicks} + 1`, firstClickedAt: sql`coalesce(${links.firstClickedAt}, now())` })
    .where(eq(links.code, code))
    .returning();
  if (!link) return notFound(request);

  await db.insert(events).values({
    type: "link_clicked",
    platform: link.platform,
    ruleId: link.ruleId,
    contactId: link.contactId,
    meta: { code, firstClick: link.clicks === 1 },
  });

  return new Response(null, { status: 302, headers: { Location: link.targetUrl, "Cache-Control": "no-store" } });
}
