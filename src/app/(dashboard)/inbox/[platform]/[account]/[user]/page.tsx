import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { CHAT_TEXT_MAX } from "@/lib/chat/send";
import { loadChatThread, parseChatKey, replyWindowEndsAt, type ChatKey } from "@/lib/chat/thread";
import { getConnection } from "@/lib/connections";
import { getT } from "@/lib/i18n/server";
import { inboxReplyLink } from "@/lib/inbox/links";
import { INBOX_RETENTION_DAYS } from "@/lib/inbox/retention";
import { ChatView, type ChatEntryView } from "./chat-view";

/*
 * ห้องแชทกับลูกค้าหนึ่งคน — กด "ตอบ" ในหน้าข้อความรอตอบ หรือ "เปิดแชท" ในหน้ารายชื่อลูกค้า
 * URL: /inbox/<facebook|instagram>/<Connection.id>/<PSID|IGSID>[?from=contacts]
 */

type Params = { platform: string; account: string; user: string };

// generateMetadata กับหน้าเรียกซ้ำกัน → โหลดครั้งเดียวต่อคำขอ
const loadThread = cache(async (platform: ChatKey["platform"], account: string, user: string) =>
  loadChatThread(getDb(), { platform, account, user }),
);

function personOf(thread: { name: string | null; username: string | null }, unknown: string): string {
  return thread.name ?? (thread.username ? `@${thread.username}` : unknown);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const key = parseChatKey(p.platform, p.account, p.user);
  if (!key) return {};
  const [t, thread] = await Promise.all([getT("chat"), loadThread(key.platform, key.account, key.user)]);
  const platform = key.platform === "facebook" ? "Facebook" : "Instagram";
  return { title: `${t("metaTitle", { person: personOf(thread, t("unknownPerson", { platform })) })} · DM Automation` };
}

export default async function ChatPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [p, sp] = await Promise.all([params, searchParams]);
  const key = parseChatKey(p.platform, p.account, p.user);
  if (!key) notFound();
  const now = new Date();
  const [t, tNav, conn, thread] = await Promise.all([
    getT("chat"),
    getT("nav"),
    getConnection(getDb(), key.platform, key.account),
    loadThread(key.platform, key.account, key.user),
  ]);
  const platform = key.platform === "facebook" ? "Facebook" : "Instagram";
  const windowEnd = replyWindowEndsAt(thread.lastInboundAt, now);
  const fromContacts = sp.from === "contacts";

  const entries: ChatEntryView[] = thread.entries.map((e) => ({ ...e, at: e.at.toISOString() }));

  return (
    <ChatView
      platform={key.platform}
      account={key.account}
      user={key.user}
      person={personOf(thread, t("unknownPerson", { platform }))}
      name={thread.name}
      username={thread.username}
      accountName={conn?.name ?? null}
      entries={entries}
      windowEndsAt={windowEnd?.toISOString() ?? null}
      hasInbound={thread.lastInboundAt !== null}
      openInboxIds={thread.openInboxIds}
      external={inboxReplyLink({
        platform: key.platform,
        kind: "dm",
        pageId: key.account,
        senderId: key.user,
        senderUsername: thread.username,
        postId: null,
        commentId: null,
        permalink: null,
      })}
      back={fromContacts ? { href: "/contacts", label: tNav("contacts") } : { href: "/inbox", label: tNav("inbox") }}
      now={now.toISOString()}
      textMax={CHAT_TEXT_MAX}
      historyDays={INBOX_RETENTION_DAYS}
    />
  );
}
