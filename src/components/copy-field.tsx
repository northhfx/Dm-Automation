"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "./ui";
import { toast } from "./toast";

/** ช่องแสดงค่าพร้อมปุ่มคัดลอก (ใช้กับ URL / token ที่ต้องเอาไปวางในเว็บ Meta) */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // เบราว์เซอร์บางตัวไม่อนุญาต → ใช้วิธีเก่า
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    toast(label ? `คัดลอก ${label} แล้ว` : "คัดลอกแล้ว", { tone: "good", duration: 2500 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-w-0 space-y-1.5">
      {label && <div className="text-xs font-medium text-fg-2">{label}</div>}
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface-2 shadow-xs">
        <code className="min-w-0 flex-1 px-3 py-2 font-mono text-[13px] leading-[22px] break-all text-fg select-all">{value}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={label ? `คัดลอก ${label}` : "คัดลอก"}
          className={cx(
            "flex shrink-0 items-center gap-1.5 border-l border-line-strong bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2",
            copied ? "text-good-text" : "text-fg-2 hover:text-fg",
          )}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          <span className="max-sm:sr-only">{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
        </button>
      </div>
    </div>
  );
}
