import Link from "next/link";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { CopyField } from "@/components/copy-field";
import { Badge, buttonClass, cx, formatDateTime, Notice, PageHeader } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { APP_REVIEW_TEXTS, INSTAGRAM_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS, REQUIRED_PERMISSIONS } from "@/lib/meta/setup-info";
import { listConnectedPages } from "@/lib/pages";
import { setAppReviewAction } from "../settings/actions";
import { ConnectForm } from "../settings/connect-form";
import { BaseUrlForm, MetaAppForm } from "../settings/forms";
import { PagesList } from "../settings/pages-list";

type StepState = "done" | "todo" | "optional";

function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children: ReactNode }) {
  return (
    <details open={state !== "done"} className="group rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span
          className={cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            state === "done" ? "bg-good-soft text-good-text" : "bg-accent-soft text-accent",
          )}
        >
          {state === "done" ? "✓" : n}
        </span>
        <span className="flex-1 font-semibold">{title}</span>
        {state === "done" && <Badge tone="good">✓ เสร็จแล้ว</Badge>}
        {state === "optional" && <Badge>ทำเมื่อพร้อม</Badge>}
        <span className="text-fg-3 transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="space-y-4 border-t border-line px-5 py-5 text-sm leading-7">{children}</div>
    </details>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
      {children} ↗
    </a>
  );
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-fg">{children}</b>;
}

export default async function GuidePage() {
  const db = getDb();
  const [status, pages] = await Promise.all([getSetupStatus(db), listConnectedPages(db)]);
  const progress = setupProgress(status);
  const base = status.baseUrl;
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);

  return (
    <>
      <PageHeader
        title="คู่มือตั้งค่า"
        description={`ทำตามทีละขั้น ระบบจะติ๊กถูกให้เองเมื่อเสร็จ — เสร็จแล้ว ${progress.done} จาก ${progress.total} ขั้น`}
      />

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
        <div className="h-full rounded-full bg-good" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
      </div>

      <div className="space-y-4">
        <Step n={1} title="ระบบออนไลน์แล้ว" state={base ? "done" : "todo"}>
          {base ? (
            <>
              <p>ระบบของคุณอยู่ที่ลิงก์นี้ (เก็บไว้ใช้เข้าหน้าจัดการ)</p>
              <CopyField value={base} />
            </>
          ) : (
            <>
              <p>ระบบยังไม่รู้ลิงก์ของตัวเอง ใส่ลิงก์ที่คุณใช้เปิดหน้านี้อยู่ (ดูจากแถบที่อยู่ของเบราว์เซอร์)</p>
              <BaseUrlForm baseUrl={null} />
            </>
          )}
        </Step>

        <Step n={2} title="สร้างแอปใน Meta for Developers" state={metaReady ? "done" : "todo"}>
          <p>Meta (Facebook) ต้องให้เราสร้าง &quot;แอป&quot; ก่อน เพื่อขออนุญาตอ่านคอมเมนต์และส่งข้อความแทนเพจ ฟรี ไม่ต้องเขียนโค้ด</p>
          <Steps>
            <li>
              เปิด <Ext href="https://developers.facebook.com/apps">developers.facebook.com/apps</Ext> แล้วล็อกอินด้วย Facebook ที่เป็นแอดมินเพจ
              (ครั้งแรกจะให้ลงทะเบียนเป็นนักพัฒนา ทำตามขั้นตอนที่ขึ้นมา)
            </li>
            <li>
              กด <B>Create App</B> (สร้างแอป) → ตั้งชื่อ เช่น &quot;ร้านของฉัน DM&quot; → ใส่อีเมล
            </li>
            <li>
              หน้าเลือก use case: เลือกตัวที่เกี่ยวกับ <B>Messenger</B> และ <B>Instagram</B> (ถ้าไม่เจอ เลือก <B>Other</B> แล้วเลือกประเภท{" "}
              <B>Business</B>)
            </li>
            <li>ถ้าถามหา Business portfolio ให้เลือกของร้านคุณ (หรือสร้างใหม่) แล้วกดสร้างแอปจนเสร็จ</li>
            <li>
              เมนูซ้าย <B>App settings → Basic</B>: คัดลอก <B>App ID</B> และกด <B>Show</B> ที่ช่อง <B>App secret</B> แล้วคัดลอกมาใส่ด้านล่าง
            </li>
            <li>
              ในหน้าเดียวกัน วางลิงก์ 2 อันนี้ในช่อง <B>Privacy policy URL</B> และ <B>User data deletion</B> (เลือกแบบ Instructions URL) แล้วกด{" "}
              <B>Save changes</B>
            </li>
          </Steps>
          {base && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="Privacy policy URL" value={`${base}/privacy`} />
              <CopyField label="User data deletion URL" value={`${base}/data-deletion`} />
            </div>
          )}
          <div className="max-w-md rounded-lg border border-line p-4">
            <MetaAppForm appId={status.meta.appId} hasSecret={Boolean(status.meta.appSecret)} fromEnv={status.meta.fromEnv} />
          </div>
        </Step>

        <Step n={3} title="ตั้ง Webhook ให้ Meta แจ้งระบบเมื่อมีคอมเมนต์/ข้อความใหม่" state={status.webhookVerifiedAt ? "done" : "todo"}>
          {!metaReady && <Notice tone="warning">ทำขั้นที่ 2 ให้เสร็จก่อน</Notice>}
          <Steps>
            <li>
              ในหน้าแอปของคุณ เมนูซ้ายหา <B>Webhooks</B> (ถ้าไม่มี กด <B>Add product</B> แล้วเลือก Webhooks)
              <br />
              <span className="text-fg-3">
                * แอปแบบใหม่บางแอปจะมีช่องตั้ง webhook อยู่ในหน้าตั้งค่า Messenger / Instagram แทน ใส่ค่าเดียวกันได้เลย
              </span>
            </li>
            <li>
              ช่อง dropdown ด้านบนเลือก <B>Page</B> → กด <B>Subscribe to this object</B>
            </li>
            <li>
              คัดลอก 2 ค่านี้ไปวาง แล้วกด <B>Verify and save</B>
            </li>
          </Steps>
          {base ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="Callback URL" value={`${base}/api/webhooks/meta`} />
              <CopyField label="Verify token" value={status.meta.verifyToken} />
            </div>
          ) : (
            <Notice tone="warning">ทำขั้นที่ 1 ให้เสร็จก่อน</Notice>
          )}
          <Steps>
            <li value={4}>
              ในรายการด้านล่าง กดปุ่ม <B>Subscribe</B> ที่แถว: <code className="rounded bg-surface-2 px-1">{PAGE_WEBHOOK_FIELDS.join(", ")}</code>
            </li>
            <li>
              เปลี่ยน dropdown เป็น <B>Instagram</B> → ทำแบบเดียวกัน (ใส่ Callback URL และ Verify token เดิม) แล้ว Subscribe แถว:{" "}
              <code className="rounded bg-surface-2 px-1">{INSTAGRAM_WEBHOOK_FIELDS.join(", ")}</code>
            </li>
          </Steps>
          {status.webhookVerifiedAt ? (
            <Notice tone="good">✓ Meta ยืนยันลิงก์ของระบบแล้วเมื่อ {formatDateTime(status.webhookVerifiedAt)}</Notice>
          ) : (
            <p className="text-fg-3">เมื่อกด Verify and save สำเร็จ ขั้นนี้จะติ๊กถูกเอง (รีเฟรชหน้านี้)</p>
          )}
        </Step>

        <Step n={4} title="เชื่อมต่อ Facebook Page และ Instagram" state={status.pagesSubscribed > 0 ? "done" : "todo"}>
          <p>
            <B>ก่อนเริ่ม</B> ตรวจ 2 อย่างในแอป Instagram บนมือถือ: (1) บัญชีเป็นแบบ <B>มืออาชีพ</B> (ธุรกิจ/ครีเอเตอร์) และผูกกับเพจแล้ว (2) เข้า
            การตั้งค่า → <B>ข้อความและการตอบกลับเรื่องราว</B> → <B>เครื่องมือที่เชื่อมต่อ</B> → เปิด <B>อนุญาตการเข้าถึงข้อความ</B>{" "}
            <span className="text-fg-3">(ชื่อเมนูอาจต่างเล็กน้อย)</span>
          </p>
          <Steps>
            <li>
              เปิด <Ext href="https://developers.facebook.com/tools/explorer/">Graph API Explorer</Ext>
            </li>
            <li>
              แถบด้านขวา ช่อง <B>Meta App</B> เลือกแอปที่สร้างในขั้นที่ 2 และช่อง <B>User or Page</B> เลือก <B>User Token</B>
            </li>
            <li>
              ช่อง <B>Permissions</B> กด <B>Add a Permission</B> แล้วเพิ่มทุกตัวในรายการนี้ (พิมพ์ชื่อแล้วกดเลือกทีละตัว)
            </li>
          </Steps>
          <CopyField value={REQUIRED_PERMISSIONS.join(", ")} />
          <Steps>
            <li value={4}>
              กด <B>Generate Access Token</B> → ล็อกอิน → <B>ติ๊กเลือกเพจและบัญชี Instagram ของคุณ</B> → กดอนุญาตจนเสร็จ
            </li>
            <li>
              กดปุ่มคัดลอกที่ช่อง <B>Access Token</B> ด้านบน แล้วนำมาวางในช่องด้านล่าง
            </li>
          </Steps>
          {!metaReady && <Notice tone="warning">ต้องใส่ App ID / App Secret (ขั้นที่ 2) ก่อน</Notice>}
          <div className="rounded-lg border border-line p-4">
            <ConnectForm />
          </div>
          {pages.length > 0 && <PagesList pages={pages} />}
        </Step>

        <Step n={5} title="สร้างกฎอัตโนมัติอันแรก" state={status.ruleCount > 0 ? "done" : "todo"}>
          <p>กำหนดว่าถ้าเจอคำไหน ให้ระบบตอบอะไร เช่น ใครคอมเมนต์ &quot;สนใจ&quot; → ตอบคอมเมนต์ + ส่งลิงก์สินค้าทาง DM</p>
          <Link href="/rules/new" className={buttonClass.primary}>
            สร้างกฎใหม่
          </Link>
        </Step>

        <Step n={6} title="ทดสอบ" state={status.lastWebhookAt ? "done" : "todo"}>
          <p>
            ตอนนี้แอปยังอยู่ใน <B>โหมดทดสอบ</B> ระบบจะตอบได้เฉพาะบัญชีที่มีชื่ออยู่ในแอปเท่านั้น (บัญชี Facebook ของคุณเองเป็นแอดมินอยู่แล้ว)
          </p>
          <Steps>
            <li>
              อยากให้เพื่อนช่วยทดสอบ: ในหน้าแอป เมนู <B>App roles → Roles</B> → เพิ่มเพื่อนเป็น <B>Tester</B> (เพื่อนต้องกดยอมรับคำเชิญ)
            </li>
            <li>ใช้บัญชีนั้นคอมเมนต์คำที่ตั้งไว้ใต้โพสต์ของเพจ หรือทักแชทเพจ</li>
            <li>
              รอไม่กี่วินาที แล้วดูที่หน้า{" "}
              <Link href="/activity" className="font-medium text-accent underline">
                กิจกรรม
              </Link>{" "}
              ควรเห็นรายการใหม่ และบัญชีนั้นควรได้รับ DM
            </li>
          </Steps>
          {status.lastWebhookAt ? (
            <Notice tone="good">✓ ระบบได้รับข้อมูลจาก Meta แล้ว (ล่าสุด {formatDateTime(status.lastWebhookAt)})</Notice>
          ) : (
            <p className="text-fg-3">ยังไม่เคยได้รับข้อมูลจาก Meta — ถ้าทดสอบแล้วยังไม่ขึ้น ตรวจขั้นที่ 3 ว่ากด Subscribe ครบทุกแถว</p>
          )}
        </Step>

        <Step n={7} title="เปิดใช้งานกับลูกค้าทุกคน (ยื่น App Review)" state={status.appReviewDone ? "done" : "optional"}>
          <p>
            ทำหลังจากทดสอบผ่านแล้ว Meta จะตรวจแอปก่อนอนุญาตให้ตอบลูกค้าทั่วไป ใช้เวลาหลายวันถึงหลายสัปดาห์ ระหว่างรอยังใช้กับบัญชีทดสอบได้ตามปกติ
          </p>
          <Steps>
            <li>
              <B>ยืนยันธุรกิจ</B>: ใน <Ext href="https://business.facebook.com/settings">Business settings</Ext> → Business info → Start
              verification (ใช้เอกสารที่มีชื่อร้าน/บริษัท)
            </li>
            <li>
              ในหน้าแอป เมนู <B>App Review → Permissions and Features</B> → กด <B>Request advanced access</B> ให้ทุก permission ในขั้นที่ 4
            </li>
            <li>
              อัดวิดีโอหน้าจอสั้นๆ: คอมเมนต์ใต้โพสต์ → ได้รับ DM → เปิดหน้าภาพรวมของระบบนี้ให้เห็น แล้วแนบในคำขอ
            </li>
            <li>ใส่คำอธิบายของแต่ละ permission (คัดลอกตัวอย่างด้านล่างได้เลย) แล้วกดส่ง</li>
            <li>
              เมื่อผ่านแล้ว สลับแอปจาก <B>Development</B> เป็น <B>Live</B> (สวิตช์ด้านบนของหน้าแอป)
            </li>
          </Steps>
          <details className="rounded-lg border border-line px-4 py-3">
            <summary className="cursor-pointer font-medium">ตัวอย่างคำอธิบายแต่ละ permission (ภาษาอังกฤษ)</summary>
            <div className="mt-3 space-y-3">
              {APP_REVIEW_TEXTS.map((t) => (
                <CopyField key={t.permission} label={t.permission} value={t.text} />
              ))}
            </div>
          </details>
          <form action={setAppReviewAction}>
            <input type="hidden" name="done" value={status.appReviewDone ? "0" : "1"} />
            <button className={buttonClass.secondary}>{status.appReviewDone ? "ยกเลิกเครื่องหมายเสร็จ" : "✓ ผ่าน App Review และเปิด Live แล้ว"}</button>
          </form>
        </Step>
      </div>
    </>
  );
}
