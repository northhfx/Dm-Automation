import Link from "next/link";
import { getDb } from "@/db/client";
import { CopyField } from "@/components/copy-field";
import { Badge, Card, formatDateTime, Notice, PageHeader } from "@/components/ui";
import { getSetupStatus } from "@/lib/config";
import { env } from "@/lib/env";
import { INSTAGRAM_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS } from "@/lib/meta/setup-info";
import { listConnectedPages } from "@/lib/pages";
import { ConnectForm } from "./connect-form";
import { BaseUrlForm, ChangePasswordForm, MetaAppForm } from "./forms";
import { PagesList } from "./pages-list";

export default async function SettingsPage() {
  const db = getDb();
  const [pages, status] = await Promise.all([listConnectedPages(db), getSetupStatus(db)]);
  const urlFromHost = Boolean(process.env.PUBLIC_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN);

  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        description={
          <>
            ตั้งค่าครั้งแรก? ทำตาม{" "}
            <Link href="/guide" className="font-medium text-accent underline">
              คู่มือตั้งค่า
            </Link>{" "}
            จะง่ายกว่า
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="เพจที่เชื่อมต่อ" className="lg:col-span-2">
          <PagesList pages={pages} />
        </Card>

        <Card title="เชื่อมต่อเพจ" description="ใช้ได้ทั้งเพจใหม่และเชื่อมเพจเดิมซ้ำ (เช่น เมื่อ token ใช้ไม่ได้)">
          <ConnectForm />
        </Card>

        <Card title="Meta App" description="จาก developers.facebook.com → แอปของคุณ → App settings → Basic">
          <MetaAppForm appId={status.meta.appId} hasSecret={Boolean(status.meta.appSecret)} fromEnv={status.meta.fromEnv} />
        </Card>

        <Card title="Webhook" description="ค่าที่ใส่ในเมนู Webhooks ของแอปใน Meta">
          <div className="space-y-4">
            {status.baseUrl ? (
              <CopyField label="Callback URL" value={`${status.baseUrl}/api/webhooks/meta`} />
            ) : (
              <Notice tone="warning">ใส่ URL ของระบบก่อน</Notice>
            )}
            <CopyField label="Verify token" value={status.meta.verifyToken} />
            <div className="text-sm">
              <div className="text-xs font-medium text-fg-2">Fields ที่ต้อง Subscribe</div>
              <p className="mt-1">Page: {PAGE_WEBHOOK_FIELDS.join(", ")}</p>
              <p>Instagram: {INSTAGRAM_WEBHOOK_FIELDS.join(", ")}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {status.webhookVerifiedAt ? (
                <Badge tone="good">✓ Meta ยืนยัน URL แล้ว</Badge>
              ) : (
                <Badge tone="warning">ยังไม่ได้รับการยืนยันจาก Meta</Badge>
              )}
              {status.lastWebhookAt && <Badge>webhook ล่าสุด {formatDateTime(status.lastWebhookAt)}</Badge>}
            </div>
          </div>
        </Card>

        <Card title="URL ของระบบ" description="ใช้สร้าง Callback URL และลิงก์ติดตามการคลิก">
          {urlFromHost && status.baseUrl ? (
            <CopyField value={status.baseUrl} />
          ) : (
            <BaseUrlForm baseUrl={status.baseUrl} />
          )}
        </Card>

        <Card title="เปลี่ยนรหัสผ่าน">
          <ChangePasswordForm />
        </Card>

        <Card title="ลิมิตการส่ง">
          <p className="text-sm text-fg-2">
            Instagram {env.instagramDmPerHour || "ไม่จำกัด"} ข้อความ/ชม. · Facebook {env.facebookDmPerHour || "ไม่จำกัด"}{" "}
            ข้อความ/ชม. — ข้อความที่เกินจะรอคิวส่งในชั่วโมงถัดไป ไม่หาย
          </p>
        </Card>
      </div>
    </>
  );
}
