"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { pages } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { saveMetaApp, savePublicBaseUrl, setAppReviewDone, setPassword, verifyPassword } from "@/lib/config";
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
      revalidatePath("/guide");
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
  if (!page.token) return [`${page.name}: token ใช้ไม่ได้ กรุณาเชื่อมต่อเพจใหม่`];
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

/** ลองให้เพจส่ง webhook มาใหม่ — คืนผลเพื่อให้หน้าเว็บแจ้งว่าสำเร็จหรือยัง */
export async function resubscribePage(formData: FormData): Promise<FormResult> {
  await requireAuth();
  const problems = await subscribe(String(formData.get("pageId")));
  revalidatePath("/settings");
  revalidatePath("/guide");
  return problems.length ? { error: problems.join(" · ") } : { ok: true };
}

export async function disconnectPage(formData: FormData): Promise<void> {
  await requireAuth();
  await getDb().delete(pages).where(eq(pages.id, String(formData.get("pageId"))));
  revalidatePath("/settings");
  revalidatePath("/guide");
}

export interface FormResult {
  ok?: boolean;
  error?: string;
  /** ช่องที่ผิด (id ของ input) เพื่อแสดงข้อความใต้ช่องนั้น */
  field?: string;
}

/** บันทึก App ID / App Secret จาก Meta App Dashboard → App settings → Basic */
export async function saveMetaAppAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  const appId = String(formData.get("appId") ?? "").trim();
  const appSecret = String(formData.get("appSecret") ?? "").trim();
  if (!/^\d{5,20}$/.test(appId)) return { error: "App ID ต้องเป็นตัวเลขล้วน (คัดลอกจากหน้า App settings → Basic)", field: "appId" };
  if (appSecret && !/^[a-f0-9]{32}$/i.test(appSecret)) {
    return { error: "App Secret ไม่ถูกต้อง (ควรเป็นตัวอักษร a-f และตัวเลข 32 ตัว — กด Show ก่อนคัดลอก)", field: "appSecret" };
  }
  await saveMetaApp(getDb(), appId, appSecret);
  revalidatePath("/guide");
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveBaseUrlAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  const url = String(formData.get("baseUrl") ?? "").trim();
  if (!/^https?:\/\/[^\s/]+/.test(url)) return { error: "ใส่ URL ให้ครบ เช่น https://dm-automation-production.up.railway.app", field: "baseUrl" };
  await savePublicBaseUrl(getDb(), url);
  revalidatePath("/guide");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setAppReviewAction(formData: FormData): Promise<void> {
  await requireAuth();
  await setAppReviewDone(getDb(), formData.get("done") === "1");
  revalidatePath("/guide");
  revalidatePath("/settings");
}

export async function changePasswordAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  if (process.env.ADMIN_PASSWORD) return { error: "รหัสผ่านถูกตั้งผ่าน ADMIN_PASSWORD ใน Railway — เปลี่ยนที่นั่นแทน" };
  const db = getDb();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(db, current))) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง", field: "current" };
  if (next.length < 8) return { error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร", field: "next" };
  await setPassword(db, next);
  return { ok: true };
}
