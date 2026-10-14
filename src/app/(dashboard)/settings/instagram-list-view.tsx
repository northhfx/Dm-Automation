"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX, KeyRound, TriangleAlert } from "lucide-react";
import { Avatar, Badge, buttonStyle, cx, EmptyState, PlatformIcon } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import type { InstagramAccountHealth } from "@/lib/instagram/accounts";
import { DisconnectInstagramButton, RefreshInstagramTokenButton, ResubscribeInstagramButton } from "./instagram-actions";
import { localizeSetupMessage } from "./setup-errors";

/*
 * หน้าตาของรายการบัญชี Instagram (Client Component เพื่อแสดงตามภาษาที่เลือก)
 * instagram-list.tsx (ฝั่งเซิร์ฟเวอร์) คำนวณสถานะและตัด token ออกก่อนส่งมา — ปุ่มได้รับแค่ accountId / username
 */

/** ปัญหาที่แสดงใต้ชื่อบัญชี */
export type InstagramProblem =
  /** token ใช้ไม่ได้แล้ว (ถอดรหัสไม่ได้) */
  | { kind: "invalid" }
  /** ต่ออายุไม่สำเร็จชั่วคราว: token ยังใช้ได้ ระบบลองใหม่เอง */
  | { kind: "retrying"; error: string }
  /** lastError อื่นๆ (ข้อความจาก lib/instagram/* หรือ Meta) */
  | { kind: "error"; error: string };

export interface InstagramAccountRow {
  id: string;
  username: string;
  name: string | null;
  health: InstagramAccountHealth;
  level: "critical" | "warning" | "ok";
  /** ต้องวาง token ใหม่ (ระบบต่ออายุเองไม่ได้แล้ว) */
  needsNewToken: boolean;
  /** subscribe webhook ซ้ำไม่สำเร็จ (บัญชียังรับ webhook อยู่) → ให้กดลองใหม่ได้เอง */
  canResubscribe: boolean;
  /** ชื่อเพจ Facebook ที่ผูกบัญชีเดียวกันไว้ */
  linkedPageName: string | null;
  problem: InstagramProblem | null;
  tokenExpiresAt: Date;
  tokenExpiryEstimated: boolean;
  lastCommentWebhookAt: Date | null;
  lastMessagingWebhookAt: Date | null;
}

type SettingsKey = MessageKey<typeof settingsMessages>;

/** ป้ายสถานะของบัญชี — instagramAccountHealth กติกาเดียวกับแถบเมนูและคู่มือ */
const STATUS_LABEL: Record<InstagramAccountHealth, SettingsKey> = {
  invalid: "igStatusInvalid",
  expired: "igStatusExpired",
  rejected: "igStatusRejected",
  unsubscribed: "igStatusUnsubscribed",
  expiring: "igStatusExpiring",
  warning: "igStatusWarning",
  ok: "igStatusOk",
};

function AccountStatus({ health, level }: { health: InstagramAccountHealth; level: InstagramAccountRow["level"] }) {
  const t = useT(settingsMessages);
  const label = t(STATUS_LABEL[health]);
  if (level === "critical") {
    return (
      <Badge tone="critical" icon={<CircleX />}>
        {label}
      </Badge>
    );
  }
  if (level === "warning") {
    return (
      <Badge tone="warning" icon={<TriangleAlert />}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge tone="good" icon={<CircleCheck />}>
      {label}
    </Badge>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs leading-5 text-fg-3">
      {label} <span className="text-fg-2 tabular">{value}</span>
    </p>
  );
}

export function InstagramAccountsView({ rows, inset }: { rows: InstagramAccountRow[]; inset?: boolean }) {
  const t = useT(settingsMessages);
  const f = useFormat();

  if (rows.length === 0) {
    return (
      <div className={inset ? undefined : "p-5"}>
        <EmptyState
          compact
          icon={<PlatformIcon platform="instagram" variant="mono" size={20} />}
          title={t("igEmptyTitle")}
          action={
            <Link href="/guide#step-5" className={buttonStyle("secondary")}>
              {t("igEmptyAction")}
            </Link>
          }
        >
          {t("igEmptyBody")}
        </EmptyState>
      </div>
    );
  }

  function problemText(problem: InstagramProblem): string {
    if (problem.kind === "invalid") return t("igProblemInvalid");
    const error = localizeSetupMessage(problem.error, t);
    return problem.kind === "retrying" ? t("igProblemRetry", { error }) : error;
  }

  return (
    <ul className={cx("divide-y divide-line", inset && "rounded-lg border border-line bg-surface")}>
      {rows.map((a) => {
        // token หมดอายุ/ใช้ไม่ได้แล้ว ระบบต่ออายุเองไม่ได้ → ไม่บอกว่า "ต่ออายุให้อัตโนมัติ"
        const expiryKey: SettingsKey = a.health === "expired" ? "tokenExpiredAt" : a.needsNewToken ? "tokenWasDue" : "tokenValidUntil";
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
                  <AccountStatus health={a.health} level={a.level} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="outline" icon={<PlatformIcon platform="instagram" size={14} />}>
                    Instagram Login
                  </Badge>
                  {a.linkedPageName && (
                    <Badge tone="outline" icon={<PlatformIcon platform="facebook" size={14} />} title={t("igLinkedBadgeTitle")}>
                      {t("igLinkedBadge", { page: a.linkedPageName })}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs leading-5 text-fg-3">
                    {t.rich(expiryKey, {
                      date: (
                        <span className="text-fg-2 tabular">
                          {f.dateTime(a.tokenExpiresAt)}
                          {a.tokenExpiryEstimated && ` ${t("estimated")}`}
                        </span>
                      ),
                    })}
                    {!a.needsNewToken && ` · ${t("autoRenew")}`}
                  </p>
                  <Detail
                    label={t("lastCommentLabel")}
                    value={a.lastCommentWebhookAt ? f.dateTime(a.lastCommentWebhookAt) : t("never")}
                  />
                  <Detail
                    label={t("lastMessagingLabel")}
                    value={a.lastMessagingWebhookAt ? f.dateTime(a.lastMessagingWebhookAt) : t("never")}
                  />
                </div>
                {a.problem && (
                  <p
                    className={cx(
                      "mt-2 flex items-start gap-1.5 text-xs leading-5",
                      a.level === "critical" ? "text-critical-text" : "text-warning-text",
                    )}
                  >
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{problemText(a.problem)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pl-[52px]">
              {a.needsNewToken ? (
                <a href="#connect-instagram" className={cx(buttonStyle("secondary"), "max-sm:flex-1")}>
                  <KeyRound aria-hidden />
                  {t("pasteNewToken")}
                </a>
              ) : (
                <RefreshInstagramTokenButton accountId={a.id} />
              )}
              {a.canResubscribe && <ResubscribeInstagramButton accountId={a.id} username={a.username} />}
              <DisconnectInstagramButton accountId={a.id} username={a.username} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
