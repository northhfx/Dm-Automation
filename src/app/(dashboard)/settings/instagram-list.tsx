import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX, KeyRound, TriangleAlert } from "lucide-react";
import { Avatar, Badge, buttonStyle, cx, EmptyState, formatDateTime, PlatformIcon } from "@/components/ui";
import {
  INSTAGRAM_ERRORS,
  instagramAccountHealth,
  instagramHealthLevel,
  needsNewInstagramToken,
  type InstagramAccount,
  type InstagramAccountHealth,
} from "@/lib/instagram/accounts";
import type { ConnectedPage } from "@/lib/pages";
import { DisconnectInstagramButton, RefreshInstagramTokenButton, ResubscribeInstagramButton } from "./instagram-actions";

/*
 * รายการบัญชี Instagram ที่เชื่อมผ่าน Instagram Login (Server Component)
 * ปุ่มฝั่ง Client ได้รับแค่ accountId / username — ห้ามส่ง token ออกไปที่เบราว์เซอร์
 */

/** ป้ายสถานะของบัญชี — ใช้ instagramAccountHealth กติกาเดียวกับแถบเมนูและคู่มือ */
const STATUS_LABEL: Record<InstagramAccountHealth, string> = {
  invalid: "ต้องเชื่อมต่อใหม่",
  expired: "token หมดอายุ",
  rejected: "token ใช้ไม่ได้",
  unsubscribed: "ยังไม่รับ webhook",
  expiring: "token ใกล้หมดอายุ",
  warning: "ต้องตรวจสอบ",
  ok: "พร้อมใช้งาน",
};

function AccountStatus({ health }: { health: InstagramAccountHealth }) {
  const level = instagramHealthLevel(health);
  if (level === "critical") {
    return (
      <Badge tone="critical" icon={<CircleX />}>
        {STATUS_LABEL[health]}
      </Badge>
    );
  }
  if (level === "warning") {
    return (
      <Badge tone="warning" icon={<TriangleAlert />}>
        {STATUS_LABEL[health]}
      </Badge>
    );
  }
  return (
    <Badge tone="good" icon={<CircleCheck />}>
      {STATUS_LABEL[health]}
    </Badge>
  );
}

/** บัญชีนี้ต้องแก้ไข/ตรวจสอบอะไรไหม (จุดเตือนในเมนูและป้ายหัวการ์ดของหน้าตั้งค่า) */
export function instagramNeedsAttention(accounts: InstagramAccount[], now: Date = new Date()): boolean {
  return accounts.length === 0 || accounts.some((a) => instagramHealthLevel(instagramAccountHealth(a, now)) !== "ok");
}

/** ข้อความอธิบายปัญหาใต้ชื่อบัญชี (null = ไม่มีปัญหา) */
function problemText(account: InstagramAccount, health: InstagramAccountHealth): string | null {
  if (health === "invalid") {
    return "token ของบัญชีนี้ใช้ไม่ได้แล้ว — กด Generate token ใหม่ในหน้า API setup with Instagram login แล้ววางในช่องด้านล่าง";
  }
  if (!account.lastError) return null;
  // ต่ออายุไม่สำเร็จชั่วคราว: token ยังใช้ได้ ระบบลองใหม่เอง
  if (health === "warning" && account.lastError.startsWith(INSTAGRAM_ERRORS.refreshPrefix)) {
    return `${account.lastError} — ระบบจะลองต่ออายุใหม่เองทุก 6 ชั่วโมง ตอนนี้ยังตอบลูกค้าได้ตามปกติ`;
  }
  return account.lastError;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs leading-5 text-fg-3">
      {label} <span className="text-fg-2 tabular">{value}</span>
    </p>
  );
}

/**
 * inset = แสดงในกรอบของตัวเอง (ใช้ในหน้าคู่มือ) — ค่าเริ่มต้นชิดขอบการ์ด
 * ปุ่ม "วาง token ใหม่" ลิงก์ไปที่ #connect-instagram (ฟอร์มวาง token ในหน้าเดียวกัน)
 */
export function InstagramAccountsList({
  accounts,
  pages,
  inset,
}: {
  accounts: InstagramAccount[];
  pages: ConnectedPage[];
  inset?: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <div className={inset ? undefined : "p-5"}>
        <EmptyState
          compact
          icon={<PlatformIcon platform="instagram" variant="mono" size={20} />}
          title="ยังไม่ได้เชื่อมบัญชี Instagram"
          action={
            <Link href="/guide#step-5" className={buttonStyle("secondary")}>
              ดูวิธีในคู่มือ ขั้นที่ 5
            </Link>
          }
        >
          ทำตามคู่มือขั้นที่ 5 แล้ววาง token ด้านล่าง
        </EmptyState>
      </div>
    );
  }

  const now = new Date();
  return (
    <ul className={cx("divide-y divide-line", inset && "rounded-lg border border-line bg-surface")}>
      {accounts.map((a) => {
        const health = instagramAccountHealth(a, now);
        const level = instagramHealthLevel(health);
        const needsNewToken = needsNewInstagramToken(health);
        const linkedPage = pages.find((p) => p.igUserId === a.id);
        const problem = problemText(a, health);
        // subscribe webhook ซ้ำไม่สำเร็จ (บัญชียังรับ webhook อยู่) → ให้กดลองใหม่ได้เอง
        const canResubscribe =
          !needsNewToken && (!a.subscribed || Boolean(a.lastError?.startsWith(INSTAGRAM_ERRORS.subscribePrefix)));
        return (
          <li key={a.id} className={cx("space-y-3", inset ? "p-4" : "px-5 py-4")}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="relative shrink-0">
                <Avatar name={a.name || a.username} size="lg" />
                <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-surface">
                  <PlatformIcon platform="instagram" size={16} />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="min-w-0 truncate leading-6 font-medium text-fg">@{a.username}</p>
                  <AccountStatus health={health} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="outline" icon={<PlatformIcon platform="instagram" size={14} />}>
                    Instagram Login
                  </Badge>
                  {linkedPage && (
                    <Badge tone="outline" icon={<PlatformIcon platform="facebook" size={14} />} title="บัญชีเดียวกับที่ผูกกับเพจ — ระบบใช้ Instagram Login กับบัญชีนี้">
                      ผูกกับเพจ {linkedPage.name} ด้วย
                    </Badge>
                  )}
                </div>
                <div className="mt-2 space-y-0.5">
                  {/* token หมดอายุ/ใช้ไม่ได้แล้ว ระบบต่ออายุเองไม่ได้ → ไม่บอกว่า "ต่ออายุให้อัตโนมัติ" */}
                  <p className="text-xs leading-5 text-fg-3">
                    {health === "expired" ? "token หมดอายุเมื่อ" : needsNewToken ? "token เดิมกำหนดหมดอายุ" : "token ใช้ได้ถึง"}{" "}
                    <span className="text-fg-2 tabular">
                      {formatDateTime(a.tokenExpiresAt)}
                      {a.tokenExpiryEstimated && " (โดยประมาณ)"}
                    </span>
                    {!needsNewToken && " · ต่ออายุให้อัตโนมัติ"}
                  </p>
                  <Detail
                    label="รับคอมเมนต์ผ่าน Instagram Login ล่าสุด:"
                    value={a.lastCommentWebhookAt ? formatDateTime(a.lastCommentWebhookAt) : "ยังไม่เคย"}
                  />
                  <Detail
                    label="รับ DM / การกดปุ่มล่าสุด:"
                    value={a.lastMessagingWebhookAt ? formatDateTime(a.lastMessagingWebhookAt) : "ยังไม่เคย"}
                  />
                </div>
                {problem && (
                  <p
                    className={cx(
                      "mt-2 flex items-start gap-1.5 text-xs leading-5",
                      level === "critical" ? "text-critical-text" : "text-warning-text",
                    )}
                  >
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{problem}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pl-[52px]">
              {needsNewToken ? (
                <a href="#connect-instagram" className={cx(buttonStyle("secondary"), "max-sm:flex-1")}>
                  <KeyRound aria-hidden />
                  วาง token ใหม่
                </a>
              ) : (
                <RefreshInstagramTokenButton accountId={a.id} />
              )}
              {canResubscribe && <ResubscribeInstagramButton accountId={a.id} username={a.username} />}
              <DisconnectInstagramButton accountId={a.id} username={a.username} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
