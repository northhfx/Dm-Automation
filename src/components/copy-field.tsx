"use client";

import { useState } from "react";

/** ช่องแสดงค่าพร้อมปุ่มคัดลอก (ใช้กับ URL / token ที่ต้องเอาไปวางในเว็บ Meta) */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // เบราว์เซอร์บางตัวไม่อนุญาต → ให้ผู้ใช้เลือกข้อความเอง
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-1">
      {label && <div className="text-xs font-medium text-fg-2">{label}</div>}
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs break-all select-all">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        >
          {copied ? "✓ คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
    </div>
  );
}
