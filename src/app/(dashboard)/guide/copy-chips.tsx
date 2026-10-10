"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { toast } from "@/components/toast";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // เบราว์เซอร์บางตัวไม่อนุญาต → ใช้วิธีเก่า
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

/**
 * รายการคำ (เช่น ชื่อ permission) ที่กดคัดลอกได้ทีละคำ + ปุ่มคัดลอกทั้งหมด
 * ใช้ในขั้นที่ต้องพิมพ์ค้นหาทีละตัวในเว็บ Meta
 */
export function CopyChips({ items, allLabel = "คัดลอกทั้งหมด" }: { items: string[]; allLabel?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(text: string, key: string, message: string) {
    await writeClipboard(text);
    setCopied(key);
    toast(message, { tone: "good", duration: 2500 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-2.5">
      <ul className="flex flex-wrap gap-1.5" aria-label="กดเพื่อคัดลอกทีละรายการ">
        {items.map((item) => {
          const done = copied === item;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => copy(item, item, `คัดลอก ${item} แล้ว`)}
                aria-label={`คัดลอก ${item}`}
                className={cx(
                  "group inline-flex h-10 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs transition-colors sm:h-8 sm:px-2",
                  done
                    ? "border-good/40 bg-good-soft text-good-text"
                    : "border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface",
                )}
              >
                {item}
                {done ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <Copy className="size-3.5 shrink-0 text-fg-3 group-hover:text-fg-2" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        icon={copied === "*" ? <Check /> : <Copy />}
        onClick={() => copy(items.join(", "), "*", `คัดลอกทั้ง ${items.length} รายการแล้ว`)}
        className="max-sm:h-10"
      >
        {allLabel}
      </Button>
    </div>
  );
}
