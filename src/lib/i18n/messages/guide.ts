import { defineMessages } from "../core";

/**
 * คู่มือตั้งค่า (/guide) — src/app/(dashboard)/guide/*
 * - "ขั้นที่ N" = การ์ดขั้นหลัก (step N), "ข้อ N" / "ขั้นย่อยที่ N" = ขั้นย่อยในการ์ด (item N)
 * - ชื่อปุ่ม/เมนู/ช่องบนเว็บ Meta ที่เป็นภาษาอังกฤษอยู่แล้ว (Create App, App settings → Basic, Verify and save ฯลฯ)
 *   ไม่อยู่ในนี้ — โค้ดส่งเป็น {ตัวแปร} ตัวหนา (ไม่แปล เพราะต้องหาให้เจอบนเว็บ Meta)
 * - ชื่อเมนูที่ Meta / Instagram แสดงเป็นภาษาไทย (เช่น เผยแพร่, เปิดใช้งาน, รีเซ็ต) อยู่ในนี้ (meta*) —
 *   ภาษาอังกฤษใช้ชื่อตามที่ Meta / Instagram แสดงในภาษาอังกฤษ
 * - {note} = วงเล็บอธิบายเพิ่ม (สีจาง) ที่แปลแยกเป็นอีก key
 */
export const guideMessages = defineMessages({
  th: {
    // ---- หัวหน้า + กล่องความคืบหน้า ----
    description: "ทำตามทีละขั้นจากบนลงล่าง ระบบจะติ๊กถูกให้เองเมื่อแต่ละขั้นเสร็จ ขั้นที่เสร็จแล้วกดเปิดดูใหม่ได้",
    goToSettings: "ไปหน้าตั้งค่า",
    progressLabel: "ความคืบหน้าการตั้งค่า",
    progressDone: "เสร็จแล้ว {done} จาก {total} ขั้น",
    progressComplete: "ตั้งค่าครบแล้ว ระบบพร้อมตอบลูกค้าอัตโนมัติ",
    /** {count} = จำนวนขั้นที่เหลือ */
    progressRemaining: "อีก {count} ขั้นก็พร้อมใช้งาน",
    /** สำหรับโปรแกรมอ่านหน้าจอ (แถบความคืบหน้า) */
    progressBar: "ตั้งค่าเสร็จ {done} จาก {total} ขั้น",
    /** ปุ่มบนมือถือ — {step} = ชื่อสั้นของขั้น (short1–short8) */
    goToStep: "ไปขั้นที่ {n}: {step}",
    optional: "ไม่บังคับ",
    ifInstagram: "ถ้าใช้ Instagram",
    srDone: "(เสร็จแล้ว)",
    srCurrent: "(ขั้นต่อไป)",
    goToDashboard: "ไปหน้าภาพรวม",

    // ---- ชื่อสั้นของแต่ละขั้น (รายการด้านขวา กว้างประมาณ 190px) ----
    short1: "ระบบออนไลน์",
    short2: "สร้างแอปใน Meta",
    short3: "ตั้ง Webhook",
    short4: "เชื่อมต่อเพจ Facebook",
    short5: "เชื่อมต่อ Instagram",
    short6: "สร้างกฎแรก",
    short7: "ทดสอบ",
    short8: "ยื่น App Review",

    // ---- การ์ดของขั้น + ลิงก์ภายนอก (guide-parts.tsx) ----
    stepNumber: "ขั้นที่ {n}",
    stepDone: "เสร็จแล้ว",
    stepCurrent: "ขั้นต่อไป",
    stepWhenReady: "ทำเมื่อพร้อม",
    /** สำหรับโปรแกรมอ่านหน้าจอ ต่อท้ายลิงก์ไปเว็บอื่น */
    newTab: "(เปิดแท็บใหม่)",

    // ---- ใช้หลายขั้น ----
    /** ปุ่มโหลดสถานะใหม่ (refresh-button.tsx) */
    refresh: "ตรวจสอบอีกครั้ง",
    refreshDone: "อัปเดตสถานะล่าสุดแล้ว",
    /** รายการชื่อ permission ที่กดคัดลอกได้ (copy-chips.tsx) */
    copyAll: "คัดลอกทั้งหมด",
    copyChipsLabel: "กดเพื่อคัดลอกทีละรายการ",
    copiedAll: "คัดลอกทั้ง {count} รายการแล้ว",
    needStep1: "ทำขั้นที่ 1 ให้เสร็จก่อน",
    needStep1Links: "ทำขั้นที่ 1 ให้เสร็จก่อน ลิงก์จะขึ้นตรงนี้",
    needStep2: "ทำขั้นที่ 2 ให้เสร็จก่อน",
    /** หน้าเลือก use case ของ Meta — {other} / {business} = ชื่อตัวเลือกบนเว็บ Meta */
    useCaseFallback: "(ถ้าไม่เจอ เลือก {other} แล้วเลือกประเภท {business})",
    /** ชื่อเมนูที่ Meta แสดงเป็นภาษาไทย (ภาษาอังกฤษ = ชื่อที่ Meta แสดงในภาษาอังกฤษ) */
    metaLive: "เปิดใช้งาน",
    metaPublish: "เผยแพร่",
    metaModeSwitch: "โหมดแอพ: การพัฒนา / เปิดใช้งาน",
    metaReset: "รีเซ็ต",
    metaBasic: "การตั้งค่าแอป → ข้อมูลพื้นฐาน",
    metaAppSecret: "ข้อมูลลับของแอป",
    metaTest: "ทดสอบ",

    // ---- ขั้นที่ 1: ที่อยู่เว็บของระบบ ----
    s1TitleDone: "ระบบออนไลน์แล้ว",
    s1Title: "บอกระบบว่าเว็บนี้อยู่ที่ไหน",
    s1Summary: "ใส่ลิงก์ที่ใช้เปิดหน้านี้ ระบบจะใช้สร้างลิงก์ให้ Meta",
    s1Saved: "ระบบของคุณอยู่ที่ลิงก์นี้ เก็บไว้ใช้เข้าหน้าจัดการ (กดบุ๊กมาร์กไว้ก็ได้)",
    s1Missing: "ระบบยังไม่รู้ลิงก์ของตัวเอง ใส่ลิงก์ที่คุณใช้เปิดหน้านี้อยู่ (ดูจากแถบที่อยู่ของเบราว์เซอร์)",
    s1Form: "ที่อยู่เว็บของระบบ",

    // ---- ขั้นที่ 2: สร้างแอปใน Meta ----
    s2Title: "สร้างแอปใน Meta for Developers",
    s2SummaryDone: "บันทึก App ID {appId} แล้ว",
    s2Summary: "ขออนุญาต Meta ให้ระบบอ่านคอมเมนต์และตอบแทนเพจ — ฟรี ไม่ต้องเขียนโค้ด",
    s2Intro: 'Meta (Facebook) ต้องให้เราสร้าง "แอป" ก่อน เพื่อขออนุญาตอ่านคอมเมนต์และส่งข้อความแทนเพจ ฟรี ไม่ต้องเขียนโค้ด',
    /** {link} = ลิงก์ developers.facebook.com/apps */
    s2Open: "เปิด {link} แล้วล็อกอินด้วย Facebook ที่เป็นแอดมินเพจ {note}",
    s2OpenNote: "(ครั้งแรกจะให้ลงทะเบียนเป็นนักพัฒนา ทำตามขั้นตอนที่ขึ้นมา)",
    /** "ร้านของฉัน DM" = ตัวอย่างชื่อแอป */
    s2Create: 'กด {createApp} (สร้างแอป) → ตั้งชื่อ เช่น "ร้านของฉัน DM" → ใส่อีเมล',
    s2UseCase: "หน้าเลือก use case: เลือกตัวที่เกี่ยวกับ {messenger} และ {instagram} {note}",
    s2Portfolio: "ถ้าถามหา Business portfolio ให้เลือกของร้านคุณ (หรือสร้างใหม่) แล้วกดสร้างแอปจนเสร็จ",
    s2Basic: "เมนูซ้าย {basic}: คัดลอก {appId} และกด {show} ที่ช่อง {appSecret} แล้วคัดลอกมาใส่ในช่องด้านล่าง",
    s2Links: "ในหน้าเดียวกัน วางลิงก์ 2 อันนี้ในช่อง {privacy} และ {deletion} (เลือกแบบ Instructions URL) แล้วกด {save}",
    s2Form: "วาง App ID และ App Secret",
    s2FormHint: "คัดลอกมาจากหน้า App settings → Basic ในขั้นย่อยที่ 5",

    // ---- ขั้นที่ 3: Webhook ----
    s3Title: "ตั้ง Webhook",
    /** {date} = วันเวลาที่ Meta ยืนยัน (ใช้ทั้งบรรทัดสรุปและกล่องสีเขียว) */
    s3Verified: "Meta ยืนยันลิงก์ของระบบแล้วเมื่อ {date}",
    s3Summary: "ให้ Meta แจ้งระบบทันทีเมื่อมีคอมเมนต์หรือข้อความใหม่",
    s3Find: "ในหน้าแอปของคุณ เมนูซ้ายหา {webhooks} (ถ้าไม่มี กด {addProduct} แล้วเลือก Webhooks)",
    s3FindHint: "แอปแบบใหม่บางแอปจะมีช่องตั้ง webhook อยู่ในหน้าตั้งค่า Messenger / Instagram แทน ใส่ค่าเดียวกันได้เลย",
    s3Object: "ช่อง dropdown ด้านบนเลือก {page} → กด {subscribe}",
    s3Paste: "คัดลอก 2 ค่านี้ไปวาง แล้วกด {verify}",
    s3Fields: "ในรายการด้านล่างของหน้านั้น กดปุ่ม {subscribe} ทุกแถวต่อไปนี้",
    s3Instagram: "เปลี่ยน dropdown เป็น {instagram} → ทำแบบเดียวกัน (ใส่ Callback URL และ Verify token เดิม) แล้ว Subscribe แถว",
    s3InstagramHint: "Instagram Login ในขั้นที่ 5 ใช้ Callback URL แยกอีกอัน",
    s3Waiting: "เมื่อกด Verify and save สำเร็จ ขั้นนี้จะติ๊กถูกเอง",

    // ---- ขั้นที่ 4: เพจ Facebook ----
    s4Title: "เชื่อมต่อ Facebook Page",
    /** {pages} = ชื่อเพจ คั่นด้วยจุลภาค */
    s4Connected: "เชื่อมต่อแล้ว: {pages}",
    s4SummaryOptional: "ไม่บังคับ — ใช้ Instagram อย่างเดียวได้ (เชื่อมแล้วในขั้นที่ 5)",
    s4Summary: "ให้ระบบเข้าถึงเพจ Facebook ของร้าน",
    s4Explorer: "เปิดเครื่องมือของ Meta ชื่อ Graph API Explorer",
    s4ExplorerButton: "เปิด Graph API Explorer",
    s4App: "แถบด้านขวา ช่อง {metaApp} เลือกแอปที่สร้างในขั้นที่ 2 และช่อง {userOrPage} เลือก {userToken}",
    /** {count} = จำนวน permission */
    s4Permissions:
      "ช่อง {permissions} กด {addPermission} แล้วเพิ่มทุกตัวในรายการนี้ ({count} ตัว — พิมพ์ชื่อแล้วกดเลือกทีละตัว กดที่ชื่อด้านล่างเพื่อคัดลอก)",
    s4Generate: "กด {generate} → ล็อกอิน → {pickPage} {note} → กดอนุญาตจนเสร็จ",
    s4PickPage: "ติ๊กเลือกเพจ",
    s4PickPageNote: "(และบัญชี Instagram ถ้ามีให้เลือก)",
    s4CopyToken: "กดปุ่มคัดลอกที่ช่อง {accessToken} ด้านบนของหน้านั้น แล้วนำมาวางในช่องด้านล่าง",
    s4NeedMeta: "ต้องใส่ App ID / App Secret (ขั้นที่ 2) ก่อน",
    s4Form: "วาง token แล้วเลือกเพจ",
    s4ConnectedPages: "เพจที่เชื่อมต่อแล้ว",
    s4InstagramNote: "Instagram เชื่อมแยกในขั้นที่ 5 {note}",
    s4InstagramNoteDetail: "(ระบบจะตอบคอมเมนต์และ DM ของ Instagram ผ่าน Instagram Login)",

    // ---- ขั้นที่ 5: Instagram Login ----
    s5Title: "เชื่อมต่อ Instagram (Instagram Login)",
    s5Intro:
      "ทำครั้งเดียวจบ ใช้บัญชี Instagram เดียวกับที่ผูกกับเพจได้เลย — เชื่อมแล้วระบบจะตอบคอมเมนต์ DM และการกดปุ่มของ Instagram ผ่านช่องทางนี้ ส่วนเพจ Facebook ทำงานเหมือนเดิม และ token จะต่ออายุให้อัตโนมัติ",
    s5CheckTitle: "ก่อนเริ่ม ตรวจในแอป Instagram บนมือถือ (ล็อกอินบัญชีร้าน)",
    s5CheckAccount: "บัญชีเป็นแบบ {professional} (ธุรกิจหรือครีเอเตอร์) และเป็น {public}",
    s5Professional: "มืออาชีพ",
    s5Public: "บัญชีสาธารณะ",
    /** {path} = เมนูในแอป Instagram ทีละชั้น ลงท้ายด้วย " → " (INSTAGRAM_MESSAGE_ACCESS_MENU) */
    s5AllowMessages: "{path}เปิด {setting} {note}",
    /** ชื่อการตั้งค่าในแอป Instagram (ภาษาอังกฤษ = ชื่อในแอป Instagram ภาษาอังกฤษ) */
    s5AllowSetting: "อนุญาตการเข้าถึงข้อความ",
    s5MenuNote: "(ชื่อเมนูอาจต่างเล็กน้อย)",
    s5PartA: "ก. สร้างแอปสำหรับ Instagram",
    s5CreateApp: "เปิด {link} → กด {createApp} → เลือก use case {useCase} {note}",
    s5AppName: "ตั้งชื่อแอป {rule} → ถ้าถามหา business portfolio เลือก {noPortfolio} → กด {create}",
    s5AppNameRule: "ห้ามมีคำว่า Insta, Gram, Face, Book, Meta, IG, FB",
    s5AppHint: "ห้ามใช้ Create test app (แอปทดสอบเปิด Live ไม่ได้) · แอป Facebook เดิมไม่ต้องแก้อะไร",
    s5Basic:
      "ในแอปใหม่ เมนู {basic}: วาง 2 ลิงก์นี้ในช่อง {privacy} และ {deletion} → อัปโหลด {icon} {iconNote} → เลือก {category} → กด {save}",
    s5IconNote: "(รูปสี่เหลี่ยมจัตุรัส 1024×1024 เช่น โลโก้ร้าน)",
    s5UseCases:
      "เมนู {useCases} → การ์ด Instagram กด {customize} → เลือก {igLogin} {note} → หัวข้อ {addRequired} กด {addAll} รอจนขึ้นเครื่องหมายถูกครบ",
    s5UseCasesNote: "(ห้ามเลือก API setup with Facebook login)",
    /** "บันทึก" = ปุ่มบันทึกของฟอร์มด้านล่าง */
    s5Secrets: "วาง secret 2 ตัวของแอปนี้ในช่องด้านล่าง แล้วกด บันทึก (ระบบใช้ทั้งคู่ตรวจว่าข้อมูลมาจาก Meta จริง)",
    s5SecretFirst: "ช่องแรก: ในหน้า API setup with Instagram login หา {igSecret} → กด {show} → คัดลอก",
    s5SecretSecond: "ช่องที่สอง: เมนูซ้าย {basic} → ช่อง {appSecret} → กด {show} → คัดลอก {note}",
    s5SecretSecondNote: "(ของแอปที่สร้างในข้อ 1 ไม่ใช่ของแอป Facebook เดิม)",
    s5SecretsForm: "วาง secret ของแอป Instagram",
    s5PartB: "ข. ให้บัญชี Instagram ใช้แอปนี้ได้",
    /** {username} = " (@ชื่อบัญชีร้าน)" ถ้ารู้ชื่อบัญชี ไม่รู้ = ว่าง */
    s5Testers: "เมนู {roles} → {testers} → {addTesters} → พิมพ์ username บัญชีร้าน{username} → ส่งคำเชิญ {note}",
    s5TestersNote: "(หรือปุ่ม Add or remove Instagram testers ในหน้า API setup with Instagram login)",
    /** {link} = ลิงก์ instagram.com/accounts/manage_access */
    s5Accept: "{onComputer} เข้า instagram.com ด้วยบัญชีร้าน → เปิด {link} → แท็บ {invites} → กด {accept} {note}",
    s5AcceptOnComputer: "บนคอมพิวเตอร์",
    /** เมนูบนเว็บ instagram.com (ภาษาอังกฤษ = ชื่อเมนูภาษาอังกฤษของ Instagram) */
    s5AcceptNote: "(ถ้าลิงก์เปิดไม่ได้: การตั้งค่า → แอปและเว็บไซต์ → Tester invites)",
    s5AcceptHint: "แอปมือถืออาจไม่แสดงเมนูนี้ และหน้า Meta ไม่บอกว่ากดยอมรับแล้วหรือยัง — ห้ามข้ามข้อนี้",
    s5Token:
      "กลับไปหน้า API setup with Instagram login → หัวข้อ {generateTokens} → {addAccount} → ล็อกอิน Instagram ด้วย {shopAccount} (ไม่ใช่บัญชีส่วนตัว) → อนุญาตทั้งหมด → กด {generateToken} → ติ๊กช่องยืนยัน → คัดลอก token (ขึ้นต้นด้วย IG) มาวางด้านล่าง",
    s5TokenShop: "บัญชีร้าน",
    s5TokenForm: "วาง token ของ Instagram",
    s5TokenHint: "ถ้าขึ้น Insufficient Developer Role แปลว่ายังไม่ได้กด Accept ในข้อ 6",
    s5PartC: "ค. ให้ Meta ส่งคอมเมนต์และข้อความมาที่ระบบ",
    s5Webhook: "หัวข้อ {configureWebhooks} → กด {configure} → วาง 2 ค่านี้ → กด {verify}",
    s5CallbackLabel: "Callback URL (ของ Instagram)",
    s5WebhookHint: "ถ้าไม่ผ่าน แปลว่า URL หรือ Verify token ไม่ตรง ลองคัดลอกใหม่อีกครั้ง",
    s5Fields: "กด {manage} ตรวจว่าแถวต่อไปนี้เป็น {subscribed} ครบ {note}",
    s5FieldsNote: "(ถ้าถามเวอร์ชัน เลือก v23.0 หรือใหม่กว่า)",
    s5Skip: "ข้ามหัวข้อ {businessLogin} และ {appReview} {note}",
    s5SkipNote: "(ไม่ต้องใช้กับบัญชีของคุณเอง)",
    /** {publishMenu} / {publishButton} = metaPublish ตัวหนา */
    s5Publish: 'เผยแพร่แอป: เมนูซ้าย {publishMenu} (Publish — ตอนแรกขึ้นว่า "ไม่ได้เผยแพร่") → กดปุ่ม {publishButton} {note}',
    s5PublishNote:
      "(แอปหน้าตาแบบเก่าใช้สวิตช์ด้านบน เปลี่ยนเป็น {live}) — ถ้ากดไม่ได้ ตรวจข้อ 2 ว่ากรอกครบ (ลิงก์ 2 อัน, App icon, Category แล้วกด Save changes)",
    s5PublishLive: "เปิดใช้งาน (Live)",
    s5BadSigTitle: "Meta ส่งข้อมูล Instagram มาแล้ว แต่ลายเซ็นไม่ตรงกับ secret ที่บันทึกไว้",
    s5BadSig:
      "ครั้งล่าสุด {date} — คัดลอก Instagram app secret ล่าสุด (และ App secret จาก App settings → Basic ถ้าใช้แอปแยก) มาวางใหม่ในข้อ 4",
    s5WebhookOk: "Meta ยืนยันลิงก์ของ Instagram แล้ว",
    s5WebhookOkLast: "Meta ยืนยันลิงก์ของ Instagram แล้ว · ได้รับข้อมูลทาง Instagram Login ล่าสุด {date}",
    s5WebhookWaiting: "เมื่อกด Verify and save ในข้อ 8 สำเร็จ ตรงนี้จะขึ้นว่ายืนยันแล้ว",
    s5PartD: "ง. ทดสอบ (สำคัญ)",
    /** {activity} = ลิงก์ไปหน้ากิจกรรม */
    s5Test: "ใช้บัญชี Instagram อื่นที่ {noRole} (เช่น บัญชีของเพื่อน) ทำทีละข้อ แล้วดูหน้า {activity} หลังแต่ละข้อ",
    s5TestNoRole: "ไม่มีบทบาทในแอป",
    s5TestComment: "คอมเมนต์คำที่ตั้งไว้ใต้โพสต์ → ควรได้ตอบใต้คอมเมนต์และได้ DM {note}",
    /** "คำขอข้อความ" = กล่องข้อความในแอป Instagram */
    s5TestCommentNote: '(DM แรกอยู่ในกล่อง "คำขอข้อความ" ถ้ายังไม่ได้ติดตามร้าน)',
    s5TestReply: "ตอบ DM นั้นด้วยคำที่ตั้งไว้",
    s5TestButton: "กดปุ่มใน DM",
    s5TestHint: "ถ้าคอมเมนต์ได้ แต่ DM หรือการกดปุ่มไม่เข้า ให้แจ้งผู้พัฒนา",
    s5SameAppQuestion: "ใช้แอป Facebook เดิมแทนได้ไหม?",
    s5SameAppAnswer:
      'ได้ ถ้าแอปเดิมยังไม่มี Instagram ใน Use cases หรือเพิ่ม API setup with Instagram login ได้โดยไม่ต้องสลับของเดิม — ถ้า Meta ให้แค่ "สลับ" ห้ามสลับ ให้สร้างแอปใหม่ตามข้อ 1 (ถ้าใช้แอปเดิม ช่องที่สองในข้อ 4 ใส่ App Secret ตัวเดียวกับขั้นที่ 2)',

    // ---- สรุปของขั้นที่ 5 (instagram-step.ts) ----
    igIntro: "ให้ระบบตอบคอมเมนต์และ DM ของ Instagram โดยเชื่อมตรงกับ Instagram แยกจาก Facebook",
    igPendingWebhook: "เชื่อม @{username} แล้ว — เหลือข้อ 8 ตั้ง Webhook ของ Instagram และข้อ 11 เผยแพร่แอป",
    /** {accounts} = igAccountValid ของแต่ละบัญชี คั่นด้วยจุลภาค */
    igConnected: "เชื่อมแล้ว: {accounts}",
    /** {expiry} = วันเวลาหมดอายุ (หรือ igExpiryEstimated) */
    igAccountValid: "@{username} (token ใช้ได้ถึง {expiry})",
    igExpiryEstimated: "{date} (โดยประมาณ)",
    igTokenExpired: "token ของ @{username} หมดอายุเมื่อ {expiry} — วาง token ใหม่ในข้อ 7",
    igTokenInvalid: "token ของ @{username} ใช้ไม่ได้แล้ว — วาง token ใหม่ในข้อ 7",
    /** {retry} = ชื่อปุ่ม "ลองใหม่" ในรายการบัญชี */
    igNotSubscribed: 'เชื่อม @{username} แล้ว แต่ยังไม่รับ webhook — กด "{retry}" ในรายการบัญชีที่ข้อ 7',

    // ---- ขั้นที่ 6: กฎแรก ----
    s6Title: "สร้างกฎอัตโนมัติอันแรก",
    s6SummaryDone: "มีกฎแล้ว {count} กฎ",
    s6Summary: "บอกระบบว่าเจอคำไหน ให้ตอบอะไร",
    s6Intro: 'กำหนดว่าถ้าเจอคำไหน ให้ระบบตอบอะไร เช่น ใครคอมเมนต์ "สนใจ" → ตอบใต้คอมเมนต์ + ส่งลิงก์สินค้าทาง DM',
    s6SeeAll: "ดูกฎทั้งหมด",

    // ---- ขั้นที่ 7: ทดสอบ ----
    s7Title: "ทดสอบ",
    s7SummaryDone: "ได้รับข้อมูลจาก Meta แล้ว (ล่าสุด {date})",
    s7Summary: "ลองคอมเมนต์หรือทักแชทเพจด้วยบัญชีของคุณ",
    s7LiveTitle: "ก่อนทดสอบ: เปลี่ยนแอปเป็นโหมด “เปิดใช้งาน” (Live)",
    /** {modeSwitch} = metaModeSwitch, {live} = metaLive, {note} = s7LiveNote, {note2} = s7LiveBoth */
    s7Live:
      "หน้าแอปใน Meta ด้านบนมีสวิตช์ {modeSwitch} ให้กดเป็น {live} — ช่วงที่ยังเป็นโหมดการพัฒนา Meta จะไม่ส่งคอมเมนต์และข้อความจริงมาให้ระบบเลย แม้คนคอมเมนต์จะเป็นแอดมินก็ตาม {note} {note2}",
    s7LiveNote:
      "(ไม่ต้องกังวล: ก่อนผ่าน App Review เพจ Facebook ยังตอบได้เฉพาะบัญชีที่มีชื่อในแอป เช่น บัญชีของคุณเองที่เป็นผู้ดูแล — Instagram ที่เชื่อมผ่าน Instagram Login ในขั้นที่ 5 ไม่ต้องรอ App Review)",
    s7LiveBoth: "(ถ้าสร้างแอป Instagram แยก ต้องเปิด Live ทั้ง 2 แอป)",
    s7Tester: "อยากให้เพื่อนช่วยทดสอบ: ในหน้าแอป เมนู {roles} → เพิ่มเพื่อนเป็น {tester} {note}",
    s7TesterNote: "(เพื่อนต้องกดยอมรับคำเชิญ)",
    s7Comment: "ใช้บัญชีนั้นคอมเมนต์คำที่ตั้งไว้ใต้โพสต์ของเพจ หรือทักแชทเพจ",
    s7Check: "รอไม่กี่วินาที แล้วดูที่หน้า {activity} ควรเห็นรายการใหม่ และบัญชีนั้นควรได้รับ DM",
    s7BadSigTitle: "Meta ส่งข้อมูลมาแล้ว แต่ App Secret ในระบบไม่ตรงกับใน Meta",
    /** {reset} / {basic} / {secret} = ชื่อปุ่ม/เมนูบนเว็บ Meta (metaReset / metaBasic / metaAppSecret), {settingsLink} = ลิงก์ s7SettingsMetaApp */
    s7BadSig:
      "ระบบเลยไม่รับข้อมูล (ครั้งล่าสุด {date}) — มักเกิดจากกด {reset} App Secret ใน Meta หลังบันทึกในระบบ วิธีแก้: หน้าแอปใน Meta → {basic} → คัดลอก {secret} ล่าสุด แล้ววางใหม่ใน {settingsLink} จากนั้นลองคอมเมนต์อีกครั้ง",
    s7SettingsMetaApp: "ตั้งค่า → Meta App",
    s7Ok: "ระบบได้รับข้อมูลจาก Meta แล้ว (ล่าสุด {date})",
    s7NoDataTitle: "ยังไม่เคยได้รับข้อมูลจาก Meta",
    s7NoDataLive: "โหมดแอปใน Meta ต้องเป็น {live} (Live) แล้วคอมเมนต์ด้วยบัญชีส่วนตัวที่เป็นผู้ดูแลแอป ไม่ใช่คอมเมนต์ในนามเพจ",
    /** {refresh} = ชื่อปุ่ม refresh ของหน้านี้ */
    s7NoDataTest:
      'ลองเช็กการเชื่อมต่อ: หน้า Webhooks ใน Meta เลือก {page} → กด {test} ที่แถว {feed} แล้วกด "{refresh}" ที่นี่ ถ้าขึ้นว่าได้รับแล้ว แปลว่าการเชื่อมต่อใช้ได้',
    s7NoDataSubscribe: "ตรวจขั้นที่ 3 ว่าเปิดสวิตช์ (Subscribe) ครบทุกแถว",
    /** "รับคอมเมนต์/DM ล่าสุด" = บรรทัดในรายการบัญชี Instagram ของหน้าตั้งค่า */
    s7NoDataInstagram: 'Instagram: ดู {link} ว่า "รับคอมเมนต์/DM ล่าสุด" ขึ้นเวลาหรือยัง',
    s7SettingsInstagram: "ตั้งค่า → บัญชี Instagram",

    // ---- ขั้นที่ 8: App Review ----
    s8Title: "เปิดใช้งานกับลูกค้าทุกคน (ยื่น App Review)",
    s8SummaryDone: "ผ่าน App Review และเปิด Live แล้ว",
    s8Summary: "ทำหลังทดสอบผ่าน — Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์",
    s8Intro:
      "ทำหลังจากทดสอบผ่านแล้ว Meta จะตรวจแอปก่อนอนุญาตให้ตอบลูกค้าทั่วไป ใช้เวลาหลายวันถึงหลายสัปดาห์ ระหว่างรอยังใช้กับบัญชีทดสอบได้ตามปกติ",
    s8FacebookOnly: "ขั้นนี้สำหรับแอป Facebook เท่านั้น — Instagram Login (ขั้นที่ 5) ไม่ต้องยื่น",
    /** {link} = ลิงก์ Business settings */
    s8Verify: "{verify}: ใน {link} → Business info → Start verification {note}",
    s8VerifyLabel: "ยืนยันธุรกิจ",
    s8VerifyNote: "(ใช้เอกสารที่มีชื่อร้าน/บริษัท)",
    s8Access: "ในหน้าแอป เมนู {menu} → กด {request} ให้ทุก permission ในขั้นที่ 4",
    s8Video: "อัดวิดีโอหน้าจอสั้นๆ: คอมเมนต์ใต้โพสต์ → ได้รับ DM → เปิดหน้าภาพรวมของระบบนี้ให้เห็น แล้วแนบในคำขอ",
    s8Describe: "ใส่คำอธิบายของแต่ละ permission (คัดลอกตัวอย่างด้านล่างได้เลย) แล้วกดส่ง",
    s8Examples: "ตัวอย่างคำอธิบายแต่ละ permission (ภาษาอังกฤษ)",
    s8ExamplesCount: "{count} รายการ",
    s8Live: "เมื่อผ่านแล้ว ตรวจว่าแอปเป็นโหมด {live} (Live) อยู่ (สวิตช์ด้านบนของหน้าแอป) — ระบบจะตอบลูกค้าทุกคนได้ทันที",
    s8MarkDone: "ผ่าน App Review และเปิด Live แล้ว",
    s8MarkUndo: "ยกเลิกเครื่องหมายเสร็จ",
    s8MarkedDone: "เยี่ยม! บันทึกว่าเปิด Live แล้ว",
    s8MarkedUndo: "ยกเลิกเครื่องหมายแล้ว",
    s8MarkHint: "กดเมื่อ Meta อนุมัติและคุณเปิด Live แล้ว ขั้นนี้จะติ๊กถูก",
  },
  en: {
    // ---- header + progress box ----
    description: "Work from top to bottom, one step at a time. Each step ticks itself off when it's done, and you can reopen finished steps.",
    goToSettings: "Go to Settings",
    progressLabel: "Setup progress",
    progressDone: "{done} of {total} steps done",
    progressComplete: "All set! The system is ready to reply to customers for you.",
    progressRemaining: "{count} to go, then you're ready",
    progressBar: "Setup: {done} of {total} steps done",
    goToStep: "Go to step {n}: {step}",
    optional: "Optional",
    ifInstagram: "If you use Instagram",
    srDone: "(done)",
    srCurrent: "(next step)",
    goToDashboard: "Go to Dashboard",

    // ---- short step names ----
    short1: "Get online",
    short2: "Create a Meta app",
    short3: "Set up the webhook",
    short4: "Connect Facebook Page",
    short5: "Connect Instagram",
    short6: "Your first automation",
    short7: "Test it",
    short8: "Submit for App Review",

    // ---- step card + external links ----
    stepNumber: "Step {n}",
    stepDone: "Done",
    stepCurrent: "Next step",
    stepWhenReady: "When you're ready",
    newTab: "(opens in a new tab)",

    // ---- shared ----
    refresh: "Check again",
    refreshDone: "Status updated",
    copyAll: "Copy all",
    copyChipsLabel: "Tap to copy one at a time",
    copiedAll: "Copied all {count}",
    needStep1: "Finish step 1 first.",
    needStep1Links: "Finish step 1 first. The links will show up here.",
    needStep2: "Finish step 2 first.",
    useCaseFallback: "(Not there? Pick {other}, then pick the {business} type.)",
    metaLive: "Live",
    metaPublish: "Publish",
    metaModeSwitch: "App Mode: Development / Live",
    metaReset: "Reset",
    metaBasic: "App settings → Basic",
    metaAppSecret: "App secret",
    metaTest: "Test",

    // ---- step 1 ----
    s1TitleDone: "Your system is online",
    s1Title: "Tell the system where it lives",
    s1Summary: "Enter the link you use to open this page. The system uses it to make links for Meta.",
    s1Saved: "Your system lives at this link. Keep it to open your admin pages (bookmarking it is a good idea).",
    s1Missing: "The system doesn't know its own link yet. Enter the link you're using to open this page (look at your browser's address bar).",
    s1Form: "System web address",

    // ---- step 2 ----
    s2Title: "Create an app in Meta for Developers",
    s2SummaryDone: "App ID {appId} saved",
    s2Summary: "Get Meta's permission for the system to read comments and reply for your Page. Free, no coding.",
    s2Intro:
      'Meta (Facebook) asks you to create an "app" first. The app gets permission to read comments and send messages for your Page. It\'s free and needs no coding.',
    s2Open: "Open {link} and log in with the Facebook account that's an admin of your Page. {note}",
    s2OpenNote: "(The first time, Meta asks you to register as a developer. Just follow the steps it shows.)",
    s2Create: 'Click {createApp} → give it a name, like "My Shop DM" → enter your email',
    s2UseCase: "On the use case page, pick the ones for {messenger} and {instagram} {note}",
    s2Portfolio: "If it asks for a Business portfolio, pick your shop's (or create one), then finish creating the app",
    s2Basic: "In the left menu, open {basic}: copy the {appId}, click {show} next to {appSecret}, and copy both into the boxes below",
    s2Links: "On the same page, paste these 2 links into {privacy} and {deletion} (choose Instructions URL), then click {save}",
    s2Form: "Paste your App ID and App Secret",
    s2FormHint: "Copy them from App settings → Basic (item 5 above)",

    // ---- step 3 ----
    s3Title: "Set up the webhook",
    s3Verified: "Meta confirmed your system's link on {date}",
    s3Summary: "Have Meta tell the system right away about new comments and messages",
    s3Find: "In your app, find {webhooks} in the left menu (not there? Click {addProduct} and pick Webhooks)",
    s3FindHint: "Some newer apps put the webhook settings on the Messenger / Instagram setup page instead. Enter the same values there.",
    s3Object: "In the dropdown at the top, pick {page} → click {subscribe}",
    s3Paste: "Copy these 2 values into Meta, then click {verify}",
    s3Fields: "Further down that page, click {subscribe} on each of these rows",
    s3Instagram: "Switch the dropdown to {instagram} → do the same (same Callback URL and Verify token), then subscribe to these rows",
    s3InstagramHint: "Instagram Login in step 5 uses a different Callback URL.",
    s3Waiting: "Once Verify and save works, this step checks itself off.",

    // ---- step 4 ----
    s4Title: "Connect your Facebook Page",
    s4Connected: "Connected: {pages}",
    s4SummaryOptional: "Optional. You can use Instagram only (connected in step 5).",
    s4Summary: "Let the system access your shop's Facebook Page",
    s4Explorer: "Open Meta's tool called Graph API Explorer",
    s4ExplorerButton: "Open Graph API Explorer",
    s4App: "In the right panel, set {metaApp} to the app from step 2, and {userOrPage} to {userToken}",
    s4Permissions:
      "Under {permissions}, click {addPermission} and add everything on this list ({count} in all. Type each name and pick it, one at a time. Tap a name below to copy it.)",
    s4Generate: "Click {generate} → log in → {pickPage} {note} → keep allowing until it's done",
    s4PickPage: "tick your Page",
    s4PickPageNote: "(and your Instagram account, if it's listed)",
    s4CopyToken: "Click the copy button in the {accessToken} box at the top of that page, then paste it below",
    s4NeedMeta: "Enter your App ID / App Secret (step 2) first.",
    s4Form: "Paste the token, then pick your Page",
    s4ConnectedPages: "Connected Pages",
    s4InstagramNote: "Instagram is connected separately in step 5 {note}",
    s4InstagramNoteDetail: "(the system answers Instagram comments and DMs through Instagram Login)",

    // ---- step 5 ----
    s5Title: "Connect Instagram (Instagram Login)",
    s5Intro:
      "You only do this once, and you can use the same Instagram account that's linked to your Page. Once connected, the system handles Instagram comments, DMs and button taps this way. Your Facebook Page keeps working as before, and the token renews itself.",
    s5CheckTitle: "Before you start, check the Instagram app on your phone (logged in as your shop)",
    s5CheckAccount: "The account is a {professional} (business or creator) and is {public}",
    s5Professional: "professional account",
    s5Public: "public",
    s5AllowMessages: "{path}turn on {setting} {note}",
    s5AllowSetting: "Allow access to messages",
    s5MenuNote: "(menu names may differ a little)",
    s5PartA: "A. Create an app for Instagram",
    s5CreateApp: "Open {link} → click {createApp} → pick the use case {useCase} {note}",
    s5AppName: "Name the app ({rule}) → if it asks for a business portfolio, pick {noPortfolio} → click {create}",
    s5AppNameRule: "no Insta, Gram, Face, Book, Meta, IG or FB in the name",
    s5AppHint: "Don't use Create test app (test apps can't go Live) · Leave your existing Facebook app as it is",
    s5Basic:
      "In the new app, open {basic}: paste these 2 links into {privacy} and {deletion} → upload an {icon} {iconNote} → pick a {category} → click {save}",
    s5IconNote: "(a 1024×1024 square image, like your shop logo)",
    s5UseCases:
      "Open {useCases} → on the Instagram card, click {customize} → pick {igLogin} {note} → under {addRequired}, click {addAll} and wait until every item has a check mark",
    s5UseCasesNote: "(not API setup with Facebook login)",
    s5Secrets: "Paste this app's 2 secrets below, then click Save (the system uses both to check that data really comes from Meta)",
    s5SecretFirst: "First box: on the API setup with Instagram login page, find {igSecret} → click {show} → copy it",
    s5SecretSecond: "Second box: in the left menu, open {basic} → {appSecret} → click {show} → copy it {note}",
    s5SecretSecondNote: "(from the app you made in item 1, not your old Facebook app)",
    s5SecretsForm: "Paste your Instagram app's secrets",
    s5PartB: "B. Let your Instagram account use this app",
    s5Testers: "Open {roles} → {testers} → {addTesters} → type your shop's username{username} → send the invite {note}",
    s5TestersNote: "(or use the Add or remove Instagram testers button on the API setup with Instagram login page)",
    s5Accept: "{onComputer}, go to instagram.com as your shop → open {link} → {invites} tab → click {accept} {note}",
    s5AcceptOnComputer: "On a computer",
    s5AcceptNote: "(If the link doesn't open: Settings → Apps and websites → Tester invites)",
    s5AcceptHint: "The phone app may not show this menu, and Meta doesn't show whether you've accepted. Don't skip this item.",
    s5Token:
      "Go back to API setup with Instagram login → under {generateTokens}, click {addAccount} → log in to Instagram with {shopAccount} (not your personal one) → allow everything → click {generateToken} → tick the confirm box → copy the token (it starts with IG) and paste it below",
    s5TokenShop: "your shop account",
    s5TokenForm: "Paste your Instagram token",
    s5TokenHint: "If you see Insufficient Developer Role, you haven't clicked Accept in item 6 yet.",
    s5PartC: "C. Have Meta send comments and messages to the system",
    s5Webhook: "Under {configureWebhooks}, click {configure} → paste these 2 values → click {verify}",
    s5CallbackLabel: "Callback URL (for Instagram)",
    s5WebhookHint: "If it fails, the URL or Verify token doesn't match. Try copying them again.",
    s5Fields: "Click {manage} and check that all these rows are {subscribed} {note}",
    s5FieldsNote: "(if it asks for a version, pick v23.0 or newer)",
    s5Skip: "Skip {businessLogin} and {appReview} {note}",
    s5SkipNote: "(you don't need them for your own account)",
    s5Publish: 'Publish the app: in the left menu, open {publishMenu} (at first it says "Unpublished") → click the {publishButton} button {note}',
    s5PublishNote:
      "(Apps with the older look use the switch at the top: set it to {live}.) If you can't click it, check that item 2 is complete (2 links, App icon, Category, then Save changes).",
    s5PublishLive: "Live",
    s5BadSigTitle: "Meta sent Instagram data, but the signature doesn't match your saved secret",
    s5BadSig:
      "Last seen {date}. Copy your latest Instagram app secret (and the App secret from App settings → Basic, if you use a separate app) and paste them again in item 4.",
    s5WebhookOk: "Meta confirmed your Instagram link",
    s5WebhookOkLast: "Meta confirmed your Instagram link · Last data via Instagram Login: {date}",
    s5WebhookWaiting: "Once Verify and save in item 8 works, this will show as confirmed.",
    s5PartD: "D. Test it (important)",
    s5Test: "Use another Instagram account that {noRole} (like a friend's). Do these one at a time and check the {activity} page after each one",
    s5TestNoRole: "has no role in the app",
    s5TestComment: "Comment your keyword under a post → you should get a public reply and a DM {note}",
    s5TestCommentNote: "(the first DM lands in \"Message requests\" if the account doesn't follow your shop)",
    s5TestReply: "Reply to that DM with your keyword",
    s5TestButton: "Tap the button in the DM",
    s5TestHint: "If comments work but DMs or button taps don't come in, let your developer know.",
    s5SameAppQuestion: "Can I use my existing Facebook app instead?",
    s5SameAppAnswer:
      'Yes, if that app doesn\'t have Instagram in Use cases yet, or if you can add API setup with Instagram login without switching out what\'s there. If Meta only lets you "switch", don\'t. Create a new app as in item 1 instead. (If you use the existing app, the second box in item 4 takes the same App Secret as step 2.)',

    // ---- step 5 summary (instagram-step.ts) ----
    igIntro: "Let the system reply to Instagram comments and DMs by connecting straight to Instagram, separate from Facebook",
    igPendingWebhook: "Connected @{username}. Still to do: item 8 (Instagram webhook) and item 11 (publish the app)",
    igConnected: "Connected: {accounts}",
    igAccountValid: "@{username} (token valid until {expiry})",
    igExpiryEstimated: "{date} (estimated)",
    igTokenExpired: "The token for @{username} expired on {expiry}. Paste a new token in item 7.",
    igTokenInvalid: "The token for @{username} no longer works. Paste a new token in item 7.",
    igNotSubscribed: 'Connected @{username}, but it isn\'t receiving webhooks yet. Click "{retry}" in the account list in item 7.',

    // ---- step 6 ----
    s6Title: "Create your first automation",
    s6SummaryDone: "Automations so far: {count}",
    s6Summary: "Tell the system which words to watch for and what to reply",
    s6Intro:
      'Choose which words to watch for and how the system replies. For example, someone comments "interested" → reply under the comment + send a product link by DM',
    s6SeeAll: "See all automations",

    // ---- step 7 ----
    s7Title: "Test it",
    s7SummaryDone: "Data is coming in from Meta (last: {date})",
    s7Summary: "Try commenting on or messaging your Page from your own account",
    s7LiveTitle: "Before you test: switch your app to Live mode",
    s7Live:
      "At the top of your app page in Meta there's an {modeSwitch} switch. Set it to {live}. While the app is in Development mode, Meta doesn't send any real comments or messages to the system, even from admins. {note} {note2}",
    s7LiveNote:
      "(Don't worry: until you pass App Review, your Facebook Page only replies to accounts listed in the app, like your own admin account. Instagram connected through Instagram Login in step 5 doesn't need to wait for App Review.)",
    s7LiveBoth: "(If you made a separate Instagram app, switch both apps to Live.)",
    s7Tester: "Want a friend to help test? In your app, open {roles} → add them as a {tester} {note}",
    s7TesterNote: "(they need to accept the invite)",
    s7Comment: "From that account, comment your keyword under a Page post, or message the Page",
    s7Check: "Wait a few seconds, then check the {activity} page. You should see a new entry, and that account should get a DM.",
    s7BadSigTitle: "Meta sent data, but the App Secret here doesn't match the one in Meta",
    s7BadSig:
      "So the system ignored it (last seen {date}). This usually happens when you click {reset} on the App Secret in Meta after saving it here. To fix it: in your Meta app, open {basic} → copy the latest {secret}, paste it again in {settingsLink}, then try commenting again.",
    s7SettingsMetaApp: "Settings → Meta App",
    s7Ok: "The system is getting data from Meta (last: {date})",
    s7NoDataTitle: "No data from Meta yet",
    s7NoDataLive: "Your app in Meta must be in {live} mode. Then comment from your personal account that's an app admin, not as the Page.",
    s7NoDataTest:
      'Check the connection: on the Webhooks page in Meta, pick {page} → click {test} on the {feed} row, then click "{refresh}" here. If it shows data came in, the connection works.',
    s7NoDataSubscribe: "In step 3, check that every row is switched on (Subscribe).",
    s7NoDataInstagram: 'Instagram: in {link}, check whether "Last comment" or "Last DM" shows a time',
    s7SettingsInstagram: "Settings → Instagram accounts",

    // ---- step 8 ----
    s8Title: "Go live for every customer (App Review)",
    s8SummaryDone: "App Review passed and your app is Live",
    s8Summary: "Do this after testing works. Meta's review takes days to weeks.",
    s8Intro:
      "Do this after your test works. Meta reviews the app before it can reply to all customers, which takes days to weeks. While you wait, test accounts keep working as usual.",
    s8FacebookOnly: "This step is for the Facebook app only. Instagram Login (step 5) doesn't need it.",
    s8Verify: "{verify}: in {link} → Business info → Start verification {note}",
    s8VerifyLabel: "Verify your business",
    s8VerifyNote: "(use a document with your shop or company name)",
    s8Access: "In your app, open {menu} → click {request} for every permission from step 4",
    s8Video: "Record a short screen video: comment under a post → get the DM → show this system's Dashboard. Attach it to your request.",
    s8Describe: "Describe each permission (feel free to copy the examples below), then submit",
    s8Examples: "Example descriptions for each permission",
    s8ExamplesCount: "{count} in total",
    s8Live: "Once approved, check that your app is in {live} mode (the switch at the top of the app page). The system can then reply to every customer right away.",
    s8MarkDone: "I passed App Review and went Live",
    s8MarkUndo: "Mark as not done",
    s8MarkedDone: "Great! Marked as Live.",
    s8MarkedUndo: "Marked as not done",
    s8MarkHint: "Click this once Meta approves and you've gone Live. This step will get a check mark.",
  },
});
