import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * ตรวจว่า webhook มาจาก Meta จริง โดยเทียบ header X-Hub-Signature-256
 * กับ HMAC-SHA256 ของ body ด้วย App Secret
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqual(expected, header);
}

/** appsecret_proof ช่วยป้องกันการนำ token ไปใช้จากที่อื่น */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${secret}`).digest();
}

/** เข้ารหัสข้อความ (เช่น Page Access Token) ก่อนเก็บลงฐานข้อมูล */
export function encrypt(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "token"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(encoded: string, secret: string): string {
  const [version, iv, tag, data] = encoded.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("รูปแบบข้อมูลเข้ารหัสไม่ถูกต้อง");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, "token"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** ลงลายเซ็นข้อมูล session (รูปแบบ payload.signature) */
export function signValue(value: string, secret: string): string {
  const sig = createHmac("sha256", deriveKey(secret, "session")).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function unsignValue(signed: string, secret: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  return safeEqual(signValue(value, secret), signed) ? value : null;
}

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** รหัสสั้นสำหรับลิงก์ติดตาม เช่น /r/k3Fq9xPa */
export function randomCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
