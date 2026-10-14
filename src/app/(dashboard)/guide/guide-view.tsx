import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, LayoutDashboard, List, Plus, Settings } from "lucide-react";
import { NavTitle } from "@/components/localized";
import { CopyField } from "@/components/copy-field";
import { ActionButton } from "@/components/submit-button";
import { buttonStyle, ButtonLink, cx, Notice, PageHeader, ProgressBar } from "@/components/ui";
import { setupProgress, type SetupStatus } from "@/lib/config";
import { createT, DEFAULT_LOCALE, formatters, type Locale } from "@/lib/i18n";
import { guideMessages } from "@/lib/i18n/messages/guide";
import { navMessages } from "@/lib/i18n/messages/nav";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import type { InstagramAccount } from "@/lib/instagram/accounts";
import {
  APP_REVIEW_TEXTS,
  INSTAGRAM_LOGIN_SCOPES,
  INSTAGRAM_MESSAGE_ACCESS_MENU,
  INSTAGRAM_MESSAGE_ACCESS_MENU_EN,
  INSTAGRAM_WEBHOOK_FIELDS,
  PAGE_WEBHOOK_FIELDS,
  REQUIRED_PERMISSIONS,
  WEBHOOK_PATHS,
} from "@/lib/meta/setup-info";
import type { ConnectedPage } from "@/lib/pages";
import { setAppReviewAction } from "../settings/actions";
import { ConnectForm } from "../settings/connect-form";
import { BaseUrlForm, InstagramAppForm, MetaAppForm } from "../settings/forms";
import { InstagramConnectForm } from "../settings/instagram-connect-form";
import { InstagramAccountsList } from "../settings/instagram-list";
import { PagesList } from "../settings/pages-list";
import {
  B,
  CodeChips,
  ExtButton,
  ExtLink,
  FormPanel,
  StepCard,
  StepDot,
  SubHeading,
  SubStep,
  SubSteps,
  type StepState,
} from "./guide-parts";
import { CopyChips } from "./copy-chips";
import { instagramStepStatus } from "./instagram-step";
import { OpenStepFromHash } from "./open-step-from-hash";
import { RefreshButton } from "./refresh-button";

const LINK_CLASS = "font-medium text-accent underline-offset-2 hover:underline";

/**
 * เนื้อหาหน้าคู่มือ (รับข้อมูลสถานะเข้ามา — page.tsx เป็นคนโหลดจากฐานข้อมูล)
 * locale = ภาษาของหน้า (page.tsx อ่านจากคุกกี้ — ไม่ใส่ = ไทย) ฟอร์มจากหน้าตั้งค่าที่ฝังอยู่อ่านภาษาจาก I18nProvider เอง
 * ชื่อปุ่ม/เมนูบนเว็บ Meta ที่เป็นภาษาอังกฤษอยู่แล้ว ส่งเข้าประโยคเป็นตัวแปรตัวหนา b("Create App") (ไม่แปล)
 */
export function GuideView({
  status,
  pages,
  igAccounts,
  igHasMetaAppSecret,
  locale = DEFAULT_LOCALE,
}: {
  status: SetupStatus;
  pages: ConnectedPage[];
  /** บัญชี Instagram ที่เชื่อมผ่าน Instagram Login (ส่งต่อให้ Server Component เท่านั้น — ห้ามส่ง token ให้ Client) */
  igAccounts: InstagramAccount[];
  igHasMetaAppSecret: boolean;
  locale?: Locale;
}) {
  const t = createT(guideMessages, locale);
  const tNav = createT(navMessages, locale);
  const tRules = createT(rulesMessages, locale);
  const f = formatters(locale);
  /** ชื่อปุ่ม/เมนูบนเว็บ Meta (ตัวหนา) */
  const b = (s: ReactNode) => <B>{s}</B>;
  /** วงเล็บอธิบายเพิ่ม (สีจาง) */
  const note = (s: ReactNode) => <span className="text-fg-2">{s}</span>;
  const refreshButton = <RefreshButton doneMessage={t("refreshDone")}>{t("refresh")}</RefreshButton>;
  const useCaseFallback = note(t.rich("useCaseFallback", { other: b("Other"), business: b("Business") }));
  const activityLink = (
    <Link href="/activity" className={LINK_CLASS}>
      {tNav("activity")}
    </Link>
  );
  const igMenu = locale === "en" ? INSTAGRAM_MESSAGE_ACCESS_MENU_EN : INSTAGRAM_MESSAGE_ACCESS_MENU;

  const progress = setupProgress(status);
  const base = status.baseUrl;
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);
  const subscribedPages = pages.filter((p) => p.subscribed);
  const ig = status.instagram;
  // เสร็จเมื่อมีบัญชีที่ใช้งานได้จริง (token หมดอายุ/ใช้ไม่ได้ → ยังไม่เสร็จ และบอกให้วาง token ใหม่)
  const igWebhookOk = Boolean(ig.webhookVerifiedAt || ig.lastWebhookAt);
  const igStep = instagramStepStatus(igAccounts, undefined, igWebhookOk, locale);
  // username ของ Instagram ร้าน (ถ้ารู้จากเพจหรือบัญชีที่เชื่อมแล้ว) ใช้บอกว่าต้องเชิญบัญชีไหนเป็น Tester
  const shopIgUsername = igAccounts[0]?.username ?? pages.find((p) => p.igUsername)?.igUsername ?? null;

  // ลำดับขั้นในหน้านี้: ขั้น 1–4, 6, 7 คือ 6 ขั้นที่นับใน setupProgress
  // (ขั้น 4 ของ setupProgress นับเมื่อเพจ "หรือ" บัญชี Instagram พร้อม → ถ้าใช้แค่ Instagram ขั้น 4 ไม่บังคับ)
  // ขั้น 5 (Instagram Login) และขั้น 8 (App Review) ไม่บังคับ
  const steps: { n: number; short: string; done: boolean; optional?: boolean; optionalLabel?: string }[] = [
    { n: 1, short: t("short1"), done: Boolean(base) },
    { n: 2, short: t("short2"), done: metaReady },
    { n: 3, short: t("short3"), done: Boolean(status.webhookVerifiedAt) },
    { n: 4, short: t("short4"), done: status.pagesSubscribed > 0, optional: status.pagesSubscribed === 0 && ig.subscribed > 0 },
    { n: 5, short: t("short5"), done: igStep.done, optional: true, optionalLabel: t("ifInstagram") },
    { n: 6, short: t("short6"), done: status.ruleCount > 0 },
    { n: 7, short: t("short7"), done: Boolean(status.lastWebhookAt) },
    { n: 8, short: t("short8"), done: status.appReviewDone, optional: true },
  ];
  // ขั้นต่อไป = ขั้นแรกที่ยังไม่เสร็จ (ถ้าขั้นบังคับครบแล้ว ชี้ไปที่ App Review)
  const current = steps.find((s) => !s.done && !s.optional) ?? steps.find((s) => !s.done);
  const stateOf = (n: number): StepState => {
    const s = steps[n - 1];
    if (s.done) return "done";
    if (s.n === current?.n) return "current";
    return s.optional ? "optional" : "todo";
  };
  const complete = progress.done >= progress.total;
  const remaining = progress.total - progress.done;

  return (
    <>
      <OpenStepFromHash />
      <PageHeader
        title={<NavTitle name="guide" />}
        description={t("description")}
        actions={
          <ButtonLink href="/settings" variant="secondary" icon={<Settings />} className="max-sm:hidden">
            {t("goToSettings")}
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px] lg:items-start lg:gap-8">
        {/* ความคืบหน้า: มือถืออยู่บนสุด เดสก์ท็อปอยู่ด้านขวาและติดอยู่กับที่ */}
        <aside aria-label={t("progressLabel")} className="lg:sticky lg:top-10 lg:col-start-2 lg:row-start-1">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]",
                  complete ? "bg-good-soft text-good-text" : "bg-accent-soft text-accent",
                )}
                aria-hidden
              >
                {complete ? <CircleCheck /> : <List />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base leading-6 font-semibold text-fg tabular">
                  {t("progressDone", { done: progress.done, total: progress.total })}
                </p>
                <p className="text-sm leading-6 text-fg-2">
                  {complete ? t("progressComplete") : t("progressRemaining", { count: remaining })}
                </p>
              </div>
            </div>
            <ProgressBar
              value={progress.done}
              max={progress.total}
              tone={complete ? "good" : "accent"}
              label={t("progressBar", { done: progress.done, total: progress.total })}
              className="mt-4"
            />

            {/* มือถือ: ปุ่มไปขั้นต่อไป */}
            {current && !complete && current.n > 1 && (
              <a href={`#step-${current.n}`} className={cx(buttonStyle("secondary", "md", { block: true }), "mt-4 lg:hidden")}>
                {t("goToStep", { n: current.n, step: current.short })}
                <ArrowRight aria-hidden />
              </a>
            )}

            {/* เดสก์ท็อป: รายการขั้นทั้งหมด */}
            <ol className="mt-5 hidden space-y-1 border-t border-line pt-4 lg:block">
              {steps.map((s, i) => {
                const state = stateOf(s.n);
                return (
                  <li key={s.n} className="relative">
                    {/* เส้นเชื่อมไปวงกลมของขั้นถัดไป (แถวที่มีป้ายไม่บังคับสูงกว่าแถวอื่น → ใช้ระยะจากขอบล่าง) */}
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={cx("absolute top-[30px] -bottom-2.5 left-[19.5px] w-px", s.done ? "bg-good/50" : "bg-line-strong/70")}
                      />
                    )}
                    <a
                      href={`#step-${s.n}`}
                      aria-current={state === "current" ? "step" : undefined}
                      className={cx(
                        "relative flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        state === "current" ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <StepDot n={s.n} state={state} size="sm" />
                      <span className="min-w-0 flex-1 pt-0.5 leading-5">
                        <span className={cx("block truncate", s.done && "text-fg-3")}>{s.short}</span>
                        {s.optional && (
                          <span className="block text-xs font-normal text-fg-3">{s.optionalLabel ?? t("optional")}</span>
                        )}
                      </span>
                      <span className="sr-only">{s.done ? t("srDone") : state === "current" ? t("srCurrent") : ""}</span>
                    </a>
                  </li>
                );
              })}
            </ol>

            {complete && (
              <ButtonLink href="/" variant="primary" block icon={<LayoutDashboard />} className="mt-4">
                {t("goToDashboard")}
              </ButtonLink>
            )}
          </div>
        </aside>

        <ol className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          {/* ---------- ขั้นที่ 1 ---------- */}
          <StepCard
            n={1}
            state={stateOf(1)}
            title={base ? t("s1TitleDone") : t("s1Title")}
            summary={base ? base : t("s1Summary")}
            locale={locale}
          >
            {base ? (
              <>
                <p>{t("s1Saved")}</p>
                <CopyField value={base} />
              </>
            ) : (
              <>
                <p>{t("s1Missing")}</p>
                <FormPanel title={t("s1Form")}>
                  <BaseUrlForm baseUrl={null} />
                </FormPanel>
              </>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 2 ---------- */}
          <StepCard
            n={2}
            state={stateOf(2)}
            title={t("s2Title")}
            summary={metaReady ? t("s2SummaryDone", { appId: status.meta.appId ?? "" }) : t("s2Summary")}
            locale={locale}
          >
            <p>{t("s2Intro")}</p>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  {t.rich("s2Open", {
                    link: (
                      <ExtLink href="https://developers.facebook.com/apps" locale={locale}>
                        developers.facebook.com/apps
                      </ExtLink>
                    ),
                    note: note(t("s2OpenNote")),
                  })}
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>{t.rich("s2Create", { createApp: b("Create App") })}</p>
              </SubStep>
              <SubStep n={3}>
                <p>{t.rich("s2UseCase", { messenger: b("Messenger"), instagram: b("Instagram"), note: useCaseFallback })}</p>
              </SubStep>
              <SubStep n={4}>
                <p>{t("s2Portfolio")}</p>
              </SubStep>
              <SubStep n={5}>
                <p>
                  {t.rich("s2Basic", {
                    basic: b("App settings → Basic"),
                    appId: b("App ID"),
                    show: b("Show"),
                    appSecret: b("App secret"),
                  })}
                </p>
              </SubStep>
              <SubStep n={6}>
                <p>
                  {t.rich("s2Links", {
                    privacy: b("Privacy policy URL"),
                    deletion: b("User data deletion"),
                    save: b("Save changes"),
                  })}
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Privacy policy URL" value={`${base}/privacy`} />
                    <CopyField label="User data deletion URL" value={`${base}/data-deletion`} />
                  </div>
                ) : (
                  <Notice tone="warning">{t("needStep1Links")}</Notice>
                )}
              </SubStep>
            </SubSteps>
            <FormPanel title={t("s2Form")} description={t("s2FormHint")}>
              <MetaAppForm appId={status.meta.appId} hasSecret={Boolean(status.meta.appSecret)} fromEnv={status.meta.fromEnv} />
            </FormPanel>
          </StepCard>

          {/* ---------- ขั้นที่ 3 ---------- */}
          <StepCard
            n={3}
            state={stateOf(3)}
            title={t("s3Title")}
            summary={status.webhookVerifiedAt ? t("s3Verified", { date: f.dateTime(status.webhookVerifiedAt) }) : t("s3Summary")}
            locale={locale}
          >
            {!metaReady && <Notice tone="warning">{t("needStep2")}</Notice>}
            <SubSteps>
              <SubStep n={1}>
                <p>{t.rich("s3Find", { webhooks: b("Webhooks"), addProduct: b("Add product") })}</p>
                <p className="text-xs leading-5 text-fg-3">{t("s3FindHint")}</p>
              </SubStep>
              <SubStep n={2}>
                <p>{t.rich("s3Object", { page: b("Page"), subscribe: b("Subscribe to this object") })}</p>
              </SubStep>
              <SubStep n={3}>
                <p>{t.rich("s3Paste", { verify: b("Verify and save") })}</p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Callback URL" value={`${base}${WEBHOOK_PATHS.meta}`} />
                    <CopyField label="Verify token" value={status.meta.verifyToken} />
                  </div>
                ) : (
                  <Notice tone="warning">{t("needStep1")}</Notice>
                )}
              </SubStep>
              <SubStep n={4}>
                <p>{t.rich("s3Fields", { subscribe: b("Subscribe") })}</p>
                <CodeChips items={PAGE_WEBHOOK_FIELDS} />
              </SubStep>
              <SubStep n={5}>
                <p>{t.rich("s3Instagram", { instagram: b("Instagram") })}</p>
                <CodeChips items={INSTAGRAM_WEBHOOK_FIELDS} />
                <p className="text-xs leading-5 text-fg-3">{t("s3InstagramHint")}</p>
              </SubStep>
            </SubSteps>
            {status.webhookVerifiedAt ? (
              <Notice tone="good">{t("s3Verified", { date: f.dateTime(status.webhookVerifiedAt) })}</Notice>
            ) : (
              <Notice tone="neutral" actions={refreshButton}>
                {t("s3Waiting")}
              </Notice>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 4 ---------- */}
          <StepCard
            n={4}
            state={stateOf(4)}
            title={t("s4Title")}
            summary={
              subscribedPages.length > 0
                ? t("s4Connected", { pages: subscribedPages.map((p) => p.name).join(", ") })
                : steps[3].optional
                  ? t("s4SummaryOptional")
                  : t("s4Summary")
            }
            optionalLabel={steps[3].optional ? t("optional") : undefined}
            locale={locale}
          >
            <SubSteps>
              <SubStep n={1}>
                <p>{t("s4Explorer")}</p>
                <ExtButton href="https://developers.facebook.com/tools/explorer/" locale={locale}>
                  {t("s4ExplorerButton")}
                </ExtButton>
              </SubStep>
              <SubStep n={2}>
                <p>{t.rich("s4App", { metaApp: b("Meta App"), userOrPage: b("User or Page"), userToken: b("User Token") })}</p>
              </SubStep>
              <SubStep n={3}>
                <p>
                  {t.rich("s4Permissions", {
                    permissions: b("Permissions"),
                    addPermission: b("Add a Permission"),
                    count: REQUIRED_PERMISSIONS.length,
                  })}
                </p>
                <CopyChips
                  items={REQUIRED_PERMISSIONS}
                  allLabel={t("copyAll")}
                  listLabel={t("copyChipsLabel")}
                  copiedAllMessage={t("copiedAll", { count: REQUIRED_PERMISSIONS.length })}
                />
              </SubStep>
              <SubStep n={4}>
                <p>
                  {t.rich("s4Generate", {
                    generate: b("Generate Access Token"),
                    pickPage: b(t("s4PickPage")),
                    note: note(t("s4PickPageNote")),
                  })}
                </p>
              </SubStep>
              <SubStep n={5}>
                <p>{t.rich("s4CopyToken", { accessToken: b("Access Token") })}</p>
              </SubStep>
            </SubSteps>
            {!metaReady && <Notice tone="warning">{t("s4NeedMeta")}</Notice>}
            <FormPanel id="connect" title={t("s4Form")}>
              <ConnectForm inGuide connectedIds={pages.map((p) => p.id)} />
            </FormPanel>
            {pages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">{t("s4ConnectedPages")}</p>
                <PagesList pages={pages} inset igLoginIds={igAccounts.map((a) => a.id)} />
              </div>
            )}
            <Notice tone="neutral">{t.rich("s4InstagramNote", { note: note(t("s4InstagramNoteDetail")) })}</Notice>
          </StepCard>

          {/* ---------- ขั้นที่ 5 (ถ้าใช้ Instagram) ---------- */}
          <StepCard
            n={5}
            state={stateOf(5)}
            title={t("s5Title")}
            optionalLabel={t("ifInstagram")}
            summary={igStep.summary}
            locale={locale}
          >
            <p>{t("s5Intro")}</p>
            <Notice tone="accent" title={t("s5CheckTitle")}>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>{t.rich("s5CheckAccount", { professional: b(t("s5Professional")), public: b(t("s5Public")) })}</li>
                <li>
                  {t.rich("s5AllowMessages", {
                    // โปรไฟล์ → ☰ → เมนูตัวหนา (ชุดเดียวกับคำอธิบาย error 2534041 ในหน้ากิจกรรม)
                    path: igMenu.map((m, i) => (
                      <Fragment key={m}>
                        {i > 1 ? <B>{m}</B> : m}
                        {" → "}
                      </Fragment>
                    )),
                    setting: b(t("s5AllowSetting")),
                    note: <span className="text-fg-3">{t("s5MenuNote")}</span>,
                  })}
                </li>
              </ol>
            </Notice>

            <SubHeading>{t("s5PartA")}</SubHeading>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  {t.rich("s5CreateApp", {
                    link: (
                      <ExtLink href="https://developers.facebook.com/apps" locale={locale}>
                        developers.facebook.com/apps
                      </ExtLink>
                    ),
                    createApp: b("Create app"),
                    useCase: b("Manage messaging & content on Instagram"),
                    note: useCaseFallback,
                  })}
                </p>
                <p>
                  {t.rich("s5AppName", {
                    rule: b(t("s5AppNameRule")),
                    noPortfolio: b("I don't want to connect a business portfolio yet"),
                    create: b("Create"),
                  })}
                </p>
                <p className="text-xs leading-5 text-fg-3">{t("s5AppHint")}</p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  {t.rich("s5Basic", {
                    basic: b("App settings → Basic"),
                    privacy: b("Privacy policy URL"),
                    deletion: b("User data deletion"),
                    icon: b("App icon"),
                    iconNote: note(t("s5IconNote")),
                    category: b("Category"),
                    save: b("Save changes"),
                  })}
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Privacy policy URL" value={`${base}/privacy`} />
                    <CopyField label="User data deletion URL" value={`${base}/data-deletion`} />
                  </div>
                ) : (
                  <Notice tone="warning">{t("needStep1Links")}</Notice>
                )}
              </SubStep>
              <SubStep n={3}>
                <p>
                  {t.rich("s5UseCases", {
                    useCases: b("Use cases"),
                    customize: b("Customize"),
                    igLogin: b("API setup with Instagram login"),
                    note: note(t("s5UseCasesNote")),
                    addRequired: b("Add required messaging permissions"),
                    addAll: b("Add all required permissions"),
                  })}
                </p>
                {/* ปุ่ม Add all required permissions เพิ่มให้ครบในครั้งเดียว — รายการนี้ไว้ตรวจว่าครบ (ชื่อยาว จึงไม่ใช้ปุ่มคัดลอก) */}
                <CodeChips items={INSTAGRAM_LOGIN_SCOPES} />
              </SubStep>
              <SubStep n={4}>
                <p>{t("s5Secrets")}</p>
                <ol className="list-[lower-alpha] space-y-1 pl-5">
                  <li>{t.rich("s5SecretFirst", { igSecret: b("Instagram app secret"), show: b("Show") })}</li>
                  <li>
                    {t.rich("s5SecretSecond", {
                      basic: b("App settings → Basic"),
                      appSecret: b("App secret"),
                      show: b("Show"),
                      note: note(t("s5SecretSecondNote")),
                    })}
                  </li>
                </ol>
                <FormPanel id="instagram-app" title={t("s5SecretsForm")}>
                  <InstagramAppForm separateApp hasSecret={ig.appSecretSet} hasMetaAppSecret={igHasMetaAppSecret} fromEnv={ig.fromEnv} />
                </FormPanel>
              </SubStep>
            </SubSteps>

            <SubHeading>{t("s5PartB")}</SubHeading>
            <SubSteps start={5}>
              <SubStep n={5}>
                <p>
                  {t.rich("s5Testers", {
                    roles: b("App roles → Roles"),
                    testers: b("Instagram Testers"),
                    addTesters: b("Add Instagram Testers"),
                    username: shopIgUsername ? ` (@${shopIgUsername})` : "",
                    note: note(t("s5TestersNote")),
                  })}
                </p>
              </SubStep>
              <SubStep n={6}>
                <p>
                  {t.rich("s5Accept", {
                    onComputer: b(t("s5AcceptOnComputer")),
                    link: (
                      <ExtLink href="https://www.instagram.com/accounts/manage_access/" locale={locale}>
                        instagram.com/accounts/manage_access
                      </ExtLink>
                    ),
                    invites: b("Tester invites"),
                    accept: b("Accept"),
                    note: note(t("s5AcceptNote")),
                  })}
                </p>
                <p className="text-xs leading-5 text-fg-3">{t("s5AcceptHint")}</p>
              </SubStep>
              <SubStep n={7} id="step-5-token">
                <p>
                  {t.rich("s5Token", {
                    generateTokens: b("Generate access tokens"),
                    addAccount: b("Add account"),
                    shopAccount: b(t("s5TokenShop")),
                    generateToken: b("Generate token"),
                  })}
                </p>
                <FormPanel id="connect-instagram" title={t("s5TokenForm")}>
                  <div className="space-y-4">
                    <InstagramConnectForm inGuide hasAppSecret={ig.appSecretSet} />
                    {igAccounts.length > 0 && <InstagramAccountsList accounts={igAccounts} pages={pages} inset />}
                  </div>
                </FormPanel>
                <p className="text-xs leading-5 text-fg-3">{t("s5TokenHint")}</p>
              </SubStep>
            </SubSteps>

            <SubHeading>{t("s5PartC")}</SubHeading>
            <SubSteps start={8}>
              <SubStep n={8} id="step-5-webhook">
                <p>
                  {t.rich("s5Webhook", {
                    configureWebhooks: b("Configure webhooks"),
                    configure: b("Configure"),
                    verify: b("Verify and save"),
                  })}
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label={t("s5CallbackLabel")} value={`${base}${WEBHOOK_PATHS.instagram}`} />
                    <CopyField label="Verify token" value={status.meta.verifyToken} />
                  </div>
                ) : (
                  <Notice tone="warning">{t("needStep1")}</Notice>
                )}
                <p className="text-xs leading-5 text-fg-3">{t("s5WebhookHint")}</p>
              </SubStep>
              <SubStep n={9}>
                <p>{t.rich("s5Fields", { manage: b("Manage"), subscribed: b("Subscribed"), note: note(t("s5FieldsNote")) })}</p>
                <CodeChips items={INSTAGRAM_WEBHOOK_FIELDS} />
              </SubStep>
              <SubStep n={10}>
                <p>
                  {t.rich("s5Skip", {
                    businessLogin: b("Set up Instagram business login"),
                    appReview: b("Complete app review"),
                    note: note(t("s5SkipNote")),
                  })}
                </p>
              </SubStep>
              <SubStep n={11}>
                <p>
                  {t.rich("s5Publish", {
                    publishMenu: b(t("metaPublish")),
                    publishButton: b(t("metaPublish")),
                    note: note(t.rich("s5PublishNote", { live: b(t("s5PublishLive")) })),
                  })}
                </p>
              </SubStep>
            </SubSteps>
            {ig.badSignatureAt && (
              <Notice tone="critical" title={t("s5BadSigTitle")} actions={refreshButton}>
                {t("s5BadSig", { date: f.dateTime(ig.badSignatureAt) })}
              </Notice>
            )}
            {igWebhookOk ? (
              <Notice tone="good">
                {ig.lastWebhookAt ? t("s5WebhookOkLast", { date: f.dateTime(ig.lastWebhookAt) }) : t("s5WebhookOk")}
              </Notice>
            ) : (
              <Notice tone="neutral" actions={refreshButton}>
                {t("s5WebhookWaiting")}
              </Notice>
            )}

            <SubHeading>{t("s5PartD")}</SubHeading>
            <SubSteps start={12}>
              <SubStep n={12}>
                <p>{t.rich("s5Test", { noRole: b(t("s5TestNoRole")), activity: activityLink })}</p>
                <ol className="list-decimal space-y-1 pl-5 text-fg-2">
                  <li>
                    {t.rich("s5TestComment", { note: <span className="text-fg-3">{t("s5TestCommentNote")}</span> })}
                  </li>
                  <li>{t("s5TestReply")}</li>
                  <li>{t("s5TestButton")}</li>
                </ol>
                <p className="text-xs leading-5 text-fg-3">{t("s5TestHint")}</p>
              </SubStep>
            </SubSteps>

            <details className="group/same rounded-lg border border-line bg-surface">
              <summary className="flex min-h-11 list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{t("s5SameAppQuestion")}</span>
                <ArrowRight className="size-4 text-fg-3 transition-transform group-open/same:rotate-90" aria-hidden />
              </summary>
              <p className="border-t border-line px-4 py-3 text-sm leading-6 text-fg-2">{t("s5SameAppAnswer")}</p>
            </details>
          </StepCard>

          {/* ---------- ขั้นที่ 6 ---------- */}
          <StepCard
            n={6}
            state={stateOf(6)}
            title={t("s6Title")}
            summary={status.ruleCount > 0 ? t("s6SummaryDone", { count: status.ruleCount }) : t("s6Summary")}
            locale={locale}
          >
            <p>{t("s6Intro")}</p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/rules/new" icon={<Plus />} className="max-sm:w-full">
                {tRules("newAutomation")}
              </ButtonLink>
              {status.ruleCount > 0 && (
                <ButtonLink href="/rules" variant="secondary" className="max-sm:w-full">
                  {t("s6SeeAll")}
                </ButtonLink>
              )}
            </div>
          </StepCard>

          {/* ---------- ขั้นที่ 7 ---------- */}
          <StepCard
            n={7}
            state={stateOf(7)}
            title={t("s7Title")}
            summary={status.lastWebhookAt ? t("s7SummaryDone", { date: f.dateTime(status.lastWebhookAt) }) : t("s7Summary")}
            locale={locale}
          >
            <Notice tone="warning" title={t("s7LiveTitle")}>
              {t.rich("s7Live", {
                modeSwitch: b(t("metaModeSwitch")),
                live: b(t("metaLive")),
                note: note(t("s7LiveNote")),
                note2: note(t("s7LiveBoth")),
              })}
            </Notice>
            <SubSteps>
              <SubStep n={1}>
                <p>{t.rich("s7Tester", { roles: b("App roles → Roles"), tester: b("Tester"), note: note(t("s7TesterNote")) })}</p>
              </SubStep>
              <SubStep n={2}>
                <p>{t("s7Comment")}</p>
              </SubStep>
              <SubStep n={3}>
                <p>{t.rich("s7Check", { activity: activityLink })}</p>
              </SubStep>
            </SubSteps>
            {status.badSignatureAt ? (
              <Notice tone="critical" title={t("s7BadSigTitle")} actions={refreshButton}>
                {t.rich("s7BadSig", {
                  date: f.dateTime(status.badSignatureAt),
                  reset: b(t("metaReset")),
                  basic: b(t("metaBasic")),
                  secret: b(t("metaAppSecret")),
                  settingsLink: (
                    <Link href="/settings#meta-app" className={LINK_CLASS}>
                      {t("s7SettingsMetaApp")}
                    </Link>
                  ),
                })}
              </Notice>
            ) : status.lastWebhookAt ? (
              <Notice tone="good">{t("s7Ok", { date: f.dateTime(status.lastWebhookAt) })}</Notice>
            ) : (
              <Notice tone="neutral" title={t("s7NoDataTitle")} actions={refreshButton}>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>{t.rich("s7NoDataLive", { live: b(t("metaLive")) })}</li>
                  <li>
                    {t.rich("s7NoDataTest", { page: b("Page"), test: b(t("metaTest")), feed: b("feed"), refresh: t("refresh") })}
                  </li>
                  <li>{t("s7NoDataSubscribe")}</li>
                  <li>
                    {t.rich("s7NoDataInstagram", {
                      link: (
                        <Link href="/settings#instagram" className={LINK_CLASS}>
                          {t("s7SettingsInstagram")}
                        </Link>
                      ),
                    })}
                  </li>
                </ol>
              </Notice>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 8 (ไม่บังคับ) ---------- */}
          <StepCard
            n={8}
            state={stateOf(8)}
            title={t("s8Title")}
            summary={status.appReviewDone ? t("s8SummaryDone") : t("s8Summary")}
            locale={locale}
          >
            <p>{t("s8Intro")}</p>
            <p className="text-xs leading-5 text-fg-3">{t("s8FacebookOnly")}</p>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  {t.rich("s8Verify", {
                    verify: b(t("s8VerifyLabel")),
                    link: (
                      <ExtLink href="https://business.facebook.com/settings" locale={locale}>
                        Business settings
                      </ExtLink>
                    ),
                    note: note(t("s8VerifyNote")),
                  })}
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  {t.rich("s8Access", { menu: b("App Review → Permissions and Features"), request: b("Request advanced access") })}
                </p>
              </SubStep>
              <SubStep n={3}>
                <p>{t("s8Video")}</p>
              </SubStep>
              <SubStep n={4}>
                <p>{t("s8Describe")}</p>
                <details className="group/texts rounded-lg border border-line bg-surface">
                  <summary className="flex list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{t("s8Examples")}</span>
                    <span className="text-xs font-normal text-fg-3 tabular">{t("s8ExamplesCount", { count: APP_REVIEW_TEXTS.length })}</span>
                    <ArrowRight className="size-4 text-fg-3 transition-transform group-open/texts:rotate-90" aria-hidden />
                  </summary>
                  <div className="space-y-3 border-t border-line p-4">
                    {APP_REVIEW_TEXTS.map((r) => (
                      <CopyField key={r.permission} label={r.permission} value={r.text} />
                    ))}
                  </div>
                </details>
              </SubStep>
              <SubStep n={5}>
                <p>{t.rich("s8Live", { live: b(t("metaLive")) })}</p>
              </SubStep>
            </SubSteps>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <ActionButton
                action={setAppReviewAction}
                fields={{ done: status.appReviewDone ? "0" : "1" }}
                variant={status.appReviewDone ? "ghost" : "secondary"}
                icon={status.appReviewDone ? undefined : <CircleCheck />}
                successMessage={status.appReviewDone ? t("s8MarkedUndo") : t("s8MarkedDone")}
                className="max-sm:w-full"
              >
                {status.appReviewDone ? t("s8MarkUndo") : t("s8MarkDone")}
              </ActionButton>
              <p className="text-xs leading-5 text-fg-3">{t("s8MarkHint")}</p>
            </div>
          </StepCard>
        </ol>
      </div>
    </>
  );
}
