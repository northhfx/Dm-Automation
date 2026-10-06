import { createHash } from "node:crypto";

/**
 * ค่าที่อ่านจาก environment variables แบบ lazy (อ่านตอนใช้งานจริง ไม่ใช่ตอน build)
 * ตัวที่ต้องตั้งจริงๆ มีแค่ DATABASE_URL — ค่าอื่นของ Meta ตั้งผ่านหน้าเว็บ (ดู lib/config.ts)
 */

function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * กุญแจลับของระบบ (ใช้เข้ารหัส token และลงลายเซ็น session)
 * ใช้ AUTH_SECRET ถ้าตั้งไว้ ไม่งั้นสร้างจาก DATABASE_URL ซึ่งเป็นความลับอยู่แล้ว ผู้ใช้จึงไม่ต้องตั้งเอง
 * (ถ้าเปลี่ยนรหัสฐานข้อมูล ระบบจะให้ล็อกอินและเชื่อมเพจใหม่)
 */
export function getAuthSecret(): string | null {
  const explicit = process.env.AUTH_SECRET;
  if (explicit && explicit.length >= 32) return explicit;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  return createHash("sha256").update(`dm-automation:auth:${databaseUrl}`).digest("hex");
}

export const env = {
  get databaseUrl() {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error("ยังไม่ได้ตั้งค่า DATABASE_URL (ดูวิธีตั้งค่าใน README.md)");
    return value;
  },
  get authSecret() {
    const value = getAuthSecret();
    if (!value) throw new Error("ยังไม่ได้ตั้งค่า DATABASE_URL (ดูวิธีตั้งค่าใน README.md)");
    return value;
  },
  get graphApiBase() {
    return (process.env.GRAPH_API_BASE || "https://graph.facebook.com").replace(/\/+$/, "");
  },
  get graphApiVersion() {
    return process.env.GRAPH_API_VERSION || "v23.0";
  },
  /** จำนวน DM อัตโนมัติสูงสุดต่อชั่วโมง (0 = ไม่จำกัด) */
  get instagramDmPerHour() {
    return numberOr("INSTAGRAM_DM_PER_HOUR", 180);
  },
  get facebookDmPerHour() {
    return numberOr("FACEBOOK_DM_PER_HOUR", 0);
  },
  /** เขตเวลาที่ใช้แบ่งสถิติรายวัน */
  get timezone() {
    return process.env.APP_TIMEZONE || "Asia/Bangkok";
  },
  get workerDisabled() {
    return process.env.DISABLE_WORKER === "1";
  },
};
