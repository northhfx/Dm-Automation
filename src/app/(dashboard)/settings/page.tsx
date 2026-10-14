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
import { Badge, ButtonLink, Card, cx, Notice, PageHeader, PlatformIcon } from "@/components/ui";
import { getInstagramConfig, getSetupStatus, setupProgress } from "@/lib/config";
import { env } from "@/lib/env";
import type { MessageKey, TFunction } from "@/lib/i18n/core";
import type { Formatters } from "@/lib/i18n/format";
import type { settingsMessages } from "@/lib/i18n/messages/settings";
import { getFormat, getT } from "@/lib/i18n/server";
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

type SettingsT = TFunction<MessageKey<typeof settingsMessages>>;

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

/** ยังไม่มีที่อยู่เว็บ → สร้าง Callback URL ไม่ได้ ชี้ไปการ์ด "ที่อยู่เว็บ" */
function NeedBaseUrl({ t }: { t: SettingsT }) {
  return (
    <Notice tone="warning">
      {t.rich("needBaseUrl", {
        link: (
          <a href="#url" className="font-medium underline">
            {t("needBaseUrlLink")}
          </a>
        ),
      })}
    </Notice>
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
  t,
  f,
}: {
  platform: "facebook" | "instagram";
  privateReplyPerHour: number;
  dmPerHour: number;
  t: SettingsT;
  f: Formatters;
}) {
  const rows = [
    { label: t("limitPrivateReply"), perHour: privateReplyPerHour },
    { label: t("limitDm"), perHour: dmPerHour },
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
                    {f.number(r.perHour)} <span className="font-normal text-fg-2">{t("perHour")}</span>
                  </>
                ) : (
                  t("unlimited")
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
  const [pages, status, igAccounts, igConfig, t, tNav, tAppearance, f] = await Promise.all([
    listConnectedPages(db),
    getSetupStatus(db),
    listInstagramAccounts(db),
    getInstagramConfig(db),
    getT("settings"),
    getT("nav"),
    getT("appearance"),
    getFormat(),
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
    { id: "pages", label: t("pagesTitle"), icon: <Store />, group: t("groupPages"), status: pagesNeedFix ? "attention" : undefined },
    { id: "connect", label: t("connectTitle"), icon: <Plug />, group: t("groupPages") },
    {
      id: "instagram",
      label: t("igTitle"),
      icon: <PlatformIcon platform="instagram" variant="mono" />,
      group: "Instagram",
      status: igNeedsFix ? "attention" : undefined,
    },
    { id: "instagram-app", label: "Instagram App", icon: <KeyRound />, group: "Instagram", status: ig.appSecretSet ? undefined : "attention" },
    {
      id: "instagram-webhook",
      label: t("igWebhookTitle"),
      icon: <Webhook />,
      group: "Instagram",
      status: !igWebhookOk || ig.badSignatureAt ? "attention" : undefined,
    },
    { id: "meta-app", label: "Meta App", icon: <KeyRound />, group: "Meta", status: metaReady ? undefined : "attention" },
    { id: "webhook", label: "Webhook", icon: <Webhook />, group: "Meta", status: status.webhookVerifiedAt ? undefined : "attention" },
    { id: "app-review", label: "App Review", icon: <ShieldCheck />, group: "Meta" },
    { id: "url", label: t("urlTitle"), icon: <Globe />, group: t("groupSystem"), status: status.baseUrl ? undefined : "attention" },
    { id: "limits", label: t("limitsTitle"), icon: <Gauge />, group: t("groupSystem") },
    { id: "appearance", label: tAppearance("title"), icon: <SunMoon />, group: t("groupSystem") },
    { id: "password", label: t("navPassword"), icon: <LockKeyhole />, group: t("groupSystem") },
  ];

  return (
    <>
      <PageHeader
        title={<NavTitle name="settings" />}
        description={
          setupDone
            ? t("headerDescription")
            : t.rich("headerFirstTime", {
                guide: (
                  <Link href="/guide" className="font-medium text-accent hover:underline">
                    {tNav("guide")}
                  </Link>
                ),
              })
        }
        actions={
          <ButtonLink href="/guide" variant="secondary" icon={<BookOpenCheck />} className="max-sm:hidden">
            {tNav("guide")}
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
            title={t("pagesTitle")}
            description={t("pagesDescription")}
            padding="none"
          >
            <PagesList pages={pages} igLoginIds={igAccounts.map((a) => a.id)} />
          </Card>

          <Card
            id="connect"
            className={SECTION}
            icon={<Plug />}
            title={t("connectTitle")}
            description={t("connectDescription")}
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
                      {t("igNotConnected")}
                    </Badge>
                  ) : igReady ? (
                    <Badge tone="good" dot>
                      {t("statusReady")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      {t("statusAttention")}
                    </Badge>
                  )
                }
              >
                {t("igTitle")}
              </Titled>
            }
            description={t("igDescription")}
            padding="none"
          >
            <InstagramAccountsList accounts={igAccounts} pages={pages} />
            <p className="flex items-start gap-2 border-t border-line bg-surface-2/40 px-5 py-3 text-xs leading-5 text-fg-2">
              <Gauge className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden />
              <span>{t("igLimitsNote")}</span>
            </p>
            <div id="connect-instagram" className={cx("space-y-4 border-t border-line p-5", SECTION)}>
              <div>
                <p className="text-sm leading-6 font-semibold text-fg">
                  {igAccounts.length ? t("igConnectTitleMore") : t("igConnectTitleFirst")}
                </p>
                <p className="text-xs leading-5 text-fg-3">{t("igConnectHint")}</p>
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
                      {t("badgeSaved")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      {t("badgeIncomplete")}
                    </Badge>
                  )
                }
              >
                Instagram App
              </Titled>
            }
            description={t("igAppDescription")}
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
                      {t("badgeVerified")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      {t("badgeNotVerified")}
                    </Badge>
                  )
                }
              >
                {t("igWebhookTitle")}
              </Titled>
            }
            description={t("igWebhookDescription")}
          >
            <div className="space-y-5">
              {ig.badSignatureAt && (
                <Notice
                  tone="critical"
                  title={t("igBadSignatureTitle")}
                  actions={
                    <ButtonLink href="#instagram-app" variant="secondary" size="sm">
                      {t("igBadSignatureAction")}
                    </ButtonLink>
                  }
                >
                  {t("igBadSignatureBody", { time: f.dateTime(ig.badSignatureAt) })}
                </Notice>
              )}
              {!igWebhookOk && (
                <Notice
                  tone="warning"
                  title={t("igNotVerifiedTitle")}
                  actions={
                    <ButtonLink href="/guide#step-5-webhook" variant="secondary" size="sm">
                      {t("seeHow")}
                    </ButtonLink>
                  }
                >
                  {t("igNotVerifiedBody")}
                </Notice>
              )}
              <div className="grid gap-4">
                {status.baseUrl ? (
                  <CopyField label="Callback URL" value={`${status.baseUrl}${WEBHOOK_PATHS.instagram}`} />
                ) : (
                  <NeedBaseUrl t={t} />
                )}
                <CopyField label="Verify token" value={status.meta.verifyToken} />
              </div>
              <div className="space-y-3 rounded-lg border border-line p-4">
                <p className="text-sm font-medium text-fg">{t("fieldsToSubscribe")}</p>
                <FieldChips label="Instagram" fields={INSTAGRAM_WEBHOOK_FIELDS} />
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">{t("verifiedAtLabel")}</dt>
                  <dd className="text-right font-medium text-fg tabular sm:text-left">
                    {ig.webhookVerifiedAt ? f.dateTime(ig.webhookVerifiedAt) : t("notVerifiedYet")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">{t("igLastWebhookLabel")}</dt>
                  <dd className="text-right font-medium text-fg tabular sm:text-left">
                    {ig.lastWebhookAt ? f.dateTime(ig.lastWebhookAt) : t("neverReceived")}
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
                      {t("badgeSaved")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      {t("badgeIncomplete")}
                    </Badge>
                  )
                }
              >
                Meta App
              </Titled>
            }
            description={t.rich("metaAppDescription", {
              link: (
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
                >
                  developers.facebook.com
                  <ArrowUpRight className="size-3.5" aria-hidden />
                  <span className="sr-only">{t("opensNewTab")}</span>
                </a>
              ),
            })}
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
                      {t("badgeVerified")}
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      {t("badgeNotVerified")}
                    </Badge>
                  )
                }
              >
                Webhook
              </Titled>
            }
            description={t("webhookDescription")}
          >
            <div className="space-y-5">
              {status.badSignatureAt && (
                <Notice
                  tone="critical"
                  title={t("badSignatureTitle")}
                  actions={
                    <ButtonLink href="#meta-app" variant="secondary" size="sm">
                      {t("badSignatureAction")}
                    </ButtonLink>
                  }
                >
                  {t("badSignatureBody", { time: f.dateTime(status.badSignatureAt) })}
                </Notice>
              )}
              {!status.webhookVerifiedAt && (
                <Notice
                  tone="warning"
                  title={t("notVerifiedTitle")}
                  actions={
                    <ButtonLink href="/guide#step-3" variant="secondary" size="sm">
                      {t("seeHow")}
                    </ButtonLink>
                  }
                >
                  {t("notVerifiedBody")}
                </Notice>
              )}
              <div className="grid gap-4">
                {status.baseUrl ? (
                  <CopyField label="Callback URL" value={`${status.baseUrl}${WEBHOOK_PATHS.meta}`} />
                ) : (
                  <NeedBaseUrl t={t} />
                )}
                <CopyField label="Verify token" value={status.meta.verifyToken} />
              </div>
              <div className="space-y-3 rounded-lg border border-line p-4">
                <p className="text-sm font-medium text-fg">{t("fieldsToSubscribe")}</p>
                <FieldChips label="Page" fields={PAGE_WEBHOOK_FIELDS} />
                <FieldChips label={t("fieldsIgViaPage")} fields={INSTAGRAM_WEBHOOK_FIELDS} />
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">{t("verifiedAtLabel")}</dt>
                  <dd className="font-medium text-fg tabular">
                    {status.webhookVerifiedAt ? f.dateTime(status.webhookVerifiedAt) : t("notVerifiedYet")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-fg-2">{t("lastWebhookLabel")}</dt>
                  <dd className="font-medium text-fg tabular">{status.lastWebhookAt ? f.dateTime(status.lastWebhookAt) : t("neverReceived")}</dd>
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
                      {t("reviewLive")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      {t("reviewTestMode")}
                    </Badge>
                  )
                }
              >
                {t("reviewTitle")}
              </Titled>
            }
            description={t("reviewDescription")}
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-fg-2">{status.appReviewDone ? t("reviewDoneBody") : t("reviewPendingBody")}</p>
              <div className="flex flex-wrap gap-2">
                {!status.appReviewDone && (
                  <ButtonLink href="/guide#step-8" variant="secondary" className="max-sm:w-full">
                    {t("reviewHowTo")}
                  </ButtonLink>
                )}
                <ActionButton
                  action={setAppReviewAction}
                  fields={{ done: status.appReviewDone ? "0" : "1" }}
                  variant={status.appReviewDone ? "ghost" : "secondary"}
                  successMessage={status.appReviewDone ? t("reviewUnmarked") : t("reviewMarked")}
                  className="max-sm:w-full"
                >
                  {status.appReviewDone ? t("reviewUnmark") : t("reviewMark")}
                </ActionButton>
              </div>
            </div>
          </Card>

          <Card
            id="url"
            className={SECTION}
            icon={<Globe />}
            title={t("urlTitle")}
            description={t("urlDescription")}
          >
            {urlFromHost && status.baseUrl ? (
              <div className="space-y-2">
                <CopyField value={status.baseUrl} />
                <p className="text-xs text-fg-3">{t("urlFromHost")}</p>
              </div>
            ) : (
              <BaseUrlForm baseUrl={status.baseUrl} />
            )}
          </Card>

          <Card
            id="limits"
            className={SECTION}
            icon={<Gauge />}
            title={t("limitsTitle")}
            description={t("limitsDescription")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <LimitTile
                platform="instagram"
                privateReplyPerHour={env.instagramPrivateReplyPerHour}
                dmPerHour={env.instagramDmPerHour}
                t={t}
                f={f}
              />
              <LimitTile
                platform="facebook"
                privateReplyPerHour={env.facebookPrivateReplyPerHour}
                dmPerHour={env.facebookDmPerHour}
                t={t}
                f={f}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-fg-3">{t("limitsFooter")}</p>
          </Card>

          <AppearanceCard />

          <Card
            id="password"
            className={SECTION}
            icon={<LockKeyhole />}
            title={t("passwordTitle")}
            description={t("passwordDescription")}
          >
            <ChangePasswordForm managedByEnv={passwordFromEnv} />
          </Card>
        </div>
      </div>
    </>
  );
}
