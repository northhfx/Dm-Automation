import { defineMessages } from "../core";

/**
 * หน้าแชทกับลูกค้าหนึ่งคน (/inbox/<platform>/<account>/<user>) — พิมพ์ตอบในนามเพจ / บัญชี Instagram ได้จากหน้านี้
 * {person} = ชื่อลูกค้า / @username / "ผู้ใช้ Facebook" · {account} = ชื่อเพจ หรือ @username ของร้าน
 * {platform} / {where} = ชื่อแพลตฟอร์ม/แอปของ Meta (Facebook, Instagram, Messenger, Meta Business Suite) ไม่แปล
 */
export const chatMessages = defineMessages({
  th: {
    /** ชื่อแท็บเบราว์เซอร์ */
    metaTitle: "แชทกับ {person}",
    unknownPerson: "ผู้ใช้ {platform}",
    replyingAs: "ตอบในนาม {account}",
    /** ลิงก์รองบนหัวห้องแชท: ไปคุยต่อในแอปของ Meta */
    openIn: "เปิดใน {where}",
    openInAria: "เปิดแชทกับ {person} ใน {where} (เปิดแท็บใหม่)",
    openInAppAria: "เปิดแชทกับ {person} ในแอป Messenger",
    markDone: "เสร็จแล้ว",
    markDoneAria: "เสร็จแล้ว — ตอบ {person} แล้ว (ย้ายออกจากข้อความรอตอบ)",
    doneToast: "ย้ายไปที่เสร็จแล้ว",
    historyLabel: "ข้อความกับ {person}",
    historyNote: "แสดงเฉพาะข้อความที่ระบบนี้เห็นใน {days} วันล่าสุด — ข้อความที่ตอบจากแอป Messenger หรือ Instagram โดยตรงจะไม่ขึ้นที่นี่",
    empty: "ยังไม่มีข้อความในช่วงนี้",
    /** ลูกค้ากดปุ่มในข้อความอัตโนมัติ */
    buttonTap: "กดปุ่ม “{title}”",
    buttonTapNoTitle: "กดปุ่มในข้อความ",
    attachmentOnly: "ส่งรูป สติกเกอร์ หรือไฟล์แนบ",
    /** ป้ายใต้ข้อความที่ระบบส่งเอง — {rule} = ชื่อกฎ */
    autoFromRule: "ข้อความอัตโนมัติ · {rule}",
    auto: "ข้อความอัตโนมัติ",
    /** ป้ายใต้ข้อความที่เจ้าของร้านพิมพ์ตอบในหน้านี้ */
    you: "คุณตอบ",
    failed: "ส่งไม่สำเร็จ",
    /** วันที่คั่นกลางห้องแชท */
    today: "วันนี้",
    yesterday: "เมื่อวาน",

    // ---- ช่องพิมพ์ ----
    inputLabel: "ข้อความตอบกลับ",
    placeholder: "พิมพ์ข้อความ…",
    send: "ส่ง",
    sending: "กำลังส่ง…",
    sentToast: "ส่งแล้ว",
    /** {count} = จำนวนตัวอักษรที่พิมพ์, {max} = ยาวสุด */
    charCount: "{count}/{max}",
    /** {time} = เวลาที่หมดสิทธิ์ เช่น "พรุ่งนี้ 14:05" */
    windowOpen: "ตอบจากที่นี่ได้ถึง {time} (24 ชั่วโมงหลังลูกค้าทักล่าสุด)",
    windowClosedTitle: "ส่งข้อความจากที่นี่ไม่ได้แล้ว",
    windowClosedBody:
      "{platform} ให้ระบบตอบได้ภายใน 24 ชั่วโมงหลังลูกค้าทักมาล่าสุด แชทนี้เกินเวลาแล้ว — ตอบใน {where} แทน หรือรอให้ลูกค้าทักมาอีกครั้ง",
    noInboundTitle: "ลูกค้ายังไม่ได้ทักแชทมา",
    noInboundBody: "{platform} ให้ระบบส่งข้อความได้เฉพาะคนที่ทักแชทหรือกดปุ่มมาภายใน 24 ชั่วโมง — ตอบใน {where} แทน",

    // ---- ส่งไม่สำเร็จ ----
    errEmpty: "พิมพ์ข้อความก่อนส่ง",
    errTooLong: "ข้อความยาวเกิน {max} ตัวอักษร",
    errNoConnection: "ไม่พบบัญชีที่เชื่อมไว้แล้ว — ตรวจที่หน้าตั้งค่า",
    errToken: "การเชื่อมต่อกับ {platform} ใช้ไม่ได้แล้ว — เชื่อมต่อใหม่ที่หน้าตั้งค่า",
    errWindow: "เกิน 24 ชั่วโมงหลังลูกค้าทักมาล่าสุดแล้ว {platform} จึงไม่ให้ส่ง — ตอบใน {where} แทน",
    errUnavailable: "ส่งไม่ได้: ลูกค้าคนนี้อาจปิดรับข้อความ บล็อก หรือลบบัญชีไปแล้ว",
    errFailed: "ส่งไม่สำเร็จ: {detail}",
    errFailedGeneric: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง",
  },
  en: {
    metaTitle: "Chat with {person}",
    unknownPerson: "{platform} user",
    replyingAs: "Replying as {account}",
    openIn: "Open in {where}",
    openInAria: "Open the chat with {person} in {where} (opens in a new tab)",
    openInAppAria: "Open the chat with {person} in the Messenger app",
    markDone: "Done",
    markDoneAria: "Done — replied to {person} (removes them from the inbox)",
    doneToast: "Marked as done",
    historyLabel: "Messages with {person}",
    historyNote:
      "Shows only the messages this system saw in the last {days} days. Replies you send directly from Messenger or Instagram don't appear here.",
    empty: "No messages in this period",
    buttonTap: "Tapped “{title}”",
    buttonTapNoTitle: "Tapped a button",
    attachmentOnly: "Sent a photo, sticker or attachment",
    autoFromRule: "Automatic message · {rule}",
    auto: "Automatic message",
    you: "You replied",
    failed: "Not sent",
    today: "Today",
    yesterday: "Yesterday",

    inputLabel: "Your reply",
    placeholder: "Type a message…",
    send: "Send",
    sending: "Sending…",
    sentToast: "Sent",
    charCount: "{count}/{max}",
    windowOpen: "You can reply from here until {time} (24 hours after their last message)",
    windowClosedTitle: "You can't reply from here anymore",
    windowClosedBody:
      "{platform} only lets this system reply within 24 hours of the customer's last message, and this chat is past that. Reply in {where} instead, or wait for the customer to message again.",
    noInboundTitle: "This customer hasn't messaged you yet",
    noInboundBody: "{platform} only lets this system message people who messaged or tapped a button in the last 24 hours. Reply in {where} instead.",

    errEmpty: "Type a message first",
    errTooLong: "The message is longer than {max} characters",
    errNoConnection: "The connected account was not found. Check Settings.",
    errToken: "The connection to {platform} no longer works. Reconnect it in Settings.",
    errWindow: "It's been more than 24 hours since the customer's last message, so {platform} won't allow it. Reply in {where} instead.",
    errUnavailable: "Couldn't send: this customer may have turned off messages, blocked you, or deleted their account.",
    errFailed: "Couldn't send: {detail}",
    errFailedGeneric: "Couldn't send. Please try again.",
  },
});
