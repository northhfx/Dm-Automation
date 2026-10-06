/**
 * อ่านค่า environment variables แบบ lazy (อ่านตอนใช้งานจริง ไม่ใช่ตอน build)
 * เพื่อให้ `next build` ผ่านได้แม้ยังไม่ได้ตั้งค่า
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`ยังไม่ได้ตั้งค่า environment variable: ${name} (ดูวิธีตั้งค่าใน README.md)`);
  }
  return value;
}

function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get metaAppId() {
    return required("META_APP_ID");
  },
  get metaAppSecret() {
    return required("META_APP_SECRET");
  },
  get metaVerifyToken() {
    return required("META_VERIFY_TOKEN");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get authSecret() {
    const value = required("AUTH_SECRET");
    if (value.length < 32) throw new Error("AUTH_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร");
    return value;
  },
  /** URL สาธารณะของระบบ เช่น https://dm.example.com ใช้สร้างลิงก์ติดตามการคลิก */
  get publicBaseUrl() {
    return required("PUBLIC_BASE_URL").replace(/\/+$/, "");
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

/** รายการตัวแปรที่จำเป็น ใช้แสดงสถานะในหน้า Settings */
export const REQUIRED_ENV = [
  "DATABASE_URL",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "ADMIN_PASSWORD",
  "AUTH_SECRET",
  "PUBLIC_BASE_URL",
] as const;
