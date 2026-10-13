import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeInstagramToken,
  fetchProfile,
  getInstagramMe,
  getPostInfo,
  GraphApiError,
  graphRequest,
  listRecentInstagramPosts,
  refreshInstagramToken,
  replyToComment,
  sendMessage,
  subscribeInstagramAccount,
  unsubscribeInstagramAccount,
} from "@/lib/meta/graph";
import { INSTAGRAM_WEBHOOK_FIELDS } from "@/lib/meta/setup-info";
import { DEFAULT_INSTAGRAM_ME, resetDatabase, startMockGraph } from "./helpers";

let graph: Awaited<ReturnType<typeof startMockGraph>>;

beforeAll(async () => {
  graph = await startMockGraph();
});
afterAll(async () => {
  await graph.close();
});
beforeEach(async () => {
  await resetDatabase();
  graph.resetAll();
});

const POSTED = new Date(Date.now() - 60 * 60_000).toISOString();

describe("graphRequest — แยก Facebook กับ Instagram Login", () => {
  it("api instagram → graph.instagram.com/v23.0 + access_token ใน query ไม่มี appsecret_proof และไม่มี Authorization", async () => {
    await graphRequest("/me", { token: "IG_TOKEN", query: { fields: "id" }, api: "instagram" });
    expect(graph.calls).toHaveLength(1);
    const [c] = graph.calls;
    expect(c.api).toBe("instagram");
    expect(c.rawPath).toBe("/v23.0/me");
    expect(c.query.access_token).toBe("IG_TOKEN");
    expect(c.query.fields).toBe("id");
    expect(c.query.appsecret_proof).toBeUndefined();
    expect(c.authorization).toBeNull();
  });

  it("api facebook (ค่าเริ่มต้น) ยังเหมือนเดิม: Bearer + appsecret_proof ไม่มี access_token ใน query", async () => {
    await graphRequest("/PAGE1", { token: "PAGE_TOKEN", query: { fields: "id" } });
    const [c] = graph.calls;
    expect(c.api).toBe("facebook");
    expect(c.rawPath).toBe("/v23.0/PAGE1");
    expect(c.authorization).toBe("Bearer PAGE_TOKEN");
    expect(c.query.appsecret_proof).toMatch(/^[0-9a-f]{64}$/);
    expect(c.query.access_token).toBeUndefined();
  });

  it("versioned:false → ไม่ใส่เวอร์ชันใน URL", async () => {
    await graphRequest("/refresh_access_token", { token: "IG_TOKEN", api: "instagram", versioned: false });
    expect(graph.calls[0].rawPath).toBe("/refresh_access_token");
  });

  it("error ของ Instagram Login อ่าน code ได้เหมือน Facebook", async () => {
    const err = await graphRequest("/me", { token: "IG_EXPIRED", api: "instagram" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GraphApiError);
    expect((err as GraphApiError).code).toBe(190);
  });
});

describe("ส่งข้อความ / ตอบคอมเมนต์ / ดึงโปรไฟล์ ผ่าน Instagram Login", () => {
  it("sendMessage('IG1', …, 'instagram') → POST /IG1/messages บน graph.instagram.com", async () => {
    const res = await sendMessage("IG1", "IG_TOKEN", { comment_id: "IGC1" }, { text: "สวัสดีค่ะ" }, "instagram");
    expect(res.message_id).toMatch(/^m_/);
    const [c] = graph.calls;
    expect(c).toMatchObject({ method: "POST", api: "instagram", path: "/IG1/messages", authorization: null });
    expect(c.query.access_token).toBe("IG_TOKEN");
    expect(c.body).toEqual({ recipient: { comment_id: "IGC1" }, messaging_type: "RESPONSE", message: { text: "สวัสดีค่ะ" } });
  });

  it("ไม่ระบุ api → ยังส่งผ่าน Facebook เหมือนเดิม", async () => {
    await sendMessage("PAGE1", "PAGE_TOKEN", { id: "PSID1" }, { text: "hi" });
    expect(graph.calls[0]).toMatchObject({ api: "facebook", path: "/PAGE1/messages", authorization: "Bearer PAGE_TOKEN" });
  });

  it("replyToComment และ fetchProfile ใช้ graph.instagram.com เมื่อ api = instagram", async () => {
    await replyToComment("instagram", "IGC1", "IG_TOKEN", "ส่งให้ทาง DM แล้วค่ะ", "instagram");
    const profile = await fetchProfile("instagram", "IGSID1", "IG_TOKEN", "instagram");
    expect(profile.username).toBe("mint.ig");
    expect(graph.calls.map((c) => [c.method, c.api, c.path, c.query.access_token])).toEqual([
      ["POST", "instagram", "/IGC1/replies", "IG_TOKEN"],
      ["GET", "instagram", "/IGSID1", "IG_TOKEN"],
    ]);
    expect(graph.calls[1].query.fields).toBe("name,username");
  });
});

describe("getInstagramMe", () => {
  it("ใช้ user_id (ไม่ใช่ id) และเก็บ id ไว้เป็น appScopedId", async () => {
    const me = await getInstagramMe("IG_TOKEN");
    expect(me).toEqual({ userId: "IG1", appScopedId: "APPSCOPED1", username: "test.shop", name: "ร้านทดสอบ", accountType: "Business" });
    const [c] = graph.calls;
    expect(c).toMatchObject({ api: "instagram", rawPath: "/v23.0/me" });
    expect(c.query.fields).toBe("id,user_id,username,name,account_type");
  });

  it("อ่านแบบ { data: [ … ] } ได้", async () => {
    graph.setInstagramMe({ ...DEFAULT_INSTAGRAM_ME, user_id: "IG7", username: "other.shop" }, { wrap: true });
    expect(await getInstagramMe("IG_TOKEN")).toMatchObject({ userId: "IG7", username: "other.shop", appScopedId: "APPSCOPED1" });
  });

  it("ไม่มี user_id → throw", async () => {
    graph.setInstagramMe({ id: "APPSCOPED1", username: "test.shop" });
    await expect(getInstagramMe("IG_TOKEN")).rejects.toThrow(/user_id/);
  });

  it("id ที่ Meta ส่งมาเป็นตัวเลขยาว (ไม่มีเครื่องหมายคำพูด) ไม่เพี้ยน", async () => {
    // ส่ง JSON ดิบเอง: mock ปกติใช้ JSON.stringify ซึ่งปัดตัวเลขไปก่อนแล้ว
    const raw = '{"id":9876543210123457,"user_id":17841405822304915,"username":"big.id"}';
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(raw, { status: 200 }));
    try {
      const me = await getInstagramMe("IG_TOKEN");
      expect(me.userId).toBe("17841405822304915");
      expect(me.appScopedId).toBe("9876543210123457");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("subscribe webhook ของบัญชี", () => {
  it("POST /me/subscribed_apps พร้อม field ครบ", async () => {
    await subscribeInstagramAccount("IG_TOKEN", INSTAGRAM_WEBHOOK_FIELDS);
    const [c] = graph.calls;
    expect(c).toMatchObject({ method: "POST", api: "instagram", path: "/me/subscribed_apps" });
    expect(c.query.subscribed_fields).toBe("comments,messages,messaging_postbacks,messaging_seen");
    expect(c.query.access_token).toBe("IG_TOKEN");
  });

  it("Meta ตอบ error → throw", async () => {
    graph.failWhen((c) => c.path === "/me/subscribed_apps");
    await expect(subscribeInstagramAccount("IG_TOKEN", INSTAGRAM_WEBHOOK_FIELDS)).rejects.toBeInstanceOf(GraphApiError);
  });

  it("unsubscribe → DELETE /me/subscribed_apps", async () => {
    await unsubscribeInstagramAccount("IG_TOKEN");
    expect(graph.calls[0]).toMatchObject({ method: "DELETE", api: "instagram", path: "/me/subscribed_apps" });
  });
});

describe("แลก / ต่ออายุ token (endpoint ไม่มีเวอร์ชัน)", () => {
  it("exchangeInstagramToken → GET /access_token พร้อม grant_type และ client_secret", async () => {
    const grant = await exchangeInstagramToken("IGSHORT_abc", "test-ig-app-secret");
    expect(grant.token).toMatch(/^IG_LONG_\d+$/);
    expect(grant.expiresInSec).toBe(5183944);
    const [c] = graph.calls;
    expect(c).toMatchObject({ method: "GET", api: "instagram", rawPath: "/access_token", authorization: null });
    expect(c.query).toEqual({ grant_type: "ig_exchange_token", client_secret: "test-ig-app-secret", access_token: "IGSHORT_abc" });
  });

  it("exchange ด้วย token ที่ long-lived อยู่แล้ว → error (เป็นเรื่องปกติ)", async () => {
    await expect(exchangeInstagramToken("IGAA_dashboard", "test-ig-app-secret")).rejects.toBeInstanceOf(GraphApiError);
  });

  it("refreshInstagramToken → GET /refresh_access_token พร้อม grant_type=ig_refresh_token", async () => {
    const grant = await refreshInstagramToken("IG_TOKEN");
    expect(grant).toEqual({ token: expect.stringMatching(/^IG_REFRESHED_\d+$/), expiresInSec: 5184000 });
    const [c] = graph.calls;
    expect(c).toMatchObject({ method: "GET", api: "instagram", rawPath: "/refresh_access_token" });
    expect(c.query).toEqual({ grant_type: "ig_refresh_token", access_token: "IG_TOKEN" });
  });
});

describe("โพสต์/รีล ผ่าน Instagram Login — caption ใช้ไม่ได้ก็ยังทำงาน", () => {
  beforeEach(() => {
    graph.setPosts([{ id: "IGP1", platform: "instagram", createdAt: POSTED, caption: "รีลใหม่" }]);
  });

  it("ปกติได้ caption ครบ (เรียกครั้งเดียว)", async () => {
    const posts = await listRecentInstagramPosts("IG1", "IG_TOKEN", 12, "instagram");
    expect(posts.map((p) => [p.id, p.caption])).toEqual([["IGP1", "รีลใหม่"]]);
    expect(graph.calls).toHaveLength(1);
    expect(graph.calls[0]).toMatchObject({ api: "instagram", path: "/IG1/media" });
    expect(graph.calls[0].query.limit).toBe("12");
  });

  it("ขอ caption แล้ว error → ลองใหม่โดยไม่ขอ caption", async () => {
    graph.failWhen((c) => c.query.fields?.includes("caption") ?? false);
    const posts = await listRecentInstagramPosts("IG1", "IG_TOKEN", 12, "instagram");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: "IGP1", platform: "instagram", mediaType: "VIDEO" });
    expect(posts[0].createdAt).not.toBeNull();

    const info = await getPostInfo("instagram", "IGP1", "IG_TOKEN", "instagram");
    expect(info.id).toBe("IGP1");
    expect(info.createdAt).toMatch(/\+0000$/);

    const fields = graph.calls.map((c) => [c.path, c.query.fields]);
    expect(fields).toEqual([
      ["/IG1/media", "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp"],
      ["/IG1/media", "id,permalink,media_type,media_url,thumbnail_url,timestamp"],
      ["/IGP1", "id,timestamp,caption,permalink"],
      ["/IGP1", "id,timestamp,permalink"],
    ]);
    expect(graph.calls.every((c) => c.api === "instagram")).toBe(true);
  });

  it("ผ่านเพจ (api facebook) ไม่ลองใหม่ — เหมือนเดิม", async () => {
    graph.failWhen((c) => c.query.fields?.includes("caption") ?? false);
    await expect(listRecentInstagramPosts("IG1", "PAGE_TOKEN")).rejects.toBeInstanceOf(GraphApiError);
    await expect(getPostInfo("instagram", "IGP1", "PAGE_TOKEN")).rejects.toBeInstanceOf(GraphApiError);
    expect(graph.calls).toHaveLength(2);
    expect(graph.calls.every((c) => c.api === "facebook")).toBe(true);
  });
});
