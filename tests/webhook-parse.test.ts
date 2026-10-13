import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { decrypt, encrypt, verifyMetaSignature } from "@/lib/crypto";
import { parseWebhook } from "@/lib/meta/webhook";
import { createSessionValue, isValidSession } from "@/lib/session";
import { fbComment, fbDm, fbRead, igComment, igDm, igQuickReply, igRead, igSelfComment, postback } from "./fixtures";

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
        via: "facebook_login",
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
      {
        type: "dm",
        platform: "facebook",
        accountId: "PAGE1",
        senderId: "PSID1",
        mid: "mid.1",
        text: "ราคา",
        payload: null,
        via: "facebook_login",
      },
    ]);
    expect(parseWebhook(fbDm({ echo: true }))).toEqual([]);
    expect(parseWebhook(igDm({ text: "hi" }))[0]).toMatchObject({ platform: "instagram", senderId: "IGSID1" });
  });

  it("แปลง read receipt", () => {
    expect(parseWebhook(fbRead(1700000000000))).toEqual([
      {
        type: "read",
        platform: "facebook",
        accountId: "PAGE1",
        senderId: "PSID1",
        watermark: 1700000000000,
        mid: null,
        via: "facebook_login",
      },
    ]);
  });

  it("ติดช่องทาง (via) ไปกับงานคอมเมนต์/DM/อ่านแล้ว — ค่าเริ่มต้นคือ facebook_login", () => {
    for (const body of [igComment(), igDm(), igRead("igmid.1"), fbComment(), fbDm(), fbRead(1700000000000)]) {
      const [job] = parseWebhook(body);
      expect(job.type).not.toBe("page_post");
      expect(job).toMatchObject({ via: "facebook_login" });
    }
    const viaLogin = [
      ...parseWebhook(igComment(), "instagram_login"),
      ...parseWebhook(igDm(), "instagram_login"),
      ...parseWebhook(igRead("igmid.1"), "instagram_login"),
      ...parseWebhook(postback("instagram", "flow:1:s1:b1"), "instagram_login"),
    ];
    expect(viaLogin.map((j) => [j.type, "via" in j ? j.via : null])).toEqual([
      ["comment", "instagram_login"],
      ["dm", "instagram_login"],
      ["read", "instagram_login"],
      ["dm", "instagram_login"],
    ]);
  });

  it("ข้ามคอมเมนต์ของบัญชี Instagram เอง (self_ig_scoped_id)", () => {
    expect(parseWebhook(igSelfComment())).toEqual([]);
    expect(parseWebhook(igSelfComment(), "instagram_login")).toEqual([]);
    // แม้ from.id ไม่ตรงกับ entry.id ก็ยังข้าม ถ้ามี self_ig_scoped_id
    expect(parseWebhook(igSelfComment({ fromId: "SOME_OTHER_ID" }), "instagram_login")).toEqual([]);
  });

  it("คอมเมนต์ Instagram ที่ส่ง comment_id มาแทน id ก็แปลงได้", () => {
    expect(parseWebhook(igComment({ noId: true, commentId: "IGC_ALT" }), "instagram_login")).toEqual([
      {
        type: "comment",
        platform: "instagram",
        accountId: "IG1",
        commentId: "IGC_ALT",
        postId: "MEDIA1",
        parentId: null,
        text: "สนใจ",
        fromId: "IGUSER1",
        fromName: "mint.shop",
        via: "instagram_login",
      },
    ]);
  });

  it("ข้ามข้อความ is_self และอ่าน payload ของ quick reply", () => {
    const self = igDm();
    (self.entry[0].messaging[0].message as Record<string, unknown>).is_self = true;
    expect(parseWebhook(self, "instagram_login")).toEqual([]);

    expect(parseWebhook(igQuickReply("flow:7:s1:b1"), "instagram_login")).toEqual([
      {
        type: "dm",
        platform: "instagram",
        accountId: "IG1",
        senderId: "IGSID1",
        mid: "igqr.1",
        text: "ใช่ ฉันสนใจ",
        payload: "flow:7:s1:b1",
        via: "instagram_login",
      },
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
