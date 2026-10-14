import { defineMessages } from "../core";

/**
 * หน้าข้อความรอตอบ (/inbox) — คนที่ทักหรือคอมเมนต์แล้วไม่ตรงกับกฎไหนเลย
 * ห้ามเขียนว่าเป็นเพราะ "คำไม่ตรง" อย่างเดียว: คอมเมนต์ไม่ตรงกฎได้เพราะโพสต์/แพลตฟอร์มที่เลือกไว้ หรือกฎปิดอยู่ด้วย
 * (เหมือนคำอธิบายในหน้ากิจกรรม — activity/timeline.tsx → unmatchedNote)
 * ชื่อหน้าอยู่ใน nav ("inbox") · {where} = ชื่อแอปของ Meta (Messenger / Instagram / Meta Business Suite) ไม่แปล
 * {person} = ชื่อลูกค้า / @username / "ผู้ใช้ Facebook" (ไม่ใช้ {name} เพราะเป็นคำแทนชื่อลูกค้าในข้อความของกฎ)
 */
export const inboxMessages = defineMessages({
  th: {
    // ---- หัวหน้า ----
    description:
      "คนที่ทักแชทหรือคอมเมนต์แล้วไม่ตรงกับกฎไหนเลย ระบบจึงไม่ได้ตอบให้ — กด “ตอบ” เพื่อไปคุยต่อใน Messenger หรือ Instagram แล้วกด “เสร็จแล้ว” รายการจะถูกลบเองเมื่อครบ {days} วัน",
    /** ป้ายข้างชื่อหน้า */
    badgeWaiting: "รอตอบ {count}",

    // ---- ตัวกรอง ----
    filterKindLabel: "ประเภทข้อความ",
    filterAll: "ทั้งหมด",
    filterChats: "แชท",
    filterComments: "คอมเมนต์",
    filterPlatformLabel: "แพลตฟอร์ม",
    showDone: "แสดงที่เสร็จแล้ว",

    // ---- แต่ละแถว ----
    /** คนที่ Meta ไม่ส่งชื่อมา — {platform} = Facebook / Instagram */
    unknownPerson: "ผู้ใช้ {platform}",
    kindChat: "แชท",
    kindComment: "คอมเมนต์",
    onPost: "บนโพสต์",
    openPostAria: "เปิดโพสต์ที่ {person} คอมเมนต์ (แท็บใหม่)",
    /** ลูกค้าส่งแต่รูป / สติกเกอร์ / ไฟล์ (ไม่มีข้อความ) */
    attachmentOnly: "ส่งรูป สติกเกอร์ หรือไฟล์แนบ",
    /** แชทหลายข้อความของคนเดียวกัน (แสดงเฉพาะเมื่อมีตั้งแต่ 2 ข้อความ) */
    messageCount: "{count} ข้อความ · แสดงข้อความล่าสุด",
    reply: "ตอบ",
    replyAria: "ตอบ {person} ใน {where} (เปิดแท็บใหม่)",
    /** แชท Facebook บนมือถือ: เปิดแอป Messenger */
    replyAppAria: "ตอบ {person} ในแอป Messenger",
    /** แชท Facebook บนคอมพิวเตอร์ (มือถือเปิดแอป Messenger — ข้อความอยู่ใน common) */
    replyHintMessenger: "เปิดแชทนี้ในกล่องข้อความของเพจ (Meta Business Suite) — บนคอมพิวเตอร์ Facebook ปิดแอป Messenger ไปแล้ว",
    replyHintInstagramChat: "เปิดแชทกับลูกค้าคนนี้ในแอป Instagram",
    replyHintInstagramProfile: "เปิดหน้าโปรไฟล์ของลูกค้าใน Instagram แล้วกด “ส่งข้อความ”",
    replyHintInstagramInbox: "เปิดกล่องข้อความ Instagram แล้วหาแชทของลูกค้าคนนี้",
    replyHintFacebookComment: "เปิดคอมเมนต์นี้บน Facebook แล้วตอบใต้คอมเมนต์",
    replyHintInstagramComment: "เปิดโพสต์บน Instagram แล้วตอบใต้คอมเมนต์ของลูกค้า",
    replyHintBusinessSuite: "เปิด Meta Business Suite แล้วหาคอมเมนต์นี้",
    done: "เสร็จแล้ว",
    doneAria: "เสร็จแล้ว — ตอบ {person} แล้ว",
    /** แถวที่กดเสร็จแล้ว (ตอนเปิด “แสดงที่เสร็จแล้ว”) — {time} เช่น "5 นาทีที่ผ่านมา" */
    doneAt: "เสร็จแล้ว · {time}",
    markWaiting: "ยังไม่เสร็จ",
    markWaitingAria: "ยังไม่เสร็จ — ย้าย {person} กลับมารอตอบ",
    doneToast: "ย้ายไปที่เสร็จแล้ว",
    undo: "เลิกทำ",
    waitingToast: "ย้ายกลับมารอตอบแล้ว",

    // ---- หน้าว่าง ----
    emptyTitle: "ยังไม่มีข้อความรอตอบ",
    emptyBody:
      "เมื่อมีคนทักแชทหรือคอมเมนต์แล้วไม่ตรงกับกฎไหนเลย จะขึ้นที่นี่ให้คุณกดไปตอบเองใน Messenger หรือ Instagram รายการจะถูกลบอัตโนมัติเมื่อครบ {days} วัน",
    emptyAction: "ดูกฎอัตโนมัติ",
    caughtUpTitle: "ตอบครบทุกคนแล้ว",
    caughtUpBody: "ตอนนี้ไม่มีใครรอคำตอบอยู่",
    showDoneAction: "ดูรายการที่เสร็จแล้ว",
    filteredEmptyTitle: "ไม่มีรายการในตัวกรองนี้",
    clearFilters: "ล้างตัวกรอง",
    pageEmptyTitle: "ไม่มีรายการในหน้านี้",
    backToFirstPage: "กลับไปหน้าแรก",

    // ---- เลขหน้า ----
    showing: "แสดง {from}–{to} จาก {total} รายการ",
    pagerLabel: "เปลี่ยนหน้า",
    prev: "ก่อนหน้า",
    next: "ถัดไป",
  },
  en: {
    description:
      "People who messaged or commented without matching any of your automations, so nothing was sent to them. Tap “Reply” to answer in Messenger or Instagram, then tap “Done”. Items are deleted automatically after {days} days.",
    badgeWaiting: "{count} waiting",

    filterKindLabel: "Message type",
    filterAll: "All",
    filterChats: "Chats",
    filterComments: "Comments",
    filterPlatformLabel: "Platform",
    showDone: "Show done",

    unknownPerson: "{platform} user",
    kindChat: "Chat",
    kindComment: "Comment",
    onPost: "on post",
    openPostAria: "Open the post {person} commented on (new tab)",
    attachmentOnly: "Sent a photo, sticker or attachment",
    messageCount: "{count} messages · showing the latest",
    reply: "Reply",
    replyAria: "Reply to {person} in {where} (opens in a new tab)",
    replyAppAria: "Reply to {person} in the Messenger app",
    replyHintMessenger: "Open this chat in your Page inbox (Meta Business Suite). Facebook no longer has a Messenger app for computers.",
    replyHintInstagramChat: "Open the chat with this customer in the Instagram app",
    replyHintInstagramProfile: "Open this customer's Instagram profile, then tap “Message”",
    replyHintInstagramInbox: "Open your Instagram inbox and find this customer's chat",
    replyHintFacebookComment: "Open this comment on Facebook and reply under it",
    replyHintInstagramComment: "Open the post on Instagram and reply under the customer's comment",
    replyHintBusinessSuite: "Open Meta Business Suite and find this comment",
    done: "Done",
    doneAria: "Done — replied to {person}",
    doneAt: "Done · {time}",
    markWaiting: "Mark as waiting",
    markWaitingAria: "Mark as waiting — move {person} back",
    doneToast: "Marked as done",
    undo: "Undo",
    waitingToast: "Moved back to waiting",

    emptyTitle: "Nothing waiting for a reply",
    emptyBody:
      "When someone messages or comments without matching any of your automations, they'll show up here so you can reply yourself in Messenger or Instagram. Items are deleted automatically after {days} days.",
    emptyAction: "View automations",
    caughtUpTitle: "You're all caught up",
    caughtUpBody: "No one is waiting for a reply right now.",
    showDoneAction: "Show done items",
    filteredEmptyTitle: "Nothing matches these filters",
    clearFilters: "Clear filters",
    pageEmptyTitle: "Nothing on this page",
    backToFirstPage: "Back to the first page",

    showing: "Showing {from}–{to} of {total}",
    pagerLabel: "Pages",
    prev: "Previous",
    next: "Next",
  },
});
