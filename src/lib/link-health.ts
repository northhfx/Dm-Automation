import { eq, inArray, max, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { linkChecks, rules } from "@/db/schema";
import type { FlowStep } from "@/lib/flows/types";

/*
 * ตรวจลิงก์ปลายทางในปุ่มลิงก์ของกฎที่เปิดอยู่ — ลูกค้ากดแล้วเจอหน้า error จะได้รู้ก่อน
 * - worker เรียก checkRuleLinksIfDue() ในรอบดูแลระบบ ตรวจจริงทุก 6 ชั่วโมง
 * - ถือว่าเสียเฉพาะที่ชัดเจน: เปิดไม่ได้เลย (DNS / หมดเวลา / ต่อไม่ติด), 404, 410, 5xx
 *   (401/403/429 ส่วนใหญ่เป็นเว็บที่กันโปรแกรมอัตโนมัติ — ลูกค้าเปิดเองได้ ไม่นับว่าเสีย)
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
  return status === 404 || status === 410 || status >= 500;
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
    return { ok: !isBrokenStatus(res.status), status: res.status, error: null };
  } catch (err) {
    const e = err as Error & { cause?: { code?: string } };
    return { ok: false, status: null, error: (e.cause?.code ?? e.name ?? "error").slice(0, 100) };
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

  const previous = new Map(
    (await db.select().from(linkChecks).where(inArray(linkChecks.url, urls))).map((r) => [r.url, r.failures]),
  );
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((url) => probeUrl(url, fetchImpl)));
    for (const [j, r] of results.entries()) {
      const url = batch[j];
      const values = {
        ok: r.ok,
        status: r.status,
        error: r.error,
        failures: r.ok ? 0 : (previous.get(url) ?? 0) + 1,
        checkedAt: now,
      };
      await db.insert(linkChecks).values({ url, ...values }).onConflictDoUpdate({ target: linkChecks.url, set: values });
    }
  }
  return urls.length;
}

/** ตรวจเมื่อครบ 6 ชั่วโมงนับจากรอบล่าสุด (หรือยังไม่เคยตรวจ) */
export async function checkRuleLinksIfDue(db: Db, fetchImpl: FetchLike = fetch, now: Date = new Date()): Promise<number> {
  const [row] = await db.select({ last: max(linkChecks.checkedAt) }).from(linkChecks);
  if (row?.last && now.getTime() - row.last.getTime() < LINK_CHECK_INTERVAL_MS) return 0;
  return checkRuleLinks(db, fetchImpl, now);
}
