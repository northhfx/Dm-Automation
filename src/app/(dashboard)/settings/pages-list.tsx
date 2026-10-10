import { CircleAlert, CircleCheck, CircleX, Plug } from "lucide-react";
import { Avatar, Badge, buttonStyle, cx, EmptyState, formatDateTime, PlatformIcon } from "@/components/ui";
import type { ConnectedPage } from "@/lib/pages";
import { DisconnectButton, ResubscribeButton } from "./page-actions";

/** สถานะของเพจ: พร้อมใช้งาน / ต้องเชื่อมต่อใหม่ / ยังไม่รับข้อความ (subscribe webhook ไม่สำเร็จ) */
function PageStatus({ page }: { page: ConnectedPage }) {
  if (!page.token) {
    return (
      <Badge tone="critical" icon={<CircleX />}>
        ต้องเชื่อมต่อใหม่
      </Badge>
    );
  }
  if (page.subscribed) {
    return (
      <Badge tone="good" icon={<CircleCheck />}>
        พร้อมใช้งาน
      </Badge>
    );
  }
  return (
    <Badge tone="critical" icon={<CircleX />}>
      ยังไม่รับ webhook
    </Badge>
  );
}

/**
 * รายการเพจที่เชื่อมต่อแล้ว พร้อมสถานะการรับ webhook
 * inset = แสดงในกรอบของตัวเอง (ใช้ในหน้าคู่มือ) — ค่าเริ่มต้นชิดขอบการ์ด (Card padding="none")
 * ปุ่ม "เชื่อมต่อใหม่" ลิงก์ไปที่ #connect (ฟอร์มเชื่อมเพจในหน้าเดียวกัน)
 */
export function PagesList({ pages, inset }: { pages: ConnectedPage[]; inset?: boolean }) {
  if (pages.length === 0) {
    return (
      <div className={inset ? undefined : "p-5"}>
        <EmptyState
          compact
          icon={<Plug aria-hidden />}
          title="ยังไม่มีเพจที่เชื่อมต่อ"
          action={
            <a href="#connect" className={buttonStyle("primary")}>
              เชื่อมต่อเพจแรก
            </a>
          }
        >
          เชื่อมเพจ Facebook (และ Instagram ที่ผูกไว้) เพื่อให้ระบบเริ่มตอบลูกค้าอัตโนมัติ
        </EmptyState>
      </div>
    );
  }

  return (
    <ul className={cx("divide-y divide-line", inset && "rounded-lg border border-line bg-surface")}>
      {pages.map((p) => {
        const problem = !p.token
          ? "token ของเพจนี้ใช้ไม่ได้แล้ว — วาง token ใหม่ในฟอร์มเชื่อมต่อเพจ แล้วเลือกเพจนี้อีกครั้ง"
          : p.lastError;
        return (
          <li key={p.id} className={cx("flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", inset ? "p-4" : "px-5 py-4")}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar name={p.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="min-w-0 truncate leading-6 font-medium text-fg">{p.name}</p>
                  <PageStatus page={p} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="outline" icon={<PlatformIcon platform="facebook" size={14} />}>
                    Facebook
                  </Badge>
                  {p.igUsername ? (
                    <Badge tone="outline" icon={<PlatformIcon platform="instagram" size={14} />}>
                      Instagram @{p.igUsername}
                    </Badge>
                  ) : (
                    <Badge tone="warning" icon={<PlatformIcon platform="instagram" variant="mono" size={14} />}>
                      ไม่มี Instagram ที่ผูกไว้
                    </Badge>
                  )}
                </div>
                {problem && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-critical-text">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{problem}</span>
                  </p>
                )}
                <p className="mt-1.5 text-xs leading-5 text-fg-3">เชื่อมต่อเมื่อ {formatDateTime(p.connectedAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap">
              {!p.token ? (
                <a href="#connect" className={cx(buttonStyle("secondary"), "max-sm:flex-1")}>
                  <Plug aria-hidden />
                  เชื่อมต่อใหม่
                </a>
              ) : (
                !p.subscribed && <ResubscribeButton pageId={p.id} pageName={p.name} />
              )}
              <DisconnectButton pageId={p.id} pageName={p.name} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
