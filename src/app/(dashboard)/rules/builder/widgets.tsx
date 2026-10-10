"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { cx } from "@/components/ui";
import type { Platform } from "@/db/schema";

/** ไอคอนแพลตฟอร์มขนาดเล็ก (ใช้ในการ์ดบนแผนผัง) */
export function PlatformMark({ platform, withLabel }: { platform: Platform; withLabel?: boolean }) {
  const label = platform === "instagram" ? "Instagram" : "Facebook";
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <PlatformIcon platform={platform} size={14} />
      {withLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

/** ช่องใส่คำแบบชิป: Enter หรือจุลภาคเพื่อเพิ่ม, × เพื่อลบ, วางข้อความหลายบรรทัดแล้วแยกให้ */
export function ChipInput({
  id,
  values,
  onChange,
  placeholder,
  maxLength = 100,
  invalid,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxLength?: number;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string[]) {
    const next = [...values];
    for (const r of raw) {
      const v = r.trim().slice(0, maxLength);
      if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    if (next.length !== values.length) onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (draft.trim()) {
        add([draft]);
        setDraft("");
      }
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[\n,]/.test(text)) {
      e.preventDefault();
      add((draft + text).split(/[\n,]/));
      setDraft("");
    }
  }

  return (
    <div
      className={cx(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 focus-within:ring-2",
        invalid ? "border-critical/60 focus-within:ring-critical/25" : "border-line focus-within:border-accent focus-within:ring-accent/25",
      )}
    >
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-soft py-0.5 pr-1 pl-2 text-sm font-medium text-accent">
          <span className="truncate">{v}</span>
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            aria-label={`ลบคำ ${v}`}
            // พื้นที่แตะกว้างกว่าที่เห็น (before) ให้กดโดนง่ายบนมือถือ
            className="relative flex h-6 w-6 items-center justify-center rounded before:absolute before:-inset-2 hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          // คีย์บอร์ดมือถือบางรุ่นไม่ส่ง keydown ของจุลภาค → แยกคำตรงนี้แทน
          const parts = e.target.value.split(",");
          if (parts.length > 1) add(parts.slice(0, -1));
          setDraft(parts[parts.length - 1]);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) {
            add([draft]);
            setDraft("");
          }
        }}
        maxLength={maxLength}
        placeholder={values.length ? "" : placeholder}
        enterKeyHint="enter"
        className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-fg-3"
      />
    </div>
  );
}

