import { defineMessages } from "../core";

/*
 * ข้อความที่โค้ดเบื้องหลัง (src/lib/**) สร้างเอง แล้วไปโผล่ในหน้าจัดการ:
 * error ที่โยน/คืนให้หน้าเว็บ, lastError ของเพจ / บัญชี Instagram / งานในคิว, error และข้อความของกิจกรรม
 *
 * - ภาษาไทยคือ "ต้นฉบับ": โค้ดสร้างข้อความด้วย systemMessage("key", {...}) (src/lib/i18n/system.ts)
 *   แล้วเก็บ/โยนเป็นภาษาไทยเสมอ (โค้ดบางส่วนเทียบข้อความกันเอง เช่น INSTAGRAM_ERRORS)
 * - ตอนแสดงผล localizeSystemMessage(ข้อความ, ภาษา) จับคู่กับแม่แบบภาษาไทยในไฟล์นี้ แล้วแสดงภาษาอังกฤษแทน
 *   → แถวเก่าในฐานข้อมูลก็แปลได้ ข้อความที่ไม่ตรงแม่แบบไหน (เช่น error จาก Meta ซึ่งเป็นภาษาอังกฤษอยู่แล้ว) แสดงตามเดิม
 * - {detail} / {note} อาจเป็นข้อความของระบบอีกชั้น (เช่น "ต่ออายุ token ไม่สำเร็จ: เชื่อมต่อ Graph API ไม่ได้: …") → แปลซ้อนให้
 * - ค่าที่แทนใน {ตัวแปร} เป็นข้อความเสมอ (ไม่ใส่ตัวคั่นหลักพัน) ข้อความที่เก็บจึงเหมือนเดิมทุกตัวอักษร
 * ห้ามแก้ภาษาไทยของข้อความที่มีอยู่แล้วโดยไม่จำเป็น: แถวเก่าในฐานข้อมูลยังเป็นข้อความเดิม จะจับคู่ไม่เจอและแสดงเป็นภาษาไทย
 */
export const systemMessages = defineMessages({
  th: {
    // ---- เรียก Graph API (lib/meta/graph.ts) ----
    /** {detail} = สาเหตุจาก fetch เช่น "fetch failed" */
    graphUnreachable: "เชื่อมต่อ Graph API ไม่ได้: {detail}",
    graphHttpStatus: "Graph API ตอบกลับสถานะ {status}",
    metaAppMissing: "ยังไม่ได้ใส่ App ID / App Secret ของ Meta App",
    igNoUserId: "Instagram ไม่ได้บอก user_id ของบัญชีนี้",
    igSubscribeUnconfirmed: "Instagram ไม่ยืนยันการรับ webhook",
    igNoAccessToken: "Instagram ไม่ได้ส่ง access token กลับมา",

    // ---- token ใช้ไม่ได้ / ต่ออายุ (handlers.ts, next-post.ts, instagram/accounts.ts, instagram/token.ts) ----
    pageTokenRejected: "token ของเพจใช้ไม่ได้ — ไปที่หน้าตั้งค่าแล้วเชื่อมต่อเพจใหม่",
    igTokenRejected: "token ของ Instagram ใช้ไม่ได้ — ไปที่ ตั้งค่า → บัญชี Instagram แล้ววาง token ใหม่",
    igTokenExpired:
      "token Instagram หมดอายุหรือถูกยกเลิก — สร้าง token ใหม่ในหน้า API setup with Instagram login แล้ววางใน ตั้งค่า → บัญชี Instagram",
    /** ขึ้นต้นด้วย INSTAGRAM_ERRORS.refreshPrefix (หน้าตั้งค่าใช้แยกว่าเป็นปัญหาชั่วคราว) */
    igRefreshFailed: "ต่ออายุ token ไม่สำเร็จ: {detail}",
    /** ขึ้นต้นด้วย INSTAGRAM_ERRORS.subscribePrefix (ปุ่ม "ลองใหม่" ล้างเฉพาะ error นี้) */
    igSubscribeFailed: "subscribe webhook ไม่สำเร็จ ({detail})",
    igTokenDecrypt: "token ถอดรหัสไม่ได้ — วาง token ใหม่",
    igAccountNotFound: "ไม่พบบัญชี Instagram นี้ อาจถูกยกเลิกการเชื่อมต่อไปแล้ว",
    igTokenTooNew: "token เพิ่งสร้างไม่ถึง 24 ชั่วโมง ยังต่ออายุไม่ได้ (ระบบจะต่ออายุให้เองอัตโนมัติ)",

    // ---- เชื่อมบัญชี Instagram ด้วย token (instagram/connect.ts) ----
    igTokenMissing: "วาง access token ของ Instagram ก่อน",
    igTokenFacebook:
      "token นี้เป็นของ Facebook (ขึ้นต้นด้วย EAA) — ต้องกด Generate token ในหน้า API setup with Instagram login แล้วคัดลอก token ที่ขึ้นต้นด้วย IG",
    igTokenNotIg: "token ไม่ได้ขึ้นต้นด้วย IG — ถ้าเชื่อมไม่สำเร็จ ให้สร้าง token ใหม่จากหน้า API setup with Instagram login",
    igSecretMissing: "ใส่ Instagram app secret ในหัวข้อ Instagram App ก่อน",
    igTokenInvalid: "token ใช้ไม่ได้หรือหมดอายุ — กด Generate token ใหม่แล้ววางอีกครั้ง",
    igTokenWrongKind: "token นี้ใช้กับ Instagram Login ไม่ได้ — ต้องสร้างจากหน้า API setup with Instagram login",
    /** {detail} = error จาก Meta */
    igConnectFailed: "เชื่อมต่อไม่สำเร็จ: {detail}",
    /** ต้องขึ้นต้นด้วย settings.igLinkedPrefix ในภาษาเดียวกัน (ฟอร์มเชื่อม Instagram กรองข้อความนี้ออก) */
    igLinkedNotice: "บัญชีนี้ผูกกับเพจ {page} ด้วย — ระบบจะใช้ Instagram Login กับบัญชีนี้แทน",
    igIdMismatch:
      "ID ของ @{username} จาก Instagram Login ({id}) ไม่ตรงกับที่ผูกกับเพจ ({pageIgId}) — ระบบยังทำงานได้ แต่อาจตอบซ้ำ แจ้งผู้พัฒนา",

    // ---- ส่ง DM (automation/handlers.ts) — error / text ของกิจกรรม และ lastError ของงานในคิว ----
    stepMissing: "ไม่พบข้อความนี้ในกฎแล้ว (อาจถูกลบระหว่างรอส่ง)",
    capDm: "ส่ง DM ครบ {limit} ข้อความใน 1 ชั่วโมงแล้ว",
    capPrivateReply: "ตอบคอมเมนต์ทาง DM ครบ {limit} ครั้งใน 1 ชั่วโมงแล้ว",
    /** {note} = capDm / capPrivateReply */
    capWait: "{note} — รอคิวส่งต่อเมื่อพ้นช่วง 1 ชั่วโมง (ข้อความไม่หาย)",
    /** {code} = รหัส error จาก Meta เช่น "613" หรือ "10 / 2534040" */
    rateLimitWait: "Meta ขอให้ชะลอการส่ง (รหัส {code}) รอบที่ {hits}/{max} — ลองส่งใหม่ในอีก {minutes} นาที",
    /** {note} = rateLimitWait (งานอื่นของบัญชีเดียวกันที่ถูกพักไปด้วย) */
    rateLimitWaitAccount: "{note} (พักทั้งบัญชี)",
    /** ข้อความของกิจกรรม "Meta ขอให้ชะลอการส่ง DM" */
    rateLimitNotice:
      "Meta แจ้งว่าบัญชีนี้ส่งข้อความถี่เกินกำหนดชั่วคราว (รหัส {code}) — ระบบพักการส่ง DM ไว้ก่อน แล้วจะลองส่งใหม่เองเป็นระยะ (ครั้งแรกในอีก {minutes} นาที) ข้อความไม่หาย ไม่ต้องทำอะไร",

    // ---- อื่นๆ ----
    /** rules/next-post.ts: กฎ "โพสต์ถัดไป" ถาม Meta แล้วไม่ได้เวลาที่ลงโพสต์ */
    postTimeMissing: "Meta ไม่ได้บอกเวลาที่ลงโพสต์นี้",
    /** queue/worker.ts */
    unknownJobType: "ไม่รู้จักงานประเภท {type}",
    /** app/r/[code]: ลิงก์ติดตามที่ไม่มีในระบบ (ลูกค้าไม่มีคุกกี้ภาษา → ไทย) */
    linkNotFound: "ไม่พบลิงก์นี้",
  },
  en: {
    graphUnreachable: "Couldn't reach the Graph API: {detail}",
    graphHttpStatus: "The Graph API responded with status {status}",
    metaAppMissing: "The App ID / App Secret of your Meta App hasn't been entered yet",
    igNoUserId: "Instagram didn't return the user_id of this account",
    igSubscribeUnconfirmed: "Instagram didn't confirm the webhook subscription",
    igNoAccessToken: "Instagram didn't send back an access token",

    pageTokenRejected: "Your Page token doesn't work — go to Settings and reconnect the Page.",
    igTokenRejected: "Your Instagram token doesn't work — go to Settings → Instagram accounts and paste a new token.",
    igTokenExpired:
      "Your Instagram token expired or was revoked — create a new one on the API setup with Instagram login page and paste it in Settings → Instagram accounts.",
    igRefreshFailed: "Couldn't renew the token: {detail}",
    igSubscribeFailed: "Couldn't subscribe to the webhook ({detail})",
    igTokenDecrypt: "Can't read the saved token — paste a new token.",
    igAccountNotFound: "Can't find this Instagram account. It may have been disconnected already.",
    igTokenTooNew: "This token is less than 24 hours old, so it can't be renewed yet (we'll renew it automatically).",

    igTokenMissing: "Paste your Instagram access token first.",
    igTokenFacebook:
      "This is a Facebook token (it starts with EAA). Click Generate token on the API setup with Instagram login page and copy the token that starts with IG.",
    igTokenNotIg: "This token doesn't start with IG — if connecting fails, create a new token on the API setup with Instagram login page.",
    igSecretMissing: "Enter your Instagram app secret in the Instagram App section first.",
    igTokenInvalid: "This token doesn't work or has expired — click Generate token again and paste the new one.",
    igTokenWrongKind: "This token can't be used with Instagram Login — create it on the API setup with Instagram login page.",
    igConnectFailed: "Couldn't connect: {detail}",
    igLinkedNotice: "This account is also linked to your Page {page} — we'll use Instagram Login for it instead.",
    igIdMismatch:
      "The ID of @{username} from Instagram Login ({id}) doesn't match the one linked to your Page ({pageIgId}). Things still work, but replies may be sent twice — please tell your developer.",

    stepMissing: "This message is no longer in the automation (it may have been deleted while waiting to be sent).",
    capDm: "Reached the limit of {limit} DMs per hour",
    capPrivateReply: "Reached the limit of {limit} private replies per hour",
    capWait: "{note} — queued to send once the hour is up (no messages are lost)",
    rateLimitWait: "Meta asked us to slow down (code {code}), round {hits}/{max} — trying again in {minutes} min",
    rateLimitWaitAccount: "{note} (paused for the whole account)",
    rateLimitNotice:
      "Meta says this account is sending messages too often for now (code {code}). DMs are paused and we'll keep retrying on our own (first try in {minutes} min). No messages are lost, and you don't need to do anything.",

    postTimeMissing: "Meta didn't say when this post was published",
    unknownJobType: "Unknown task type: {type}",
    linkNotFound: "Link not found",
  },
});
