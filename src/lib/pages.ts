import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pages, type Page, type Platform } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";

export interface ConnectedPage extends Page {
  /** null = ถอดรหัสไม่ได้ (เช่น เปลี่ยนรหัสฐานข้อมูล/AUTH_SECRET) ต้องเชื่อมต่อเพจใหม่ */
  token: string | null;
}

function withToken(page: Page): ConnectedPage {
  try {
    return { ...page, token: decrypt(page.accessToken, env.authSecret) };
  } catch {
    return { ...page, token: null };
  }
}

/** หาเพจจาก id ที่ได้รับใน webhook (Facebook = Page ID, Instagram = IG User ID) */
export async function findPageByAccount(db: Db, platform: Platform, accountId: string): Promise<ConnectedPage | null> {
  const page = await db.query.pages.findFirst({
    where: platform === "instagram" ? eq(pages.igUserId, accountId) : eq(pages.id, accountId),
  });
  return page ? withToken(page) : null;
}

export async function getPageById(db: Db, pageId: string): Promise<ConnectedPage | null> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  return page ? withToken(page) : null;
}

export async function listConnectedPages(db: Db): Promise<ConnectedPage[]> {
  const rows = await db.query.pages.findMany({ orderBy: (p, { asc }) => [asc(p.name)] });
  return rows.map(withToken);
}

export async function savePage(
  db: Db,
  data: { id: string; name: string; token: string; igUserId: string | null; igUsername: string | null },
): Promise<void> {
  const values = {
    id: data.id,
    name: data.name,
    accessToken: encrypt(data.token, env.authSecret),
    igUserId: data.igUserId,
    igUsername: data.igUsername,
    lastError: null,
  };
  await db
    .insert(pages)
    .values(values)
    .onConflictDoUpdate({ target: pages.id, set: { ...values, connectedAt: new Date() } });
}
