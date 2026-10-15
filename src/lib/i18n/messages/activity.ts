import { defineMessages } from "../core";

/**
 * หน้ากิจกรรม (/activity) — src/app/(dashboard)/activity/*
 * timeline.tsx ใช้ทั้งหน้ากิจกรรมและการ์ด "กิจกรรมล่าสุด" ในหน้าภาพรวม (และ RelativeTime ในหน้ารายชื่อลูกค้า)
 * {person} = ชื่อลูกค้า / @username / ชื่อบัญชีร้าน (ไม่ใช้ {name} เพราะเป็นคำแทนชื่อลูกค้าในข้อความของกฎ)
 */
export const activityMessages = defineMessages({
  th: {
    // ---- หัวหน้า (ชื่อหน้าอยู่ใน nav: "activity") ----
    description:
      "ทุกอย่างที่ระบบได้รับและทำไป เรียงจากล่าสุด ใช้ดูว่าระบบตอบลูกค้าแล้วหรือยัง และหาสาเหตุเวลาระบบไม่ตอบ (เก็บไว้ 12 เดือน)",
    refresh: "อัปเดตรายการ",
    /** loading.tsx (สำหรับโปรแกรมอ่านหน้าจอ) */
    loading: "กำลังโหลดกิจกรรม…",

    // ---- ตัวกรอง ----
    filterLabel: "กรองตามประเภท",
    filterAll: "ทั้งหมด",
    filterIncoming: "ข้อความเข้า",
    filterSent: "ส่งแล้ว",
    filterClicks: "กดปุ่ม/คลิก",
    filterFailed: "ไม่สำเร็จ",
    /** ข้างตัวกรอง: จำนวนรายการในหน้านี้ */
    countLatest: "ล่าสุด {count} รายการ",
    countOlder: "รายการที่เก่ากว่า {count} รายการ",

    // ---- ดูย้อนหลัง ----
    olderNotice: "กำลังดูรายการย้อนหลัง",
    backToLatest: "กลับไปรายการล่าสุด",
    loadOlder: "ดูรายการที่เก่ากว่า",
    /** หัวกลุ่มของแต่ละวัน (ชิดขวา) */
    groupCount: "{count} รายการ",

    // ---- หน้าว่าง ----
    emptyTitle: "ยังไม่มีกิจกรรม",
    emptyBody: "ลองคอมเมนต์หรือทักแชทเพจของคุณดู ถ้าตั้งค่าถูกต้อง รายการจะขึ้นที่นี่ภายในไม่กี่วินาที",
    emptyAction: "เปิดคู่มือตั้งค่า",
    emptyOlder: "ไม่มีรายการที่เก่ากว่านี้",
    emptyIncoming: "ยังไม่มีคอมเมนต์หรือแชทเข้ามา",
    emptySent: "ยังไม่มีข้อความที่ระบบส่งออกไป",
    emptyClicks: "ยังไม่มีใครกดปุ่มหรือคลิกลิงก์",
    emptyFailed: "ไม่มีรายการที่ส่งไม่สำเร็จ",
    emptyOther: "ไม่มีรายการ",
    emptyFailedBody: "ระบบตอบลูกค้าได้ตามปกติ",
    emptyViewAll: "ดูกิจกรรมทั้งหมด",

    // ---- แถบแจ้งเตือนรายการไม่สำเร็จ (failure-summary.ts) ----
    failSendTitle: "ส่งไม่สำเร็จ {count} รายการ ใน 24 ชั่วโมงที่ผ่านมา",
    failSendDescription: "กดดูสาเหตุและวิธีแก้ของแต่ละรายการ",
    failSendAction: "ดูสาเหตุ",
    failTokenTitle: "ต่ออายุ token Instagram ไม่สำเร็จ {count} ครั้ง ใน 24 ชั่วโมงที่ผ่านมา",
    failTokenDescription: "ไม่ใช่ข้อความที่ส่งไม่ถึงลูกค้า — ดูสถานะ token และวิธีแก้ได้ที่ ตั้งค่า → บัญชี Instagram",
    failTokenAction: "ไปที่ตั้งค่า",
    failBothTitle: "มีรายการไม่สำเร็จ {count} รายการ ใน 24 ชั่วโมงที่ผ่านมา",
    /** {send} = ส่งข้อความไม่สำเร็จ, {token} = ต่ออายุ token ไม่สำเร็จ */
    failBothDescription:
      "ส่งข้อความไม่สำเร็จ {send} รายการ · ต่ออายุ token Instagram ไม่สำเร็จ {token} ครั้ง — กดดูสาเหตุและวิธีแก้ของแต่ละรายการ",

    // ---- ประเภทกิจกรรม (timeline.tsx) ----
    evCommentReceived: "มีคนคอมเมนต์",
    evDmReceived: "มีคนทักแชท",
    evRuleTriggered: "ตรงกับกฎ",
    evPublicReplySent: "ตอบใต้คอมเมนต์แล้ว",
    evPublicReplyFailed: "ตอบใต้คอมเมนต์ไม่สำเร็จ",
    evDmSent: "ส่ง DM แล้ว",
    evDmFailed: "ส่ง DM ไม่สำเร็จ",
    evButtonClicked: "กดปุ่ม",
    evLinkClicked: "คลิกลิงก์",
    evSkipped: "ข้าม ไม่ได้ส่ง",
    evPostBound: "กฎเริ่มใช้กับโพสต์ใหม่แล้ว",
    evTokenRefreshFailed: "ต่ออายุ token Instagram ไม่สำเร็จ",
    evDmRateLimited: "Meta ขอให้ชะลอการส่ง DM",
    /** ต่อจากชื่อกิจกรรม เช่น "มีคนคอมเมนต์ จาก Ploy" */
    whoFrom: "จาก {person}",
    whoTo: "ถึง {person}",
    whoBy: "โดย {person}",
    /** กิจกรรมของบัญชีร้าน (ไม่เกี่ยวกับลูกค้า) เช่น "บัญชี @mali.shop" */
    whoAccount: "บัญชี {person}",

    // ---- รายละเอียดในแต่ละรายการ ----
    /** ชื่อกฎที่เกี่ยวข้อง */
    ruleName: "กฎ: {rule}",
    /** ป้ายต่อท้ายชื่อกิจกรรม เมื่อข้อความเข้าไม่ตรงกับกฎไหน */
    unmatchedTag: "(ไม่ตรงกฎ)",
    /** {where} = unmatchedWhereComment / unmatchedWhereDm */
    unmatchedNote: "ไม่ได้เก็บชื่อและข้อความ เพราะไม่ตรงกับกฎไหนเลย ({where})",
    unmatchedWhereComment: "คำ โพสต์ หรือแพลตฟอร์มที่ตั้งไว้",
    unmatchedWhereDm: "คำหรือแพลตฟอร์มที่ตั้งไว้",
    viewInInbox: "ดูในข้อความรอตอบ",
    buttonsAria: "ปุ่มในข้อความ",
    /** สำหรับโปรแกรมอ่านหน้าจอ อ่านก่อนชื่อปุ่มแต่ละปุ่ม */
    buttonSr: "ปุ่ม:",
    expandMore: "ดูทั้งหมด",
    expandLess: "ย่อ",
    /** {message} = ข้อความผิดพลาดจาก Meta (ภาษาอังกฤษตามที่ Meta ส่งมา) */
    errorReason: "สาเหตุ: {message}",
    /** Meta ไม่ได้บอกสาเหตุมา */
    errorUnknown: "ไม่ทราบสาเหตุ",
    errorCode: "รหัสจาก Meta: {code}",
    goToInstagramSettings: "ไปที่ตั้งค่า → บัญชี Instagram",

    // ---- เหตุผลที่ข้าม ----
    skipOncePerUser: "คนนี้เคยได้รับจากกฎนี้แล้ว (ตั้งไว้ให้ส่งครั้งเดียวต่อคน)",
    skipRuleInactive: "กฎนี้ปิดอยู่ จึงไม่ส่งข้อความถัดไป",
    skipNextPostLookupFailed: "เช็คกับ Meta ไม่ได้ว่าโพสต์นี้เป็นโพสต์ถัดไปของกฎหรือเปล่า จึงยังไม่ส่ง (คอมเมนต์ถัดไปจะลองเช็คใหม่)",

    // ---- คำอธิบายรหัสผิดพลาดที่พบบ่อยจาก Meta ----
    hint24h: "เกิน 24 ชั่วโมงหลังจากลูกค้าทักมาครั้งล่าสุด Meta จึงไม่ให้ส่งข้อความนี้",
    /** {menu} = ทางไปเมนูในแอป Instagram เช่น "โปรไฟล์ → ☰ → ..." (ตามภาษาของแอป) */
    hintIgMessageAccess:
      "บัญชี Instagram ปิด 'อนุญาตการเข้าถึงข้อความ' ไว้ — เปิดในแอป Instagram ของร้าน: {menu} → อนุญาตการเข้าถึงข้อความ (ดูคู่มือขั้นที่ 5)",
    hintToken: "token หมดอายุหรือใช้ไม่ได้ ไปที่หน้าตั้งค่าแล้วเชื่อมต่อเพจหรือบัญชี Instagram ใหม่",
    hintPermission: "แอปยังไม่ได้รับสิทธิ์นี้ ถ้ายังไม่ผ่าน App Review จะส่งได้เฉพาะบัญชีผู้ทดสอบของแอป",
    hintUnavailable: "ผู้รับไม่สามารถรับข้อความได้ในตอนนี้",
    hintRateLimit: "ส่งถี่เกินไป Meta จำกัดจำนวนชั่วคราว รอสักครู่แล้วระบบจะใช้งานได้ตามปกติ",

    // ---- สำหรับตรวจสอบปัญหา ----
    debugTitle: "สำหรับตรวจสอบปัญหา",
    debugDescription: "ข้อมูลทางเทคนิค ใช้ดูเวลาระบบไม่ตอบ หรือส่งให้คนที่ช่วยดูแลระบบ",
    failedJobsTitle: "งานที่ล้มเหลว",
    failedJobsDescription: "ระบบลองใหม่จนครบจำนวนครั้งแล้วยังไม่สำเร็จ",
    jobComment: "จัดการคอมเมนต์",
    jobDm: "จัดการข้อความแชท",
    jobRead: "อัปเดตสถานะอ่านแล้ว",
    jobSendDm: "ส่ง DM",
    jobAttempts: "ลองไปแล้ว {count} ครั้ง",
    webhookTitle: "ข้อมูลที่ Meta ส่งเข้ามาล่าสุด (webhook)",
    webhookDescription: "ข้อมูลดิบจาก Meta เก็บไว้ 7 วัน ถ้าว่างแปลว่า Meta ยังไม่ได้ส่งข้อมูลเข้ามาที่ระบบ",
    webhookEmptyTitle: "ยังไม่เคยได้รับข้อมูลจาก Meta",
    webhookEmptyAction: "ตรวจขั้นตอนตั้งค่า",
    webhookEmptyBody: "ตรวจขั้นตอนตั้งค่า Webhook ในคู่มือ แล้วลองคอมเมนต์ที่เพจอีกครั้ง",
    /** ที่มาของข้อมูล: Instagram ที่เชื่อมผ่านเพจ Facebook */
    sourceInstagramViaPage: "Instagram (ผ่านเพจ)",
    sourceUnknown: "ไม่ทราบที่มา",
    /** สรุปข้อมูลก้อนนี้ เช่น "คอมเมนต์ · กดปุ่ม 2" */
    whComment: "คอมเมนต์",
    whPageMessage: "ข้อความจากเพจ",
    whChat: "แชท",
    whButton: "กดปุ่ม",
    whRead: "อ่านแล้ว",
    whOther: "อื่นๆ",
    /** {label} = ชนิดข้อมูลด้านบน, {count} = จำนวน (แสดงเมื่อมากกว่า 1) */
    whCount: "{label} {count}",
  },
  en: {
    description:
      "Everything the system received and did, newest first. Check whether customers got a reply, and find out why when they didn't. Kept for 12 months.",
    refresh: "Refresh",
    loading: "Loading activity…",

    filterLabel: "Filter by type",
    filterAll: "All",
    filterIncoming: "Incoming",
    filterSent: "Sent",
    filterClicks: "Taps/clicks",
    filterFailed: "Failed",
    countLatest: "Latest: {count}",
    countOlder: "Older: {count}",

    olderNotice: "You're looking at older events",
    backToLatest: "Back to latest",
    loadOlder: "Show older events",
    groupCount: "{count} total",

    emptyTitle: "No activity yet",
    emptyBody: "Try commenting on or messaging your Page. If setup is right, it shows up here within seconds.",
    emptyAction: "Open Setup guide",
    emptyOlder: "Nothing older than this",
    emptyIncoming: "No comments or messages yet",
    emptySent: "Nothing sent yet",
    emptyClicks: "No button taps or link clicks yet",
    emptyFailed: "Nothing failed to send",
    emptyOther: "Nothing here",
    emptyFailedBody: "Replies are going out as usual.",
    emptyViewAll: "See all activity",

    failSendTitle: "Failed to send in the last 24 hours: {count}",
    failSendDescription: "See the reason and how to fix each one.",
    failSendAction: "See reasons",
    failTokenTitle: "Instagram token renewals failed in the last 24 hours: {count}",
    failTokenDescription:
      "No customer messages were lost. See the token status and how to fix it in Settings → Instagram accounts.",
    failTokenAction: "Go to Settings",
    failBothTitle: "Failed in the last 24 hours: {count}",
    failBothDescription:
      "Messages not sent: {send} · Instagram token renewals failed: {token}. See the reason and how to fix each one.",

    evCommentReceived: "New comment",
    evDmReceived: "New message",
    evRuleTriggered: "Matched an automation",
    evPublicReplySent: "Public reply sent",
    evPublicReplyFailed: "Public reply failed",
    evDmSent: "DM sent",
    evDmFailed: "DM failed",
    evButtonClicked: "Button tapped",
    evLinkClicked: "Link clicked",
    evSkipped: "Skipped, not sent",
    evPostBound: "Automation now runs on a new post",
    evTokenRefreshFailed: "Couldn't renew Instagram token",
    evDmRateLimited: "Meta asked to slow down DMs",
    whoFrom: "from {person}",
    whoTo: "to {person}",
    whoBy: "by {person}",
    whoAccount: "for {person}",

    ruleName: "Automation: {rule}",
    unmatchedTag: "(no match)",
    unmatchedNote: "Name and message not saved because it matched no automation ({where})",
    unmatchedWhereComment: "keywords, posts, or platforms you set",
    unmatchedWhereDm: "keywords or platforms you set",
    viewInInbox: "See in Inbox",
    buttonsAria: "Buttons in the message",
    buttonSr: "Button:",
    expandMore: "Show all",
    expandLess: "Show less",
    errorReason: "Reason: {message}",
    errorUnknown: "Unknown reason",
    errorCode: "Meta error code: {code}",
    goToInstagramSettings: "Go to Settings → Instagram accounts",

    skipOncePerUser: "This person already got it from this automation (set to send once per person)",
    skipRuleInactive: "This automation is off, so the next message wasn't sent",
    skipNextPostLookupFailed:
      "Couldn't check with Meta whether this is the automation's next post, so nothing was sent yet (it checks again on the next comment)",

    hint24h: "It's been more than 24 hours since the customer last messaged you, so Meta doesn't allow this message.",
    hintIgMessageAccess:
      "This Instagram account has 'Allow access to messages' turned off. Turn it on in your shop's Instagram app: {menu} → Allow access to messages (see step 5 of the Setup guide)",
    hintToken: "The token expired or stopped working. Go to Settings and connect the Page or Instagram account again.",
    hintPermission: "The app doesn't have this permission yet. Until it passes App Review, it can only send to the app's test accounts.",
    hintUnavailable: "This person can't receive messages right now.",
    hintRateLimit: "Too many messages too fast, so Meta is limiting sends for a while. Wait a bit and things go back to normal.",

    debugTitle: "Troubleshooting",
    debugDescription: "Technical details. Use them when the system doesn't reply, or send them to whoever helps you run it.",
    failedJobsTitle: "Tasks that failed",
    failedJobsDescription: "The system retried as many times as it could and still couldn't finish.",
    jobComment: "Handle a comment",
    jobDm: "Handle a message",
    jobRead: "Update read status",
    jobSendDm: "Send a DM",
    jobAttempts: "Attempts: {count}",
    webhookTitle: "Latest data from Meta (webhook)",
    webhookDescription: "Raw data from Meta, kept for 7 days. If it's empty, Meta hasn't sent anything to the app yet.",
    webhookEmptyTitle: "Nothing from Meta yet",
    webhookEmptyAction: "Check setup steps",
    webhookEmptyBody: "Check the webhook steps in the Setup guide, then try commenting on your Page again.",
    sourceInstagramViaPage: "Instagram (via Page)",
    sourceUnknown: "Unknown source",
    whComment: "Comment",
    whPageMessage: "Page message",
    whChat: "Message",
    whButton: "Button tap",
    whRead: "Read",
    whOther: "Other",
    whCount: "{label} ×{count}",
  },
});
