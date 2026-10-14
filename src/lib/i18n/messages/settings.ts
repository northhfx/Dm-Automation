import { defineMessages } from "../core";

/**
 * หน้าตั้งค่า (/settings) — src/app/(dashboard)/settings/* (ยกเว้นการ์ด "การแสดงผล" ที่อยู่ใน appearance)
 * ฟอร์ม/รายการเพจ/บัญชี Instagram ในไฟล์เหล่านี้ใช้ในหน้าคู่มือ (/guide) ด้วย
 */
export const settingsMessages = defineMessages({
  th: {
    // ---- หัวหน้า ----
    headerDescription: "การเชื่อมต่อกับ Facebook / Instagram และค่าของระบบ",
    /** {guide} = ลิงก์ "คู่มือตั้งค่า" */
    headerFirstTime: "ตั้งค่าครั้งแรก? ทำตาม {guide} ทีละขั้นจะง่ายกว่า",

    // ---- เมนูหมวด (ซ้ายมือ / แถบบนมือถือ) ----
    navAriaLabel: "หมวดการตั้งค่า",
    /** สำหรับโปรแกรมอ่านหน้าจอ ต่อท้ายหมวดที่มีจุดเตือน */
    navAttention: "(ต้องตรวจสอบ)",
    groupPages: "เพจ",
    groupSystem: "ระบบ",
    navPassword: "รหัสผ่าน",

    // ---- ป้ายสถานะที่ใช้หลายการ์ด ----
    statusReady: "พร้อมใช้งาน",
    statusAttention: "ต้องตรวจสอบ",
    badgeSaved: "บันทึกแล้ว",
    badgeIncomplete: "ยังไม่ครบ",
    badgeVerified: "Meta ยืนยันแล้ว",
    badgeNotVerified: "ยังไม่ยืนยัน",

    // ---- การ์ด: เพจที่เชื่อมต่อ / เชื่อมต่อเพจใหม่ ----
    pagesTitle: "เพจที่เชื่อมต่อ",
    pagesDescription: "เพจ Facebook ที่ระบบตอบให้อัตโนมัติ",
    connectTitle: "เชื่อมต่อเพจใหม่",
    connectDescription: "ใช้ได้ทั้งเพจใหม่และเชื่อมเพจเดิมซ้ำ (เช่น เมื่อ token ใช้ไม่ได้)",

    // ---- การ์ด: บัญชี Instagram ----
    igTitle: "บัญชี Instagram",
    igNotConnected: "ยังไม่เชื่อม",
    igDescription: "เชื่อมผ่าน Instagram Login แยกจากเพจ Facebook — ใช้ตอบคอมเมนต์และ DM ของ Instagram",
    igLimitsNote:
      "ระบบไม่จำกัดจำนวนข้อความหรือจำนวนลูกค้า · Meta ให้ส่ง DM ตอบคอมเมนต์ได้ราว 750 ครั้ง/ชม. ต่อบัญชี (เกินจะรอคิวส่งให้เองอัตโนมัติ ไม่มีข้อความหาย) ส่วนการตอบแชทแทบไม่จำกัด",
    igConnectTitleMore: "วาง token ใหม่ / เชื่อมบัญชีเพิ่ม",
    igConnectTitleFirst: "เชื่อมบัญชี Instagram",
    igConnectHint: "วาง token บัญชีเดิมซ้ำได้ (เช่น เมื่อ token ใช้ไม่ได้) — กฎและข้อมูลเดิมยังอยู่ครบ",

    // ---- การ์ด: Instagram App ----
    igAppDescription:
      "Instagram app secret จากหน้า API setup with Instagram login และ App secret จาก App settings → Basic ของแอป Instagram ที่สร้างแยก",

    // ---- การ์ด: Webhook Instagram ----
    igWebhookTitle: "Webhook Instagram",
    igWebhookDescription: "ค่าที่ใส่ในหัวข้อ Configure webhooks ของหน้า API setup with Instagram login",
    igBadSignatureTitle: "Meta ส่งข้อมูล Instagram มาแล้ว แต่ลายเซ็นไม่ตรงกับ secret ที่บันทึกไว้",
    igBadSignatureAction: "ใส่ secret ใหม่",
    /** {time} = วันเวลาที่พบล่าสุด */
    igBadSignatureBody:
      "ครั้งล่าสุด {time} — คัดลอก Instagram app secret ล่าสุด (และ App secret จาก App settings → Basic ถ้าใช้แอปแยก) มาวางในหัวข้อ Instagram App",
    igNotVerifiedTitle: "Meta ยังไม่ได้ยืนยันลิงก์ของ Instagram",
    seeHow: "ดูวิธีตั้ง",
    igNotVerifiedBody: "คัดลอก 2 ค่าด้านล่างไปวางในหัวข้อ Configure webhooks แล้วกด Verify and save",
    igLastWebhookLabel: "ได้รับ webhook ทาง Instagram Login ล่าสุด",

    // ---- ส่วนที่ใช้ทั้ง Webhook และ Webhook Instagram ----
    /** {link} = ลิงก์ไปการ์ด "ที่อยู่เว็บ" (ข้อความใน needBaseUrlLink) */
    needBaseUrl: "ใส่ {link} ก่อน แล้วระบบจะสร้าง Callback URL ให้",
    needBaseUrlLink: "ที่อยู่เว็บของระบบ",
    /** "Fields" / "Subscribe" คือคำในหน้า Meta */
    fieldsToSubscribe: "Fields ที่ต้อง Subscribe",
    fieldsIgViaPage: "Instagram (ผ่านเพจ)",
    verifiedAtLabel: "Meta ยืนยัน URL เมื่อ",
    notVerifiedYet: "ยังไม่ยืนยัน",
    neverReceived: "ยังไม่เคยได้รับ",

    // ---- การ์ด: Meta App ----
    /** {link} = ลิงก์ developers.facebook.com */
    metaAppDescription: "จาก {link} → แอปของคุณ → App settings → Basic",
    opensNewTab: "(เปิดแท็บใหม่)",

    // ---- การ์ด: Webhook ----
    webhookDescription: "ค่าที่ใส่ในเมนู Webhooks ของแอปใน Meta เพื่อให้ Meta ส่งคอมเมนต์และข้อความใหม่มาที่ระบบ",
    badSignatureTitle: "Meta ส่งข้อมูลมาแล้ว แต่ App Secret ไม่ตรงกัน",
    badSignatureAction: "ใส่ App Secret ใหม่",
    badSignatureBody:
      "ครั้งล่าสุด {time} — คัดลอกข้อมูลลับของแอปล่าสุดจาก Meta (การตั้งค่าแอป → ข้อมูลพื้นฐาน) มาวางในหัวข้อ Meta App ด้านบน (ถ้าเป็นข้อมูล Instagram ให้ตรวจ Instagram app secret ด้วย)",
    notVerifiedTitle: "Meta ยังไม่ได้ยืนยันลิงก์ของระบบ",
    notVerifiedBody: "คัดลอก 2 ค่าด้านล่างไปวางในหน้า Webhooks ของแอป แล้วกด Verify and save",
    lastWebhookLabel: "ได้รับ webhook ล่าสุด",

    // ---- การ์ด: App Review ----
    reviewLive: "เปิดใช้กับทุกคนแล้ว",
    reviewTestMode: "โหมดทดสอบ",
    reviewTitle: "สถานะ App Review",
    reviewDescription:
      "Meta ต้องตรวจแอป Facebook ก่อน เพจ Facebook จึงจะตอบลูกค้าทุกคนได้ (Instagram ที่เชื่อมผ่าน Instagram Login ไม่ต้องยื่น)",
    reviewDoneBody: "แอปผ่าน App Review และเปิด Live แล้ว เพจ Facebook ตอบได้ทุกคนที่คอมเมนต์หรือทักแชท",
    reviewPendingBody:
      "ตอนนี้เพจ Facebook ตอบได้เฉพาะบัญชีที่มีชื่ออยู่ในแอป (แอดมินและ Tester) ทำขั้นนี้หลังทดสอบผ่านแล้ว Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์ — Instagram ที่เชื่อมผ่าน Instagram Login ไม่ต้องยื่น",
    reviewHowTo: "ดูวิธียื่น App Review",
    reviewUnmarked: "ยกเลิกเครื่องหมายแล้ว",
    reviewMarked: "บันทึกแล้ว — เปิดใช้กับทุกคน",
    reviewUnmark: "ยกเลิกเครื่องหมายเสร็จ",
    reviewMark: "ผ่าน App Review และเปิด Live แล้ว",

    // ---- การ์ด: ที่อยู่เว็บ ----
    urlTitle: "ที่อยู่เว็บ",
    urlDescription: "ลิงก์ของระบบนี้ ใช้สร้าง Callback URL และลิงก์ติดตามการคลิก",
    urlFromHost: "ตั้งจากค่าใน Railway อัตโนมัติ (แก้ไขที่นั่น)",

    // ---- การ์ด: ลิมิตการส่ง ----
    limitsTitle: "ลิมิตการส่ง",
    limitsDescription: "ต่อบัญชี ตามที่ Meta กำหนด — ข้อความที่เกินจะรอคิวส่งเมื่อพ้นช่วง 1 ชั่วโมง ไม่หาย",
    limitsFooter: "ถ้า Meta แจ้งว่าส่งถี่เกิน ระบบจะพักแล้วส่งต่อเอง (ดูได้ในหน้ากิจกรรม) ไม่ต้องทำอะไร",
    limitPrivateReply: "DM ตอบคอมเมนต์",
    limitDm: "DM ทั่วไป",
    /** ต่อท้ายตัวเลข เช่น "720 /ชม." */
    perHour: "/ชม.",
    unlimited: "ไม่จำกัด",

    // ---- การ์ด: เปลี่ยนรหัสผ่าน ----
    passwordTitle: "เปลี่ยนรหัสผ่าน",
    passwordDescription: "รหัสผ่านที่ใช้เข้าหน้าจัดการนี้",

    // ---- ฟอร์ม Meta App / Instagram App / ที่อยู่เว็บ / รหัสผ่าน (forms.tsx) ----
    /** ป้ายข้างชื่อช่อง secret ที่บันทึกไว้แล้ว */
    savedMark: "บันทึกไว้แล้ว",
    fromRailwayTitle: "ตั้งค่าไว้ใน Railway แล้ว",
    metaFromEnvBody: "App ID / App Secret อยู่ใน Variables ของ Railway (แก้ไขที่นั่น)",
    metaAppSaved: "บันทึก Meta App แล้ว",
    appIdHint: "ตัวเลขล้วน อยู่บนสุดของหน้า App settings → Basic",
    appIdPlaceholder: "เช่น 1234567890123456",
    secretSavedHint: "ซ่อนไว้เพื่อความปลอดภัย — เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน",
    appSecretHint: "กด Show ข้างช่อง App secret ในหน้า Meta ก่อนคัดลอก",
    secret32Placeholder: "ตัวอักษรและตัวเลข 32 ตัว",
    igSecretSaved: "บันทึก Instagram app secret แล้ว",
    igFromEnvBody: "Instagram app secret อยู่ใน Variables ของ Railway (INSTAGRAM_APP_SECRET) — แก้ไขที่นั่น",
    igMetaSecretLabel: "App secret ของแอป Instagram (App settings → Basic)",
    /** คู่มือขั้นที่ 5 — "ข้อ 1" คือข้อย่อยในขั้นนั้น */
    igMetaSecretHintGuide: "แอป Instagram ที่สร้างในข้อ 1 → App settings → Basic → กด Show ที่ App secret ก่อนคัดลอก",
    igMetaSecretHint: "ใส่เมื่อสร้างแอปแยกสำหรับ Instagram — Meta อาจใช้ค่านี้ลงลายเซ็น webhook (ถ้าใช้แอป Facebook เดิม เว้นว่างได้)",
    igSecretHint: "กด Show ข้างช่อง Instagram app secret ก่อนคัดลอก",
    igSecretPlaceholder: "ตัวอักษรและตัวเลข",
    igSeparateAppSummary: "สร้างแอปแยกสำหรับ Instagram? (ทำตามคู่มือขั้นที่ 5)",
    baseUrlSaved: "บันทึกที่อยู่เว็บแล้ว",
    baseUrlLabel: "ที่อยู่เว็บ (URL) ของระบบ",
    baseUrlHint:
      "ลิงก์ที่ใช้เปิดหน้านี้ ดูได้จากแถบที่อยู่ของเบราว์เซอร์ หรือ Railway → กล่องแอป → Settings → Networking (Public domain)",
    baseUrlSave: "บันทึก URL",
    passwordChanged: "เปลี่ยนรหัสผ่านแล้ว",
    passwordFromEnvTitle: "รหัสผ่านตั้งไว้ใน Railway",
    passwordFromEnvBody: "รหัสผ่านถูกตั้งผ่าน ADMIN_PASSWORD ใน Variables ของ Railway — เปลี่ยนที่นั่นแทน",
    currentPassword: "รหัสผ่านปัจจุบัน",
    newPassword: "รหัสผ่านใหม่",
    newPasswordHint: "อย่างน้อย 8 ตัวอักษร",
    passwordChanging: "กำลังเปลี่ยน…",
    passwordSubmit: "เปลี่ยนรหัสผ่าน",

    // ---- ฟอร์มเชื่อมเพจ (connect-form.tsx) ----
    stepsAriaLabel: "ขั้นตอนการเชื่อมต่อเพจ",
    stepPasteToken: "วาง token",
    stepPickPages: "เลือกเพจ",
    connecting: "กำลังเชื่อมต่อ…",
    connectSelected: "เชื่อมต่อเพจที่เลือก",
    back: "ย้อนกลับ",
    connectPartialToast: "แต่บางเพจยังรับข้อความไม่ได้ ดูรายละเอียดในหน้า",
    pickLegend: "เลือกเพจที่ต้องการให้ระบบตอบอัตโนมัติ",
    /** {count} = จำนวนเพจที่พบ */
    pickFound: "พบ {count} เพจที่บัญชีนี้เป็นแอดมิน — เลือกได้หลายเพจ",
    pickIgViaPage: "(IG @{username} ผ่านเพจ)",
    alreadyConnected: "เชื่อมต่ออยู่แล้ว",
    connectDoneBody: "ระบบเริ่มตอบคอมเมนต์และข้อความของเพจที่เลือกแล้ว",
    tokenHintGuide: "ระบบจะแลกเป็น token ระยะยาวให้อัตโนมัติ และไม่เก็บ token นี้ไว้",
    /** {link} = ลิงก์ไปคู่มือ (ข้อความใน tokenHintLink) */
    tokenHint: "สร้างได้จาก Graph API Explorer ({link}) — ระบบจะแลกเป็น token ระยะยาวให้อัตโนมัติ และไม่เก็บ token นี้ไว้",
    tokenHintLink: "ดูวิธีในคู่มือ ขั้นที่ 4",
    checking: "กำลังตรวจสอบ…",
    fetchPages: "ดึงรายชื่อเพจ",

    // ---- ฟอร์มวาง token ของ Instagram (instagram-connect-form.tsx) ----
    igConnectPartialToast: "แต่ยังรับคอมเมนต์และข้อความไม่ได้ ดูรายละเอียดในหน้า",
    /** ต้องเป็นส่วนต้นของ libIgLinkedNotice (ใช้กรองข้อความนั้นออก เพราะแสดงเป็นข้อความสีเขียวแยกแล้ว) */
    igLinkedPrefix: "บัญชีนี้ผูกกับเพจ {page}",
    igNeedSecretTitle: "ใส่ Instagram app secret ก่อน",
    igNeedSecretAction: "ไปที่ช่อง app secret",
    igNeedSecretBody: "ระบบใช้ secret นี้ตรวจ token และรับข้อมูลจาก Instagram",
    igLinkedBody:
      "บัญชีนี้คือ Instagram ที่ผูกกับเพจ {page} — ต่อจากนี้ระบบจะตอบคอมเมนต์และ DM ของ Instagram ผ่าน Instagram Login ส่วนเพจ Facebook ทำงานเหมือนเดิม ไม่ต้องแก้อะไร",
    igConnectedBody: "ระบบเริ่มตอบคอมเมนต์และ DM ของบัญชีนี้แล้ว token จะต่ออายุให้อัตโนมัติ",
    igTokenLabel: "Access token ของ Instagram",
    igTokenHintGuide: "หน้า API setup with Instagram login → Generate token (ขึ้นต้นด้วย IG)",
    igTokenHint: "หน้า API setup with Instagram login → Generate token (ขึ้นต้นด้วย IG) — {link}",
    igTokenHintLink: "ดูวิธีในคู่มือ ขั้นที่ 5 ข้อ 7",
    igEnterSecret: "ใส่ app secret",
    igConnectSubmit: "เชื่อมต่อ Instagram",

    // ---- ปุ่มจัดการเพจ / บัญชี (page-actions.tsx, instagram-actions.tsx) ----
    trying: "กำลังลอง…",
    stillNotConnected: "ยังเชื่อมต่อไม่สำเร็จ",
    pageReady: "{page} พร้อมใช้งานแล้ว",
    accountReady: "@{username} พร้อมใช้งานแล้ว",
    renewing: "กำลังต่ออายุ…",
    renewed: "ต่ออายุ token แล้ว",
    renewFailed: "ยังต่ออายุไม่ได้",
    renewToken: "ต่ออายุ token",
    disconnect: "ยกเลิกการเชื่อมต่อ",
    disconnected: "ยกเลิกการเชื่อมต่อแล้ว",
    notNow: "ไม่ใช่ตอนนี้",
    pageDisconnectTitle: "ยกเลิกการเชื่อมต่อ {page}?",
    pageDisconnectBody: "ระบบจะหยุดตอบคอมเมนต์และข้อความของเพจนี้ทันที กฎ รายชื่อลูกค้า และสถิติเดิมยังอยู่ครบ เชื่อมต่อกลับได้ทุกเมื่อ",
    igDisconnectTitle: "ยกเลิกการเชื่อมต่อ @{username}?",
    igDisconnectBody:
      "ระบบจะหยุดใช้ Instagram Login กับบัญชีนี้ ถ้าเพจ Facebook ผูกบัญชีนี้ไว้ ระบบจะกลับไปใช้การเชื่อมผ่านเพจแทน กฎ รายชื่อลูกค้า และสถิติเดิมยังอยู่ครบ",

    // ---- รายการเพจ (pages-list.tsx) ----
    pageReconnectNeeded: "ต้องเชื่อมต่อใหม่",
    notSubscribed: "ยังไม่รับ webhook",
    pagesEmptyTitle: "ยังไม่มีเพจที่เชื่อมต่อ",
    pagesEmptyAction: "เชื่อมต่อเพจแรก",
    pagesEmptyBody: "เชื่อมเพจ Facebook เพื่อให้ระบบเริ่มตอบลูกค้าอัตโนมัติ",
    pageTokenProblem: "token ของเพจนี้ใช้ไม่ได้แล้ว — วาง token ใหม่ในฟอร์มเชื่อมต่อเพจ แล้วเลือกเพจนี้อีกครั้ง",
    usesIgLogin: "ใช้ Instagram Login",
    igViaPage: "Instagram @{username} (ผ่านเพจ)",
    /** {time} = วันเวลาที่เชื่อมต่อ */
    connectedAt: "เชื่อมต่อเมื่อ {time}",
    reconnect: "เชื่อมต่อใหม่",

    // ---- รายการบัญชี Instagram (instagram-list.tsx) ----
    igStatusInvalid: "ต้องเชื่อมต่อใหม่",
    igStatusExpired: "token หมดอายุ",
    igStatusRejected: "token ใช้ไม่ได้",
    igStatusUnsubscribed: "ยังไม่รับ webhook",
    igStatusExpiring: "token ใกล้หมดอายุ",
    igStatusWarning: "ต้องตรวจสอบ",
    igStatusOk: "พร้อมใช้งาน",
    igProblemInvalid:
      "token ของบัญชีนี้ใช้ไม่ได้แล้ว — กด Generate token ใหม่ในหน้า API setup with Instagram login แล้ววางในช่องด้านล่าง",
    /** {error} = สาเหตุที่ต่ออายุไม่สำเร็จ (libIgRefreshFailed) */
    igProblemRetry: "{error} — ระบบจะลองต่ออายุใหม่เองทุก 6 ชั่วโมง ตอนนี้ยังตอบลูกค้าได้ตามปกติ",
    igEmptyTitle: "ยังไม่ได้เชื่อมบัญชี Instagram",
    igEmptyAction: "ดูวิธีในคู่มือ ขั้นที่ 5",
    igEmptyBody: "ทำตามคู่มือขั้นที่ 5 แล้ววาง token ด้านล่าง",
    igLinkedBadgeTitle: "บัญชีเดียวกับที่ผูกกับเพจ — ระบบใช้ Instagram Login กับบัญชีนี้",
    igLinkedBadge: "ผูกกับเพจ {page} ด้วย",
    /** {date} = วันหมดอายุ (ตัวหนังสือเข้ม) */
    tokenExpiredAt: "token หมดอายุเมื่อ {date}",
    tokenWasDue: "token เดิมกำหนดหมดอายุ {date}",
    tokenValidUntil: "token ใช้ได้ถึง {date}",
    /** ต่อท้ายวันหมดอายุเมื่อ Meta ไม่ได้บอกวันจริง */
    estimated: "(โดยประมาณ)",
    autoRenew: "ต่ออายุให้อัตโนมัติ",
    lastCommentLabel: "รับคอมเมนต์ผ่าน Instagram Login ล่าสุด:",
    lastMessagingLabel: "รับ DM / การกดปุ่มล่าสุด:",
    never: "ยังไม่เคย",
    pasteNewToken: "วาง token ใหม่",

    // ---- ข้อผิดพลาดจาก Server Action (actions.ts) ----
    errPasteUserToken: "กรุณาวาง User Access Token",
    errNoPages: "ไม่พบเพจที่บัญชีนี้เป็นแอดมิน — ตอนสร้าง token ต้องติ๊กเลือกเพจด้วย",
    /** {detail} = ข้อความ error จาก Meta (ภาษาอังกฤษ) — lib/instagram/connect.ts ใช้ข้อความเดียวกัน */
    errConnectFailed: "เชื่อมต่อไม่สำเร็จ: {detail}",
    errPickOnePage: "เลือกอย่างน้อย 1 เพจ",
    pagesConnected: "เชื่อมต่อ {count} เพจเรียบร้อย",
    errSaveFailed: "บันทึกไม่สำเร็จ: {detail}",
    errPageTokenBroken: "{page}: token ใช้ไม่ได้ กรุณาเชื่อมต่อเพจใหม่",
    errPageSubscribeFailed: "{page}: subscribe webhook ไม่สำเร็จ ({detail})",
    errAppId: "App ID ต้องเป็นตัวเลขล้วน (คัดลอกจากหน้า App settings → Basic)",
    errAppSecret: "App Secret ไม่ถูกต้อง (ควรเป็นตัวอักษร a-f และตัวเลข 32 ตัว — กด Show ก่อนคัดลอก)",
    errBaseUrl: "ใส่ URL ให้ครบ เช่น https://dm-automation-production.up.railway.app",
    errPasswordFromEnv: "รหัสผ่านถูกตั้งผ่าน ADMIN_PASSWORD ใน Railway — เปลี่ยนที่นั่นแทน",
    errWrongPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    errPasswordShort: "รหัสผ่านใหม่ต้องยาวอย่างน้อย {min} ตัวอักษร",
    igConnected: "เชื่อมต่อ @{username} แล้ว",
    errIgSecretFromEnv: "ตั้งค่าไว้ใน Railway (INSTAGRAM_APP_SECRET) — แก้ที่นั่น",
    errIgSecretMissing: "วาง Instagram app secret จากหน้า API setup with Instagram login",
    errIgSecretFormat: "Instagram app secret ไม่ถูกต้อง (ควรเป็นตัวอักษรและตัวเลขติดกัน — กด Show ก่อนคัดลอก)",
    errIgMetaSecretFormat: "App secret ไม่ถูกต้อง (ควรเป็นตัวอักษรและตัวเลขติดกัน — กด Show ก่อนคัดลอก)",
    errIgSecretIsFacebook:
      "นี่คือ App Secret ของ Facebook (App settings → Basic) — ต้องใช้ Instagram app secret จากหน้า API setup with Instagram login",

    // ---- ข้อความจาก lib/instagram/* (error / ข้อความแจ้ง / lastError ที่เก็บในฐานข้อมูล) ----
    // ภาษาไทยต้องตรงกับต้นฉบับในไฟล์นั้นทุกตัวอักษร: ใช้เทียบหาข้อความ แล้วแสดงภาษาอังกฤษแทน (ดู settings/setup-errors.ts)
    libIgTokenInvalid: "token ใช้ไม่ได้หรือหมดอายุ — กด Generate token ใหม่แล้ววางอีกครั้ง",
    libIgTokenWrongKind: "token นี้ใช้กับ Instagram Login ไม่ได้ — ต้องสร้างจากหน้า API setup with Instagram login",
    libIgTokenMissing: "วาง access token ของ Instagram ก่อน",
    libIgTokenFacebook:
      "token นี้เป็นของ Facebook (ขึ้นต้นด้วย EAA) — ต้องกด Generate token ในหน้า API setup with Instagram login แล้วคัดลอก token ที่ขึ้นต้นด้วย IG",
    libIgSecretMissing: "ใส่ Instagram app secret ในหัวข้อ Instagram App ก่อน",
    libIgTokenNotIg: "token ไม่ได้ขึ้นต้นด้วย IG — ถ้าเชื่อมไม่สำเร็จ ให้สร้าง token ใหม่จากหน้า API setup with Instagram login",
    libIgSubscribeFailed: "subscribe webhook ไม่สำเร็จ ({detail})",
    libIgLinkedNotice: "บัญชีนี้ผูกกับเพจ {page} ด้วย — ระบบจะใช้ Instagram Login กับบัญชีนี้แทน",
    libIgIdMismatch:
      "ID ของ @{username} จาก Instagram Login ({id}) ไม่ตรงกับที่ผูกกับเพจ ({pageIgId}) — ระบบยังทำงานได้ แต่อาจตอบซ้ำ แจ้งผู้พัฒนา",
    libIgAccountNotFound: "ไม่พบบัญชี Instagram นี้ อาจถูกยกเลิกการเชื่อมต่อไปแล้ว",
    libIgTokenDecrypt: "token ถอดรหัสไม่ได้ — วาง token ใหม่",
    libIgTokenTooNew: "token เพิ่งสร้างไม่ถึง 24 ชั่วโมง ยังต่ออายุไม่ได้ (ระบบจะต่ออายุให้เองอัตโนมัติ)",
    libIgTokenRejected: "token ของ Instagram ใช้ไม่ได้ — ไปที่ ตั้งค่า → บัญชี Instagram แล้ววาง token ใหม่",
    libIgTokenExpired:
      "token Instagram หมดอายุหรือถูกยกเลิก — สร้าง token ใหม่ในหน้า API setup with Instagram login แล้ววางใน ตั้งค่า → บัญชี Instagram",
    libIgRefreshFailed: "ต่ออายุ token ไม่สำเร็จ: {detail}",
  },
  en: {
    // ---- page header ----
    headerDescription: "Your Facebook and Instagram connections, plus system settings",
    headerFirstTime: "Setting up for the first time? The {guide} walks you through it step by step.",

    // ---- section menu ----
    navAriaLabel: "Settings sections",
    navAttention: "(needs attention)",
    groupPages: "Pages",
    groupSystem: "System",
    navPassword: "Password",

    // ---- shared status badges ----
    statusReady: "Ready",
    statusAttention: "Needs attention",
    badgeSaved: "Saved",
    badgeIncomplete: "Not finished",
    badgeVerified: "Verified by Meta",
    badgeNotVerified: "Not verified",

    // ---- cards: connected Pages / connect a Page ----
    pagesTitle: "Connected Pages",
    pagesDescription: "Facebook Pages that get automatic replies",
    connectTitle: "Connect a Page",
    connectDescription: "Add a new Page, or reconnect one you already have (for example, when its token stops working)",

    // ---- card: Instagram accounts ----
    igTitle: "Instagram accounts",
    igNotConnected: "Not connected",
    igDescription: "Connected with Instagram Login, separate from your Facebook Pages — used to reply to Instagram comments and DMs",
    igLimitsNote:
      "No limit on messages or customers · Meta lets each account send about 750 private replies per hour (anything over that waits in line and goes out automatically — nothing is lost). Chat replies are almost unlimited.",
    igConnectTitleMore: "Paste a new token / add an account",
    igConnectTitleFirst: "Connect an Instagram account",
    igConnectHint:
      "You can paste a new token for an account you already have (for example, when its token stops working) — your automations and data stay as they are.",

    // ---- card: Instagram App ----
    igAppDescription:
      "The Instagram app secret from the API setup with Instagram login page, and the App secret from App settings → Basic of your separate Instagram app",

    // ---- card: Instagram webhook ----
    igWebhookTitle: "Instagram webhook",
    igWebhookDescription: "What to enter under Configure webhooks on the API setup with Instagram login page",
    igBadSignatureTitle: "Meta is sending Instagram data, but the signature doesn't match your saved secret",
    igBadSignatureAction: "Enter a new secret",
    igBadSignatureBody:
      "Last seen {time} — copy your latest Instagram app secret (and the App secret from App settings → Basic if you use a separate app) into the Instagram App section",
    igNotVerifiedTitle: "Meta hasn't verified your Instagram link yet",
    seeHow: "See how",
    igNotVerifiedBody: "Copy the 2 values below into Configure webhooks, then click Verify and save",
    igLastWebhookLabel: "Last webhook via Instagram Login",

    // ---- shared by both webhook cards ----
    needBaseUrl: "Enter your {link} first, and we'll create the Callback URL for you.",
    needBaseUrlLink: "web address",
    fieldsToSubscribe: "Fields to subscribe",
    fieldsIgViaPage: "Instagram (via Page)",
    verifiedAtLabel: "Meta verified the URL",
    notVerifiedYet: "Not yet",
    neverReceived: "None yet",

    // ---- card: Meta App ----
    metaAppDescription: "From {link} → your app → App settings → Basic",
    opensNewTab: "(opens in a new tab)",

    // ---- card: Webhook ----
    webhookDescription: "What to enter in your app's Webhooks menu on Meta, so Meta sends new comments and messages here",
    badSignatureTitle: "Meta is sending data, but the App Secret doesn't match",
    badSignatureAction: "Enter a new App Secret",
    badSignatureBody:
      "Last seen {time} — copy your app's latest App Secret from Meta (App settings → Basic) into the Meta App section above (for Instagram data, also check the Instagram app secret)",
    notVerifiedTitle: "Meta hasn't verified your link yet",
    notVerifiedBody: "Copy the 2 values below into your app's Webhooks page, then click Verify and save",
    lastWebhookLabel: "Last webhook received",

    // ---- card: App Review ----
    reviewLive: "Live for everyone",
    reviewTestMode: "Test mode",
    reviewTitle: "App Review status",
    reviewDescription:
      "Meta must review your Facebook app before your Facebook Page can reply to every customer (Instagram connected with Instagram Login doesn't need review)",
    reviewDoneBody: "Your app passed App Review and is Live. Your Facebook Page can reply to everyone who comments or messages you.",
    reviewPendingBody:
      "For now, your Facebook Page only replies to people listed in the app (admins and Testers). Do this step after testing works. Meta's review takes days to weeks — Instagram connected with Instagram Login doesn't need it.",
    reviewHowTo: "How to submit for App Review",
    reviewUnmarked: "Unmarked",
    reviewMarked: "Saved — live for everyone",
    reviewUnmark: "Unmark as done",
    reviewMark: "I passed App Review and went Live",

    // ---- card: web address ----
    urlTitle: "Web address",
    urlDescription: "The link to this app. Used to create the Callback URL and tracked links.",
    urlFromHost: "Set automatically from Railway (change it there)",

    // ---- card: sending limits ----
    limitsTitle: "Sending limits",
    limitsDescription: "Per account, as set by Meta — anything over the limit waits for the next hour. Nothing is lost.",
    limitsFooter: "If Meta says you're sending too fast, we pause and carry on by ourselves (see Activity). You don't need to do anything.",
    limitPrivateReply: "Private replies",
    limitDm: "Other DMs",
    perHour: "/hr",
    unlimited: "No limit",

    // ---- card: change password ----
    passwordTitle: "Change password",
    passwordDescription: "The password you use to log in to this dashboard",

    // ---- forms (forms.tsx) ----
    savedMark: "Saved",
    fromRailwayTitle: "Set in Railway",
    metaFromEnvBody: "Your App ID and App Secret are in Railway Variables (change them there)",
    metaAppSaved: "Meta App saved",
    appIdHint: "Numbers only, at the top of App settings → Basic",
    appIdPlaceholder: "e.g. 1234567890123456",
    secretSavedHint: "Hidden to keep it safe — leave blank to keep it",
    appSecretHint: "On Meta, click Show next to App secret before copying",
    secret32Placeholder: "32 letters and numbers",
    igSecretSaved: "Instagram app secret saved",
    igFromEnvBody: "Your Instagram app secret is in Railway Variables (INSTAGRAM_APP_SECRET) — change it there",
    igMetaSecretLabel: "Instagram app's App secret (App settings → Basic)",
    igMetaSecretHintGuide: "In the Instagram app you made in item 1 → App settings → Basic → click Show on App secret before copying",
    igMetaSecretHint:
      "Fill this in if you made a separate app for Instagram — Meta may sign webhooks with it (leave blank if you use your Facebook app)",
    igSecretHint: "Click Show next to Instagram app secret before copying",
    igSecretPlaceholder: "Letters and numbers",
    igSeparateAppSummary: "Made a separate app for Instagram? (Setup guide step 5)",
    baseUrlSaved: "Web address saved",
    baseUrlLabel: "Web address (URL) of this app",
    baseUrlHint:
      "The link you use to open this page. Find it in your browser's address bar, or in Railway → your app box → Settings → Networking (Public domain)",
    baseUrlSave: "Save URL",
    passwordChanged: "Password changed",
    passwordFromEnvTitle: "Password is set in Railway",
    passwordFromEnvBody: "Your password is set with ADMIN_PASSWORD in Railway Variables — change it there instead",
    currentPassword: "Current password",
    newPassword: "New password",
    newPasswordHint: "At least 8 characters",
    passwordChanging: "Changing…",
    passwordSubmit: "Change password",

    // ---- connect a Page form (connect-form.tsx) ----
    stepsAriaLabel: "Steps to connect a Page",
    stepPasteToken: "Paste token",
    stepPickPages: "Choose Pages",
    connecting: "Connecting…",
    connectSelected: "Connect selected Pages",
    back: "Back",
    connectPartialToast: "But some Pages can't get messages yet. See the details on this page.",
    pickLegend: "Choose the Pages to reply to automatically",
    pickFound: "Pages you manage: {count} — you can choose more than one",
    pickIgViaPage: "(IG @{username} via Page)",
    alreadyConnected: "Already connected",
    connectDoneBody: "Now replying to comments and messages on the Pages you chose.",
    tokenHintGuide: "We'll swap it for a long-lived token automatically and won't keep this one.",
    tokenHint: "Create one in Graph API Explorer ({link}) — we'll swap it for a long-lived token automatically and won't keep this one.",
    tokenHintLink: "see Setup guide step 4",
    checking: "Checking…",
    fetchPages: "Get my Pages",

    // ---- Instagram token form (instagram-connect-form.tsx) ----
    igConnectPartialToast: "But it can't get comments and messages yet. See the details on this page.",
    igLinkedPrefix: "This account is also linked to your Page {page}",
    igNeedSecretTitle: "Enter your Instagram app secret first",
    igNeedSecretAction: "Go to app secret",
    igNeedSecretBody: "We use this secret to check tokens and receive data from Instagram.",
    igLinkedBody:
      "This is the Instagram account linked to your Page {page}. From now on, Instagram comments and DMs are answered through Instagram Login. Your Facebook Page works as before — nothing to change.",
    igConnectedBody: "Now replying to comments and DMs for this account. The token renews automatically.",
    igTokenLabel: "Instagram access token",
    igTokenHintGuide: "API setup with Instagram login page → Generate token (starts with IG)",
    igTokenHint: "API setup with Instagram login page → Generate token (starts with IG) — {link}",
    igTokenHintLink: "see Setup guide step 5, item 7",
    igEnterSecret: "Enter app secret",
    igConnectSubmit: "Connect Instagram",

    // ---- Page / account buttons (page-actions.tsx, instagram-actions.tsx) ----
    trying: "Trying…",
    stillNotConnected: "Still not connected",
    pageReady: "{page} is ready",
    accountReady: "@{username} is ready",
    renewing: "Renewing…",
    renewed: "Token renewed",
    renewFailed: "Couldn't renew yet",
    renewToken: "Renew token",
    disconnect: "Disconnect",
    disconnected: "Disconnected",
    notNow: "Not now",
    pageDisconnectTitle: "Disconnect {page}?",
    pageDisconnectBody:
      "We'll stop replying to comments and messages on this Page right away. Your automations, contacts and stats stay as they are. You can reconnect any time.",
    igDisconnectTitle: "Disconnect @{username}?",
    igDisconnectBody:
      "We'll stop using Instagram Login for this account. If a Facebook Page is linked to it, we'll go back to connecting through the Page. Your automations, contacts and stats stay as they are.",

    // ---- Pages list (pages-list.tsx) ----
    pageReconnectNeeded: "Reconnect needed",
    notSubscribed: "Not getting webhooks",
    pagesEmptyTitle: "No Pages connected yet",
    pagesEmptyAction: "Connect your first Page",
    pagesEmptyBody: "Connect a Facebook Page to start replying to customers automatically.",
    pageTokenProblem: "This Page's token no longer works — paste a new token in the Connect a Page form, then choose this Page again.",
    usesIgLogin: "Uses Instagram Login",
    igViaPage: "Instagram @{username} (via Page)",
    connectedAt: "Connected {time}",
    reconnect: "Reconnect",

    // ---- Instagram accounts list (instagram-list.tsx) ----
    igStatusInvalid: "Reconnect needed",
    igStatusExpired: "Token expired",
    igStatusRejected: "Token not working",
    igStatusUnsubscribed: "Not getting webhooks",
    igStatusExpiring: "Token expires soon",
    igStatusWarning: "Needs attention",
    igStatusOk: "Ready",
    igProblemInvalid:
      "This account's token no longer works — click Generate token again on the API setup with Instagram login page, then paste it below.",
    igProblemRetry: "{error} — we'll try again every 6 hours. You can still reply to customers as usual.",
    igEmptyTitle: "No Instagram account connected yet",
    igEmptyAction: "See Setup guide step 5",
    igEmptyBody: "Follow Setup guide step 5, then paste the token below.",
    igLinkedBadgeTitle: "Same account as the one linked to your Page — we use Instagram Login for it",
    igLinkedBadge: "Also linked to Page {page}",
    tokenExpiredAt: "Token expired {date}",
    tokenWasDue: "Old token was due to expire {date}",
    tokenValidUntil: "Token valid until {date}",
    estimated: "(estimated)",
    autoRenew: "renews automatically",
    lastCommentLabel: "Last comment via Instagram Login:",
    lastMessagingLabel: "Last DM or button tap:",
    never: "Never",
    pasteNewToken: "Paste a new token",

    // ---- server action errors (actions.ts) ----
    errPasteUserToken: "Please paste your User Access Token.",
    errNoPages: "No Pages found where this account is an admin. When you create the token, tick your Pages too.",
    errConnectFailed: "Couldn't connect: {detail}",
    errPickOnePage: "Choose at least 1 Page.",
    pagesConnected: "Pages connected: {count}",
    errSaveFailed: "Couldn't save: {detail}",
    errPageTokenBroken: "{page}: the token doesn't work. Please reconnect this Page.",
    errPageSubscribeFailed: "{page}: couldn't subscribe to the webhook ({detail})",
    errAppId: "App ID must be numbers only (copy it from App settings → Basic).",
    errAppSecret: "That App Secret doesn't look right (it should be 32 letters a–f and numbers). Click Show before copying.",
    errBaseUrl: "Enter the full URL, e.g. https://dm-automation-production.up.railway.app",
    errPasswordFromEnv: "Your password is set with ADMIN_PASSWORD in Railway — change it there instead.",
    errWrongPassword: "Wrong current password. Try typing it again.",
    errPasswordShort: "Your new password needs at least {min} characters.",
    igConnected: "Connected @{username}",
    errIgSecretFromEnv: "This is set in Railway (INSTAGRAM_APP_SECRET) — change it there.",
    errIgSecretMissing: "Paste the Instagram app secret from the API setup with Instagram login page.",
    errIgSecretFormat:
      "That Instagram app secret doesn't look right (it should be letters and numbers with no spaces). Click Show before copying.",
    errIgMetaSecretFormat: "That App secret doesn't look right (it should be letters and numbers with no spaces). Click Show before copying.",
    errIgSecretIsFacebook:
      "This is your Facebook App Secret (App settings → Basic). Use the Instagram app secret from the API setup with Instagram login page instead.",

    // ---- messages from lib/instagram/* (shown in English instead of the Thai original) ----
    libIgTokenInvalid: "This token doesn't work or has expired — click Generate token again and paste the new one.",
    libIgTokenWrongKind: "This token can't be used with Instagram Login — create it on the API setup with Instagram login page.",
    libIgTokenMissing: "Paste your Instagram access token first.",
    libIgTokenFacebook:
      "This is a Facebook token (it starts with EAA). Click Generate token on the API setup with Instagram login page and copy the token that starts with IG.",
    libIgSecretMissing: "Enter your Instagram app secret in the Instagram App section first.",
    libIgTokenNotIg: "This token doesn't start with IG — if connecting fails, create a new token on the API setup with Instagram login page.",
    libIgSubscribeFailed: "Couldn't subscribe to the webhook ({detail})",
    libIgLinkedNotice: "This account is also linked to your Page {page} — we'll use Instagram Login for it instead.",
    libIgIdMismatch:
      "The ID of @{username} from Instagram Login ({id}) doesn't match the one linked to your Page ({pageIgId}). Things still work, but replies may be sent twice — please tell your developer.",
    libIgAccountNotFound: "Can't find this Instagram account. It may have been disconnected already.",
    libIgTokenDecrypt: "Can't read the saved token — paste a new token.",
    libIgTokenTooNew: "This token is less than 24 hours old, so it can't be renewed yet (we'll renew it automatically).",
    libIgTokenRejected: "Your Instagram token doesn't work — go to Settings → Instagram accounts and paste a new token.",
    libIgTokenExpired:
      "Your Instagram token expired or was revoked — create a new one on the API setup with Instagram login page and paste it in Settings → Instagram accounts.",
    libIgRefreshFailed: "Couldn't renew the token: {detail}",
  },
});
