import Link from "next/link";
import { ArrowRight, CircleCheck, LayoutDashboard, List, Plus, Settings } from "lucide-react";
import { getDb } from "@/db/client";
import { CopyField } from "@/components/copy-field";
import { ActionButton } from "@/components/submit-button";
import { buttonStyle, ButtonLink, cx, formatDateTime, formatNumber, Notice, PageHeader, ProgressBar } from "@/components/ui";
import { getSetupStatus, setupProgress } from "@/lib/config";
import { APP_REVIEW_TEXTS, INSTAGRAM_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS, REQUIRED_PERMISSIONS } from "@/lib/meta/setup-info";
import { listConnectedPages } from "@/lib/pages";
import { setAppReviewAction } from "../settings/actions";
import { ConnectForm } from "../settings/connect-form";
import { BaseUrlForm, MetaAppForm } from "../settings/forms";
import { PagesList } from "../settings/pages-list";
import { B, CodeChips, ExtButton, ExtLink, FormPanel, StepCard, StepDot, SubStep, SubSteps, type StepState } from "./guide-parts";
import { RefreshButton } from "./refresh-button";

export default async function GuidePage() {
  const db = getDb();
  const [status, pages] = await Promise.all([getSetupStatus(db), listConnectedPages(db)]);
  const progress = setupProgress(status);
  const base = status.baseUrl;
  const metaReady = Boolean(status.meta.appId && status.meta.appSecret);
  const subscribedPages = pages.filter((p) => p.subscribed);

  // ลำดับขั้นในหน้านี้ (ขั้น 1–6 คือ 6 ขั้นที่นับใน setupProgress, ขั้น 7 ไม่บังคับ)
  const steps = [
    { n: 1, short: "ระบบออนไลน์", done: Boolean(base) },
    { n: 2, short: "สร้างแอปใน Meta", done: metaReady },
    { n: 3, short: "ตั้ง Webhook", done: Boolean(status.webhookVerifiedAt) },
    { n: 4, short: "เชื่อมต่อเพจ", done: status.pagesSubscribed > 0 },
    { n: 5, short: "สร้างกฎแรก", done: status.ruleCount > 0 },
    { n: 6, short: "ทดสอบ", done: Boolean(status.lastWebhookAt) },
    { n: 7, short: "ยื่น App Review", done: status.appReviewDone, optional: true },
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
            {current && !complete && (
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
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={cx("absolute top-[30px] left-[19.5px] h-4 w-px", s.done ? "bg-good/50" : "bg-line-strong/70")}
                      />
                    )}
                    <a
                      href={`#step-${s.n}`}
                      aria-current={state === "current" ? "step" : undefined}
                      className={cx(
                        "relative flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        state === "current" ? "bg-accent-soft font-medium text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <StepDot n={s.n} state={state} size="sm" />
                      <span className={cx("min-w-0 flex-1 truncate", s.done && "text-fg-3")}>{s.short}</span>
                      {s.optional && <span className="text-xs text-fg-3">ไม่บังคับ</span>}
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
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <CopyField label="Callback URL" value={`${base}/api/webhooks/meta`} />
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
            title="เชื่อมต่อ Facebook Page และ Instagram"
            summary={
              subscribedPages.length > 0
                ? `เชื่อมต่อแล้ว: ${subscribedPages.map((p) => p.name).join(", ")}`
                : "ให้ระบบเข้าถึงเพจและบัญชี Instagram ของร้าน"
            }
          >
            <Notice tone="accent" title="ก่อนเริ่ม ตรวจ 2 อย่างในแอป Instagram บนมือถือ">
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>
                  บัญชีเป็นแบบ <B>มืออาชีพ</B> (ธุรกิจ/ครีเอเตอร์) และผูกกับเพจแล้ว
                </li>
                <li>
                  เข้า การตั้งค่า → <B>ข้อความและการตอบกลับเรื่องราว</B> → <B>เครื่องมือที่เชื่อมต่อ</B> → เปิด{" "}
                  <B>อนุญาตการเข้าถึงข้อความ</B> <span className="text-fg-3">(ชื่อเมนูอาจต่างเล็กน้อย)</span>
                </li>
              </ol>
            </Notice>
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
                  ตัว — พิมพ์ชื่อแล้วกดเลือกทีละตัว)
                </p>
                <CopyField label="Permissions" value={REQUIRED_PERMISSIONS.join(", ")} />
              </SubStep>
              <SubStep n={4}>
                <p>
                  กด <B>Generate Access Token</B> → ล็อกอิน → <B>ติ๊กเลือกเพจและบัญชี Instagram ของคุณ</B> → กดอนุญาตจนเสร็จ
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
                <PagesList pages={pages} inset />
              </div>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 5 ---------- */}
          <StepCard
            n={5}
            state={stateOf(5)}
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

          {/* ---------- ขั้นที่ 6 ---------- */}
          <StepCard
            n={6}
            state={stateOf(6)}
            title="ทดสอบ"
            summary={
              status.lastWebhookAt
                ? `ได้รับข้อมูลจาก Meta แล้ว (ล่าสุด ${formatDateTime(status.lastWebhookAt)})`
                : "ลองคอมเมนต์หรือทักแชทเพจด้วยบัญชีของคุณ"
            }
          >
            <p>
              ตอนนี้แอปยังอยู่ใน <B>โหมดทดสอบ</B> ระบบจะตอบได้เฉพาะบัญชีที่มีชื่ออยู่ในแอปเท่านั้น{" "}
              <span className="text-fg-2">(บัญชี Facebook ของคุณเองเป็นแอดมินอยู่แล้ว)</span>
            </p>
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
            {status.lastWebhookAt ? (
              <Notice tone="good">ระบบได้รับข้อมูลจาก Meta แล้ว (ล่าสุด {formatDateTime(status.lastWebhookAt)})</Notice>
            ) : (
              <Notice tone="neutral" actions={<RefreshButton />}>
                ยังไม่เคยได้รับข้อมูลจาก Meta — ถ้าทดสอบแล้วยังไม่ขึ้น ตรวจขั้นที่ 3 ว่ากด Subscribe ครบทุกแถว
              </Notice>
            )}
          </StepCard>

          {/* ---------- ขั้นที่ 7 (ไม่บังคับ) ---------- */}
          <StepCard
            n={7}
            state={stateOf(7)}
            title="เปิดใช้งานกับลูกค้าทุกคน (ยื่น App Review)"
            summary={
              status.appReviewDone ? "ผ่าน App Review และเปิด Live แล้ว" : "ทำหลังทดสอบผ่าน — Meta ใช้เวลาตรวจหลายวันถึงหลายสัปดาห์"
            }
          >
            <p>
              ทำหลังจากทดสอบผ่านแล้ว Meta จะตรวจแอปก่อนอนุญาตให้ตอบลูกค้าทั่วไป ใช้เวลาหลายวันถึงหลายสัปดาห์
              ระหว่างรอยังใช้กับบัญชีทดสอบได้ตามปกติ
            </p>
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
                  เมื่อผ่านแล้ว สลับแอปจาก <B>Development</B> เป็น <B>Live</B> (สวิตช์ด้านบนของหน้าแอป)
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
