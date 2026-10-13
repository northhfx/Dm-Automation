import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, LayoutDashboard, List, Plus, Settings } from "lucide-react";
import { CopyField } from "@/components/copy-field";
import { ActionButton } from "@/components/submit-button";
import { buttonStyle, ButtonLink, cx, formatDateTime, formatNumber, Notice, PageHeader, ProgressBar } from "@/components/ui";
import { setupProgress, type SetupStatus } from "@/lib/config";
import type { InstagramAccount } from "@/lib/instagram/accounts";
import {
  APP_REVIEW_TEXTS,
  INSTAGRAM_LOGIN_SCOPES,
  INSTAGRAM_MESSAGE_ACCESS_MENU,
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

/** เนื้อหาหน้าคู่มือ (รับข้อมูลสถานะเข้ามา — page.tsx เป็นคนโหลดจากฐานข้อมูล) */
export function GuideView({
  status,
  pages,
  igAccounts,
  igHasMetaAppSecret,
}: {
  status: SetupStatus;
  pages: ConnectedPage[];
  /** บัญชี Instagram ที่เชื่อมผ่าน Instagram Login (ส่งต่อให้ Server Component เท่านั้น — ห้ามส่ง token ให้ Client) */
  igAccounts: InstagramAccount[];
  igHasMetaAppSecret: boolean;
}) {
  const progress = setupProgress(status);
  const base = status.baseUrl;
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);
  const subscribedPages = pages.filter((p) => p.subscribed);
  const ig = status.instagram;
  // เสร็จเมื่อมีบัญชีที่ใช้งานได้จริง (token หมดอายุ/ใช้ไม่ได้ → ยังไม่เสร็จ และบอกให้วาง token ใหม่)
  const igWebhookOk = Boolean(ig.webhookVerifiedAt || ig.lastWebhookAt);
  const igStep = instagramStepStatus(igAccounts, undefined, igWebhookOk);
  // username ของ Instagram ร้าน (ถ้ารู้จากเพจหรือบัญชีที่เชื่อมแล้ว) ใช้บอกว่าต้องเชิญบัญชีไหนเป็น Tester
  const shopIgUsername = igAccounts[0]?.username ?? pages.find((p) => p.igUsername)?.igUsername ?? null;

  // ลำดับขั้นในหน้านี้: ขั้น 1–4, 6, 7 คือ 6 ขั้นที่นับใน setupProgress
  // (ขั้น 4 ของ setupProgress นับเมื่อเพจ "หรือ" บัญชี Instagram พร้อม → ถ้าใช้แค่ Instagram ขั้น 4 ไม่บังคับ)
  // ขั้น 5 (Instagram Login) และขั้น 8 (App Review) ไม่บังคับ
  const steps: { n: number; short: string; done: boolean; optional?: boolean; optionalLabel?: string }[] = [
    { n: 1, short: "ระบบออนไลน์", done: Boolean(base) },
    { n: 2, short: "สร้างแอปใน Meta", done: metaReady },
    { n: 3, short: "ตั้ง Webhook", done: Boolean(status.webhookVerifiedAt) },
    { n: 4, short: "เชื่อมต่อเพจ Facebook", done: status.pagesSubscribed > 0, optional: status.pagesSubscribed === 0 && ig.subscribed > 0 },
    { n: 5, short: "เชื่อมต่อ Instagram", done: igStep.done, optional: true, optionalLabel: "ถ้าใช้ Instagram" },
    { n: 6, short: "สร้างกฎแรก", done: status.ruleCount > 0 },
    { n: 7, short: "ทดสอบ", done: Boolean(status.lastWebhookAt) },
    { n: 8, short: "ยื่น App Review", done: status.appReviewDone, optional: true },
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
        title="คู่มือตั้งค่า"
        description="ทำตามทีละขั้นจากบนลงล่าง ระบบจะติ๊กถูกให้เองเมื่อแต่ละขั้นเสร็จ ขั้นที่เสร็จแล้วกดเปิดดูใหม่ได้"
        actions={
          <ButtonLink href="/settings" variant="secondary" icon={<Settings />} className="max-sm:hidden">
            ไปหน้าตั้งค่า
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px] lg:items-start lg:gap-8">
        {/* ความคืบหน้า: มือถืออยู่บนสุด เดสก์ท็อปอยู่ด้านขวาและติดอยู่กับที่ */}
        <aside aria-label="ความคืบหน้าการตั้งค่า" className="lg:sticky lg:top-10 lg:col-start-2 lg:row-start-1">
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
                <p className="text-base leading-6 font-semibold text-fg tabular">{`เสร็จแล้ว ${progress.done} จาก ${progress.total} ขั้น`}</p>
                <p className="text-sm leading-6 text-fg-2">
                  {complete ? "ตั้งค่าครบแล้ว ระบบพร้อมตอบลูกค้าอัตโนมัติ" : `อีก ${remaining} ขั้นก็พร้อมใช้งาน`}
                </p>
              </div>
            </div>
            <ProgressBar
              value={progress.done}
              max={progress.total}
              tone={complete ? "good" : "accent"}
              label={`ตั้งค่าเสร็จ ${progress.done} จาก ${progress.total} ขั้น`}
              className="mt-4"
            />

            {/* มือถือ: ปุ่มไปขั้นต่อไป */}
            {current && !complete && current.n > 1 && (
              <a href={`#step-${current.n}`} className={cx(buttonStyle("secondary", "md", { block: true }), "mt-4 lg:hidden")}>
                ไปขั้นที่ {current.n}: {current.short}
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
                          <span className="block text-xs font-normal text-fg-3">{s.optionalLabel ?? "ไม่บังคับ"}</span>
                        )}
                      </span>
                      <span className="sr-only">{s.done ? "(เสร็จแล้ว)" : state === "current" ? "(ขั้นต่อไป)" : ""}</span>
                    </a>
                  </li>
                );
              })}
            </ol>

            {complete && (
              <ButtonLink href="/" variant="primary" block icon={<LayoutDashboard />} className="mt-4">
                ไปหน้าภาพรวม
              </ButtonLink>
            )}
          </div>
        </aside>

        <ol className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          {/* ---------- ขั้นที่ 1 ---------- */}
          <StepCard
            n={1}
            state={stateOf(1)}
            title={base ? "ระบบออนไลน์แล้ว" : "บอกระบบว่าเว็บนี้อยู่ที่ไหน"}
            summary={base ? base : "ใส่ลิงก์ที่ใช้เปิดหน้านี้ ระบบจะใช้สร้างลิงก์ให้ Meta"}
          >
            {base ? (
              <>
                <p>ระบบของคุณอยู่ที่ลิงก์นี้ เก็บไว้ใช้เข้าหน้าจัดการ (กดบุ๊กมาร์กไว้ก็ได้)</p>
                <CopyField value={base} />
              </>
            ) : (
              <>
                <p>ระบบยังไม่รู้ลิงก์ของตัวเอง ใส่ลิงก์ที่คุณใช้เปิดหน้านี้อยู่ (ดูจากแถบที่อยู่ของเบราว์เซอร์)</p>
                <FormPanel title="ที่อยู่เว็บของระบบ">
                  <BaseUrlForm baseUrl={null} />
                </FormPanel>
              </>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 2 ---------- */}
          <StepCard
            n={2}
            state={stateOf(2)}
            title="สร้างแอปใน Meta for Developers"
            summary={metaReady ? `บันทึก App ID ${status.meta.appId} แล้ว` : "ขออนุญาต Meta ให้ระบบอ่านคอมเมนต์และตอบแทนเพจ — ฟรี ไม่ต้องเขียนโค้ด"}
          >
            <p>
              Meta (Facebook) ต้องให้เราสร้าง &quot;แอป&quot; ก่อน เพื่อขออนุญาตอ่านคอมเมนต์และส่งข้อความแทนเพจ ฟรี ไม่ต้องเขียนโค้ด
            </p>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  เปิด <ExtLink href="https://developers.facebook.com/apps">developers.facebook.com/apps</ExtLink> แล้วล็อกอินด้วย Facebook
                  ที่เป็นแอดมินเพจ <span className="text-fg-2">(ครั้งแรกจะให้ลงทะเบียนเป็นนักพัฒนา ทำตามขั้นตอนที่ขึ้นมา)</span>
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  กด <B>Create App</B> (สร้างแอป) → ตั้งชื่อ เช่น &quot;ร้านของฉัน DM&quot; → ใส่อีเมล
                </p>
              </SubStep>
              <SubStep n={3}>
                <p>
                  หน้าเลือก use case: เลือกตัวที่เกี่ยวกับ <B>Messenger</B> และ <B>Instagram</B>{" "}
                  <span className="text-fg-2">
                    (ถ้าไม่เจอ เลือก <B>Other</B> แล้วเลือกประเภท <B>Business</B>)
                  </span>
                </p>
              </SubStep>
              <SubStep n={4}>
                <p>ถ้าถามหา Business portfolio ให้เลือกของร้านคุณ (หรือสร้างใหม่) แล้วกดสร้างแอปจนเสร็จ</p>
              </SubStep>
              <SubStep n={5}>
                <p>
                  เมนูซ้าย <B>App settings → Basic</B>: คัดลอก <B>App ID</B> และกด <B>Show</B> ที่ช่อง <B>App secret</B>{" "}
                  แล้วคัดลอกมาใส่ในช่องด้านล่าง
                </p>
              </SubStep>
              <SubStep n={6}>
                <p>
                  ในหน้าเดียวกัน วางลิงก์ 2 อันนี้ในช่อง <B>Privacy policy URL</B> และ <B>User data deletion</B> (เลือกแบบ Instructions URL)
                  แล้วกด <B>Save changes</B>
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Privacy policy URL" value={`${base}/privacy`} />
                    <CopyField label="User data deletion URL" value={`${base}/data-deletion`} />
                  </div>
                ) : (
                  <Notice tone="warning">ทำขั้นที่ 1 ให้เสร็จก่อน ลิงก์จะขึ้นตรงนี้</Notice>
                )}
              </SubStep>
            </SubSteps>
            <FormPanel title="วาง App ID และ App Secret" description="คัดลอกมาจากหน้า App settings → Basic ในขั้นย่อยที่ 5">
              <MetaAppForm appId={status.meta.appId} hasSecret={Boolean(status.meta.appSecret)} fromEnv={status.meta.fromEnv} />
            </FormPanel>
          </StepCard>

          {/* ---------- ขั้นที่ 3 ---------- */}
          <StepCard
            n={3}
            state={stateOf(3)}
            title="ตั้ง Webhook"
            summary={
              status.webhookVerifiedAt
                ? `Meta ยืนยันลิงก์ของระบบแล้วเมื่อ ${formatDateTime(status.webhookVerifiedAt)}`
                : "ให้ Meta แจ้งระบบทันทีเมื่อมีคอมเมนต์หรือข้อความใหม่"
            }
          >
            {!metaReady && <Notice tone="warning">ทำขั้นที่ 2 ให้เสร็จก่อน</Notice>}
            <SubSteps>
              <SubStep n={1}>
                <p>
                  ในหน้าแอปของคุณ เมนูซ้ายหา <B>Webhooks</B> (ถ้าไม่มี กด <B>Add product</B> แล้วเลือก Webhooks)
                </p>
                <p className="text-xs leading-5 text-fg-3">
                  แอปแบบใหม่บางแอปจะมีช่องตั้ง webhook อยู่ในหน้าตั้งค่า Messenger / Instagram แทน ใส่ค่าเดียวกันได้เลย
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  ช่อง dropdown ด้านบนเลือก <B>Page</B> → กด <B>Subscribe to this object</B>
                </p>
              </SubStep>
              <SubStep n={3}>
                <p>
                  คัดลอก 2 ค่านี้ไปวาง แล้วกด <B>Verify and save</B>
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Callback URL" value={`${base}${WEBHOOK_PATHS.meta}`} />
                    <CopyField label="Verify token" value={status.meta.verifyToken} />
                  </div>
                ) : (
                  <Notice tone="warning">ทำขั้นที่ 1 ให้เสร็จก่อน</Notice>
                )}
              </SubStep>
              <SubStep n={4}>
                <p>
                  ในรายการด้านล่างของหน้านั้น กดปุ่ม <B>Subscribe</B> ทุกแถวต่อไปนี้
                </p>
                <CodeChips items={PAGE_WEBHOOK_FIELDS} />
              </SubStep>
              <SubStep n={5}>
                <p>
                  เปลี่ยน dropdown เป็น <B>Instagram</B> → ทำแบบเดียวกัน (ใส่ Callback URL และ Verify token เดิม) แล้ว Subscribe แถว
                </p>
                <CodeChips items={INSTAGRAM_WEBHOOK_FIELDS} />
                <p className="text-xs leading-5 text-fg-3">Instagram Login ในขั้นที่ 5 ใช้ Callback URL แยกอีกอัน</p>
              </SubStep>
            </SubSteps>
            {status.webhookVerifiedAt ? (
              <Notice tone="good">Meta ยืนยันลิงก์ของระบบแล้วเมื่อ {formatDateTime(status.webhookVerifiedAt)}</Notice>
            ) : (
              <Notice tone="neutral" actions={<RefreshButton />}>
                เมื่อกด Verify and save สำเร็จ ขั้นนี้จะติ๊กถูกเอง
              </Notice>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 4 ---------- */}
          <StepCard
            n={4}
            state={stateOf(4)}
            title="เชื่อมต่อ Facebook Page"
            summary={
              subscribedPages.length > 0
                ? `เชื่อมต่อแล้ว: ${subscribedPages.map((p) => p.name).join(", ")}`
                : steps[3].optional
                  ? "ไม่บังคับ — ใช้ Instagram อย่างเดียวได้ (เชื่อมแล้วในขั้นที่ 5)"
                  : "ให้ระบบเข้าถึงเพจ Facebook ของร้าน"
            }
            optionalLabel={steps[3].optional ? "ไม่บังคับ" : undefined}
          >
            <SubSteps>
              <SubStep n={1}>
                <p>เปิดเครื่องมือของ Meta ชื่อ Graph API Explorer</p>
                <ExtButton href="https://developers.facebook.com/tools/explorer/">เปิด Graph API Explorer</ExtButton>
              </SubStep>
              <SubStep n={2}>
                <p>
                  แถบด้านขวา ช่อง <B>Meta App</B> เลือกแอปที่สร้างในขั้นที่ 2 และช่อง <B>User or Page</B> เลือก <B>User Token</B>
                </p>
              </SubStep>
              <SubStep n={3}>
                <p>
                  ช่อง <B>Permissions</B> กด <B>Add a Permission</B> แล้วเพิ่มทุกตัวในรายการนี้ ({formatNumber(REQUIRED_PERMISSIONS.length)}{" "}
                  ตัว — พิมพ์ชื่อแล้วกดเลือกทีละตัว กดที่ชื่อด้านล่างเพื่อคัดลอก)
                </p>
                <CopyChips items={REQUIRED_PERMISSIONS} />
              </SubStep>
              <SubStep n={4}>
                <p>
                  กด <B>Generate Access Token</B> → ล็อกอิน → <B>ติ๊กเลือกเพจ</B>{" "}
                  <span className="text-fg-2">(และบัญชี Instagram ถ้ามีให้เลือก)</span> → กดอนุญาตจนเสร็จ
                </p>
              </SubStep>
              <SubStep n={5}>
                <p>
                  กดปุ่มคัดลอกที่ช่อง <B>Access Token</B> ด้านบนของหน้านั้น แล้วนำมาวางในช่องด้านล่าง
                </p>
              </SubStep>
            </SubSteps>
            {!metaReady && <Notice tone="warning">ต้องใส่ App ID / App Secret (ขั้นที่ 2) ก่อน</Notice>}
            <FormPanel id="connect" title="วาง token แล้วเลือกเพจ">
              <ConnectForm inGuide connectedIds={pages.map((p) => p.id)} />
            </FormPanel>
            {pages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">เพจที่เชื่อมต่อแล้ว</p>
                <PagesList pages={pages} inset igLoginIds={igAccounts.map((a) => a.id)} />
              </div>
            )}
            <Notice tone="neutral">
              Instagram เชื่อมแยกในขั้นที่ 5{" "}
              <span className="text-fg-2">(ระบบจะตอบคอมเมนต์และ DM ของ Instagram ผ่าน Instagram Login)</span>
            </Notice>
          </StepCard>

          {/* ---------- ขั้นที่ 5 (ถ้าใช้ Instagram) ---------- */}
          <StepCard
            n={5}
            state={stateOf(5)}
            title="เชื่อมต่อ Instagram (Instagram Login)"
            optionalLabel="ถ้าใช้ Instagram"
            summary={igStep.summary}
          >
            <p>
              ทำครั้งเดียวจบ ใช้บัญชี Instagram เดียวกับที่ผูกกับเพจได้เลย — เชื่อมแล้วระบบจะตอบคอมเมนต์ DM และการกดปุ่มของ Instagram
              ผ่านช่องทางนี้ ส่วนเพจ Facebook ทำงานเหมือนเดิม และ token จะต่ออายุให้อัตโนมัติ
            </p>
            <Notice tone="accent" title="ก่อนเริ่ม ตรวจในแอป Instagram บนมือถือ (ล็อกอินบัญชีร้าน)">
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>
                  บัญชีเป็นแบบ <B>มืออาชีพ</B> (ธุรกิจหรือครีเอเตอร์) และเป็น <B>บัญชีสาธารณะ</B>
                </li>
                <li>
                  {/* โปรไฟล์ → ☰ → เมนูตัวหนา (ชุดเดียวกับคำอธิบาย error 2534041 ในหน้ากิจกรรม) */}
                  {INSTAGRAM_MESSAGE_ACCESS_MENU.map((m, i) => (
                    <Fragment key={m}>
                      {i > 1 ? <B>{m}</B> : m}
                      {" → "}
                    </Fragment>
                  ))}
                  เปิด <B>อนุญาตการเข้าถึงข้อความ</B> <span className="text-fg-3">(ชื่อเมนูอาจต่างเล็กน้อย)</span>
                </li>
              </ol>
            </Notice>

            <SubHeading>ก. สร้างแอปสำหรับ Instagram</SubHeading>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  เปิด <ExtLink href="https://developers.facebook.com/apps">developers.facebook.com/apps</ExtLink> → กด <B>Create app</B> →
                  เลือก use case <B>Manage messaging &amp; content on Instagram</B>{" "}
                  <span className="text-fg-2">
                    (ถ้าไม่เจอ เลือก <B>Other</B> แล้วเลือกประเภท <B>Business</B>)
                  </span>
                </p>
                <p>
                  ตั้งชื่อแอป <B>ห้ามมีคำว่า Insta, Gram, Face, Book, Meta, IG, FB</B> → ถ้าถามหา business portfolio เลือก{" "}
                  <B>I don&apos;t want to connect a business portfolio yet</B> → กด <B>Create</B>
                </p>
                <p className="text-xs leading-5 text-fg-3">
                  ห้ามใช้ Create test app (แอปทดสอบเปิด Live ไม่ได้) · แอป Facebook เดิมไม่ต้องแก้อะไร
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  ในแอปใหม่ เมนู <B>App settings → Basic</B>: วาง 2 ลิงก์นี้ในช่อง <B>Privacy policy URL</B> และ <B>User data deletion</B> →
                  อัปโหลด <B>App icon</B> <span className="text-fg-2">(รูปสี่เหลี่ยมจัตุรัส 1024×1024 เช่น โลโก้ร้าน)</span> → เลือก{" "}
                  <B>Category</B> → กด <B>Save changes</B>
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Privacy policy URL" value={`${base}/privacy`} />
                    <CopyField label="User data deletion URL" value={`${base}/data-deletion`} />
                  </div>
                ) : (
                  <Notice tone="warning">ทำขั้นที่ 1 ให้เสร็จก่อน ลิงก์จะขึ้นตรงนี้</Notice>
                )}
              </SubStep>
              <SubStep n={3}>
                <p>
                  เมนู <B>Use cases</B> → การ์ด Instagram กด <B>Customize</B> → เลือก <B>API setup with Instagram login</B>{" "}
                  <span className="text-fg-2">(ห้ามเลือก API setup with Facebook login)</span> → หัวข้อ{" "}
                  <B>Add required messaging permissions</B> กด <B>Add all required permissions</B> รอจนขึ้นเครื่องหมายถูกครบ
                </p>
                {/* ปุ่ม Add all required permissions เพิ่มให้ครบในครั้งเดียว — รายการนี้ไว้ตรวจว่าครบ (ชื่อยาว จึงไม่ใช้ปุ่มคัดลอก) */}
                <CodeChips items={INSTAGRAM_LOGIN_SCOPES} />
              </SubStep>
              <SubStep n={4}>
                <p>วาง secret 2 ตัวของแอปนี้ในช่องด้านล่าง แล้วกด บันทึก (ระบบใช้ทั้งคู่ตรวจว่าข้อมูลมาจาก Meta จริง)</p>
                <ol className="list-[lower-alpha] space-y-1 pl-5">
                  <li>
                    ช่องแรก: ในหน้า API setup with Instagram login หา <B>Instagram app secret</B> → กด <B>Show</B> → คัดลอก
                  </li>
                  <li>
                    ช่องที่สอง: เมนูซ้าย <B>App settings → Basic</B> → ช่อง <B>App secret</B> → กด <B>Show</B> → คัดลอก{" "}
                    <span className="text-fg-2">(ของแอปที่สร้างในข้อ 1 ไม่ใช่ของแอป Facebook เดิม)</span>
                  </li>
                </ol>
                <FormPanel id="instagram-app" title="วาง secret ของแอป Instagram">
                  <InstagramAppForm separateApp hasSecret={ig.appSecretSet} hasMetaAppSecret={igHasMetaAppSecret} fromEnv={ig.fromEnv} />
                </FormPanel>
              </SubStep>
            </SubSteps>

            <SubHeading>ข. ให้บัญชี Instagram ใช้แอปนี้ได้</SubHeading>
            <SubSteps start={5}>
              <SubStep n={5}>
                <p>
                  เมนู <B>App roles → Roles</B> → <B>Instagram Testers</B> → <B>Add Instagram Testers</B> → พิมพ์ username บัญชีร้าน
                  {shopIgUsername && <> (@{shopIgUsername})</>} → ส่งคำเชิญ{" "}
                  <span className="text-fg-2">(หรือปุ่ม Add or remove Instagram testers ในหน้า API setup with Instagram login)</span>
                </p>
              </SubStep>
              <SubStep n={6}>
                <p>
                  <B>บนคอมพิวเตอร์</B> เข้า instagram.com ด้วยบัญชีร้าน → เปิด{" "}
                  <ExtLink href="https://www.instagram.com/accounts/manage_access/">instagram.com/accounts/manage_access</ExtLink> → แท็บ{" "}
                  <B>Tester invites</B> → กด <B>Accept</B>{" "}
                  <span className="text-fg-2">(ถ้าลิงก์เปิดไม่ได้: การตั้งค่า → แอปและเว็บไซต์ → Tester invites)</span>
                </p>
                <p className="text-xs leading-5 text-fg-3">
                  แอปมือถืออาจไม่แสดงเมนูนี้ และหน้า Meta ไม่บอกว่ากดยอมรับแล้วหรือยัง — ห้ามข้ามข้อนี้
                </p>
              </SubStep>
              <SubStep n={7} id="step-5-token">
                <p>
                  กลับไปหน้า API setup with Instagram login → หัวข้อ <B>Generate access tokens</B> → <B>Add account</B> → ล็อกอิน Instagram
                  ด้วย <B>บัญชีร้าน</B> (ไม่ใช่บัญชีส่วนตัว) → อนุญาตทั้งหมด → กด <B>Generate token</B> → ติ๊กช่องยืนยัน → คัดลอก token
                  (ขึ้นต้นด้วย IG) มาวางด้านล่าง
                </p>
                <FormPanel id="connect-instagram" title="วาง token ของ Instagram">
                  <div className="space-y-4">
                    <InstagramConnectForm inGuide hasAppSecret={ig.appSecretSet} />
                    {igAccounts.length > 0 && <InstagramAccountsList accounts={igAccounts} pages={pages} inset />}
                  </div>
                </FormPanel>
                <p className="text-xs leading-5 text-fg-3">ถ้าขึ้น Insufficient Developer Role แปลว่ายังไม่ได้กด Accept ในข้อ 6</p>
              </SubStep>
            </SubSteps>

            <SubHeading>ค. ให้ Meta ส่งคอมเมนต์และข้อความมาที่ระบบ</SubHeading>
            <SubSteps start={8}>
              <SubStep n={8} id="step-5-webhook">
                <p>
                  หัวข้อ <B>Configure webhooks</B> → กด <B>Configure</B> → วาง 2 ค่านี้ → กด <B>Verify and save</B>
                </p>
                {base ? (
                  <div className="grid gap-3">
                    <CopyField label="Callback URL (ของ Instagram)" value={`${base}${WEBHOOK_PATHS.instagram}`} />
                    <CopyField label="Verify token" value={status.meta.verifyToken} />
                  </div>
                ) : (
                  <Notice tone="warning">ทำขั้นที่ 1 ให้เสร็จก่อน</Notice>
                )}
                <p className="text-xs leading-5 text-fg-3">ถ้าไม่ผ่าน แปลว่า URL หรือ Verify token ไม่ตรง ลองคัดลอกใหม่อีกครั้ง</p>
              </SubStep>
              <SubStep n={9}>
                <p>
                  กด <B>Manage</B> ตรวจว่าแถวต่อไปนี้เป็น <B>Subscribed</B> ครบ{" "}
                  <span className="text-fg-2">(ถ้าถามเวอร์ชัน เลือก v23.0 หรือใหม่กว่า)</span>
                </p>
                <CodeChips items={INSTAGRAM_WEBHOOK_FIELDS} />
              </SubStep>
              <SubStep n={10}>
                <p>
                  ข้ามหัวข้อ <B>Set up Instagram business login</B> และ <B>Complete app review</B>{" "}
                  <span className="text-fg-2">(ไม่ต้องใช้กับบัญชีของคุณเอง)</span>
                </p>
              </SubStep>
              <SubStep n={11}>
                <p>
                  สวิตช์ด้านบนของหน้าแอป: เปลี่ยนเป็น <B>เปิดใช้งาน (Live)</B>{" "}
                  <span className="text-fg-2">— ถ้ากดไม่ได้ ตรวจข้อ 2 ว่ากรอกครบ (ลิงก์ 2 อัน, App icon, Category แล้วกด Save changes)</span>
                </p>
              </SubStep>
            </SubSteps>
            {ig.badSignatureAt && (
              <Notice
                tone="critical"
                title="Meta ส่งข้อมูล Instagram มาแล้ว แต่ลายเซ็นไม่ตรงกับ secret ที่บันทึกไว้"
                actions={<RefreshButton />}
              >
                ครั้งล่าสุด {formatDateTime(ig.badSignatureAt)} — คัดลอก Instagram app secret ล่าสุด (และ App secret จาก App settings →
                Basic ถ้าใช้แอปแยก) มาวางใหม่ในข้อ 4
              </Notice>
            )}
            {igWebhookOk ? (
              <Notice tone="good">
                Meta ยืนยันลิงก์ของ Instagram แล้ว
                {ig.lastWebhookAt && <> · ได้รับข้อมูลทาง Instagram Login ล่าสุด {formatDateTime(ig.lastWebhookAt)}</>}
              </Notice>
            ) : (
              <Notice tone="neutral" actions={<RefreshButton />}>
                เมื่อกด Verify and save ในข้อ 8 สำเร็จ ตรงนี้จะขึ้นว่ายืนยันแล้ว
              </Notice>
            )}

            <SubHeading>ง. ทดสอบ (สำคัญ)</SubHeading>
            <SubSteps start={12}>
              <SubStep n={12}>
                <p>
                  ใช้บัญชี Instagram อื่นที่ <B>ไม่มีบทบาทในแอป</B> (เช่น บัญชีของเพื่อน) ทำทีละข้อ แล้วดูหน้า{" "}
                  <Link href="/activity" className="font-medium text-accent underline-offset-2 hover:underline">
                    กิจกรรม
                  </Link>{" "}
                  หลังแต่ละข้อ
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-fg-2">
                  <li>
                    คอมเมนต์คำที่ตั้งไว้ใต้โพสต์ → ควรได้ตอบใต้คอมเมนต์และได้ DM{" "}
                    <span className="text-fg-3">(DM แรกอยู่ในกล่อง &quot;คำขอข้อความ&quot; ถ้ายังไม่ได้ติดตามร้าน)</span>
                  </li>
                  <li>ตอบ DM นั้นด้วยคำที่ตั้งไว้</li>
                  <li>กดปุ่มใน DM</li>
                </ol>
                <p className="text-xs leading-5 text-fg-3">ถ้าคอมเมนต์ได้ แต่ DM หรือการกดปุ่มไม่เข้า ให้แจ้งผู้พัฒนา</p>
              </SubStep>
            </SubSteps>

            <details className="group/same rounded-lg border border-line bg-surface">
              <summary className="flex min-h-11 list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                <span className="flex-1">ใช้แอป Facebook เดิมแทนได้ไหม?</span>
                <ArrowRight className="size-4 text-fg-3 transition-transform group-open/same:rotate-90" aria-hidden />
              </summary>
              <p className="border-t border-line px-4 py-3 text-sm leading-6 text-fg-2">
                ได้ ถ้าแอปเดิมยังไม่มี Instagram ใน Use cases หรือเพิ่ม API setup with Instagram login ได้โดยไม่ต้องสลับของเดิม — ถ้า
                Meta ให้แค่ &quot;สลับ&quot; ห้ามสลับ ให้สร้างแอปใหม่ตามข้อ 1 (ถ้าใช้แอปเดิม ช่องที่สองในข้อ 4 ใส่ App Secret ตัวเดียวกับขั้นที่ 2)
              </p>
            </details>
          </StepCard>

          {/* ---------- ขั้นที่ 6 ---------- */}
          <StepCard
            n={6}
            state={stateOf(6)}
            title="สร้างกฎอัตโนมัติอันแรก"
            summary={status.ruleCount > 0 ? `มีกฎแล้ว ${formatNumber(status.ruleCount)} กฎ` : "บอกระบบว่าเจอคำไหน ให้ตอบอะไร"}
          >
            <p>
              กำหนดว่าถ้าเจอคำไหน ให้ระบบตอบอะไร เช่น ใครคอมเมนต์ &quot;สนใจ&quot; → ตอบใต้คอมเมนต์ + ส่งลิงก์สินค้าทาง DM
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/rules/new" icon={<Plus />} className="max-sm:w-full">
                สร้างกฎใหม่
              </ButtonLink>
              {status.ruleCount > 0 && (
                <ButtonLink href="/rules" variant="secondary" className="max-sm:w-full">
                  ดูกฎทั้งหมด
                </ButtonLink>
              )}
            </div>
          </StepCard>

          {/* ---------- ขั้นที่ 7 ---------- */}
          <StepCard
            n={7}
            state={stateOf(7)}
            title="ทดสอบ"
            summary={
              status.lastWebhookAt
                ? `ได้รับข้อมูลจาก Meta แล้ว (ล่าสุด ${formatDateTime(status.lastWebhookAt)})`
                : "ลองคอมเมนต์หรือทักแชทเพจด้วยบัญชีของคุณ"
            }
          >
            <Notice tone="warning" title="ก่อนทดสอบ: เปลี่ยนแอปเป็นโหมด “เปิดใช้งาน” (Live)">
              หน้าแอปใน Meta ด้านบนมีสวิตช์ <B>โหมดแอพ: การพัฒนา / เปิดใช้งาน</B> ให้กดเป็น <B>เปิดใช้งาน</B> — ช่วงที่ยังเป็นโหมดการพัฒนา
              Meta จะไม่ส่งคอมเมนต์และข้อความจริงมาให้ระบบเลย แม้คนคอมเมนต์จะเป็นแอดมินก็ตาม{" "}
              <span className="text-fg-2">
                (ไม่ต้องกังวล: ก่อนผ่าน App Review เพจ Facebook ยังตอบได้เฉพาะบัญชีที่มีชื่อในแอป เช่น บัญชีของคุณเองที่เป็นผู้ดูแล —
                Instagram ที่เชื่อมผ่าน Instagram Login ในขั้นที่ 5 ไม่ต้องรอ App Review)
              </span>{" "}
              <span className="text-fg-2">(ถ้าสร้างแอป Instagram แยก ต้องเปิด Live ทั้ง 2 แอป)</span>
            </Notice>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  อยากให้เพื่อนช่วยทดสอบ: ในหน้าแอป เมนู <B>App roles → Roles</B> → เพิ่มเพื่อนเป็น <B>Tester</B>{" "}
                  <span className="text-fg-2">(เพื่อนต้องกดยอมรับคำเชิญ)</span>
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>ใช้บัญชีนั้นคอมเมนต์คำที่ตั้งไว้ใต้โพสต์ของเพจ หรือทักแชทเพจ</p>
              </SubStep>
              <SubStep n={3}>
                <p>
                  รอไม่กี่วินาที แล้วดูที่หน้า{" "}
                  <Link href="/activity" className="font-medium text-accent underline-offset-2 hover:underline">
                    กิจกรรม
                  </Link>{" "}
                  ควรเห็นรายการใหม่ และบัญชีนั้นควรได้รับ DM
                </p>
              </SubStep>
            </SubSteps>
            {status.badSignatureAt ? (
              <Notice tone="critical" title="Meta ส่งข้อมูลมาแล้ว แต่ App Secret ในระบบไม่ตรงกับใน Meta" actions={<RefreshButton />}>
                ระบบเลยไม่รับข้อมูล (ครั้งล่าสุด {formatDateTime(status.badSignatureAt)}) — มักเกิดจากกด <B>รีเซ็ต</B> App Secret ใน Meta
                หลังบันทึกในระบบ วิธีแก้: หน้าแอปใน Meta → <B>การตั้งค่าแอป → ข้อมูลพื้นฐาน</B> → คัดลอก <B>ข้อมูลลับของแอป</B> ล่าสุด
                แล้ววางใหม่ใน{" "}
                <Link href="/settings#meta-app" className="font-medium text-accent underline-offset-2 hover:underline">
                  ตั้งค่า → Meta App
                </Link>{" "}
                จากนั้นลองคอมเมนต์อีกครั้ง
              </Notice>
            ) : status.lastWebhookAt ? (
              <Notice tone="good">ระบบได้รับข้อมูลจาก Meta แล้ว (ล่าสุด {formatDateTime(status.lastWebhookAt)})</Notice>
            ) : (
              <Notice tone="neutral" title="ยังไม่เคยได้รับข้อมูลจาก Meta" actions={<RefreshButton />}>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>
                    โหมดแอปใน Meta ต้องเป็น <B>เปิดใช้งาน</B> (Live) แล้วคอมเมนต์ด้วยบัญชีส่วนตัวที่เป็นผู้ดูแลแอป
                    ไม่ใช่คอมเมนต์ในนามเพจ
                  </li>
                  <li>
                    ลองเช็กการเชื่อมต่อ: หน้า Webhooks ใน Meta เลือก <B>Page</B> → กด <B>ทดสอบ</B> ที่แถว <B>feed</B> แล้วกด
                    &quot;ตรวจสอบอีกครั้ง&quot; ที่นี่ ถ้าขึ้นว่าได้รับแล้ว แปลว่าการเชื่อมต่อใช้ได้
                  </li>
                  <li>ตรวจขั้นที่ 3 ว่าเปิดสวิตช์ (Subscribe) ครบทุกแถว</li>
                  <li>
                    Instagram: ดู{" "}
                    <Link href="/settings#instagram" className="font-medium text-accent underline-offset-2 hover:underline">
                      ตั้งค่า → บัญชี Instagram
                    </Link>{" "}
                    ว่า &quot;รับคอมเมนต์/DM ล่าสุด&quot; ขึ้นเวลาหรือยัง
                  </li>
                </ol>
              </Notice>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 8 (ไม่บังคับ) ---------- */}
          <StepCard
            n={8}
            state={stateOf(8)}
            title="เปิดใช้งานกับลูกค้าทุกคน (ยื่น App Review)"
            summary={
              status.appReviewDone ? "ผ่าน App Review และเปิด Live แล้ว" : "ทำหลังทดสอบผ่าน — Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์"
            }
          >
            <p>
              ทำหลังจากทดสอบผ่านแล้ว Meta จะตรวจแอปก่อนอนุญาตให้ตอบลูกค้าทั่วไป ใช้เวลาหลายวันถึงหลายสัปดาห์
              ระหว่างรอยังใช้กับบัญชีทดสอบได้ตามปกติ
            </p>
            <p className="text-xs leading-5 text-fg-3">ขั้นนี้สำหรับแอป Facebook เท่านั้น — Instagram Login (ขั้นที่ 5) ไม่ต้องยื่น</p>
            <SubSteps>
              <SubStep n={1}>
                <p>
                  <B>ยืนยันธุรกิจ</B>: ใน <ExtLink href="https://business.facebook.com/settings">Business settings</ExtLink> → Business info →
                  Start verification <span className="text-fg-2">(ใช้เอกสารที่มีชื่อร้าน/บริษัท)</span>
                </p>
              </SubStep>
              <SubStep n={2}>
                <p>
                  ในหน้าแอป เมนู <B>App Review → Permissions and Features</B> → กด <B>Request advanced access</B> ให้ทุก permission ในขั้นที่ 4
                </p>
              </SubStep>
              <SubStep n={3}>
                <p>อัดวิดีโอหน้าจอสั้นๆ: คอมเมนต์ใต้โพสต์ → ได้รับ DM → เปิดหน้าภาพรวมของระบบนี้ให้เห็น แล้วแนบในคำขอ</p>
              </SubStep>
              <SubStep n={4}>
                <p>ใส่คำอธิบายของแต่ละ permission (คัดลอกตัวอย่างด้านล่างได้เลย) แล้วกดส่ง</p>
                <details className="group/texts rounded-lg border border-line bg-surface">
                  <summary className="flex list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">ตัวอย่างคำอธิบายแต่ละ permission (ภาษาอังกฤษ)</span>
                    <span className="text-xs font-normal text-fg-3 tabular">{APP_REVIEW_TEXTS.length} รายการ</span>
                    <ArrowRight className="size-4 text-fg-3 transition-transform group-open/texts:rotate-90" aria-hidden />
                  </summary>
                  <div className="space-y-3 border-t border-line p-4">
                    {APP_REVIEW_TEXTS.map((t) => (
                      <CopyField key={t.permission} label={t.permission} value={t.text} />
                    ))}
                  </div>
                </details>
              </SubStep>
              <SubStep n={5}>
                <p>
                  เมื่อผ่านแล้ว ตรวจว่าแอปเป็นโหมด <B>เปิดใช้งาน</B> (Live) อยู่ (สวิตช์ด้านบนของหน้าแอป) — ระบบจะตอบลูกค้าทุกคนได้ทันที
                </p>
              </SubStep>
            </SubSteps>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <ActionButton
                action={setAppReviewAction}
                fields={{ done: status.appReviewDone ? "0" : "1" }}
                variant={status.appReviewDone ? "ghost" : "secondary"}
                icon={status.appReviewDone ? undefined : <CircleCheck />}
                successMessage={status.appReviewDone ? "ยกเลิกเครื่องหมายแล้ว" : "เยี่ยม! บันทึกว่าเปิด Live แล้ว"}
                className="max-sm:w-full"
              >
                {status.appReviewDone ? "ยกเลิกเครื่องหมายเสร็จ" : "ผ่าน App Review และเปิด Live แล้ว"}
              </ActionButton>
              <p className="text-xs leading-5 text-fg-3">กดเมื่อ Meta อนุมัติและคุณเปิด Live แล้ว ขั้นนี้จะติ๊กถูก</p>
            </div>
          </StepCard>
        </ol>
      </div>
    </>
  );
}
