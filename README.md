# DM Automation

ระบบตอบคอมเมนต์และส่ง DM อัตโนมัติสำหรับ **Facebook Page** และ **Instagram** แบบที่ติดตั้งเอง (แทน ManyChat) พร้อมแดชบอร์ดดูสถิติ

- มีคนคอมเมนต์คำที่กำหนด (เช่น "สนใจ") → ระบบ**ตอบคอมเมนต์** + **ส่ง DM** ให้คนนั้นทันที
- มีคนทักแชทด้วยคำที่กำหนด (เช่น "ราคา") → ระบบตอบกลับในแชทอัตโนมัติ
- เลือกได้ว่ากฎทำงานกับ **ทุกโพสต์** หรือ **เฉพาะโพสต์ที่เลือก**
- ลิงก์ใน DM ถูกแปลงเป็น**ลิงก์ติดตาม** เพื่อนับคนกด
- แดชบอร์ด: ข้อความเข้า, จำนวนที่ตรงกฎ, DM ที่ส่งสำเร็จ/ไม่สำเร็จ, % การอ่าน, % การคลิก, ลูกค้าใหม่, กราฟรายวัน, ผลงานแยกตามกฎ
- รายชื่อลูกค้า, หน้ากิจกรรม (ดูย้อนหลังว่าระบบทำอะไรไปบ้าง) และ webhook ดิบไว้ตรวจปัญหา

ค่าใช้จ่ายประมาณ **$5/เดือน** (ค่าเซิร์ฟเวอร์ + ฐานข้อมูลบน Railway) ส่วน API ของ Meta ใช้ได้ฟรี

---

## สิ่งที่ต้องมี

1. **Facebook Page** ที่คุณเป็นแอดมิน
2. **Instagram แบบ Professional** (Business หรือ Creator) ที่**ผูกกับ Facebook Page นั้นแล้ว**
3. บัญชี **Meta for Developers** (สมัครฟรีที่ [developers.facebook.com](https://developers.facebook.com))
4. บัญชี **GitHub** (มีแล้ว) และบัญชี **Railway** ([railway.com](https://railway.com)) สำหรับเปิดเซิร์ฟเวอร์

> ⚠️ ระบบนี้ต้องรันบนเซิร์ฟเวอร์ที่เปิดตลอดเวลา (Railway, Render, VPS) **ไม่รองรับ Vercel/serverless** เพราะมีตัวประมวลผลคิวทำงานอยู่เบื้องหลัง

---

## ขั้นตอนที่ 1 — เปิดเซิร์ฟเวอร์บน Railway

1. เข้า Railway → **New Project** → **Deploy from GitHub repo** → เลือก repo `dm-automation`
2. ในโปรเจกต์เดียวกัน กด **+ New** → **Database** → **PostgreSQL**
3. คลิก service ของแอป → แท็บ **Settings** → **Networking** → **Generate Domain** จะได้ URL เช่น `https://dm-automation-production.up.railway.app`
4. แท็บ **Variables** ใส่ค่าตามนี้ (ดูคำอธิบายทั้งหมดใน `.env.example`)

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PUBLIC_BASE_URL` | URL จากข้อ 3 (ไม่มี `/` ท้าย) |
| `ADMIN_PASSWORD` | รหัสผ่านเข้าแดชบอร์ด |
| `AUTH_SECRET` | ตัวอักษรสุ่มยาว 32 ตัวขึ้นไป (**ห้ามเปลี่ยนภายหลัง** ไม่งั้นต้องเชื่อมเพจใหม่) |
| `META_VERIFY_TOKEN` | คำอะไรก็ได้ที่คุณตั้งเอง เช่น `my-shop-webhook-2026` |
| `META_APP_ID`, `META_APP_SECRET` | ได้จากขั้นตอนที่ 2 (ใส่ทีหลังได้) |
| `BUSINESS_NAME`, `CONTACT_EMAIL` | ชื่อร้านและอีเมล แสดงในหน้านโยบายความเป็นส่วนตัว |

5. รอ deploy เสร็จ แล้วเปิด URL ของคุณ → ล็อกอินด้วย `ADMIN_PASSWORD` ได้ = ✅

ระบบสร้างตารางในฐานข้อมูลให้อัตโนมัติทุกครั้งที่เปิดเซิร์ฟเวอร์

---

## ขั้นตอนที่ 2 — สร้าง Meta App

1. ไปที่ [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**
2. เลือกประเภท/กรณีใช้งานที่เกี่ยวกับ **Messenger** และ **Instagram** (เช่น "Engage with customers on Messenger" และ "Manage messaging & content on Instagram" — ชื่อเมนูอาจเปลี่ยนไปเล็กน้อยตามที่ Meta ปรับหน้าเว็บ) และผูกกับ Business Portfolio ของคุณ
3. เพิ่ม product **Messenger**, **Instagram** และ **Webhooks** (ถ้ายังไม่มี)
4. **App settings → Basic**
   - คัดลอก **App ID** และ **App Secret** ไปใส่ `META_APP_ID` / `META_APP_SECRET` ใน Railway
   - **Privacy Policy URL**: `https://<โดเมนของคุณ>/privacy`
   - **User data deletion → Data deletion instructions URL**: `https://<โดเมนของคุณ>/data-deletion`
   - กด **Save changes**

---

## ขั้นตอนที่ 3 — ตั้งค่า Webhook (ให้ Meta แจ้งเมื่อมีคอมเมนต์/ข้อความใหม่)

ในหน้าแอป → **Webhooks**

1. เลือก object **Page** → **Subscribe to this object**
   - **Callback URL**: `https://<โดเมนของคุณ>/api/webhooks/meta`
   - **Verify token**: ค่าเดียวกับ `META_VERIFY_TOKEN`
   - กด Verify and save แล้ว **Subscribe** fields: `feed`, `messages`, `messaging_postbacks`, `message_reads`
2. เลือก object **Instagram** → ใส่ Callback URL และ Verify token เดิม
   - Subscribe fields: `comments`, `messages`, `messaging_postbacks`, `messaging_seen`

> ค่าทั้งหมดนี้ดูได้จากหน้า **ตั้งค่า** ในแดชบอร์ดด้วย

---

## ขั้นตอนที่ 4 — เชื่อมต่อเพจเข้ากับระบบ

1. **เปิดสิทธิ์ข้อความใน Instagram** (สำคัญ ถ้าไม่เปิด DM ของ IG จะไม่เข้าระบบ):
   แอป Instagram → การตั้งค่า → **ข้อความและการตอบกลับเรื่องราว** → **เครื่องมือที่เชื่อมต่อ** → เปิด **อนุญาตการเข้าถึงข้อความ** (ชื่อเมนูอาจต่างกันเล็กน้อยตามเวอร์ชันแอป)
2. เปิด [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - **Meta App**: เลือกแอปของคุณ
   - **User or Page**: เลือก **User Token**
   - **Permissions**: เพิ่มทั้งหมดนี้
     ```
     pages_show_list, pages_manage_metadata, pages_read_engagement,
     pages_read_user_content, pages_manage_engagement, pages_messaging,
     instagram_basic, instagram_manage_comments, instagram_manage_messages,
     business_management
     ```
   - กด **Generate Access Token** → ล็อกอิน → **ติ๊กเลือกเพจและบัญชี Instagram ของคุณ** → อนุญาต
   - คัดลอก token ที่ได้
3. แดชบอร์ด → **ตั้งค่า** → วาง token → **ดึงรายชื่อเพจ** → เลือกเพจ → **เชื่อมต่อเพจที่เลือก**
4. ต้องเห็นป้าย **✓ รับ webhook แล้ว** ที่เพจนั้น

ระบบจะแลก token เป็นแบบ**ไม่หมดอายุ**ให้อัตโนมัติ (ถ้าวันหลังเปลี่ยนรหัสผ่าน Facebook หรือถอดสิทธิ์แอป ให้ทำขั้นตอนนี้ซ้ำ)

---

## ขั้นตอนที่ 5 — ทดสอบ

ตอนนี้แอปยังอยู่ใน **Development mode**: ระบบจะตอบได้เฉพาะ**บัญชีที่มีบทบาทในแอป** (แอดมิน/นักพัฒนา/ผู้ทดสอบ) เท่านั้น

1. เพิ่มบัญชีทดสอบที่ **App roles → Roles** (เพิ่มบัญชี Facebook/Instagram ของเพื่อนหรือบัญชีสำรองของคุณ)
2. แดชบอร์ด → **กฎอัตโนมัติ** → **สร้างกฎใหม่** เช่น keyword `สนใจ` + ข้อความ DM + ลิงก์สินค้า
3. ใช้บัญชีทดสอบคอมเมนต์ "สนใจ" ใต้โพสต์ → ภายในไม่กี่วินาทีควรได้รับ DM
4. ดูผลที่หน้า **กิจกรรม** (ถ้าไม่มีอะไรขึ้นเลย ดูหัวข้อ "แก้ปัญหา" ด้านล่าง)

---

## ขั้นตอนที่ 6 — เปิดใช้งานจริงกับลูกค้าทุกคน (App Review)

เพื่อให้ระบบตอบลูกค้าทั่วไปได้ ต้องให้ Meta ตรวจแอปก่อน

1. **Business Verification**: ยืนยันธุรกิจใน Business Portfolio (ใช้เอกสารธุรกิจ/บิลที่มีชื่อร้าน)
2. **App Review → Permissions and Features**: ขอ **Advanced Access** ให้ permission ในขั้นตอนที่ 4 ทุกตัว
   - แต่ละ permission ต้องเขียนอธิบายว่าใช้ทำอะไร และแนบ**วิดีโอสาธิต** (อัดหน้าจอ: คอมเมนต์ใต้โพสต์ → ได้รับ DM → หน้าแดชบอร์ดของระบบ)
   - ตัวอย่างคำอธิบาย: *"We use instagram_manage_comments to detect comments containing keywords on our own posts and reply to them, and instagram_manage_messages to send the requested product information to the commenter via a private reply."*
3. เมื่อผ่านแล้ว สลับแอปเป็น **Live mode**

การรีวิวใช้เวลาหลายวันถึงหลายสัปดาห์ ระหว่างนั้นใช้งาน/ทดสอบกับบัญชีทดสอบไปก่อนได้

---

## วิธีใช้งาน

### กฎอัตโนมัติ
- **ทำงานเมื่อ**: คอมเมนต์ใต้โพสต์ หรือ ทักแชท (DM)
- **วิธีจับคำ**: *มีคำนี้อยู่ในข้อความ* (แนะนำ เหมาะกับภาษาไทย), *ตรงทั้งข้อความ*, หรือ *ทุกข้อความ*
- **ตอบคอมเมนต์**: ใส่หลายแบบได้ บรรทัดละ 1 แบบ ระบบจะสุ่มใช้ เพื่อไม่ให้ดูเป็นสแปม
- **ข้อความ DM**: ใช้ `{name}` แทนชื่อลูกค้า และ `{link}` แทนลิงก์ติดตาม
- **ตอบคนเดิมแค่ครั้งเดียวต่อโพสต์**: กันส่ง DM ซ้ำเมื่อคนเดิมคอมเมนต์หลายครั้ง
- **ลำดับความสำคัญ**: ถ้าข้อความตรงหลายกฎ ระบบใช้กฎที่เลขน้อยที่สุดเพียงกฎเดียว

### ความหมายของสถิติ
| ตัวเลข | ความหมาย |
|---|---|
| ข้อความเข้า | คอมเมนต์ + DM ทั้งหมดที่ระบบได้รับ |
| ตรงกับกฎ | จำนวนครั้งที่ข้อความตรงกับกฎ (ระบบลงมือทำงาน) |
| ส่ง DM สำเร็จ | DM ที่ Meta รับไปส่งแล้ว (ส่วนที่ล้มเหลวดูสาเหตุได้ที่หน้ากิจกรรม) |
| อัตราการอ่าน | % ของ DM ที่ลูกค้าเปิดอ่าน |
| อัตราการคลิก | % ของลิงก์ที่ส่งไปแล้วมีคนกดอย่างน้อย 1 ครั้ง (ไม่นับการเปิดลิงก์อัตโนมัติของระบบแชทเพื่อทำภาพตัวอย่าง) |
| ลูกค้าใหม่ | คนที่คุยกับเพจ/ได้รับ DM จากระบบเป็นครั้งแรกในช่วงเวลานั้น |

---

## ข้อจำกัดของแพลตฟอร์ม (กำหนดโดย Meta ไม่ใช่ระบบนี้)

- DM จากคอมเมนต์ (Private Reply) ส่งได้ **1 ข้อความต่อ 1 คอมเมนต์** และต้องส่ง**ภายใน 7 วัน**หลังคอมเมนต์ จึงควรใส่ข้อมูลทั้งหมดไว้ในข้อความเดียว
- ส่งข้อความหาลูกค้าได้ภายใน **24 ชั่วโมง** หลังลูกค้าทักมาล่าสุด
- Instagram จำกัดจำนวน DM อัตโนมัติต่อชั่วโมง ระบบตั้งไว้ที่ 180/ชม. (`INSTAGRAM_DM_PER_HOUR`) ข้อความที่เกินจะ**รอคิวส่งในชั่วโมงถัดไป ไม่หาย**
- ถ้า Meta ขัดข้องชั่วคราว ระบบจะลองส่งใหม่ให้อัตโนมัติ

---

## แก้ปัญหา

| อาการ | ตรวจอะไร |
|---|---|
| คอมเมนต์/ทักแชทแล้วไม่มีอะไรขึ้นในหน้ากิจกรรม | ดูกล่อง **Webhook ล่าสุดที่ได้รับ** ในหน้ากิจกรรม ถ้าว่าง = webhook ไม่มาถึง → ตรวจ Callback URL, fields ที่ subscribe, ป้าย "รับ webhook แล้ว" ในหน้าตั้งค่า และบัญชีที่ทดสอบต้องมีบทบาทในแอป (ตอนยังเป็น Development mode) |
| webhook มาถึงแต่ไม่ส่ง DM | ดูว่าข้อความตรงกับ keyword และโพสต์ที่เลือกไว้หรือไม่ และกฎเปิดอยู่หรือเปล่า |
| "ส่ง DM ไม่สำเร็จ" | ดูสาเหตุในหน้ากิจกรรม เช่น ไม่มี permission, เกิน 7 วัน, ผู้ใช้ปิดรับข้อความ |
| DM ของ Instagram ไม่เข้า | เปิด **อนุญาตการเข้าถึงข้อความ** ในแอป Instagram (ขั้นตอนที่ 4 ข้อ 1) |
| Log ขึ้นว่า "ลายเซ็นไม่ถูกต้อง" | `META_APP_SECRET` ไม่ตรงกับแอป |
| เคยใช้ได้แล้วจู่ๆ ใช้ไม่ได้ | token อาจถูกยกเลิก (เปลี่ยนรหัสผ่าน/ถอดสิทธิ์) → ทำขั้นตอนที่ 4 ซ้ำ |

---

## สำหรับนักพัฒนา

```bash
npm install
cp .env.example .env.local   # แก้ค่าให้ถูก (ต้องมี PostgreSQL)
npm run dev                  # http://localhost:3000
npm test                     # unit + integration tests (ใช้ฐานข้อมูลจริงจาก TEST_DATABASE_URL)
npm run lint && npm run typecheck
```

ทดสอบ webhook จาก Meta บนเครื่องตัวเองได้ด้วย tunnel เช่น `cloudflared tunnel --url http://localhost:3000` แล้วใช้ URL ที่ได้เป็น Callback URL และ `PUBLIC_BASE_URL`

**โครงสร้างหลัก**

```
src/app/api/webhooks/meta/route.ts   รับ webhook → ตรวจลายเซ็น → ใส่คิว
src/lib/meta/webhook.ts              แปลง payload ของ Meta เป็นงาน (comment / dm / read)
src/lib/automation/handlers.ts       หา rule → ตอบคอมเมนต์ / ส่ง DM / บันทึกสถิติ
src/lib/queue/                       คิวงานบน Postgres + worker (ลองใหม่, คุมลิมิตต่อชั่วโมง)
src/lib/rules/match.ts               ตรรกะจับ keyword
src/lib/stats.ts                     คำนวณสถิติหน้าภาพรวม
src/app/r/[code]/route.ts            ลิงก์ติดตามการคลิก
src/app/(dashboard)/                 หน้าแดชบอร์ด
src/db/schema.ts + drizzle/          ตารางฐานข้อมูล (แก้ schema แล้วรัน npm run db:generate)
```

## แผนต่อไป

- **เฟส 2**: LINE OA, Telegram
- **เฟส 3**: ข้อความหลายขั้น/ปุ่มกด, ติด tag ลูกค้า, ส่งข้อความตามเงื่อนไข
