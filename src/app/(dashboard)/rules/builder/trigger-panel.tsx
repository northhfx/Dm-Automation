"use client";

import { useId, useState, useSyncExternalStore, type Dispatch, type ReactNode } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  Clapperboard,
  ExternalLink,
  Hash,
  Layers,
  Link2,
  ListChecks,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Shuffle,
  Timer,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { SegmentedControl } from "@/components/segmented-control";
import { Switch } from "@/components/switch";
import { Badge, Button, buttonStyle, cx, Field, formatDateTime, formatRelativeTime, IconButton, inputClass, Notice, textareaClass } from "@/components/ui";
import type { Platform, PostScope } from "@/db/schema";
import type { RecentPost } from "@/lib/meta/graph";
import { nextPostStatus, postIdsOf, splitKeywords, type BuilderAction, type BuilderDoc, type Problem } from "./model";
import { ChipInput } from "./widgets";

type DocPatch = Extract<BuilderAction, { type: "patch" }>["patch"];
type PatchFn = (patch: DocPatch, key?: string) => void;

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
  const patch: PatchFn = (p, key) => dispatch(patchAction(p, key));
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
              ["comment", "มีคนคอมเมนต์", "ใต้โพสต์หรือรีล", MessageCircle],
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
        <PostScopeSection doc={doc} onPatch={patch} problem={has("posts")} recentPosts={recentPosts} postsError={postsError} />
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
          <Field label="ลำดับความสำคัญ" htmlFor={`${ids}-prio`} hint="ถ้าข้อความตรงหลายกฎ ระบบใช้กฎที่เลขน้อยกว่า (1–1000) · ง่ายกว่านั้น: กดย้ายขึ้น/ลงได้จากปุ่ม ⋮ ในหน้ากฎทั้งหมด">
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

/* ---------------------------------------------------------------- ใช้กับโพสต์หรือรีลไหน */

const SCOPE_OPTIONS: { value: PostScope; title: string; description: string; Icon: LucideIcon }[] = [
  { value: "specific", title: "โพสต์หรือรีลที่เลือก", description: "เลือกจากโพสต์ล่าสุด หรือใส่ ID เอง", Icon: ListChecks },
  { value: "next", title: "โพสต์หรือรีลถัดไป", description: "โพสต์หรือรีลแรกที่ลงหลังกดบันทึก", Icon: CalendarClock },
  { value: "any", title: "ทุกโพสต์และรีล", description: "ใช้กับทุกโพสต์และรีล รวมถึงที่ลงในอนาคต", Icon: Layers },
];

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

interface ScopeProps {
  doc: BuilderDoc;
  onPatch: PatchFn;
  problem?: string;
  recentPosts: RecentPost[];
  postsError: string | null;
}

/** เลือกแบบเดียวจาก 3 แบบ (radio จริง → ใช้ลูกศรเลื่อนได้) แบบที่เลือกกางรายละเอียดออกมาใต้หัวข้อ */
function PostScopeSection({ doc, onPatch, problem, recentPosts, postsError }: ScopeProps) {
  const name = useId();
  return (
    <PanelSection title="ใช้กับโพสต์หรือรีลไหน">
      <div role="radiogroup" aria-label="ใช้กับโพสต์หรือรีลไหน" className="space-y-2">
        {SCOPE_OPTIONS.map(({ value, title, description, Icon }) => {
          const on = doc.postScope === value;
          return (
            <div
              key={value}
              className={cx(
                "overflow-hidden rounded-xl border transition-colors has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-accent/40",
                on ? "border-accent ring-1 ring-accent" : "border-line-strong hover:border-fg-3/60",
              )}
            >
              <label className={cx("flex min-h-16 cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors", on ? "bg-accent-soft/60" : "bg-surface hover:bg-surface-2/70")}>
                <input
                  type="radio"
                  name={name}
                  value={value}
                  checked={on}
                  onChange={() => onPatch({ postScope: value })}
                  className="sr-only"
                />
                <span
                  className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", on ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-2")}
                >
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{title}</span>
                  <span className="block text-xs leading-5 text-fg-3">{description}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    on ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface",
                  )}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
              </label>
              {on && value === "specific" && (
                <div className="border-t border-line bg-surface p-3.5">
                  <SpecificPosts doc={doc} onPatch={onPatch} problem={problem} recentPosts={recentPosts} postsError={postsError} />
                </div>
              )}
              {on && value === "next" && (
                <div className="border-t border-line bg-surface p-3.5">
                  <NextPostInfo doc={doc} onPatch={onPatch} recentPosts={recentPosts} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PanelSection>
  );
}

/* ---------------------------------------------------------------- โพสต์หรือรีลที่เลือก */

/** แสดงโพสต์ล่าสุดทีละ 6 รายการก่อน (ที่เหลือกด "ดูทั้งหมด") */
const PREVIEW_COUNT = 6;

/** ป้าย "รีล"/"วิดีโอ" — Instagram ส่งรีลมาเป็น VIDEO (ดูจากลิงก์ว่าเป็น /reel/ หรือเปล่า) */
function mediaLabel(post: RecentPost): string | null {
  const link = post.permalink ?? "";
  if (link.includes("/reel/")) return "รีล";
  if (post.mediaType === "VIDEO") return post.platform === "instagram" && !/\/(p|tv)\//.test(link) ? "รีล" : "วิดีโอ";
  if (post.platform === "facebook" && link.includes("/videos/")) return "วิดีโอ";
  return null;
}

function SpecificPosts({ doc, onPatch, problem, recentPosts, postsError }: ScopeProps) {
  const ids = useId();
  // โพสต์ของแพลตฟอร์มที่เลือกไว้ (+ โพสต์ที่เคยติ๊กไว้ เผื่อเปลี่ยนแพลตฟอร์มทีหลัง จะได้เห็นและเอาออกได้)
  const posts = recentPosts.filter((p) => !doc.platforms.length || doc.platforms.includes(p.platform) || doc.postIds.includes(p.id));
  const [showAll, setShowAll] = useState(() => posts.some((p, i) => i >= PREVIEW_COUNT && doc.postIds.includes(p.id)));
  const [manualOpen, setManualOpen] = useState(() => !!doc.postIdsManual.trim() || recentPosts.length === 0);
  const shown = showAll ? posts : posts.slice(0, PREVIEW_COUNT);
  const count = postIdsOf(doc).length;
  const manualCount = splitKeywords(doc.postIdsManual).flatMap((x) => x.split(/\s+/)).filter(Boolean).length;

  function toggle(id: string) {
    const on = doc.postIds.includes(id);
    onPatch({ postIds: on ? doc.postIds.filter((x) => x !== id) : [...doc.postIds, id] });
  }

  return (
    <div className="space-y-3">
      {postsError && (
        <Notice tone="warning" title="ตอนนี้ดึงโพสต์ล่าสุดไม่ได้">
          ใส่ ID ของโพสต์เองด้านล่างได้ หรือลองรีเฟรชหน้านี้อีกครั้ง
          <span className="mt-1 block text-xs break-words opacity-75">{postsError}</span>
        </Notice>
      )}

      {posts.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-fg-3">แตะเพื่อเลือก (เลือกได้หลายรายการ)</span>
            {count > 0 && <span className="shrink-0 font-medium text-accent tabular">เลือกแล้ว {count}</span>}
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((post) => (
              <li key={post.id}>
                <PostTile post={post} selected={doc.postIds.includes(post.id)} onToggle={() => toggle(post.id)} />
              </li>
            ))}
          </ul>
          {posts.length > PREVIEW_COUNT && (
            <Button variant="ghost" size="sm" block iconRight={<ChevronDown className={cx("transition-transform", showAll && "rotate-180")} />} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${posts.length} รายการ`}
            </Button>
          )}
        </>
      ) : (
        !postsError && <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-5 text-fg-2">ยังไม่พบโพสต์ล่าสุด — ใส่ ID ของโพสต์เองด้านล่างได้</p>
      )}

      <details open={manualOpen} onToggle={(e) => setManualOpen(e.currentTarget.open)} className="group/manual rounded-lg border border-line">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-2 hover:bg-surface-2/60 hover:text-fg [&::-webkit-details-marker]:hidden">
          <Hash size={15} className="text-fg-3" aria-hidden="true" />
          ใส่ ID เอง
          {manualCount > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-xs text-fg-2 tabular">{manualCount}</span>}
          <ChevronDown size={16} className="ml-auto text-fg-3 transition-transform group-open/manual:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-3 pb-3">
          <Field label="ID ของโพสต์หรือรีล" htmlFor={`${ids}-pid`} hint="คั่นด้วยบรรทัดใหม่หรือจุลภาค — ใช้กับโพสต์เก่าที่ไม่อยู่ในรายการ">
            <textarea
              id={`${ids}-pid`}
              rows={2}
              value={doc.postIdsManual}
              onChange={(e) => onPatch({ postIdsManual: e.target.value }, "postIdsManual")}
              placeholder="เช่น 1234567890_987654321"
              className={cx(textareaClass, "min-h-0")}
            />
          </Field>
        </div>
      </details>

      {problem && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-critical-text">
          <CircleAlert size={14} className="shrink-0" aria-hidden="true" />
          {problem}
        </p>
      )}
    </div>
  );
}

function PostTile({ post, selected, onToggle }: { post: RecentPost; selected: boolean; onToggle: () => void }) {
  const caption = post.caption.trim();
  const media = mediaLabel(post);
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={caption || undefined}
      onClick={onToggle}
      className={cx(
        "group/post block w-full overflow-hidden rounded-lg border bg-surface text-left transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-accent/40 focus-visible:outline-none",
        selected ? "border-accent ring-2 ring-accent" : "border-line hover:border-fg-3/60",
      )}
    >
      <span className="relative block aspect-square bg-surface-2">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- รูปจาก CDN ของ Meta
          <img src={post.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-3 text-center text-[11px] leading-4 text-fg-2">
            <span className="line-clamp-5 break-words">{caption || "(ไม่มีข้อความ)"}</span>
          </span>
        )}
        <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-surface/90 shadow-xs">
          <PlatformIcon platform={post.platform} size={15} title={PLATFORM_LABEL[post.platform]} />
        </span>
        {media && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-surface/90 px-1.5 py-0.5 text-[11px] font-medium text-fg shadow-xs">
            <Clapperboard size={11} aria-hidden="true" />
            {media}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-xs transition-colors",
            // ยังไม่เลือก: วงกลมทึบเกือบเต็ม + ขอบเข้ม ให้เห็นได้บนทุกรูป (รวมรูปสีอ่อน)
            selected ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface/90 shadow-sm group-hover/post:bg-surface",
          )}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      </span>
      <span className="block space-y-0.5 px-2 py-1.5">
        {post.imageUrl && <span className="line-clamp-2 text-xs leading-4 break-words text-fg">{caption || "(ไม่มีข้อความ)"}</span>}
        <span className="block text-[11px] text-fg-3 tabular">{post.createdAt ? formatDateTime(post.createdAt) : PLATFORM_LABEL[post.platform]}</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- โพสต์หรือรีลถัดไป */

// "ตอนนี้" ฝั่งเบราว์เซอร์ (อัปเดตทุก 30 วินาที) — ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์เป็น null เพื่อไม่ให้ข้อความเวลาไม่ตรงกันตอน hydrate
let nowSnapshot = 0;
function readNow(): number {
  const t = Date.now();
  if (t - nowSnapshot >= 30_000) nowSnapshot = t;
  return nowSnapshot;
}
function subscribeNow(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}
function useNow(): number | null {
  return useSyncExternalStore(subscribeNow, readNow, () => null);
}

/** "ผูกเมื่อสักครู่", "ผูกเมื่อ 5 นาทีที่ผ่านมา", "ผูกเมื่อวาน" */
function boundAgo(boundAt: string, now: number | null): string {
  const when = now === null ? formatDateTime(boundAt) : formatRelativeTime(boundAt, new Date(now));
  return when.startsWith("เมื่อ") ? `ผูก${when}` : `ผูกเมื่อ ${when}`;
}

/** Facebook ส่ง id มาเป็น "<pageId>_<postId>" — เทียบได้ทั้งแบบเต็มและแบบสั้น */
function findRecentPost(posts: RecentPost[], id: string): RecentPost | undefined {
  const short = (x: string) => x.split("_").pop() ?? x;
  return posts.find((p) => p.id === id) ?? posts.find((p) => short(p.id) === short(id));
}

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cx("relative flex h-2.5 w-2.5 shrink-0", className)} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40 [animation-duration:2s]" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
    </span>
  );
}

function StatusBox({ icon, title, children, action, tone = "neutral" }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-lg border p-3",
        tone === "accent" ? "border-accent/25 bg-accent-soft/50" : "border-line bg-surface-2/60",
      )}
    >
      <span className={cx("mt-0.5 shrink-0 [&_svg]:size-4", tone === "accent" ? "text-accent" : "text-fg-2")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {children && <div className="mt-0.5 text-xs leading-5 text-fg-2">{children}</div>}
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  );
}

function NextPostInfo({ doc, onPatch, recentPosts }: Pick<ScopeProps, "doc" | "onPatch" | "recentPosts">) {
  const status = nextPostStatus(doc);
  const now = useNow();
  const hasBound = doc.platforms.some((p) => doc.boundPosts[p]);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-fg-2">ระบบจะใช้กฎนี้กับโพสต์หรือรีลแรกที่คุณลงหลังจากกดบันทึก (Facebook และ Instagram แยกกัน)</p>

      {status.kind === "start" && (
        <StatusBox icon={<Timer />} title="เริ่มนับหลังกดบันทึก">
          โพสต์หรือรีลที่ลงก่อนหน้านั้นจะไม่ใช้กฎนี้
        </StatusBox>
      )}

      {status.kind === "rearm" && (
        <StatusBox
          tone="accent"
          icon={<RotateCcw />}
          title="จะเริ่มนับใหม่เมื่อกดบันทึก"
          action={
            <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => onPatch({ rearmNext: false })}>
              ยกเลิก
            </Button>
          }
        >
          {hasBound ? "ล้างโพสต์ที่ผูกไว้ แล้วรอโพสต์หรือรีลที่ลงหลังจากนั้นแทน" : "รอโพสต์หรือรีลที่ลงหลังจากนั้น"}
        </StatusBox>
      )}

      {status.kind === "waiting" && (
        <div className="flex items-start gap-3 rounded-lg border border-accent/25 bg-accent-soft/50 p-3" role="status">
          <PulseDot className="mt-[7px]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              กำลังรอโพสต์ใหม่ <span className="font-normal text-fg-2">ตั้งแต่ {formatDateTime(status.since)}</span>
            </p>
            <p className="mt-0.5 text-xs leading-5 text-fg-2">ลงโพสต์หรือรีลได้เลย ระบบจะผูกให้เองเมื่อมีคนคอมเมนต์ครั้งแรก</p>
          </div>
        </div>
      )}

      {status.kind === "bound" && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {(doc.platforms.length ? doc.platforms : status.bound).map((platform) => {
            const bound = doc.boundPosts[platform];
            if (!bound) {
              return (
                <li key={platform} className="flex items-center gap-3 p-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong bg-surface-2/50">
                    <PlatformIcon platform={platform} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-fg-2">{PLATFORM_LABEL[platform]}</p>
                    <p className="flex items-center gap-2 text-sm text-fg">
                      <PulseDot />
                      กำลังรอโพสต์ใหม่
                    </p>
                    <p className="text-xs text-fg-3">ตั้งแต่ {formatDateTime(status.since)}</p>
                  </div>
                </li>
              );
            }
            const post = findRecentPost(recentPosts, bound.id);
            const caption = post?.caption.trim();
            return (
              <li key={platform} className="flex items-center gap-3 p-3">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {post?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- รูปจาก CDN ของ Meta
                    <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-fg-3">
                      {post && mediaLabel(post) ? <Clapperboard size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
                    </span>
                  )}
                  <span className="absolute right-0.5 bottom-0.5 flex h-4.5 w-4.5 items-center justify-center rounded bg-surface/90">
                    <PlatformIcon platform={platform} size={13} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
                    {PLATFORM_LABEL[platform]}
                    <Badge tone="good" size="sm" icon={<Link2 />}>
                      ผูกแล้ว
                    </Badge>
                  </p>
                  <p className={cx("truncate text-sm", post ? "text-fg" : "font-mono text-[13px] text-fg-2")} title={caption || bound.id}>
                    {post ? caption || "(ไม่มีข้อความ)" : `ID ${bound.id}`}
                  </p>
                  <p className="text-xs text-fg-3">{boundAgo(bound.boundAt, now)}</p>
                </div>
                {post?.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`เปิดโพสต์ใน ${PLATFORM_LABEL[platform]}`}
                    title="เปิดดูโพสต์"
                    className={buttonStyle("ghost", "md", { iconOnly: true })}
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(status.kind === "waiting" || status.kind === "bound") && (
        <div className="space-y-1.5">
          <Button variant="secondary" icon={<RotateCcw />} onClick={() => onPatch({ rearmNext: true })}>
            เริ่มรอโพสต์ถัดไปใหม่
          </Button>
          <p className="text-xs leading-5 text-fg-3">
            {status.kind === "bound"
              ? "ล้างโพสต์ที่ผูกไว้ แล้วให้กฎนี้ไปใช้กับโพสต์หรือรีลที่ลงหลังกดบันทึกแทน"
              : "เริ่มนับเวลาใหม่จากตอนกดบันทึก (โพสต์ที่ลงก่อนหน้านั้นจะไม่ใช้กฎนี้)"}
          </p>
        </div>
      )}
    </div>
  );
}
