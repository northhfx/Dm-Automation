"use client";

import { CircleAlert, CircleCheck, CircleX, Plug } from "lucide-react";
import { Avatar, Badge, buttonStyle, cx, EmptyState, PlatformIcon } from "@/components/ui";
import { useFormat, useT } from "@/lib/i18n/client";
import { settingsMessages } from "@/lib/i18n/messages/settings";
import { DisconnectButton, ResubscribeButton } from "./page-actions";

/*
 * หน้าตาของรายการเพจ (Client Component เพื่อแสดงตามภาษาที่เลือก)
 * รับเฉพาะข้อมูลที่ต้องแสดง — pages-list.tsx (ฝั่งเซิร์ฟเวอร์) ตัด token ของเพจออกก่อนส่งมา
 */

export interface PageRow {
  id: string;
  name: string;
  /** false = token ถอดรหัสไม่ได้ ต้องเชื่อมต่อเพจใหม่ */
  tokenOk: boolean;
  subscribed: boolean;
  igUsername: string | null;
  /** บัญชี Instagram ของเพจนี้เชื่อมผ่าน Instagram Login อยู่ (ระบบใช้ Instagram Login แทน) */
  igLogin: boolean;
  lastError: string | null;
  connectedAt: Date;
}

/** สถานะของเพจ: พร้อมใช้งาน / ต้องเชื่อมต่อใหม่ / ยังไม่รับข้อความ (subscribe webhook ไม่สำเร็จ) */
function PageStatus({ page }: { page: PageRow }) {
  const t = useT(settingsMessages);
  if (!page.tokenOk) {
    return (
      <Badge tone="critical" icon={<CircleX />}>
        {t("pageReconnectNeeded")}
      </Badge>
    );
  }
  if (page.subscribed) {
    return (
      <Badge tone="good" icon={<CircleCheck />}>
        {t("statusReady")}
      </Badge>
    );
  }
  return (
    <Badge tone="critical" icon={<CircleX />}>
      {t("notSubscribed")}
    </Badge>
  );
}

export function PagesListView({ rows, inset }: { rows: PageRow[]; inset?: boolean }) {
  const t = useT(settingsMessages);
  const f = useFormat();
  if (rows.length === 0) {
    return (
      <div className={inset ? undefined : "p-5"}>
        <EmptyState
          compact
          icon={<Plug aria-hidden />}
          title={t("pagesEmptyTitle")}
          action={
            <a href="#connect" className={buttonStyle("primary")}>
              {t("pagesEmptyAction")}
            </a>
          }
        >
          {t("pagesEmptyBody")}
        </EmptyState>
      </div>
    );
  }

  return (
    <ul className={cx("divide-y divide-line", inset && "rounded-lg border border-line bg-surface")}>
      {rows.map((p) => {
        const problem = !p.tokenOk ? t("pageTokenProblem") : p.lastError;
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
                  {p.igUsername &&
                    (p.igLogin ? (
                      // แยกเป็น 2 ป้าย เพื่อขึ้นบรรทัดใหม่ได้บนจอมือถือ (ไม่ถูกตัดคำ)
                      <>
                        <Badge tone="outline" icon={<PlatformIcon platform="instagram" size={14} />}>
                          Instagram @{p.igUsername}
                        </Badge>
                        <Badge tone="accent">{t("usesIgLogin")}</Badge>
                      </>
                    ) : (
                      <Badge tone="outline" icon={<PlatformIcon platform="instagram" size={14} />}>
                        {t("igViaPage", { username: p.igUsername })}
                      </Badge>
                    ))}
                </div>
                {problem && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-critical-text">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{problem}</span>
                  </p>
                )}
                <p className="mt-1.5 text-xs leading-5 text-fg-3">{t("connectedAt", { time: f.dateTime(p.connectedAt) })}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap">
              {!p.tokenOk ? (
                <a href="#connect" className={cx(buttonStyle("secondary"), "max-sm:flex-1")}>
                  <Plug aria-hidden />
                  {t("reconnect")}
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
