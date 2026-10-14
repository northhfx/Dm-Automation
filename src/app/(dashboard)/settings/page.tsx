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
  SunMoon,
  Webhook,
} from "lucide-react";
import { getDb } from "@/db/client";
import { NavTitle } from "@/components/localized";
import { ActionButton } from "@/components/submit-button";
import { CopyField } from "@/components/copy-field";
import { Badge, ButtonLink, Card, cx, formatDateTime, formatNumber, Notice, PageHeader, PlatformIcon } from "@/components/ui";
import { getInstagramConfig, getSetupStatus, setupProgress } from "@/lib/config";
import { env } from "@/lib/env";
import { listInstagramAccounts } from "@/lib/instagram/accounts";
import { INSTAGRAM_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS, WEBHOOK_PATHS } from "@/lib/meta/setup-info";
import { listConnectedPages } from "@/lib/pages";
import { setAppReviewAction } from "./actions";
import { AppearanceCard } from "./appearance-card";
import { ConnectForm } from "./connect-form";
import { BaseUrlForm, ChangePasswordForm, InstagramAppForm, MetaAppForm } from "./forms";
import { InstagramConnectForm } from "./instagram-connect-form";
import { instagramNeedsAttention, InstagramAccountsList } from "./instagram-list";
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
      <span className="shrink-0 text-xs font-medium text-fg-2 sm:w-32">{label}</span>
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

/** ลิมิตต่อชั่วโมงของหนึ่งแพลตฟอร์ม: DM ตอบคอมเมนต์ (Private Reply) แยกจาก DM ทั่วไป (0 = ไม่จำกัด) */
function LimitTile({
  platform,
  privateReplyPerHour,
  dmPerHour,
}: {
  platform: "facebook" | "instagram";
  privateReplyPerHour: number;
  dmPerHour: number;
}) {
  const rows = [
    { label: "DM ตอบคอมเมนต์", perHour: privateReplyPerHour },
    { label: "DM ทั่วไป", perHour: dmPerHour },
  ];
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-3.5 py-3 sm:flex-row sm:gap-3 sm:px-4">
      <PlatformIcon platform={platform} size={20} />
      {/* self-stretch: มือถือ (flex-col + items-start) ให้กว้างเต็มกล่อง ตัวเลขจะชิดขวาตรงกันทุกแถว */}
      <div className="min-w-0 flex-1 self-stretch">
        <p className="text-xs font-medium text-fg-2">{platform === "instagram" ? "Instagram" : "Facebook"}</p>
        <dl className="mt-1 space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-2">
              <dt className="text-xs text-fg-3">{r.label}</dt>
              <dd className="text-sm font-semibold text-fg tabular">
                {r.perHour ? (
                  <>
                    {formatNumber(r.perHour)} <span className="font-normal text-fg-2">/ชม.</span>
                  </>
                ) : (
                  "ไม่จำกัด"
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const db = getDb();
  const [pages, status, igAccounts, igConfig] = await Promise.all([
    listConnectedPages(db),
    getSetupStatus(db),
    listInstagramAccounts(db),
    getInstagramConfig(db),
  ]);
  const progress = setupProgress(status);
  const urlFromHost = Boolean(process.env.PUBLIC_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN);
  const passwordFromEnv = Boolean(process.env.ADMIN_PASSWORD);
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);
  const pagesNeedFix = pages.length === 0 || pages.some((p) => !p.token || !p.subscribed);
  const setupDone = progress.done >= progress.total;
  const ig = status.instagram;
  const igNeedsFix = instagramNeedsAttention(igAccounts);
  const igReady = igAccounts.length > 0 && !igNeedsFix;
  const igWebhookOk = Boolean(ig.webhookVerifiedAt || ig.lastWebhookAt);

  const nav: SettingsNavItem[] = [
    { id: "pages", label: "เพจที่เชื่อมต่อ", icon: <Store />, group: "เพจ", status: pagesNeedFix ? "attention" : undefined },
    { id: "connect", label: "เชื่อมต่อเพจใหม่", icon: <Plug />, group: "เพจ" },
    {
      id: "instagram",
      label: "บัญชี Instagram",
      icon: <PlatformIcon platform="instagram" variant="mono" />,
      group: "Instagram",
      status: igNeedsFix ? "attention" : undefined,
    },
    { id: "instagram-app", label: "Instagram App", icon: <KeyRound />, group: "Instagram", status: ig.appSecretSet ? undefined : "attention" },
    {
      id: "instagram-webhook",
      label: "Webhook Instagram",
      icon: <Webhook />,
      group: "Instagram",
      status: !igWebhookOk || ig.badSignatureAt ? "attention" : undefined,
    },
    { id: "meta-app", label: "Meta App", icon: <KeyRound />, group: "Meta", status: metaReady ? undefined : "attention" },
    { id: "webhook", label: "Webhook", icon: <Webhook />, group: "Meta", status: status.webhookVerifiedAt ? undefined : "attention" },
    { id: "app-review", label: "App Review", icon: <ShieldCheck />, group: "Meta" },
    { id: "url", label: "ที่อยู่เว็บ", icon: <Globe />, group: "ระบบ", status: status.baseUrl ? undefined : "attention" },
    { id: "limits", label: "ลิมิตการส่ง", icon: <Gauge />, group: "ระบบ" },
    { id: "appearance", label: "การแสดงผล", icon: <SunMoon />, group: "ระบบ" },
    { id: "password", label: "รหัสผ่าน", icon: <LockKeyhole />, group: "ระบบ" },
  ];

  return (
    <>
      <PageHeader
        title={<NavTitle name="settings" />}
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
            description="เพจ Facebook ที่ระบบตอบให้อัตโนมัติ"
            padding="none"
          >
            <PagesList pages={pages} igLoginIds={igAccounts.map((a) => a.id)} />
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
            id="instagram"
            className={SECTION}
            icon={<PlatformIcon platform="instagram" variant="mono" />}
            title={
              <Titled
                badge={
                  igAccounts.length === 0 ? (
                    <Badge tone="neutral" dot>
                      ยังไม่เชื่อม
                    </Badge>
                  ) : igReady ? (
                    <Badge tone="good" dot>
                      พร้อมใช้งาน
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      ต้องตรวจสอบ
                    </Badge>
                  )
                }
              >
                บัญชี Instagram
              </Titled>
            }
            description="เชื่อมผ่าน Instagram Login แยกจากเพจ Facebook — ใช้ตอบคอมเมนต์และ DM ของ Instagram"
            padding="none"
          >
            <InstagramAccountsList accounts={igAccounts} pages={pages} />
            <p className="flex items-start gap-2 border-t border-line bg-surface-2/40 px-5 py-3 text-xs leading-5 text-fg-2">
              <Gauge className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden />
              <span>
                ระบบไม่จำกัดจำนวนข้อความหรือจำนวนลูกค้า · Meta ให้ส่ง DM ตอบคอมเมนต์ได้ราว 750 ครั้ง/ชม. ต่อบัญชี (เกินจะรอคิวส่งให้เองอัตโนมัติ
                ไม่มีข้อความหาย) ส่วนการตอบแชทแทบไม่จำกัด
              </span>
            </p>
            <div id="connect-instagram" className={cx("space-y-4 border-t border-line p-5", SECTION)}>
              <div>
                <p className="text-sm leading-6 font-semibold text-fg">{igAccounts.length ? "วาง token ใหม่ / เชื่อมบัญชีเพิ่ม" : "เชื่อมบัญชี Instagram"}</p>
                <p className="text-xs leading-5 text-fg-3">วาง token บัญชีเดิมซ้ำได้ (เช่น เมื่อ token ใช้ไม่ได้) — กฎและข้อมูลเดิมยังอยู่ครบ</p>
              </div>
              <InstagramConnectForm hasAppSecret={ig.appSecretSet} />
            </div>
          </Card>

          <Card
            id="instagram-app"
            className={SECTION}
            icon={<KeyRound />}
            title={
              <Titled
                badge={
                  ig.appSecretSet ? (
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
                Instagram App
              </Titled>
            }
            description="Instagram app secret จากหน้า API setup with Instagram login และ App secret จาก App settings → Basic ของแอป Instagram ที่สร้างแยก"
          >
            <InstagramAppForm hasSecret={ig.appSecretSet} hasMetaAppSecret={Boolean(igConfig.metaAppSecret)} fromEnv={ig.fromEnv} />
          </Card>

          <Card
            id="instagram-webhook"
            className={SECTION}
            icon={<Webhook />}
            title={
              <Titled
                badge={
                  igWebhookOk ? (
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
                Webhook Instagram
              </Titled>
            }
            description="ค่าที่ใส่ในหัวข้อ Configure webhooks ของหน้า API setup with Instagram login"
          >
            <div className="space-y-5">
              {ig.badSignatureAt && (
                <Notice
                  tone="critical"
                  title="Meta ส่งข้อมูล Instagram มาแล้ว แต่ลายเซ็นไม่ตรงกับ secret ที่บันทึกไว้"
                  actions={
                    <ButtonLink href="#instagram-app" variant="secondary" size="sm">
                      ใส่ secret ใหม่
                    </ButtonLink>
                  }
                >
                  ครั้งล่าสุด {formatDateTime(ig.badSignatureAt)} — คัดลอก Instagram app secret ล่าสุด (และ App secret จาก App settings → Basic
                  ถ้าใช้แอปแยก) มาวางในหัวข้อ Instagram App
                </Notice>
              )}
              {!igWebhookOk && (
                <Notice
                  tone="warning"
                  title="Meta ยังไม่ได้ยืนยันลิงก์ของ Instagram"
                  actions={
                    <ButtonLink href="/guide#step-5-webhook" variant="secondary" size="sm">
                      ดูวิธีตั้ง
                    </ButtonLink>
                  }
                >
                  คัดลอก 2 ค่าด้านล่างไปวางในหัวข้อ Configure webhooks แล้วกด Verify and save
                </Notice>
              )}
              <div className="grid gap-4">
                {status.baseUrl ? (
                  <CopyField label="Callback URL" value={`${status.baseUrl}${WEBHOOK_PATHS.instagram}`} />
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
                <FieldChips label="Instagram" fields={INSTAGRAM_WEBHOOK_FIELDS} />
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">Meta ยืนยัน URL เมื่อ</dt>
                  <dd className="text-right font-medium text-fg tabular sm:text-left">
                    {ig.webhookVerifiedAt ? formatDateTime(ig.webhookVerifiedAt) : "ยังไม่ยืนยัน"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">ได้รับ webhook ทาง Instagram Login ล่าสุด</dt>
                  <dd className="text-right font-medium text-fg tabular sm:text-left">
                    {ig.lastWebhookAt ? formatDateTime(ig.lastWebhookAt) : "ยังไม่เคยได้รับ"}
                  </dd>
                </div>
              </dl>
            </div>
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
              {status.badSignatureAt && (
                <Notice
                  tone="critical"
                  title="Meta ส่งข้อมูลมาแล้ว แต่ App Secret ไม่ตรงกัน"
                  actions={
                    <ButtonLink href="#meta-app" variant="secondary" size="sm">
                      ใส่ App Secret ใหม่
                    </ButtonLink>
                  }
                >
                  ครั้งล่าสุด {formatDateTime(status.badSignatureAt)} — คัดลอกข้อมูลลับของแอปล่าสุดจาก Meta (การตั้งค่าแอป → ข้อมูลพื้นฐาน)
                  มาวางในหัวข้อ Meta App ด้านบน (ถ้าเป็นข้อมูล Instagram ให้ตรวจ Instagram app secret ด้วย)
                </Notice>
              )}
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
                  <CopyField label="Callback URL" value={`${status.baseUrl}${WEBHOOK_PATHS.meta}`} />
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
                <FieldChips label="Instagram (ผ่านเพจ)" fields={INSTAGRAM_WEBHOOK_FIELDS} />
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
            description="Meta ต้องตรวจแอป Facebook ก่อน เพจ Facebook จึงจะตอบลูกค้าทุกคนได้ (Instagram ที่เชื่อมผ่าน Instagram Login ไม่ต้องยื่น)"
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-fg-2">
                {status.appReviewDone
                  ? "แอปผ่าน App Review และเปิด Live แล้ว เพจ Facebook ตอบได้ทุกคนที่คอมเมนต์หรือทักแชท"
                  : "ตอนนี้เพจ Facebook ตอบได้เฉพาะบัญชีที่มีชื่ออยู่ในแอป (แอดมินและ Tester) ทำขั้นนี้หลังทดสอบผ่านแล้ว Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์ — Instagram ที่เชื่อมผ่าน Instagram Login ไม่ต้องยื่น"}
              </p>
              <div className="flex flex-wrap gap-2">
                {!status.appReviewDone && (
                  <ButtonLink href="/guide#step-8" variant="secondary" className="max-sm:w-full">
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
            description="ต่อบัญชี ตามที่ Meta กำหนด — ข้อความที่เกินจะรอคิวส่งเมื่อพ้นช่วง 1 ชั่วโมง ไม่หาย"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <LimitTile
                platform="instagram"
                privateReplyPerHour={env.instagramPrivateReplyPerHour}
                dmPerHour={env.instagramDmPerHour}
              />
              <LimitTile
                platform="facebook"
                privateReplyPerHour={env.facebookPrivateReplyPerHour}
                dmPerHour={env.facebookDmPerHour}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-fg-3">
              ถ้า Meta แจ้งว่าส่งถี่เกิน ระบบจะพักแล้วส่งต่อเอง (ดูได้ในหน้ากิจกรรม) ไม่ต้องทำอะไร
            </p>
          </Card>

          <AppearanceCard />

          <Card id="password" className={SECTION} icon={<LockKeyhole />} title="เปลี่ยนรหัสผ่าน" description="รหัสผ่านที่ใช้เข้าหน้าจัดการนี้">
            <ChangePasswordForm managedByEnv={passwordFromEnv} />
          </Card>
        </div>
      </div>
    </>
  );
}
