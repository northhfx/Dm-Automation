import { defineMessages } from "../core";

/**
 * หน้ารายชื่อลูกค้า (/contacts) — src/app/(dashboard)/contacts/*
 * {person} = ชื่อลูกค้า / @username / "ผู้ใช้ Facebook" (ไม่ใช้ {name} เพราะเป็นคำแทนชื่อลูกค้าในข้อความของกฎ)
 * {where} = ชื่อแอปของ Meta (Meta Business Suite / Instagram) ไม่แปล
 */
export const contactsMessages = defineMessages({
  th: {
    // ---- หัวหน้า (ชื่อหน้าอยู่ใน nav: "contacts") ----
    /** ป้ายข้างชื่อหน้า: จำนวนลูกค้าทั้งหมด */
    badgeTotal: "{count} คน",
    description: "เฉพาะคนที่คอมเมนต์หรือทักแชทตรงกับคำที่ตั้งไว้ในกฎ เรียงตามคนที่ทักมาล่าสุด",
    /** loading.tsx (สำหรับโปรแกรมอ่านหน้าจอ) */
    loading: "กำลังโหลดรายชื่อลูกค้า…",

    // ---- ยังไม่มีลูกค้าเลย ----
    emptyTitle: "ยังไม่มีลูกค้า",
    emptyBody: "เมื่อมีคนคอมเมนต์หรือทักแชทตรงกับคำที่ตั้งไว้ในกฎ รายชื่อจะแสดงที่นี่ คนที่ทักเรื่องอื่นจะไม่ถูกเก็บไว้",
    emptyAction: "ดูกฎอัตโนมัติ",

    // ---- ค้นหา / ตัวกรอง ----
    searchLabel: "ค้นหาลูกค้า",
    searchPlaceholder: "ค้นหาชื่อ หรือ username",
    searchButton: "ค้นหา",
    platformLabel: "แพลตฟอร์ม",
    filterAll: "ทั้งหมด",
    /** {query} = คำที่ค้น (ตัวหนา), {count} = จำนวนที่พบ */
    searchResult: "ผลการค้นหา “{query}” · {count} คน",
    clearSearch: "ล้างการค้นหา",

    // ---- ไม่พบรายการ ----
    notFoundTitle: "ไม่พบ “{query}”",
    notFoundBody: "ลองค้นด้วยชื่ออื่น หรือ username ของลูกค้า",
    pageEmptyTitle: "ไม่มีรายการในหน้านี้",
    /** {platform} = Facebook / Instagram (หรือ platformFallback) */
    platformEmptyTitle: "ยังไม่มีลูกค้าจาก {platform}",
    platformFallback: "แพลตฟอร์มนี้",
    backToFirstPage: "กลับไปหน้าแรก",
    viewAll: "ดูรายชื่อทั้งหมด",

    // ---- เลขหน้า ----
    showing: "แสดง {from}–{to} จาก {total} คน",
    pagerLabel: "เปลี่ยนหน้า",
    prev: "ก่อนหน้า",
    next: "ถัดไป",

    // ---- ตาราง ----
    colContact: "ลูกค้า",
    colPlatform: "ช่องทาง",
    colFirstSeen: "เจอครั้งแรก",
    colLastInbound: "ทักมาล่าสุด",
    colSent: "DM ที่ได้รับ",
    colClicks: "คลิกลิงก์",
    colClicksHint: "จำนวนครั้งที่คลิกลิงก์ในข้อความ (ไม่รวมการกดปุ่มที่ส่งข้อความถัดไป)",
    neverMessaged: "ยังไม่เคยทัก",
    /** มือถือ: ตัวเลขใต้ชื่อ */
    mobileStats: "DM {sent} · คลิกลิงก์ {clicks}",

    // ---- แต่ละคน ----
    /** คนที่ Meta ไม่ส่งชื่อมา — {platform} = Facebook / Instagram */
    unknownPerson: "ผู้ใช้ {platform}",
    /** สำหรับโปรแกรมอ่านหน้าจอ ก่อนข้อความล่าสุดของลูกค้า */
    previewComment: "คอมเมนต์ล่าสุด:",
    previewChat: "ข้อความแชทล่าสุด:",
    openChat: "เปิดแชท",
    openChatAria: "เปิดแชทกับ {person} ใน {where} (เปิดแท็บใหม่)",
    /** แชท Facebook บนมือถือ: เปิดแอป Messenger */
    openChatAppAria: "เปิดแชทกับ {person} ในแอป Messenger",
    /** แชท Facebook บนคอมพิวเตอร์ (มือถือเปิดแอป Messenger — ข้อความอยู่ใน common) */
    openChatHintMessenger: "เปิดแชทนี้ในกล่องข้อความของเพจ (Meta Business Suite) — บนคอมพิวเตอร์ Facebook ปิดแอป Messenger ไปแล้ว",
    openChatHintInstagram: "เปิดหน้าโปรไฟล์ Instagram ของลูกค้า แล้วกดส่งข้อความเพื่อคุยต่อ",
  },
  en: {
    badgeTotal: "{count} total",
    description: "Only people whose comment or message matched a keyword in your automations. Latest message first.",
    loading: "Loading contacts…",

    emptyTitle: "No contacts yet",
    emptyBody:
      "When someone comments or messages a keyword from your automations, they show up here. People who message about anything else aren't saved.",
    emptyAction: "View automations",

    searchLabel: "Search contacts",
    searchPlaceholder: "Search by name or username",
    searchButton: "Search",
    platformLabel: "Platform",
    filterAll: "All",
    searchResult: "Results for “{query}”: {count}",
    clearSearch: "Clear search",

    notFoundTitle: "No results for “{query}”",
    notFoundBody: "Try another name or the customer's username.",
    pageEmptyTitle: "Nothing on this page",
    platformEmptyTitle: "No contacts from {platform} yet",
    platformFallback: "this platform",
    backToFirstPage: "Back to the first page",
    viewAll: "See all contacts",

    showing: "Showing {from}–{to} of {total}",
    pagerLabel: "Pages",
    prev: "Previous",
    next: "Next",

    colContact: "Contact",
    colPlatform: "Platform",
    colFirstSeen: "First seen",
    colLastInbound: "Last message",
    colSent: "DMs sent",
    colClicks: "Link clicks",
    colClicksHint: "How many times they clicked a link in your messages (next-message buttons not included)",
    neverMessaged: "Never messaged",
    mobileStats: "DMs {sent} · Link clicks {clicks}",

    unknownPerson: "{platform} user",
    previewComment: "Latest comment:",
    previewChat: "Latest message:",
    openChat: "Open chat",
    openChatAria: "Open chat with {person} in {where} (opens in a new tab)",
    openChatAppAria: "Open chat with {person} in the Messenger app",
    openChatHintMessenger: "Open this chat in your Page inbox (Meta Business Suite). Facebook no longer has a Messenger app for computers.",
    openChatHintInstagram: "Open the customer's Instagram profile, then tap Message to keep chatting",
  },
});
