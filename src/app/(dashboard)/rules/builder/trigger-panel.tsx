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
import { Badge, Button, buttonStyle, cx, Field, IconButton, inputClass, Notice, textareaClass } from "@/components/ui";
import type { Platform, PostScope } from "@/db/schema";
import { useFormat, useT } from "@/lib/i18n/client";
import type { MessageKey, TFunction } from "@/lib/i18n/core";
import type { Formatters } from "@/lib/i18n/format";
import { rulesMessages } from "@/lib/i18n/messages/rules";
import type { RecentPost } from "@/lib/meta/graph";
import { nextPostStatus, postIdsOf, splitKeywords, type BuilderAction, type BuilderDoc, type Problem } from "./model";
import { ChipInput } from "./widgets";

type DocPatch = Extract<BuilderAction, { type: "patch" }>["patch"];
type PatchFn = (patch: DocPatch, key?: string) => void;

const MAX_REPLIES = 10;

type RulesKey = MessageKey<typeof rulesMessages>;
type RulesT = TFunction<RulesKey>;

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
  const t = useT(rulesMessages);
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

      <PanelSection title={t("runsWhen")}>
        <div role="radiogroup" aria-label={t("runsWhen")} className="grid grid-cols-2 gap-2">
          {(
            [
              ["comment", t("triggerComment"), t("triggerCommentHint"), MessageCircle],
              ["dm", t("triggerDm"), t("triggerDmHint"), Send],
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

      <PanelSection title={t("platforms")} description={t("platformsHint")}>
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

      <PanelSection title={t("keywordsTitle")}>
        <SegmentedControl
          block
          label={t("matchLabel")}
          value={doc.matchType}
          onChange={(v) => patch({ matchType: v })}
          options={[
            { value: "contains", label: t("matchContains") },
            { value: "exact", label: t("matchExact") },
            { value: "any", label: t("matchAny") },
          ]}
        />
        <p className="text-xs leading-5 text-fg-3">
          {t(
            doc.matchType === "contains"
              ? isComment
                ? "matchContainsCommentHint"
                : "matchContainsDmHint"
              : doc.matchType === "exact"
                ? "matchExactHint"
                : isComment
                  ? "matchAnyCommentHint"
                  : "matchAnyDmHint",
          )}
        </p>
        {doc.matchType !== "any" && (
          <Field
            label={t("keywordsLabel")}
            htmlFor={`${ids}-kw`}
            error={has("keywords") || has("keyword-long")}
            hint={t("keywordsHint")}
          >
            <ChipInput
              id={`${ids}-kw`}
              values={doc.keywords}
              onChange={(keywords) => patch({ keywords })}
              placeholder={t("keywordsPlaceholder")}
              invalid={!!(has("keywords") || has("keyword-long"))}
            />
          </Field>
        )}
      </PanelSection>

      {isComment && (
        <PostScopeSection doc={doc} onPatch={patch} problem={has("posts")} recentPosts={recentPosts} postsError={postsError} />
      )}

      {isComment && (
        <PanelSection title={t("publicReplyTitle")} description={t("publicReplyHint")}>
          <div className="space-y-2">
            {doc.publicReplies.map((reply, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-medium text-fg-2 tabular" aria-hidden="true">
                  {i + 1}
                </span>
                <input
                  value={reply}
                  aria-label={t("replyLabel", { n: i + 1 })}
                  maxLength={500}
                  placeholder={t("replyPlaceholder")}
                  onChange={(e) =>
                    patch({ publicReplies: doc.publicReplies.map((r, j) => (j === i ? e.target.value.replace(/\n/g, " ") : r)) }, `reply:${i}`)
                  }
                  className={inputClass}
                />
                <IconButton
                  icon={<Trash2 />}
                  label={t("replyDelete", { n: i + 1 })}
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
              <Plus size={16} aria-hidden="true" /> {t("replyAdd")}
            </button>
            {doc.publicReplies.filter((r) => r.trim()).length > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-fg-3">
                <Shuffle size={13} aria-hidden="true" /> {t("replyRandom", { count: doc.publicReplies.filter((r) => r.trim()).length })}
              </span>
            )}
          </div>
          {has("replies") && <p className="text-xs text-critical-text">{has("replies")}</p>}
        </PanelSection>
      )}

      {isComment && (
        <PanelSection title={t("onceTitle")}>
          <Switch checked={doc.oncePerUser} onChange={(v) => patch({ oncePerUser: v })} label={t("onceLabel")} description={t("onceHint")} />
        </PanelSection>
      )}

      <details className="group border-b border-line last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
          {t("advanced")}
          <ChevronDown size={16} className="text-fg-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-5 pb-5">
          <Field label={t("priority")} htmlFor={`${ids}-prio`} hint={t("priorityHint")}>
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

const SCOPE_OPTIONS: { value: PostScope; title: RulesKey; description: RulesKey; Icon: LucideIcon }[] = [
  { value: "specific", title: "postScopeSpecific", description: "postScopeSpecificHint", Icon: ListChecks },
  { value: "next", title: "postScopeNext", description: "postScopeNextHint", Icon: CalendarClock },
  { value: "any", title: "postScopeAny", description: "postScopeAnyHint", Icon: Layers },
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
  const t = useT(rulesMessages);
  const name = useId();
  return (
    <PanelSection title={t("postScopeTitle")}>
      <div role="radiogroup" aria-label={t("postScopeTitle")} className="space-y-2">
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
                  <span className="block text-sm font-medium text-fg">{t(title)}</span>
                  <span className="block text-xs leading-5 text-fg-3">{t(description)}</span>
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
function mediaLabel(post: RecentPost): "mediaReel" | "mediaVideo" | null {
  const link = post.permalink ?? "";
  if (link.includes("/reel/")) return "mediaReel";
  if (post.mediaType === "VIDEO") return post.platform === "instagram" && !/\/(p|tv)\//.test(link) ? "mediaReel" : "mediaVideo";
  if (post.platform === "facebook" && link.includes("/videos/")) return "mediaVideo";
  return null;
}

function SpecificPosts({ doc, onPatch, problem, recentPosts, postsError }: ScopeProps) {
  const t = useT(rulesMessages);
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
        <Notice tone="warning" title={t("postsErrorTitle")}>
          {t("postsErrorBody")}
          <span className="mt-1 block text-xs break-words opacity-75">{postsError}</span>
        </Notice>
      )}

      {posts.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-fg-3">{t("postsPickHint")}</span>
            {count > 0 && <span className="shrink-0 font-medium text-accent tabular">{t("postsSelected", { count })}</span>}
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
              {showAll ? t("showLess") : t("showAll", { count: posts.length })}
            </Button>
          )}
        </>
      ) : (
        !postsError && <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-5 text-fg-2">{t("noRecentPosts")}</p>
      )}

      <details open={manualOpen} onToggle={(e) => setManualOpen(e.currentTarget.open)} className="group/manual rounded-lg border border-line">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-2 hover:bg-surface-2/60 hover:text-fg [&::-webkit-details-marker]:hidden">
          <Hash size={15} className="text-fg-3" aria-hidden="true" />
          {t("manualIds")}
          {manualCount > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-xs text-fg-2 tabular">{manualCount}</span>}
          <ChevronDown size={16} className="ml-auto text-fg-3 transition-transform group-open/manual:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-3 pb-3">
          <Field label={t("manualIdsLabel")} htmlFor={`${ids}-pid`} hint={t("manualIdsHint")}>
            <textarea
              id={`${ids}-pid`}
              rows={2}
              value={doc.postIdsManual}
              onChange={(e) => onPatch({ postIdsManual: e.target.value }, "postIdsManual")}
              placeholder={t("manualIdsPlaceholder")}
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
  const t = useT(rulesMessages);
  const f = useFormat();
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
            <span className="line-clamp-5 break-words">{caption || t("noCaption")}</span>
          </span>
        )}
        <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-surface/90 shadow-xs">
          <PlatformIcon platform={post.platform} size={15} title={PLATFORM_LABEL[post.platform]} />
        </span>
        {media && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-surface/90 px-1.5 py-0.5 text-[11px] font-medium text-fg shadow-xs">
            <Clapperboard size={11} aria-hidden="true" />
            {t(media)}
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
        {post.imageUrl && <span className="line-clamp-2 text-xs leading-4 break-words text-fg">{caption || t("noCaption")}</span>}
        <span className="block text-[11px] text-fg-3 tabular">{post.createdAt ? f.dateTime(post.createdAt) : PLATFORM_LABEL[post.platform]}</span>
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

/** เกินนี้ relativeTime แสดงเป็นวันที่ (ตรงกับ format.ts) */
const RELATIVE_LIMIT_SEC = 7 * 86400;

/** "ผูกเมื่อสักครู่", "ผูกเมื่อ 5 นาทีที่ผ่านมา", "ผูกเมื่อวาน" / "Linked 5 minutes ago", "Linked on Oct 13, 2:05 PM" */
function boundAgo(boundAt: string, now: number | null, t: RulesT, f: Formatters): string {
  if (now !== null && Math.abs(Math.round((new Date(boundAt).getTime() - now) / 1000)) < RELATIVE_LIMIT_SEC) {
    const when = f.relativeTime(boundAt, new Date(now));
    // ไทย: "เมื่อสักครู่" / "เมื่อวาน" มีคำว่า "เมื่อ" อยู่แล้ว ไม่ต้องเติมซ้ำ
    return t(when.startsWith("เมื่อ") ? "boundRelativeJoined" : "boundRelative", { when });
  }
  // ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ (now = null) หรือนานเกิน 7 วัน → วันที่และเวลา
  return t("boundAbsolute", { when: f.dateTime(boundAt) });
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
  const t = useT(rulesMessages);
  const f = useFormat();
  const status = nextPostStatus(doc);
  const now = useNow();
  const hasBound = doc.platforms.some((p) => doc.boundPosts[p]);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-fg-2">{t("nextIntro")}</p>

      {status.kind === "start" && (
        <StatusBox icon={<Timer />} title={t("nextStartTitle")}>
          {t("nextStartBody")}
        </StatusBox>
      )}

      {status.kind === "rearm" && (
        <StatusBox
          tone="accent"
          icon={<RotateCcw />}
          title={t("nextRearmTitle")}
          action={
            <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => onPatch({ rearmNext: false })}>
              {t("nextRearmUndo")}
            </Button>
          }
        >
          {hasBound ? t("nextRearmBodyBound") : t("nextRearmBody")}
        </StatusBox>
      )}

      {status.kind === "waiting" && (
        <div className="flex items-start gap-3 rounded-lg border border-accent/25 bg-accent-soft/50 p-3" role="status">
          <PulseDot className="mt-[7px]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              {t("nextWaiting")} <span className="font-normal text-fg-2">{t("nextWaitingSince", { when: f.dateTime(status.since) })}</span>
            </p>
            <p className="mt-0.5 text-xs leading-5 text-fg-2">{t("nextWaitingHint")}</p>
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
                      {t("nextWaiting")}
                    </p>
                    <p className="text-xs text-fg-3">{t("nextSinceLine", { when: f.dateTime(status.since) })}</p>
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
                      {t("nextBound")}
                    </Badge>
                  </p>
                  <p className={cx("truncate text-sm", post ? "text-fg" : "font-mono text-[13px] text-fg-2")} title={caption || bound.id}>
                    {post ? caption || t("noCaption") : `ID ${bound.id}`}
                  </p>
                  <p className="text-xs text-fg-3">{boundAgo(bound.boundAt, now, t, f)}</p>
                </div>
                {post?.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("openPostAria", { platform: PLATFORM_LABEL[platform] })}
                    title={t("openPostTitle")}
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
            {t("rearmButton")}
          </Button>
          <p className="text-xs leading-5 text-fg-3">{status.kind === "bound" ? t("rearmHintBound") : t("rearmHintWaiting")}</p>
        </div>
      )}
    </div>
  );
}
