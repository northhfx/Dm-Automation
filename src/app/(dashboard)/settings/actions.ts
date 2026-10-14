"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { pages } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import {
  getInstagramConfig,
  getMetaConfig,
  saveInstagramApp,
  saveMetaApp,
  savePublicBaseUrl,
  setAppReviewDone,
  setPassword,
  verifyPassword,
} from "@/lib/config";
import { createT, type MessageKey, type TFunction } from "@/lib/i18n/core";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { connectInstagramWithToken, disconnectInstagram, InstagramConnectError, resubscribeInstagram } from "@/lib/instagram/connect";
import { refreshInstagramAccountToken } from "@/lib/instagram/token";
import { exchangeForLongLivedUserToken, listManagedPages, subscribePageToApp } from "@/lib/meta/graph";
import { getPageById, savePage } from "@/lib/pages";
import { localizeSetupMessage } from "./setup-errors";

type SettingsT = TFunction<MessageKey<typeof settingsMessages>>;

/**
 * ตัวแปลข้อความของ action ตามภาษาในคุกกี้
 * เรียกนอก request ของ Next (เช่นในเทส) อ่านคุกกี้ไม่ได้ → ภาษาไทย (เหมือนไม่มีคุกกี้)
 */
async function settingsT(): Promise<SettingsT> {
  try {
    return await getT("settings");
  } catch {
    return createT(settingsMessages);
  }
}

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

  const t = await settingsT();
  if (intent === "fetch") {
    const token = String(formData.get("token") ?? "").trim();
    if (!token) return { step: "token", error: t("errPasteUserToken") };
    try {
      const longLived = await exchangeForLongLivedUserToken(token);
      const managed = await listManagedPages(longLived);
      if (managed.length === 0) {
        return { step: "token", error: t("errNoPages") };
      }
      return {
        step: "pick",
        userToken: longLived,
        pages: managed.map((p) => ({ id: p.id, name: p.name, igUsername: p.instagram_business_account?.username ?? null })),
      };
    } catch (err) {
      return { step: "token", error: t("errConnectFailed", { detail: (err as Error).message }) };
    }
  }

  if (intent === "save") {
    const userToken = String(formData.get("userToken") ?? "");
    const selected = new Set(formData.getAll("pageIds").map(String));
    if (selected.size === 0) return { ...prev, error: t("errPickOnePage") };
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
        problems.push(...(await subscribe(p.id, t)));
      }
      revalidatePath("/settings");
      revalidatePath("/guide");
      return {
        step: "done",
        message: t("pagesConnected", { count: managed.length }),
        error: problems.length ? problems.join(" · ") : undefined,
      };
    } catch (err) {
      return { ...prev, error: t("errSaveFailed", { detail: (err as Error).message }) };
    }
  }

  return prev;
}

/** ให้เพจส่ง webhook มาที่แอป แล้วบันทึกผลไว้แสดงในหน้าตั้งค่า */
async function subscribe(pageId: string, t: SettingsT): Promise<string[]> {
  const db = getDb();
  const page = await getPageById(db, pageId);
  if (!page) return [];
  if (!page.token) return [t("errPageTokenBroken", { page: page.name })];
  try {
    await subscribePageToApp(page.id, page.token);
    await db.update(pages).set({ subscribed: true, lastError: null }).where(eq(pages.id, page.id));
    return [];
  } catch (err) {
    const message = (err as Error).message;
    await db.update(pages).set({ subscribed: false, lastError: message }).where(eq(pages.id, page.id));
    return [t("errPageSubscribeFailed", { page: page.name, detail: message })];
  }
}

/** ลองให้เพจส่ง webhook มาใหม่ — คืนผลเพื่อให้หน้าเว็บแจ้งว่าสำเร็จหรือยัง */
export async function resubscribePage(formData: FormData): Promise<FormResult> {
  await requireAuth();
  const problems = await subscribe(String(formData.get("pageId")), await settingsT());
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
  if (!/^\d{5,20}$/.test(appId)) return { error: (await settingsT())("errAppId"), field: "appId" };
  if (appSecret && !/^[a-f0-9]{32}$/i.test(appSecret)) {
    return { error: (await settingsT())("errAppSecret"), field: "appSecret" };
  }
  await saveMetaApp(getDb(), appId, appSecret);
  revalidatePath("/guide");
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveBaseUrlAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  const url = String(formData.get("baseUrl") ?? "").trim();
  if (!/^https?:\/\/[^\s/]+/.test(url)) return { error: (await settingsT())("errBaseUrl"), field: "baseUrl" };
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

/** ความยาวรหัสผ่านใหม่ขั้นต่ำ (ตรงกับ minLength ของช่องในฟอร์ม) */
const MIN_PASSWORD_LENGTH = 8;

export async function changePasswordAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  const t = await settingsT();
  if (process.env.ADMIN_PASSWORD) return { error: t("errPasswordFromEnv") };
  const db = getDb();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(db, current))) return { error: t("errWrongPassword"), field: "current" };
  if (next.length < MIN_PASSWORD_LENGTH) return { error: t("errPasswordShort", { min: MIN_PASSWORD_LENGTH }), field: "next" };
  await setPassword(db, next);
  return { ok: true };
}

// ---------------- Instagram (เชื่อมผ่าน Instagram Login) ----------------

function revalidateSetup() {
  revalidatePath("/settings");
  revalidatePath("/guide");
}

export interface InstagramConnectState {
  ok?: boolean;
  error?: string;
  field?: "token" | "appSecret";
  message?: string;
  /** ข้อความแจ้งจากการเชื่อมต่อ (ไม่ทำให้เชื่อมไม่สำเร็จ) */
  notices?: string[];
  /** subscribe webhook สำเร็จไหม */
  subscribed?: boolean;
  /** ชื่อเพจ Facebook ที่ผูกบัญชีนี้ไว้ด้วย (บัญชีเดียวกัน → แจ้งแบบให้สบายใจ ไม่ใช่คำเตือน) */
  linkedPage?: string;
}

/** วาง token จากหน้า API setup with Instagram login → ตรวจ + บันทึก + subscribe webhook */
export async function connectInstagramAction(_prev: InstagramConnectState, formData: FormData): Promise<InstagramConnectState> {
  await requireAuth();
  const db = getDb();
  const t = await settingsT();
  try {
    const result = await connectInstagramWithToken(db, String(formData.get("token") ?? ""));
    const linked = await db.query.pages.findFirst({ where: eq(pages.igUserId, result.accountId), columns: { name: true } });
    revalidateSetup();
    return {
      ok: true,
      message: t("igConnected", { username: result.username }),
      notices: result.notices.map((n) => localizeSetupMessage(n, t)),
      subscribed: result.subscribed,
      linkedPage: linked?.name,
    };
  } catch (err) {
    if (err instanceof InstagramConnectError) return { error: localizeSetupMessage(err.message, t), field: err.field ?? undefined };
    console.error("[instagram] เชื่อมต่อไม่สำเร็จ:", err);
    return { error: t("errConnectFailed", { detail: (err as Error)?.message ?? String(err) }) };
  }
}

const IG_SECRET_PATTERN = /^[A-Za-z0-9]{20,64}$/;

/** บันทึก Instagram app secret (หน้า API setup with Instagram login) + App secret ของแอป IG ที่แยก (ไม่บังคับ) */
export async function saveInstagramAppAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAuth();
  const db = getDb();
  const t = await settingsT();
  const current = await getInstagramConfig(db);
  if (current.fromEnv) return { error: t("errIgSecretFromEnv") };

  const appSecret = String(formData.get("igAppSecret") ?? "").trim();
  const metaAppSecret = String(formData.get("igMetaAppSecret") ?? "").trim();
  if (!appSecret && !current.appSecret) {
    return { error: t("errIgSecretMissing"), field: "igAppSecret" };
  }
  if (appSecret && !IG_SECRET_PATTERN.test(appSecret)) {
    return { error: t("errIgSecretFormat"), field: "igAppSecret" };
  }
  if (metaAppSecret && !IG_SECRET_PATTERN.test(metaAppSecret)) {
    return { error: t("errIgMetaSecretFormat"), field: "igMetaAppSecret" };
  }
  if (appSecret && appSecret === (await getMetaConfig(db)).appSecret) {
    return { error: t("errIgSecretIsFacebook"), field: "igAppSecret" };
  }
  await saveInstagramApp(db, { appSecret, metaAppSecret });
  revalidateSetup();
  return { ok: true };
}

/** ปุ่ม "ลองใหม่": ให้ Meta ส่ง webhook ของบัญชีนี้มาอีกครั้ง */
export async function resubscribeInstagramAction(formData: FormData): Promise<FormResult> {
  await requireAuth();
  const result = await resubscribeInstagram(getDb(), String(formData.get("accountId") ?? ""));
  revalidateSetup();
  return result.ok ? { ok: true } : { error: localizeSetupMessage(result.error, await settingsT()) };
}

/** ปุ่ม "ต่ออายุ token" (ปกติระบบต่ออายุให้เอง — ปุ่มนี้ไว้ลองทันที) */
export async function refreshInstagramTokenAction(formData: FormData): Promise<FormResult> {
  await requireAuth();
  const result = await refreshInstagramAccountToken(getDb(), String(formData.get("accountId") ?? ""), { manual: true });
  revalidateSetup();
  return result.ok ? { ok: true } : { error: localizeSetupMessage(result.error, await settingsT()) };
}

export async function disconnectInstagramAction(formData: FormData): Promise<void> {
  await requireAuth();
  await disconnectInstagram(getDb(), String(formData.get("accountId") ?? ""));
  revalidateSetup();
}
