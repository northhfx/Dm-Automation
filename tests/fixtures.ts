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

export function igComment(o: { text?: string; fromId?: string; commentId?: string; mediaId?: string } = {}) {
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
              from: { id: o.fromId ?? "IGUSER1", username: "mint.shop" },
              media: { id: o.mediaId ?? "MEDIA1", media_product_type: "FEED" },
              id: o.commentId ?? "IGC1",
              text: o.text ?? "สนใจ",
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
