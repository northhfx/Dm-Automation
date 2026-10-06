import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { decrypt, encrypt, verifyMetaSignature } from "@/lib/crypto";
import { parseWebhook } from "@/lib/meta/webhook";
import { createSessionValue, isValidSession } from "@/lib/session";
import { fbComment, fbDm, fbRead, igComment, igDm } from "./fixtures";

describe("parseWebhook", () => {
  it("แปลงคอมเมนต์ Facebook", () => {
    expect(parseWebhook(fbComment({ text: "สนใจค่ะ" }))).toEqual([
      {
        type: "comment",
        platform: "facebook",
        accountId: "PAGE1",
        commentId: "POST1_C1",
        postId: "PAGE1_POST1",
        parentId: "PAGE1_POST1",
        text: "สนใจค่ะ",
        fromId: "USER1",
        fromName: "Somchai Jaidee",
      },
    ]);
  });

  it("ข้ามคอมเมนต์ที่เพจตอบเอง และคอมเมนต์ที่ถูกแก้ไข/ลบ", () => {
    expect(parseWebhook(fbComment({ fromId: "PAGE1" }))).toEqual([]);
    expect(parseWebhook(fbComment({ verb: "edited" }))).toEqual([]);
    expect(parseWebhook(igComment({ fromId: "IG1" }))).toEqual([]);
  });

  it("แปลงคอมเมนต์ Instagram", () => {
    const [job] = parseWebhook(igComment({ text: "link please" }));
    expect(job).toMatchObject({
      type: "comment",
      platform: "instagram",
      accountId: "IG1",
      commentId: "IGC1",
      postId: "MEDIA1",
      fromName: "mint.shop",
    });
  });

  it("แปลงข้อความ DM และข้าม echo (ข้อความที่เพจส่งเอง)", () => {
    expect(parseWebhook(fbDm({ text: "ราคา" }))).toEqual([
      { type: "dm", platform: "facebook", accountId: "PAGE1", senderId: "PSID1", mid: "mid.1", text: "ราคา", payload: null },
    ]);
    expect(parseWebhook(fbDm({ echo: true }))).toEqual([]);
    expect(parseWebhook(igDm({ text: "hi" }))[0]).toMatchObject({ platform: "instagram", senderId: "IGSID1" });
  });

  it("แปลง read receipt", () => {
    expect(parseWebhook(fbRead(1700000000000))).toEqual([
      { type: "read", platform: "facebook", accountId: "PAGE1", senderId: "PSID1", watermark: 1700000000000, mid: null },
    ]);
  });

  it("ไม่พังเมื่อ payload แปลกๆ", () => {
    expect(parseWebhook(null)).toEqual([]);
    expect(parseWebhook({ object: "page", entry: [{ id: "PAGE1", changes: [{ field: "feed" }] }] })).toEqual([]);
    expect(parseWebhook({ object: "whatsapp_business_account", entry: [] })).toEqual([]);
  });
});

describe("crypto", () => {
  it("ตรวจลายเซ็น webhook ของ Meta", () => {
    const body = JSON.stringify({ hello: "world" });
    const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "secret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "other-secret")).toBe(false);
    expect(verifyMetaSignature(body + " ", sig, "secret")).toBe(false);
    expect(verifyMetaSignature(body, null, "secret")).toBe(false);
  });

  it("เข้ารหัส/ถอดรหัส token", () => {
    const secret = "x".repeat(32);
    const enc = encrypt("EAAB-page-token", secret);
    expect(enc).not.toContain("EAAB");
    expect(decrypt(enc, secret)).toBe("EAAB-page-token");
    expect(() => decrypt(enc, "y".repeat(32))).toThrow();
  });

  it("session หมดอายุและปลอมไม่ได้", () => {
    const secret = "s".repeat(32);
    const value = createSessionValue(secret, 0);
    expect(isValidSession(value, secret, 1000)).toBe(true);
    expect(isValidSession(value, secret, 31 * 24 * 60 * 60_000)).toBe(false);
    expect(isValidSession(value.replace(/^\d+/, "99999999999999"), secret, 1000)).toBe(false);
    expect(isValidSession(value, "t".repeat(32), 1000)).toBe(false);
  });
});
