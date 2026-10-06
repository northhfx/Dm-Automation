import { Badge, buttonClass, formatDateTime } from "@/components/ui";
import type { ConnectedPage } from "@/lib/pages";
import { disconnectPage, resubscribePage } from "./actions";

/** รายการเพจที่เชื่อมต่อแล้ว พร้อมสถานะการรับ webhook */
export function PagesList({ pages }: { pages: ConnectedPage[] }) {
  if (pages.length === 0) return <p className="text-sm text-fg-2">ยังไม่มีเพจที่เชื่อมต่อ</p>;
  return (
    <ul className="space-y-3">
      {pages.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{p.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge>Facebook</Badge>
              {p.igUsername ? <Badge>Instagram @{p.igUsername}</Badge> : <Badge tone="warning">ไม่มี Instagram ที่ผูกไว้</Badge>}
              {!p.token ? (
                <Badge tone="critical">✕ ต้องเชื่อมต่อใหม่</Badge>
              ) : p.subscribed ? (
                <Badge tone="good">✓ พร้อมใช้งาน</Badge>
              ) : (
                <Badge tone="critical">✕ ยังไม่รับ webhook</Badge>
              )}
            </div>
            {p.lastError && <p className="mt-1 text-xs text-critical-text">{p.lastError}</p>}
            <p className="mt-1 text-xs text-fg-3">เชื่อมต่อเมื่อ {formatDateTime(p.connectedAt)}</p>
          </div>
          <div className="flex gap-2">
            {p.token && !p.subscribed && (
              <form action={resubscribePage}>
                <input type="hidden" name="pageId" value={p.id} />
                <button className={buttonClass.secondary}>ลองใหม่</button>
              </form>
            )}
            <form action={disconnectPage}>
              <input type="hidden" name="pageId" value={p.id} />
              <button className={buttonClass.danger}>ยกเลิกการเชื่อมต่อ</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
