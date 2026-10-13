/** ตัวอย่าง webhook payload ตามรูปแบบที่ Meta ส่งมาจริง */

export function fbComment(o: { text?: string; fromId?: string; commentId?: string; postId?: string; verb?: string } = {}) {
  const postId = o.postId ?? "PAGE1_POST1";
  return {
    object: "page",
    entry: [
      {
        id: "PAGE1",
        time: 1700000000,
        changes: [
          {
            field: "feed",
            value: {
              from: { id: o.fromId ?? "USER1", name: "Somchai Jaidee" },
              post_id: postId,
              comment_id: o.commentId ?? "POST1_C1",
              parent_id: postId,
              created_time: 1700000000,
              item: "comment",
              verb: o.verb ?? "add",
              message: o.text ?? "สนใจ",
            },
          },
        ],
      },
    ],
  };
}

/** คอมเมนต์ Instagram (noId = ส่ง comment_id มาแทน id) */
export function igComment(
  o: { text?: string; fromId?: string; fromUsername?: string; commentId?: string; mediaId?: string; noId?: boolean } = {},
) {
  const commentId = o.commentId ?? "IGC1";
  return {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        time: 1700000000,
        changes: [
          {
            field: "comments",
            value: {
              from: { id: o.fromId ?? "IGUSER1", username: o.fromUsername ?? "mint.shop" },
              media: { id: o.mediaId ?? "MEDIA1", media_product_type: "FEED" },
              ...(o.noId ? { comment_id: commentId } : { id: commentId }),
              text: o.text ?? "สนใจ",
            },
          },
        ],
      },
    ],
  };
}

/** คอมเมนต์ของบัญชีร้านเอง (Instagram Login แนบ from.self_ig_scoped_id มาด้วย) */
export function igSelfComment(o: { fromId?: string; commentId?: string; text?: string } = {}) {
  return {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        time: 1700000000,
        changes: [
          {
            field: "comments",
            value: {
              from: { id: o.fromId ?? "IG1", username: "test.shop", self_ig_scoped_id: "IGSCOPED_SELF1" },
              media: { id: "MEDIA1", media_product_type: "FEED" },
              id: o.commentId ?? "IGC_SELF1",
              text: o.text ?? "ส่งรายละเอียดให้ทาง DM แล้วนะคะ",
            },
          },
        ],
      },
    ],
  };
}

export function fbDm(o: { text?: string; mid?: string; echo?: boolean; senderId?: string } = {}) {
  const senderId = o.echo ? "PAGE1" : (o.senderId ?? "PSID1");
  return {
    object: "page",
    entry: [
      {
        id: "PAGE1",
        time: 1700000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: o.echo ? "PSID1" : "PAGE1" },
            timestamp: 1700000000000,
            message: { mid: o.mid ?? "mid.1", text: o.text ?? "ราคา", ...(o.echo ? { is_echo: true } : {}) },
          },
        ],
      },
    ],
  };
}

export function igDm(o: { text?: string; mid?: string; senderId?: string } = {}) {
  return {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        time: 1700000000,
        messaging: [
          {
            sender: { id: o.senderId ?? "IGSID1" },
            recipient: { id: "IG1" },
            timestamp: 1700000000000,
            message: { mid: o.mid ?? "igmid.1", text: o.text ?? "ราคา" },
          },
        ],
      },
    ],
  };
}

/** ลูกค้ากด quick reply → มาเป็น event messages ที่มี message.quick_reply.payload */
export function igQuickReply(payload: string, o: { text?: string; mid?: string; senderId?: string } = {}) {
  return {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        time: 1700000000,
        messaging: [
          {
            sender: { id: o.senderId ?? "IGSID1" },
            recipient: { id: "IG1" },
            timestamp: Date.now(),
            message: { mid: o.mid ?? "igqr.1", text: o.text ?? "ใช่ ฉันสนใจ", quick_reply: { payload } },
          },
        ],
      },
    ],
  };
}

export function fbRead(watermark: number, senderId = "PSID1") {
  return {
    object: "page",
    entry: [
      {
        id: "PAGE1",
        time: 1700000000,
        messaging: [{ sender: { id: senderId }, recipient: { id: "PAGE1" }, timestamp: watermark, read: { watermark } }],
      },
    ],
  };
}

export function igRead(mid: string, senderId = "IGSID1") {
  return {
    object: "instagram",
    entry: [
      {
        id: "IG1",
        time: 1700000000,
        messaging: [{ sender: { id: senderId }, recipient: { id: "IG1" }, timestamp: Date.now(), read: { mid } }],
      },
    ],
  };
}

/** ลูกค้ากดปุ่มในข้อความของเรา (postback) */
export function postback(
  platform: "facebook" | "instagram",
  payload: string,
  o: { title?: string; senderId?: string; mid?: string } = {},
) {
  const account = platform === "facebook" ? "PAGE1" : "IG1";
  return {
    object: platform === "facebook" ? "page" : "instagram",
    entry: [
      {
        id: account,
        time: 1700000000,
        messaging: [
          {
            sender: { id: o.senderId ?? (platform === "facebook" ? "PSID1" : "IGSID1") },
            recipient: { id: account },
            timestamp: Date.now(),
            postback: { mid: o.mid ?? "pb.1", title: o.title ?? "ใช่ ฉันสนใจ", payload },
          },
        ],
      },
    ],
  };
}
