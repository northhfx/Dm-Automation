import { eq, inArray, max, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { linkChecks, rules } from "@/db/schema";
import type { FlowStep } from "@/lib/flows/types";

/*
 * ตรวจลิงก์ปลายทางในปุ่มลิงก์ของกฎที่เปิดอยู่ — ลูกค้ากดแล้วเจอหน้า error จะได้รู้ก่อน
 * - worker เรียก checkRuleLinksIfDue() ในรอบดูแลระบบ ตรวจจริงทุก 6 ชั่วโมง
 * - ถือว่าเสียเฉพาะที่ชัดเจน: เปิดไม่ได้เลย (DNS / หมดเวลา / ต่อไม่ติด), 404, 410, 500–599
 *   ไม่นับว่าเสีย: 401/403/429 และ 503 ที่มาจากระบบกันบอท (เว็บกันโปรแกรมอัตโนมัติ — ลูกค้าเปิดเองได้),
 *   เว็บที่ส่งใบรับรอง HTTPS มาไม่ครบ (เบราว์เซอร์หาส่วนที่ขาดเองได้), รหัสแปลกๆ เช่น 999
 *   (ใบรับรองหมดอายุ / ชื่อไม่ตรง / เซ็นเอง ยังนับว่าเสีย — เบราว์เซอร์ของลูกค้าก็ขึ้นเตือน)
 * - ลิงก์ของหลายเว็บเปิดไม่ได้พร้อมกันทั้งหมด = เน็ตของเซิร์ฟเวอร์เองมีปัญหา ไม่ใช่ลิงก์ → ไม่นับรอบนั้น
 * - แจ้งเตือนเมื่อเสียติดกันตั้งแต่ 2 รอบ (เว็บล่มแป๊บเดียวไม่ต้องเตือน)
 */

export const LINK_CHECK_INTERVAL_MS = 6 * 60 * 60_000;
/** เสียติดกันกี่รอบถึงจะแจ้งเตือน */
export const LINK_ALERT_AFTER = 2;
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** ลิงก์ทั้งหมดในปุ่มลิงก์ของกฎ (ไม่ซ้ำ) */
export function linkUrlsOf(steps: FlowStep[]): string[] {
  const urls = new Set<string>();
  for (const step of steps) for (const b of step.buttons) if (b.type === "link" && b.url) urls.add(b.url);
  return [...urls];
}

/** สถานะ HTTP ที่ถือว่าลิงก์เสียแน่ๆ */
export function isBrokenStatus(status: number): boolean {
  return status === 404 || status === 410 || (status >= 500 && status <= 599);
}

/** 503 จากระบบกันบอท / จำกัดความถี่ (Cloudflare, Amazon ฯลฯ) — คนเปิดได้ปกติ */
function isBotBlock(res: Response): boolean {
  return res.status === 503 && (res.headers.has("cf-mitigated") || res.headers.has("retry-after"));
}

/** เว็บส่งใบรับรอง HTTPS มาไม่ครบ — เบราว์เซอร์หาส่วนที่ขาดเองได้ (Node หาไม่ได้) จึงไม่นับว่าเสีย */
const INCOMPLETE_CHAIN = new Set(["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_GET_ISSUER_CERT"]);

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** เปิดลิงก์ 1 ครั้ง — ok=false เมื่อเสียชัดเจน */
export async function probeUrl(url: string, fetchImpl: FetchLike = fetch): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DM-Automation link check)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    // ไม่ต้องอ่านเนื้อหา
    await res.body?.cancel().catch(() => {});
    return { ok: !isBrokenStatus(res.status) || isBotBlock(res), status: res.status, error: null };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    const code = (e.cause?.code ?? e.name ?? "error").slice(0, 100);
    return { ok: INCOMPLETE_CHAIN.has(code), status: null, error: code };
  }
}

/** ตรวจลิงก์ของกฎที่เปิดอยู่ทั้งหมดทันที คืนจำนวนลิงก์ที่ตรวจ */
export async function checkRuleLinks(db: Db, fetchImpl: FetchLike = fetch, now: Date = new Date()): Promise<number> {
  const active = await db.select({ steps: rules.steps }).from(rules).where(eq(rules.active, true));
  const urls = [...new Set(active.flatMap((r) => linkUrlsOf(r.steps)))];

  // ลิงก์ที่ไม่มีในกฎแล้ว ไม่ต้องเก็บผล
  if (urls.length === 0) await db.delete(linkChecks);
  else await db.delete(linkChecks).where(notInArray(linkChecks.url, urls));
  if (urls.length === 0) return 0;

  const results: { url: string; ok: boolean; status: number | null; error: string | null }[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(async (url) => ({ url, ...(await probeUrl(url, fetchImpl)) })))));
  }
  // ลิงก์ของตั้งแต่ 2 เว็บเปิดไม่ได้เลยพร้อมกันทั้งหมด → น่าจะเป็นที่เน็ตของเซิร์ฟเวอร์ ไม่นับรอบนี้ (รอบหน้าค่อยตรวจใหม่)
  // (ทุกลิงก์อยู่เว็บเดียวกันแล้วเว็บนั้นล่ม = ลิงก์เสียจริง ต้องเตือน)
  const networkDown = new Set(results.map((r) => hostOf(r.url))).size >= 2 && results.every((r) => !r.ok && r.status === null);
  const previous = new Map(
    (await db.select().from(linkChecks).where(inArray(linkChecks.url, urls))).map((r) => [r.url, r.failures]),
  );
  for (const r of results) {
    const failures = r.ok ? 0 : (previous.get(r.url) ?? 0) + (networkDown ? 0 : 1);
    const values = { ok: r.ok, status: r.status, error: r.error, failures, checkedAt: now };
    await db.insert(linkChecks).values({ url: r.url, ...values }).onConflictDoUpdate({ target: linkChecks.url, set: values });
  }
  return urls.length;
}

/** ตรวจเมื่อครบ 6 ชั่วโมงนับจากรอบล่าสุด (หรือยังไม่เคยตรวจ) */
export async function checkRuleLinksIfDue(db: Db, fetchImpl: FetchLike = fetch, now: Date = new Date()): Promise<number> {
  const [row] = await db.select({ last: max(linkChecks.checkedAt) }).from(linkChecks);
  if (row?.last && now.getTime() - row.last.getTime() < LINK_CHECK_INTERVAL_MS) return 0;
  return checkRuleLinks(db, fetchImpl, now);
}
