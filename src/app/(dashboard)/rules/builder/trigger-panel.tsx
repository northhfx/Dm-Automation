"use client";

import { useId, type Dispatch, type ReactNode } from "react";
import { Check, ChevronDown, MessageCircle, Plus, Send, Shuffle, Trash2 } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { SegmentedControl } from "@/components/segmented-control";
import { Switch } from "@/components/switch";
import { cx, Field, IconButton, inputClass, Notice, textareaClass } from "@/components/ui";
import type { Platform } from "@/db/schema";
import type { RecentPost } from "@/lib/meta/graph";
import type { BuilderAction, BuilderDoc, Problem } from "./model";
import { ChipInput } from "./widgets";

const MAX_REPLIES = 10;

interface Props {
  doc: BuilderDoc;
  dispatch: Dispatch<BuilderAction>;
  problems: Problem[];
  recentPosts: RecentPost[];
  postsError: string | null;
}

export function PanelSection({ title, description, children }: { title?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-5 py-5 last:border-b-0">
      {title && (
        <div>
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-5 text-fg-3">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function TriggerPanel({ doc, dispatch, problems, recentPosts, postsError }: Props) {
  const ids = useId();
  const patch = (p: Parameters<typeof patchAction>[0], key?: string) => dispatch(patchAction(p, key));
  const has = (key: string) => problems.find((p) => p.key === key)?.message;
  const isComment = doc.trigger === "comment";

  function togglePlatform(p: Platform) {
    const on = doc.platforms.includes(p);
    patch({ platforms: on ? doc.platforms.filter((x) => x !== p) : [...doc.platforms, p].sort() });
  }

  return (
    <div>
      {has("start") && (
        <div className="px-5 pt-5">
          <Notice tone="warning">{has("start")}</Notice>
        </div>
      )}

      <PanelSection title="ทำงานเมื่อ">
        <div role="radiogroup" aria-label="ทำงานเมื่อ" className="grid grid-cols-2 gap-2">
          {(
            [
              ["comment", "มีคนคอมเมนต์", "ใต้โพสต์ของเพจ", MessageCircle],
              ["dm", "มีคนทักแชท", "ส่งข้อความ (DM) มา", Send],
            ] as const
          ).map(([value, label, hint, Icon]) => {
            const active = doc.trigger === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch({ trigger: value })}
                className={cx(
                  "relative rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                  active ? "border-accent bg-accent-soft/60 ring-1 ring-accent" : "border-line-strong bg-surface hover:bg-surface-2",
                )}
              >
                <Icon size={18} className={active ? "text-accent" : "text-fg-2"} aria-hidden="true" />
                <span className="mt-2 block text-sm font-medium">{label}</span>
                <span className="block text-xs text-fg-3">{hint}</span>
                {active && (
                  <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection title="แพลตฟอร์ม" description="ใช้กับเพจ Facebook และบัญชี Instagram ที่เชื่อมต่อไว้">
        <div className="grid grid-cols-2 gap-2">
          {(["facebook", "instagram"] as const).map((p) => {
            const on = doc.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => togglePlatform(p)}
                className={cx(
                  "flex h-11 items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                  on ? "border-accent bg-accent-soft/60 text-fg" : "border-line-strong bg-surface text-fg-2 hover:bg-surface-2",
                )}
              >
                <PlatformIcon platform={p} size={18} />
                {p === "facebook" ? "Facebook" : "Instagram"}
                <span
                  className={cx(
                    "ml-auto flex h-4.5 w-4.5 items-center justify-center rounded border",
                    on ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
                  )}
                  aria-hidden="true"
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        {has("platforms") && <p className="text-xs text-critical-text">{has("platforms")}</p>}
      </PanelSection>

      <PanelSection title="คำที่ให้ระบบจับ">
        <SegmentedControl
          block
          label="วิธีจับคำ"
          value={doc.matchType}
          onChange={(v) => patch({ matchType: v })}
          options={[
            { value: "contains", label: "มีคำนี้" },
            { value: "exact", label: "ตรงทั้งหมด" },
            { value: "any", label: "ทุกข้อความ" },
          ]}
        />
        <p className="text-xs leading-5 text-fg-3">
          {doc.matchType === "contains"
            ? `ทำงานเมื่อ${isComment ? "คอมเมนต์" : "ข้อความ"}มีคำใดคำหนึ่งอยู่ เช่น "สนใจค่ะ" ก็นับคำว่า "สนใจ"`
            : doc.matchType === "exact"
              ? `ทำงานเมื่อพิมพ์มาตรงกับคำใดคำหนึ่งทั้งข้อความเท่านั้น`
              : `ทำงานกับทุก${isComment ? "คอมเมนต์" : "ข้อความ"} ไม่ต้องมีคำเฉพาะ`}
        </p>
        {doc.matchType !== "any" && (
          <Field
            label="คำ"
            htmlFor={`${ids}-kw`}
            error={has("keywords") || has("keyword-long")}
            hint="กด Enter หรือพิมพ์ , เพื่อเพิ่มคำ — วางหลายคำพร้อมกันได้"
          >
            <ChipInput
              id={`${ids}-kw`}
              values={doc.keywords}
              onChange={(keywords) => patch({ keywords })}
              placeholder="เช่น สนใจ, ราคา, link"
              invalid={!!(has("keywords") || has("keyword-long"))}
            />
          </Field>
        )}
      </PanelSection>

      {isComment && (
        <PanelSection title="ใช้กับโพสต์ไหน">
          <SegmentedControl
            block
            label="ใช้กับโพสต์ไหน"
            value={doc.allPosts ? "all" : "some"}
            onChange={(v) => patch({ allPosts: v === "all" })}
            options={[
              { value: "all", label: "ทุกโพสต์" },
              { value: "some", label: "เลือกโพสต์" },
            ]}
          />
          {!doc.allPosts && (
            <div className="space-y-3">
              {postsError && <Notice tone="warning">ดึงรายการโพสต์ไม่ได้: {postsError}</Notice>}
              {recentPosts.length > 0 ? (
                <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {recentPosts.map((post) => {
                    const on = doc.postIds.includes(post.id);
                    return (
                      <button
                        key={post.id}
                        type="button"
                        aria-pressed={on}
                        title={post.caption || "(ไม่มีข้อความ)"}
                        onClick={() => patch({ postIds: on ? doc.postIds.filter((x) => x !== post.id) : [...doc.postIds, post.id] })}
                        className={cx(
                          "group relative overflow-hidden rounded-lg border text-left focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
                          on ? "border-accent ring-2 ring-accent" : "border-line hover:border-fg-3/60",
                        )}
                      >
                        {post.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- รูปจาก CDN ของ Meta
                          <img src={post.imageUrl} alt="" className="aspect-square w-full object-cover" />
                        ) : (
                          <span className="flex aspect-square w-full items-center justify-center bg-surface-2 p-2 text-center text-[11px] leading-4 text-fg-2">
                            <span className="line-clamp-4">{post.caption || "(ไม่มีข้อความ)"}</span>
                          </span>
                        )}
                        <span className="absolute bottom-1 left-1">
                          <PlatformIcon platform={post.platform} size={16} />
                        </span>
                        <span
                          className={cx(
                            "absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2",
                            on ? "border-accent bg-accent text-accent-fg" : "border-white/90 bg-black/20",
                          )}
                          aria-hidden="true"
                        >
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !postsError && <p className="text-xs text-fg-3">ยังไม่พบโพสต์ล่าสุด — ใส่ Post ID เองด้านล่างได้</p>
              )}
              <Field label="หรือใส่ Post ID เอง" htmlFor={`${ids}-pid`} optional hint="คั่นด้วยบรรทัดใหม่หรือจุลภาค (ใช้กับโพสต์เก่าที่ไม่อยู่ในรายการ)">
                <textarea
                  id={`${ids}-pid`}
                  rows={2}
                  value={doc.postIdsManual}
                  onChange={(e) => patch({ postIdsManual: e.target.value }, "postIdsManual")}
                  className={cx(textareaClass, "min-h-0")}
                />
              </Field>
              {has("posts") && <p className="text-xs text-critical-text">{has("posts")}</p>}
            </div>
          )}
        </PanelSection>
      )}

      {isComment && (
        <PanelSection
          title="ตอบใต้คอมเมนต์"
          description="ทุกคนเห็นคำตอบนี้ — ระบบสุ่มใช้ทีละแบบ ดูเป็นธรรมชาติและไม่โดนมองว่าเป็นสแปม (ลบหมด = ไม่ตอบใต้คอมเมนต์)"
        >
          <div className="space-y-2">
            {doc.publicReplies.map((reply, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-medium text-fg-2 tabular" aria-hidden="true">
                  {i + 1}
                </span>
                <input
                  value={reply}
                  aria-label={`คำตอบแบบที่ ${i + 1}`}
                  maxLength={500}
                  placeholder="เช่น ส่งรายละเอียดให้ทาง DM แล้วนะคะ"
                  onChange={(e) =>
                    patch({ publicReplies: doc.publicReplies.map((r, j) => (j === i ? e.target.value.replace(/\n/g, " ") : r)) }, `reply:${i}`)
                  }
                  className={inputClass}
                />
                <IconButton
                  icon={<Trash2 />}
                  label={`ลบคำตอบแบบที่ ${i + 1}`}
                  size="md"
                  onClick={() => patch({ publicReplies: doc.publicReplies.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={doc.publicReplies.length >= MAX_REPLIES}
              onClick={() => patch({ publicReplies: [...doc.publicReplies, ""] })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
            >
              <Plus size={16} aria-hidden="true" /> เพิ่มแบบ
            </button>
            {doc.publicReplies.filter((r) => r.trim()).length > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-3">
                <Shuffle size={13} aria-hidden="true" /> สุ่ม {doc.publicReplies.filter((r) => r.trim()).length} แบบ
              </span>
            )}
          </div>
          {has("replies") && <p className="text-xs text-critical-text">{has("replies")}</p>}
        </PanelSection>
      )}

      {isComment && (
        <PanelSection title="กันส่งซ้ำ">
          <Switch
            checked={doc.oncePerUser}
            onChange={(v) => patch({ oncePerUser: v })}
            label="ตอบคนเดิมครั้งเดียวต่อโพสต์"
            description="ถ้าคนเดิมคอมเมนต์หลายครั้งในโพสต์เดียวกัน จะส่ง DM ให้แค่ครั้งแรก"
          />
        </PanelSection>
      )}

      <details className="group border-b border-line last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
          ขั้นสูง
          <ChevronDown size={16} className="text-fg-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-5 pb-5">
          <Field label="ลำดับความสำคัญ" htmlFor={`${ids}-prio`} hint="ถ้าข้อความตรงหลายกฎ ระบบใช้กฎที่เลขน้อยกว่า (1–1000)">
            <input
              id={`${ids}-prio`}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={doc.priority}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) patch({ priority: Math.min(1000, Math.max(1, n)) }, "priority");
              }}
              className={cx(inputClass, "max-w-32")}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

function patchAction(patch: Extract<BuilderAction, { type: "patch" }>["patch"], key?: string): BuilderAction {
  return { type: "patch", patch, key, at: Date.now() };
}
