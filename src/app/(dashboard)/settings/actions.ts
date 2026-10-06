"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { pages } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { exchangeForLongLivedUserToken, listManagedPages, subscribePageToApp } from "@/lib/meta/graph";
import { getPageById, savePage } from "@/lib/pages";

export interface ConnectState {
  step: "token" | "pick" | "done";
  error?: string;
  message?: string;
  userToken?: string;
  pages?: { id: string; name: string; igUsername: string | null }[];
}

/** ขั้นตอนเชื่อมเพจ: (1) วาง token → แลกเป็น token ระยะยาว → แสดงรายชื่อเพจ (2) เลือกเพจ → บันทึก + subscribe webhook */
export async function connectAction(prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireAuth();
  const intent = formData.get("intent");

  if (intent === "reset") return { step: "token" };

  if (intent === "fetch") {
    const token = String(formData.get("token") ?? "").trim();
    if (!token) return { step: "token", error: "กรุณาวาง User Access Token" };
    try {
      const longLived = await exchangeForLongLivedUserToken(token);
      const managed = await listManagedPages(longLived);
      if (managed.length === 0) {
        return { step: "token", error: "ไม่พบเพจที่บัญชีนี้เป็นแอดมิน — ตอนสร้าง token ต้องติ๊กเลือกเพจด้วย" };
      }
      return {
        step: "pick",
        userToken: longLived,
        pages: managed.map((p) => ({ id: p.id, name: p.name, igUsername: p.instagram_business_account?.username ?? null })),
      };
    } catch (err) {
      return { step: "token", error: `เชื่อมต่อไม่สำเร็จ: ${(err as Error).message}` };
    }
  }

  if (intent === "save") {
    const userToken = String(formData.get("userToken") ?? "");
    const selected = new Set(formData.getAll("pageIds").map(String));
    if (selected.size === 0) return { ...prev, error: "เลือกอย่างน้อย 1 เพจ" };
    try {
      const db = getDb();
      const managed = (await listManagedPages(userToken)).filter((p) => selected.has(p.id));
      const problems: string[] = [];
      for (const p of managed) {
        await savePage(db, {
          id: p.id,
          name: p.name,
          token: p.access_token,
          igUserId: p.instagram_business_account?.id ?? null,
          igUsername: p.instagram_business_account?.username ?? null,
        });
        problems.push(...(await subscribe(p.id)));
      }
      revalidatePath("/settings");
      return {
        step: "done",
        message: `เชื่อมต่อ ${managed.length} เพจเรียบร้อย`,
        error: problems.length ? problems.join(" · ") : undefined,
      };
    } catch (err) {
      return { ...prev, error: `บันทึกไม่สำเร็จ: ${(err as Error).message}` };
    }
  }

  return prev;
}

/** ให้เพจส่ง webhook มาที่แอป แล้วบันทึกผลไว้แสดงในหน้าตั้งค่า */
async function subscribe(pageId: string): Promise<string[]> {
  const db = getDb();
  const page = await getPageById(db, pageId);
  if (!page) return [];
  try {
    await subscribePageToApp(page.id, page.token);
    await db.update(pages).set({ subscribed: true, lastError: null }).where(eq(pages.id, page.id));
    return [];
  } catch (err) {
    const message = (err as Error).message;
    await db.update(pages).set({ subscribed: false, lastError: message }).where(eq(pages.id, page.id));
    return [`${page.name}: subscribe webhook ไม่สำเร็จ (${message})`];
  }
}

export async function resubscribePage(formData: FormData): Promise<void> {
  await requireAuth();
  await subscribe(String(formData.get("pageId")));
  revalidatePath("/settings");
}

export async function disconnectPage(formData: FormData): Promise<void> {
  await requireAuth();
  await getDb().delete(pages).where(eq(pages.id, String(formData.get("pageId"))));
  revalidatePath("/settings");
}
