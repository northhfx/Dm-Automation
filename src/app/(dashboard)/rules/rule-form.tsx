"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass, Card, cx, Field, inputClass, Notice } from "@/components/ui";
import type { RecentPost } from "@/lib/meta/graph";
import type { StepStats } from "@/lib/stats";
import { saveRule } from "./actions";
import type { RuleFormState, RuleFormValues } from "./form-values";
import { StepsEditor } from "./steps-editor";

interface Props {
  initial: RuleFormValues;
  recentPosts: RecentPost[];
  postsError: string | null;
  stepStats?: Record<string, StepStats>;
}

export function RuleForm({ initial, recentPosts, postsError, stepStats }: Props) {
  const [state, action, pending] = useActionState<RuleFormState, FormData>(saveRule, {});
  const values = state.values ?? initial;
  // key เปลี่ยนเมื่อ server ส่งค่ากลับมา → ฟอร์มโหลดค่าที่ผู้ใช้กรอกไว้ใหม่ (ไม่หายเมื่อกรอกผิด)
  return (
    <RuleFormFields
      key={state.attempt ?? 0}
      values={values}
      state={state}
      action={action}
      pending={pending}
      recentPosts={recentPosts}
      postsError={postsError}
      stepStats={stepStats}
    />
  );
}

function RuleFormFields({
  values,
  state,
  action,
  pending,
  recentPosts,
  postsError,
  stepStats,
}: {
  values: RuleFormValues;
  state: RuleFormState;
  action: (formData: FormData) => void;
  pending: boolean;
  recentPosts: RecentPost[];
  postsError: string | null;
  stepStats?: Record<string, StepStats>;
}) {
  const [trigger, setTrigger] = useState(values.trigger);
  const [matchType, setMatchType] = useState(values.matchType);
  const [allPosts, setAllPosts] = useState(values.postIds.length === 0);
  const knownIds = new Set(recentPosts.map((p) => p.id));
  const manualIds = values.postIds.filter((id) => !knownIds.has(id));

  return (
    <form action={action} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      {state.error && <ErrorNotice message={state.error} />}

      <Card title="1. เมื่อไหร่ให้ระบบทำงาน">
        <div className="space-y-5">
          <Field label="ชื่อกฎ" hint="ตั้งให้จำง่าย เช่น 'คอมเมนต์ สนใจ → ส่งลิงก์สินค้า'" htmlFor="name">
            <input id="name" name="name" required maxLength={100} defaultValue={values.name} className={inputClass} />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">ทำงานเมื่อ</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["comment", "มีคนคอมเมนต์ใต้โพสต์", "ตอบคอมเมนต์ + ส่ง DM ให้คนที่คอมเมนต์"],
                  ["dm", "มีคนทักแชท (DM) มา", "ตอบกลับในแชทอัตโนมัติ"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cx(
                    "flex cursor-pointer gap-3 rounded-lg border p-3",
                    trigger === value ? "border-accent bg-accent-soft" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={value}
                    checked={trigger === value}
                    onChange={() => setTrigger(value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-fg-2">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">แพลตฟอร์ม</legend>
            <div className="flex gap-4">
              {(
                [
                  ["facebook", "Facebook"],
                  ["instagram", "Instagram"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="platforms" value={value} defaultChecked={values.platforms.includes(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <Field label="วิธีจับคำ" htmlFor="matchType">
              <select
                id="matchType"
                name="matchType"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as RuleFormValues["matchType"])}
                className={inputClass}
              >
                <option value="contains">มีคำนี้อยู่ในข้อความ</option>
                <option value="exact">ตรงทั้งข้อความ</option>
                <option value="any">ทุกข้อความ (ไม่ต้องมี keyword)</option>
              </select>
            </Field>
            {matchType !== "any" && (
              <Field label="Keyword" hint="บรรทัดละ 1 คำ หรือคั่นด้วยจุลภาค เช่น สนใจ, ราคา, link" htmlFor="keywords">
                <textarea id="keywords" name="keywords" rows={3} defaultValue={values.keywords} className={inputClass} />
              </Field>
            )}
          </div>

          {trigger === "comment" && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">ใช้กับโพสต์ไหน</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="postScope" checked={allPosts} onChange={() => setAllPosts(true)} />
                  ทุกโพสต์
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="postScope" checked={!allPosts} onChange={() => setAllPosts(false)} />
                  เฉพาะโพสต์ที่เลือก
                </label>
              </div>
              {!allPosts && (
                <div className="space-y-3">
                  {postsError && <Notice tone="warning">ดึงรายการโพสต์ไม่ได้: {postsError}</Notice>}
                  {recentPosts.length > 0 && (
                    <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
                      {recentPosts.map((post) => (
                        <label key={post.id} className="flex cursor-pointer gap-3 rounded-lg border border-line p-2 hover:bg-surface-2">
                          <input type="checkbox" name="postIds" value={post.id} defaultChecked={values.postIds.includes(post.id)} className="mt-1" />
                          {post.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- รูปจาก CDN ของ Meta
                            <img src={post.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                          ) : (
                            <div className="h-14 w-14 shrink-0 rounded bg-surface-2" />
                          )}
                          <span className="min-w-0 text-xs">
                            <span className="font-medium">{post.platform === "instagram" ? "Instagram" : "Facebook"}</span>
                            <span className="mt-0.5 line-clamp-2 block text-fg-2">{post.caption || "(ไม่มีข้อความ)"}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <Field label="หรือใส่ Post ID เอง" hint="คั่นด้วยบรรทัดใหม่หรือจุลภาค (ใช้กับโพสต์เก่าที่ไม่อยู่ในรายการ)" htmlFor="postIdsManual">
                    <textarea id="postIdsManual" name="postIdsManual" rows={2} defaultValue={manualIds.join("\n")} className={inputClass} />
                  </Field>
                </div>
              )}
            </fieldset>
          )}
        </div>
      </Card>

      {trigger === "comment" && (
        <Card title="2. ตอบใต้คอมเมนต์ (ทุกคนเห็น)">
          <Field
            label="ข้อความตอบคอมเมนต์"
            hint="บรรทัดละ 1 แบบ ระบบจะสุ่มใช้ เพื่อไม่ให้ดูเป็นสแปม เว้นว่างไว้ถ้าไม่ต้องการตอบใต้คอมเมนต์"
            htmlFor="publicReplies"
          >
            <textarea id="publicReplies" name="publicReplies" rows={3} defaultValue={values.publicReplies} className={inputClass} />
          </Field>
        </Card>
      )}

      <Card
        title={`${trigger === "comment" ? 3 : 2}. ข้อความที่ส่งทาง DM`}
        description="ข้อความแรกส่งทันที ข้อความถัดไปส่งเมื่อลูกค้ากดปุ่ม — ถามก่อนแล้วให้กดปุ่ม มักได้คนกดลิงก์มากกว่าส่งลิงก์ทันที"
      >
        <StepsEditor initial={values.steps} trigger={trigger} stats={stepStats} />
      </Card>

      <Card title={`${trigger === "comment" ? 4 : 3}. ตัวเลือกเพิ่มเติม`}>
        <div className="space-y-4">
          {trigger === "comment" && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="oncePerUser" defaultChecked={values.oncePerUser} className="mt-1" />
              <span>
                ตอบคนเดิมแค่ครั้งเดียวต่อโพสต์
                <span className="block text-xs text-fg-3">กันไม่ให้ส่ง DM ซ้ำถ้าคนเดิมคอมเมนต์หลายครั้ง</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="active" defaultChecked={values.active} className="mt-1" />
            <span>เปิดใช้งานกฎนี้</span>
          </label>
          <div className="max-w-[200px]">
            <Field label="ลำดับความสำคัญ" hint="ถ้าตรงหลายกฎ จะใช้กฎที่เลขน้อยกว่า" htmlFor="priority">
              <input id="priority" name="priority" type="number" min={1} max={1000} defaultValue={values.priority} className={inputClass} />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "กำลังบันทึก…" : "บันทึกกฎ"}
        </button>
        <Link href="/rules" className={buttonClass.secondary}>
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

/** แจ้ง error แล้วเลื่อนหน้าขึ้นมาให้เห็น (บนมือถือปุ่มบันทึกอยู่ล่างสุด ไม่งั้นจะเหมือนกดแล้วไม่เกิดอะไร) */
function ErrorNotice({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    ref.current?.focus();
  }, [message]);
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="outline-none">
      <Notice tone="critical">{message}</Notice>
    </div>
  );
}
