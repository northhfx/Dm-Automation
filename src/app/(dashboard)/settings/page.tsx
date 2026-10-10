import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpenCheck,
  Gauge,
  Globe,
  KeyRound,
  LockKeyhole,
  Plug,
  ShieldCheck,
  Store,
  Webhook,
} from "lucide-react";
import { getDb } from "@/db/client";
import { ActionButton } from "@/components/submit-button";
import { CopyField } from "@/components/copy-field";
import { Badge, ButtonLink, Card, formatDateTime, formatNumber, Notice, PageHeader, PlatformIcon } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { env } from "@/lib/env";
import { INSTAGRAM_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS } from "@/lib/meta/setup-info";
import { listConnectedPages } from "@/lib/pages";
import { setAppReviewAction } from "./actions";
import { ConnectForm } from "./connect-form";
import { BaseUrlForm, ChangePasswordForm, MetaAppForm } from "./forms";
import { PagesList } from "./pages-list";
import { SettingsNav, type SettingsNavItem } from "./settings-nav";

// เว้นที่ด้านบนเมื่อกระโดดไปหมวด (ไม่ให้หัวการ์ดถูกแถบด้านบน/แถบหมวดบนมือถือบัง)
const SECTION = "scroll-mt-[calc(var(--app-topbar-h)+72px)] lg:scroll-mt-10";

/** ชื่อการ์ด + ป้ายสถานะต่อท้าย (บนมือถือป้ายไม่ไปเบียดคำอธิบาย) */
function Titled({ children, badge }: { children: ReactNode; badge: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {children}
      {badge}
    </span>
  );
}

function FieldChips({ label, fields }: { label: string; fields: string[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-20 shrink-0 text-xs font-medium text-fg-2">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <code key={f} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg">
            {f}
          </code>
        ))}
      </div>
    </div>
  );
}

function LimitTile({ platform, perHour }: { platform: "facebook" | "instagram"; perHour: number }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <PlatformIcon platform={platform} size={20} />
      <div className="min-w-0">
        <p className="text-xs text-fg-2">{platform === "instagram" ? "Instagram" : "Facebook"}</p>
        <p className="text-sm font-semibold text-fg tabular">
          {perHour ? (
            <>
              {formatNumber(perHour)} <span className="font-normal text-fg-2">ข้อความ/ชม.</span>
            </>
          ) : (
            "ไม่จำกัด"
          )}
        </p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const db = getDb();
  const [pages, status] = await Promise.all([listConnectedPages(db), getSetupStatus(db)]);
  const progress = setupProgress(status);
  const urlFromHost = Boolean(process.env.PUBLIC_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN);
  const passwordFromEnv = Boolean(process.env.ADMIN_PASSWORD);
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);
  const pagesNeedFix = pages.length === 0 || pages.some((p) => !p.token || !p.subscribed);
  const setupDone = progress.done >= progress.total;

  const nav: SettingsNavItem[] = [
    { id: "pages", label: "เพจที่เชื่อมต่อ", icon: <Store />, group: "เพจ", status: pagesNeedFix ? "attention" : undefined },
    { id: "connect", label: "เชื่อมต่อเพจใหม่", icon: <Plug />, group: "เพจ" },
    { id: "meta-app", label: "Meta App", icon: <KeyRound />, group: "Meta", status: metaReady ? undefined : "attention" },
    { id: "webhook", label: "Webhook", icon: <Webhook />, group: "Meta", status: status.webhookVerifiedAt ? undefined : "attention" },
    { id: "app-review", label: "App Review", icon: <ShieldCheck />, group: "Meta" },
    { id: "url", label: "ที่อยู่เว็บ", icon: <Globe />, group: "ระบบ", status: status.baseUrl ? undefined : "attention" },
    { id: "limits", label: "ลิมิตการส่ง", icon: <Gauge />, group: "ระบบ" },
    { id: "password", label: "รหัสผ่าน", icon: <LockKeyhole />, group: "ระบบ" },
  ];

  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        description={
          setupDone ? (
            "การเชื่อมต่อกับ Facebook / Instagram และค่าของระบบ"
          ) : (
            <>
              ตั้งค่าครั้งแรก? ทำตาม{" "}
              <Link href="/guide" className="font-medium text-accent hover:underline">
                คู่มือตั้งค่า
              </Link>{" "}
              ทีละขั้นจะง่ายกว่า
            </>
          )
        }
        actions={
          <ButtonLink href="/guide" variant="secondary" icon={<BookOpenCheck />} className="max-sm:hidden">
            คู่มือตั้งค่า
            {!setupDone && (
              <Badge tone="warning" className="-mr-1 tabular">
                {progress.done}/{progress.total}
              </Badge>
            )}
          </ButtonLink>
        }
      />

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav items={nav} />

        <div className="mt-6 max-w-3xl min-w-0 space-y-6 lg:mt-0">
          <Card
            id="pages"
            className={SECTION}
            icon={<Store />}
            title="เพจที่เชื่อมต่อ"
            description="เพจ Facebook และบัญชี Instagram ที่ระบบตอบให้อัตโนมัติ"
            padding="none"
          >
            <PagesList pages={pages} />
          </Card>

          <Card
            id="connect"
            className={SECTION}
            icon={<Plug />}
            title="เชื่อมต่อเพจใหม่"
            description="ใช้ได้ทั้งเพจใหม่และเชื่อมเพจเดิมซ้ำ (เช่น เมื่อ token ใช้ไม่ได้)"
          >
            <ConnectForm connectedIds={pages.map((p) => p.id)} />
          </Card>

          <Card
            id="meta-app"
            className={SECTION}
            icon={<KeyRound />}
            title={
              <Titled
                badge={
                  metaReady ? (
                    <Badge tone="good" dot>
                      บันทึกแล้ว
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      ยังไม่ครบ
                    </Badge>
                  )
                }
              >
                Meta App
              </Titled>
            }
            description={
              <>
                จาก{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
                >
                  developers.facebook.com
                  <ArrowUpRight className="size-3.5" aria-hidden />
                  <span className="sr-only">(เปิดแท็บใหม่)</span>
                </a>{" "}
                → แอปของคุณ → App settings → Basic
              </>
            }
          >
            <MetaAppForm appId={status.meta.appId} hasSecret={Boolean(status.meta.appSecret)} fromEnv={status.meta.fromEnv} />
          </Card>

          <Card
            id="webhook"
            className={SECTION}
            icon={<Webhook />}
            title={
              <Titled
                badge={
                  status.webhookVerifiedAt ? (
                    <Badge tone="good" dot>
                      Meta ยืนยันแล้ว
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      ยังไม่ยืนยัน
                    </Badge>
                  )
                }
              >
                Webhook
              </Titled>
            }
            description="ค่าที่ใส่ในเมนู Webhooks ของแอปใน Meta เพื่อให้ Meta ส่งคอมเมนต์และข้อความใหม่มาที่ระบบ"
          >
            <div className="space-y-5">
              {!status.webhookVerifiedAt && (
                <Notice
                  tone="warning"
                  title="Meta ยังไม่ได้ยืนยันลิงก์ของระบบ"
                  actions={
                    <ButtonLink href="/guide#step-3" variant="secondary" size="sm">
                      ดูวิธีตั้ง
                    </ButtonLink>
                  }
                >
                  คัดลอก 2 ค่าด้านล่างไปวางในหน้า Webhooks ของแอป แล้วกด Verify and save
                </Notice>
              )}
              <div className="grid gap-4">
                {status.baseUrl ? (
                  <CopyField label="Callback URL" value={`${status.baseUrl}/api/webhooks/meta`} />
                ) : (
                  <Notice tone="warning">
                    ใส่{" "}
                    <a href="#url" className="font-medium underline">
                      ที่อยู่เว็บของระบบ
                    </a>{" "}
                    ก่อน แล้วระบบจะสร้าง Callback URL ให้
                  </Notice>
                )}
                <CopyField label="Verify token" value={status.meta.verifyToken} />
              </div>
              <div className="space-y-3 rounded-lg border border-line p-4">
                <p className="text-sm font-medium text-fg">Fields ที่ต้อง Subscribe</p>
                <FieldChips label="Page" fields={PAGE_WEBHOOK_FIELDS} />
                <FieldChips label="Instagram" fields={INSTAGRAM_WEBHOOK_FIELDS} />
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">Meta ยืนยัน URL เมื่อ</dt>
                  <dd className="font-medium text-fg tabular">{status.webhookVerifiedAt ? formatDateTime(status.webhookVerifiedAt) : "ยังไม่ยืนยัน"}</dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">ได้รับ webhook ล่าสุด</dt>
                  <dd className="font-medium text-fg tabular">{status.lastWebhookAt ? formatDateTime(status.lastWebhookAt) : "ยังไม่เคยได้รับ"}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card
            id="app-review"
            className={SECTION}
            icon={<ShieldCheck />}
            title={
              <Titled
                badge={
                  status.appReviewDone ? (
                    <Badge tone="good" dot>
                      เปิดใช้กับทุกคนแล้ว
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      โหมดทดสอบ
                    </Badge>
                  )
                }
              >
                สถานะ App Review
              </Titled>
            }
            description="Meta ต้องตรวจแอปก่อน ระบบจึงจะตอบลูกค้าทุกคนได้"
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-fg-2">
                {status.appReviewDone
                  ? "แอปผ่าน App Review และเปิด Live แล้ว ระบบตอบได้ทุกคนที่คอมเมนต์หรือทักแชท"
                  : "ตอนนี้ระบบตอบได้เฉพาะบัญชีที่มีชื่ออยู่ในแอป (แอดมินและ Tester) ทำขั้นนี้หลังทดสอบผ่านแล้ว Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์"}
              </p>
              <div className="flex flex-wrap gap-2">
                {!status.appReviewDone && (
                  <ButtonLink href="/guide#step-7" variant="secondary" className="max-sm:w-full">
                    ดูวิธียื่น App Review
                  </ButtonLink>
                )}
                <ActionButton
                  action={setAppReviewAction}
                  fields={{ done: status.appReviewDone ? "0" : "1" }}
                  variant={status.appReviewDone ? "ghost" : "secondary"}
                  successMessage={status.appReviewDone ? "ยกเลิกเครื่องหมายแล้ว" : "บันทึกแล้ว — เปิดใช้กับทุกคน"}
                  className="max-sm:w-full"
                >
                  {status.appReviewDone ? "ยกเลิกเครื่องหมายเสร็จ" : "ผ่าน App Review และเปิด Live แล้ว"}
                </ActionButton>
              </div>
            </div>
          </Card>

          <Card
            id="url"
            className={SECTION}
            icon={<Globe />}
            title="ที่อยู่เว็บ"
            description="ลิงก์ของระบบนี้ ใช้สร้าง Callback URL และลิงก์ติดตามการคลิก"
          >
            {urlFromHost && status.baseUrl ? (
              <div className="space-y-2">
                <CopyField value={status.baseUrl} />
                <p className="text-xs text-fg-3">ตั้งจากค่าใน Railway อัตโนมัติ (แก้ไขที่นั่น)</p>
              </div>
            ) : (
              <BaseUrlForm baseUrl={status.baseUrl} />
            )}
          </Card>

          <Card
            id="limits"
            className={SECTION}
            icon={<Gauge />}
            title="ลิมิตการส่ง"
            description="ข้อความที่เกินจะรอคิวส่งในชั่วโมงถัดไป ไม่หาย"
          >
            <div className="grid grid-cols-2 gap-3">
              <LimitTile platform="instagram" perHour={env.instagramDmPerHour} />
              <LimitTile platform="facebook" perHour={env.facebookDmPerHour} />
            </div>
          </Card>

          <Card id="password" className={SECTION} icon={<LockKeyhole />} title="เปลี่ยนรหัสผ่าน" description="รหัสผ่านที่ใช้เข้าหน้าจัดการนี้">
            <ChangePasswordForm managedByEnv={passwordFromEnv} />
          </Card>
        </div>
      </div>
    </>
  );
}
