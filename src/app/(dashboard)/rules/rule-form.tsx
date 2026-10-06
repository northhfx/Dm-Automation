"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { buttonClass, Card, cx, Field, inputClass, Notice } from "@/components/ui";
import type { RecentPost } from "@/lib/meta/graph";
import { saveRule } from "./actions";
import type { RuleFormState, RuleFormValues } from "./form-values";

interface Props {
  initial: RuleFormValues;
  recentPosts: RecentPost[];
  postsError: string | null;
}

export function RuleForm({ initial, recentPosts, postsError }: Props) {
  const [state, action, pending] = useActionState<RuleFormState, FormData>(saveRule, {});
  const values = state.values ?? initial;
  // key เปลี่ยนเมื่อ server ส่งค่ากลับมา → ฟอร์มโหลดค่าที่ผู้ใช้กรอกไว้ใหม่ (ไม่หายเมื่อกรอกผิด)
  return <RuleFormFields key={state.attempt ?? 0} values={values} state={state} action={action} pending={pending} recentPosts={recentPosts} postsError={postsError} />;
}

function RuleFormFields({
  values,
  state,
  action,
  pending,
  recentPosts,
  postsError,
}: {
  values: RuleFormValues;
  state: RuleFormState;
  action: (formData: FormData) => void;
  pending: boolean;
  recentPosts: RecentPost[];
  postsError: string | null;
}) {
  const [trigger, setTrigger] = useState(values.trigger);
  const [matchType, setMatchType] = useState(values.matchType);
  const [allPosts, setAllPosts] = useState(values.postIds.length === 0);
  const knownIds = new Set(recentPosts.map((p) => p.id));
  const manualIds = values.postIds.filter((id) => !knownIds.has(id));

  return (
    <form action={action} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      {state.error && <Notice tone="critical">{state.error}</Notice>}

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

      <Card title="2. ระบบจะตอบว่าอะไร">
        <div className="space-y-5">
          {trigger === "comment" && (
            <Field
              label="ตอบคอมเมนต์ (สาธารณะ)"
              hint="บรรทัดละ 1 แบบ ระบบจะสุ่มใช้ เพื่อไม่ให้ดูเป็นสแปม เว้นว่างไว้ถ้าไม่ต้องการตอบคอมเมนต์"
              htmlFor="publicReplies"
            >
              <textarea id="publicReplies" name="publicReplies" rows={3} defaultValue={values.publicReplies} className={inputClass} />
            </Field>
          )}

          <Field
            label="ข้อความ DM"
            hint={
              <>
                ใช้ <code className="rounded bg-surface-2 px-1">{"{name}"}</code> แทนชื่อลูกค้า และ{" "}
                <code className="rounded bg-surface-2 px-1">{"{link}"}</code> แทนลิงก์ (ถ้าไม่ใส่ {"{link}"} ระบบจะต่อท้ายให้)
                {trigger === "comment" && " · DM จากคอมเมนต์ส่งได้ 1 ข้อความต่อคอมเมนต์ จึงควรใส่ทุกอย่างไว้ในข้อความเดียว"}
              </>
            }
            htmlFor="dmText"
          >
            <textarea id="dmText" name="dmText" rows={5} required maxLength={1000} defaultValue={values.dmText} className={inputClass} />
          </Field>

          <Field label="ลิงก์ (ไม่บังคับ)" hint="ระบบจะแปลงเป็นลิงก์ติดตาม เพื่อนับว่ามีคนกดกี่คน" htmlFor="linkUrl">
            <input id="linkUrl" name="linkUrl" type="url" placeholder="https://" defaultValue={values.linkUrl} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="3. ตัวเลือกเพิ่มเติม">
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
