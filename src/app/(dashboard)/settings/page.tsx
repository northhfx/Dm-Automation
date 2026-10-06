import { getDb } from "@/db/client";
import { Badge, buttonClass, Card, formatDateTime, PageHeader } from "@/components/ui";
import { env, REQUIRED_ENV } from "@/lib/env";
import { PAGE_WEBHOOK_FIELDS } from "@/lib/meta/graph";
import { listConnectedPages } from "@/lib/pages";
import { disconnectPage, resubscribePage } from "./actions";
import { ConnectForm } from "./connect-form";

const INSTAGRAM_WEBHOOK_FIELDS = ["comments", "messages", "messaging_postbacks", "messaging_seen"];

function Code({ children }: { children: string }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>;
}

export default async function SettingsPage() {
  const pages = await listConnectedPages(getDb());
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  const webhookUrl = process.env.PUBLIC_BASE_URL ? `${env.publicBaseUrl}/api/webhooks/meta` : null;

  return (
    <>
      <PageHeader title="ตั้งค่า" description="เชื่อมต่อ Facebook Page / Instagram และตรวจสอบการตั้งค่า Webhook" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="เพจที่เชื่อมต่อแล้ว" className="lg:col-span-2">
          {pages.length === 0 ? (
            <p className="text-sm text-fg-2">ยังไม่มี — เชื่อมต่อด้านล่าง</p>
          ) : (
            <ul className="space-y-3">
              {pages.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>Facebook ID {p.id}</Badge>
                      {p.igUsername ? <Badge>Instagram @{p.igUsername}</Badge> : <Badge tone="warning">ไม่มี Instagram</Badge>}
                      {p.subscribed ? <Badge tone="good">✓ รับ webhook แล้ว</Badge> : <Badge tone="critical">✕ ยังไม่รับ webhook</Badge>}
                    </div>
                    {p.lastError && <p className="mt-1 text-xs text-critical-text">{p.lastError}</p>}
                    <p className="mt-1 text-xs text-fg-3">เชื่อมต่อเมื่อ {formatDateTime(p.connectedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={resubscribePage}>
                      <input type="hidden" name="pageId" value={p.id} />
                      <button className={buttonClass.secondary}>Subscribe ใหม่</button>
                    </form>
                    <form action={disconnectPage}>
                      <input type="hidden" name="pageId" value={p.id} />
                      <button className={buttonClass.danger}>ยกเลิกการเชื่อมต่อ</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="เชื่อมต่อเพจ" description="ใช้ได้ทั้งเพจใหม่และเชื่อมเพจเดิมซ้ำ (เช่น เมื่อ token หมดอายุ)">
          <ConnectForm />
        </Card>

        <Card title="ค่าที่ต้องใส่ใน Meta App Dashboard" description="เมนู Webhooks ของแอปใน developers.facebook.com">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-fg-2">Callback URL</dt>
              <dd className="mt-1">{webhookUrl ? <Code>{webhookUrl}</Code> : <span className="text-critical-text">ตั้งค่า PUBLIC_BASE_URL ก่อน</span>}</dd>
            </div>
            <div>
              <dt className="text-fg-2">Verify Token</dt>
              <dd className="mt-1">ค่าเดียวกับ <Code>META_VERIFY_TOKEN</Code></dd>
            </div>
            <div>
              <dt className="text-fg-2">Fields ของ Page</dt>
              <dd className="mt-1 flex flex-wrap gap-1">{PAGE_WEBHOOK_FIELDS.map((f) => <Code key={f}>{f}</Code>)}</dd>
            </div>
            <div>
              <dt className="text-fg-2">Fields ของ Instagram</dt>
              <dd className="mt-1 flex flex-wrap gap-1">{INSTAGRAM_WEBHOOK_FIELDS.map((f) => <Code key={f}>{f}</Code>)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="สถานะระบบ" className="lg:col-span-2">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {REQUIRED_ENV.map((name) => (
              <li key={name} className="flex items-center gap-2">
                {missing.includes(name) ? <Badge tone="critical">✕ ยังไม่ตั้ง</Badge> : <Badge tone="good">✓ ตั้งแล้ว</Badge>}
                <Code>{name}</Code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fg-2">
            จำกัด DM อัตโนมัติ: Instagram {env.instagramDmPerHour || "ไม่จำกัด"} ข้อความ/ชม. · Facebook{" "}
            {env.facebookDmPerHour || "ไม่จำกัด"} ข้อความ/ชม. — ข้อความที่เกินจะรอคิวส่งในชั่วโมงถัดไป ไม่หาย
          </p>
        </Card>
      </div>
    </>
  );
}
