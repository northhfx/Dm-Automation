import { defineMessages } from "../core";

/**
 * หน้ารายการกฎ (/rules) + หน้าต่างเลือกแบบเริ่มต้น + แผงด้านข้าง/แถบบนของตัวสร้างกฎ (top-bar, trigger-panel, overview-panel)
 * "กฎ" ในภาษาอังกฤษเรียกว่า "Automation" (ห้ามใช้คำว่า rule)
 * {rule} = ชื่อกฎที่เจ้าของร้านตั้ง (ไม่ใช้ {name} เพราะเป็นคำแทนชื่อลูกค้าในข้อความของกฎ)
 * "ผูก" (กฎแบบโพสต์ถัดไปจับคู่กับโพสต์จริงแล้ว) ภาษาอังกฤษใช้ "linked"
 */
export const rulesMessages = defineMessages({
  th: {
    newAutomation: "สร้างกฎใหม่",

    // ---- หัวหน้า /rules ----
    pageDescription: "ตอบคอมเมนต์และแชทให้อัตโนมัติ เมื่อลูกค้าพิมพ์คำที่คุณตั้งไว้",
    /** ป้ายข้างชื่อหน้า: เปิดอยู่กี่กฎจากทั้งหมด */
    activeBadge: "เปิดอยู่ {active} จาก {total} กฎ",

    // ---- กลุ่มในรายการ ----
    groupComment: "เมื่อมีคนคอมเมนต์",
    groupDm: "เมื่อมีคนทักแชท",
    moveHint: "ย้ายกฎขึ้น/ลงได้จากปุ่ม ⋮ ของแต่ละกฎ",
    topWins: "ถ้าตรงหลายกฎ ระบบใช้กฎที่อยู่บนสุด",
    /** หมายเหตุท้ายรายการ (ต่อด้วย ctrHint และ moveHint คั่นด้วย ·) */
    statsSince: "ตัวเลขนับตั้งแต่สร้างกฎ",
    ctrHint: "อัตราการกด = สัดส่วนคนที่กดปุ่มหรือลิงก์ จากคนที่ได้รับ DM",

    // ---- การ์ดของแต่ละกฎ ----
    /** คำอธิบายเมื่อชี้ที่เลขลำดับ */
    rankTitle: "ลำดับที่ {rank}",
    /** สำหรับโปรแกรมอ่านหน้าจอ ต่อหน้าเลขลำดับ (มีวรรคท้าย) */
    rankPrefix: "ลำดับที่ ",
    statusOn: "เปิดอยู่",
    statusOff: "ปิดอยู่",
    toggleLabel: "เปิดใช้กฎ {rule}",
    toggleFailed: "เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้ง",
    toggledOn: "เปิดกฎแล้ว เริ่มตอบอัตโนมัติ",
    toggledOff: "ปิดกฎแล้ว หยุดตอบชั่วคราว",

    // ---- เมนู ⋮ ของการ์ด ----
    menuLabel: "ตัวเลือกของกฎ {rule}",
    edit: "แก้ไข",
    duplicate: "ทำสำเนา",
    /** toast หลังทำสำเนา (สำเนาถูกปิดไว้ก่อน) */
    duplicated: "ทำสำเนาแล้ว (ปิดไว้ก่อน)",
    moveUp: "ย้ายขึ้น",
    moveDown: "ย้ายลง",
    movedUp: "ย้าย “{rule}” ขึ้นแล้ว",
    movedDown: "ย้าย “{rule}” ลงแล้ว",
    delete: "ลบ",
    deleteTitle: "ลบกฎ “{rule}”?",
    deleteBody: "ลบแล้วกู้คืนไม่ได้ ถ้าแค่อยากหยุดชั่วคราว ให้ปิดสวิตช์แทน",
    /** ปุ่มยืนยันในหน้าต่างถามก่อนลบ */
    deleteConfirm: "ลบกฎ",
    deleted: "ลบกฎแล้ว",

    // ---- ใช้กับโพสต์ไหน (ในการ์ด) ----
    scopeSelected: "{count} โพสต์/รีลที่เลือก",
    scopeSelectedTitle: "ใช้กับโพสต์หรือรีลที่เลือกไว้เท่านั้น",
    scopeNoneSelected: "ยังไม่ได้เลือกโพสต์หรือรีล",
    scopeNoneSelectedTitle: "เลือกโพสต์หรือรีลในหน้าแก้ไขกฎ",
    scopeWaiting: "รอโพสต์หรือรีลถัดไป",
    scopeWaitingTitle: "ระบบจะผูกกฎนี้กับโพสต์หรือรีลถัดไปที่คุณลงให้อัตโนมัติ",
    scopeBoundAll: "ผูกกับโพสต์/รีลใหม่แล้ว",
    scopeBoundAllTitle: "ใช้กับโพสต์หรือรีลใหม่ที่ระบบผูกไว้ให้แล้ว",
    /** ผูกได้บางแพลตฟอร์ม — {platforms} = Facebook / Instagram */
    scopeBoundSome: "ผูก {platforms} แล้ว",
    scopeBoundSomeTitle: "แพลตฟอร์มที่เหลือยังรอโพสต์หรือรีลถัดไป",
    scopeAny: "ทุกโพสต์และรีล",
    scopeAnyTitle: "ใช้กับทุกโพสต์และรีล",

    // ---- เงื่อนไข (ในการ์ด) — ตามด้วยชิปคำที่ตั้งไว้ ----
    leadAnyComment: "ทุกคอมเมนต์",
    leadAnyDm: "ทุกข้อความในแชท",
    leadCommentExact: "คอมเมนต์ที่พิมพ์ว่า",
    leadCommentContains: "คอมเมนต์ที่มีคำว่า",
    leadDmExact: "แชทที่พิมพ์ว่า",
    leadDmContains: "แชทที่มีคำว่า",
    /** คำที่เหลือซึ่งไม่ได้แสดงเป็นชิป */
    moreKeywords: "+{count} คำ",

    // ---- ตัวอย่างข้อความ / ลำดับการตอบ / สถิติ (ในการ์ด) ----
    /** ชิปแทน {name} ในตัวอย่างข้อความ */
    customerName: "ชื่อลูกค้า",
    noMessage: "ยังไม่ได้เขียนข้อความ",
    flowPublicReply: "ตอบใต้คอมเมนต์",
    flowMessages: "ส่ง {count} ข้อความ",
    flowButtons: "{count} ปุ่ม",
    statRuns: "ทำงาน",
    /** {count} = ตัวเลขตัวหนา (จำนวนครั้งที่กฎทำงาน) */
    statRunsValue: "{count} ครั้ง",
    statCtr: "อัตราการกด",
    noButtonsTitle: "กฎนี้ไม่มีปุ่ม จึงไม่มีอัตราการกด",
    noButtons: "(ไม่มีปุ่ม)",

    // ---- หน้าว่าง ----
    emptyTitle: "ยังไม่มีกฎอัตโนมัติ",
    emptyBody: "เลือกแบบเริ่มต้นด้านล่าง แล้วปรับข้อความ ปุ่ม และการ์ดได้เองทุกอย่าง",

    // ---- แบบเริ่มต้น (หน้าต่างสร้างกฎใหม่) ----
    chooserDescription: "เลือกแบบที่ใกล้เคียงที่สุด แล้วแก้ข้อความ ปุ่ม และการ์ดได้เองทุกอย่าง",
    recommended: "แนะนำ",
    /** วงหมุนระหว่างรอเปิดหน้าสร้างกฎ */
    opening: "กำลังเปิด",
    templateCommentTitle: "คอมเมนต์ → ส่ง DM พร้อมปุ่ม",
    templateCommentBody: "ตอบใต้คอมเมนต์ แล้วส่ง DM ที่มีปุ่มให้ลูกค้ากดรับรายละเอียด",
    templateDmTitle: "ตอบแชทตามคำที่ลูกค้าพิมพ์",
    templateDmBody: "ลูกค้าทักแชทว่า “ราคา” ระบบตอบกลับพร้อมลิงก์ให้ทันที",
    templateBlankTitle: "เริ่มจากว่าง",
    templateBlankBody: "เริ่มจากการ์ดเปล่าใบเดียว แล้วสร้างข้อความและปุ่มเองทั้งหมด",
    /** ชื่อสั้นใต้ไอคอนในภาพลำดับการทำงาน (ที่ว่างแคบ) */
    flowComment: "คอมเมนต์",
    flowSendDm: "ส่ง DM",
    flowTapButton: "กดปุ่ม",
    flowLink: "ลิงก์",
    flowChat: "ทักแชท",
    flowReply: "ตอบกลับ",
    flowTrigger: "เงื่อนไข",
    flowEmptyCard: "การ์ดเปล่า",

    // ---- หน้าแก้กฎ / ระหว่างโหลด ----
    savedToast: "บันทึกกฎแล้ว",
    loadingNew: "กำลังเตรียมกฎใหม่…",
    loadingEdit: "กำลังเปิดกฎ…",

    // ---- แถบบนของตัวสร้างกฎ ----
    backAria: "กลับไปหน้ากฎทั้งหมด",
    backTitle: "กฎทั้งหมด",
    nameLabel: "ชื่อกฎ",
    namePlaceholder: "ตั้งชื่อกฎ เช่น คอมเมนต์ สนใจ → ส่งลิงก์",
    /** {ctr} = เปอร์เซ็นต์ที่จัดรูปแบบแล้ว เช่น "12%" */
    topStats: "ทำงาน {runs} ครั้ง · อัตราการกด {ctr}",
    activeSwitch: "เปิดใช้งาน",
    /** สถานะสั้นข้างสวิตช์บนจอเล็ก */
    activeShortOn: "เปิด",
    activeShortOff: "ปิด",
    unsaved: "ยังไม่ได้บันทึก",
    saved: "บันทึกแล้ว",
    ruleMenuLabel: "ตัวเลือกของกฎนี้",
    lastSavedVersion: "ฉบับที่บันทึกล่าสุด",
    duplicateDirtyTitle: "ทำสำเนาจากฉบับที่บันทึกล่าสุด?",
    duplicateDirtyBody: "การแก้ที่ยังไม่ได้บันทึกในกฎนี้จะหายไป ถ้าต้องการเก็บไว้ ให้กดบันทึกก่อน",
    deleteThisTitle: "ลบกฎนี้?",
    deleteThisBody: "การ์ดและสถิติของกฎนี้จะหายไป ลบแล้วกู้คืนไม่ได้",
    /** รายการในเมนู ⋮ ของแถบบน */
    deleteRule: "ลบกฎ",
    saveShortcut: "บันทึก (Ctrl+S)",

    // ---- แผงภาพรวม (ยังไม่ได้เลือกการ์ด) ----
    /** เส้นจากการ์ด "เมื่อ…" — {to} = เลขข้อความ */
    edgeFromTrigger: "การ์ด \"เมื่อ…\" → ข้อความ #{to}",
    /** เส้นจากปุ่ม — {button} = ชื่อปุ่ม, {from}/{to} = เลขข้อความ */
    edgeFromButton: "ปุ่ม \"{button}\" ของข้อความ #{from} → ข้อความ #{to}",
    untitledButton: "ไม่มีชื่อ",
    selectedEdge: "เส้นที่เลือก",
    deleteEdge: "ลบเส้นนี้",
    saveFailed: "บันทึกไม่สำเร็จ",
    beforeSave: "ก่อนบันทึก",
    beforeSaveHint: "แตะรายการเพื่อไปแก้ที่การ์ดนั้น",
    readyToSave: "ครบแล้ว พร้อมบันทึก",
    resultsTitle: "ผลลัพธ์ของกฎนี้",
    resultsSince: "นับตั้งแต่เริ่มใช้งาน",
    resultRuns: "ทำงาน",
    resultRunsUnit: "ครั้ง",
    resultSent: "ส่ง DM",
    resultSentUnit: "ข้อความ",
    resultCtr: "อัตราการกด",
    resultCtrUnit: "จากคนที่ได้รับ",
    howTo: "วิธีใช้",
    /** {action} = ตัวหนา (tipTapAction) */
    tipTap: "{action}เพื่อแก้ไข · ลากการ์ดเพื่อย้ายตำแหน่ง",
    tipTapAction: "แตะการ์ด",
    tipConnect: "{action}ข้างปุ่ม ไปวางที่ว่างเพื่อสร้างข้อความถัดไป หรือวางบนการ์ดเพื่อเชื่อม",
    tipConnectAction: "ลากจากจุดกลม",
    tipPan: "{action}เพื่อเลื่อน · Ctrl + ล้อเมาส์ หรือถ่างสองนิ้วเพื่อซูม",
    tipPanAction: "ลากพื้นที่ว่าง",
    editTrigger: "ตั้งค่าเงื่อนไข (การ์ด \"เมื่อ…\")",

    // ---- แผงเงื่อนไข (การ์ด "เมื่อ…") ----
    runsWhen: "ทำงานเมื่อ",
    triggerComment: "มีคนคอมเมนต์",
    triggerCommentHint: "ใต้โพสต์หรือรีล",
    triggerDm: "มีคนทักแชท",
    triggerDmHint: "ส่งข้อความ (DM) มา",
    platforms: "แพลตฟอร์ม",
    platformsHint: "ใช้กับเพจ Facebook และบัญชี Instagram ที่เชื่อมต่อไว้",
    keywordsTitle: "คำที่ให้ระบบจับ",
    matchLabel: "วิธีจับคำ",
    matchContains: "มีคำนี้",
    matchExact: "ตรงทั้งหมด",
    matchAny: "ทุกข้อความ",
    matchContainsCommentHint: "ทำงานเมื่อคอมเมนต์มีคำใดคำหนึ่งอยู่ เช่น \"สนใจค่ะ\" ก็นับคำว่า \"สนใจ\"",
    matchContainsDmHint: "ทำงานเมื่อข้อความมีคำใดคำหนึ่งอยู่ เช่น \"สนใจค่ะ\" ก็นับคำว่า \"สนใจ\"",
    matchExactHint: "ทำงานเมื่อพิมพ์มาตรงกับคำใดคำหนึ่งทั้งข้อความเท่านั้น",
    matchAnyCommentHint: "ทำงานกับทุกคอมเมนต์ ไม่ต้องมีคำเฉพาะ",
    matchAnyDmHint: "ทำงานกับทุกข้อความ ไม่ต้องมีคำเฉพาะ",
    keywordsLabel: "คำ",
    keywordsHint: "กด Enter หรือพิมพ์ , เพื่อเพิ่มคำ — วางหลายคำพร้อมกันได้",
    keywordsPlaceholder: "เช่น สนใจ, ราคา, link",
    publicReplyTitle: "ตอบใต้คอมเมนต์",
    publicReplyHint: "ทุกคนเห็นคำตอบนี้ — ระบบสุ่มใช้ทีละแบบ ดูเป็นธรรมชาติและไม่โดนมองว่าเป็นสแปม (ลบหมด = ไม่ตอบใต้คอมเมนต์)",
    /** {n} = เลขแบบที่ 1, 2, 3… */
    replyLabel: "คำตอบแบบที่ {n}",
    replyPlaceholder: "เช่น ส่งรายละเอียดให้ทาง DM แล้วนะคะ",
    replyDelete: "ลบคำตอบแบบที่ {n}",
    replyAdd: "เพิ่มแบบ",
    /** แสดงเมื่อมีตั้งแต่ 2 แบบขึ้นไป */
    replyRandom: "สุ่ม {count} แบบ",
    onceTitle: "กันส่งซ้ำ",
    onceLabel: "ตอบคนเดิมครั้งเดียวต่อโพสต์",
    onceHint: "ถ้าคนเดิมคอมเมนต์หลายครั้งในโพสต์เดียวกัน จะส่ง DM ให้แค่ครั้งแรก",
    advanced: "ขั้นสูง",
    priority: "ลำดับความสำคัญ",
    priorityHint: "ถ้าข้อความตรงหลายกฎ ระบบใช้กฎที่เลขน้อยกว่า (1–1000) · ง่ายกว่านั้น: กดย้ายขึ้น/ลงได้จากปุ่ม ⋮ ในหน้ากฎทั้งหมด",

    // ---- ใช้กับโพสต์หรือรีลไหน (แผงเงื่อนไข) ----
    postScopeTitle: "ใช้กับโพสต์หรือรีลไหน",
    postScopeSpecific: "โพสต์หรือรีลที่เลือก",
    postScopeSpecificHint: "เลือกจากโพสต์ล่าสุด หรือใส่ ID เอง",
    postScopeNext: "โพสต์หรือรีลถัดไป",
    postScopeNextHint: "โพสต์หรือรีลแรกที่ลงหลังกดบันทึก",
    postScopeAny: "ทุกโพสต์และรีล",
    postScopeAnyHint: "ใช้กับทุกโพสต์และรีล รวมถึงที่ลงในอนาคต",
    mediaReel: "รีล",
    mediaVideo: "วิดีโอ",
    postsErrorTitle: "ตอนนี้ดึงโพสต์ล่าสุดไม่ได้",
    postsErrorBody: "ใส่ ID ของโพสต์เองด้านล่างได้ หรือลองรีเฟรชหน้านี้อีกครั้ง",
    postsPickHint: "แตะเพื่อเลือก (เลือกได้หลายรายการ)",
    postsSelected: "เลือกแล้ว {count}",
    showLess: "แสดงน้อยลง",
    showAll: "ดูทั้งหมด {count} รายการ",
    noRecentPosts: "ยังไม่พบโพสต์ล่าสุด — ใส่ ID ของโพสต์เองด้านล่างได้",
    manualIds: "ใส่ ID เอง",
    manualIdsLabel: "ID ของโพสต์หรือรีล",
    manualIdsHint: "คั่นด้วยบรรทัดใหม่หรือจุลภาค — ใช้กับโพสต์เก่าที่ไม่อยู่ในรายการ",
    manualIdsPlaceholder: "เช่น 1234567890_987654321",
    /** โพสต์ที่ไม่มีข้อความ (แคปชัน) */
    noCaption: "(ไม่มีข้อความ)",

    // ---- โพสต์หรือรีลถัดไป (แผงเงื่อนไข) ----
    nextIntro: "ระบบจะใช้กฎนี้กับโพสต์หรือรีลแรกที่คุณลงหลังจากกดบันทึก (Facebook และ Instagram แยกกัน)",
    nextStartTitle: "เริ่มนับหลังกดบันทึก",
    nextStartBody: "โพสต์หรือรีลที่ลงก่อนหน้านั้นจะไม่ใช้กฎนี้",
    nextRearmTitle: "จะเริ่มนับใหม่เมื่อกดบันทึก",
    nextRearmUndo: "ยกเลิก",
    nextRearmBodyBound: "ล้างโพสต์ที่ผูกไว้ แล้วรอโพสต์หรือรีลที่ลงหลังจากนั้นแทน",
    nextRearmBody: "รอโพสต์หรือรีลที่ลงหลังจากนั้น",
    nextWaiting: "กำลังรอโพสต์ใหม่",
    /** ต่อท้าย nextWaiting ในบรรทัดเดียวกัน — {when} = วันที่และเวลา */
    nextWaitingSince: "ตั้งแต่ {when}",
    /** บรรทัดของตัวเอง ใต้ nextWaiting ของแต่ละแพลตฟอร์ม */
    nextSinceLine: "ตั้งแต่ {when}",
    nextWaitingHint: "ลงโพสต์หรือรีลได้เลย ระบบจะผูกให้เองเมื่อมีคนคอมเมนต์ครั้งแรก",
    nextBound: "ผูกแล้ว",
    /** {when} = เวลาแบบสัมพัทธ์ เช่น "5 นาทีที่ผ่านมา" */
    boundRelative: "ผูกเมื่อ {when}",
    /** ใช้เมื่อ {when} ขึ้นต้นด้วย "เมื่อ" อยู่แล้ว ("เมื่อสักครู่", "เมื่อวาน") — ภาษาอังกฤษเหมือน boundRelative */
    boundRelativeJoined: "ผูก{when}",
    /** {when} = วันที่และเวลา เช่น "13 ต.ค. 14:05" */
    boundAbsolute: "ผูกเมื่อ {when}",
    openPostAria: "เปิดโพสต์ใน {platform}",
    openPostTitle: "เปิดดูโพสต์",
    rearmButton: "เริ่มรอโพสต์ถัดไปใหม่",
    rearmHintBound: "ล้างโพสต์ที่ผูกไว้ แล้วให้กฎนี้ไปใช้กับโพสต์หรือรีลที่ลงหลังกดบันทึกแทน",
    rearmHintWaiting: "เริ่มนับเวลาใหม่จากตอนกดบันทึก (โพสต์ที่ลงก่อนหน้านั้นจะไม่ใช้กฎนี้)",
  },
  en: {
    newAutomation: "New Automation",

    // ---- หัวหน้า /rules ----
    pageDescription: "Reply to comments and messages automatically when customers type the keywords you set.",
    activeBadge: "On: {active} of {total}",

    // ---- กลุ่มในรายการ ----
    groupComment: "When someone comments",
    groupDm: "When someone messages you",
    moveHint: "Move an automation up or down from its ⋮ button",
    topWins: "If several automations match, the top one is used",
    statsSince: "Numbers count from when each automation was created",
    ctrHint: "Click rate = share of people who got the DM and tapped a button or link",

    // ---- การ์ดของแต่ละกฎ ----
    rankTitle: "Position {rank}",
    rankPrefix: "Position ",
    statusOn: "On",
    statusOff: "Off",
    toggleLabel: "Turn on {rule}",
    toggleFailed: "Couldn't turn it on or off. Please try again.",
    toggledOn: "Automation on. Auto-replies have started.",
    toggledOff: "Automation off. Replies are paused.",

    // ---- เมนู ⋮ ของการ์ด ----
    menuLabel: "Options for {rule}",
    edit: "Edit",
    duplicate: "Duplicate",
    duplicated: "Duplicated (turned off for now)",
    moveUp: "Move up",
    moveDown: "Move down",
    movedUp: "Moved “{rule}” up",
    movedDown: "Moved “{rule}” down",
    delete: "Delete",
    deleteTitle: "Delete “{rule}”?",
    deleteBody: "You can't undo this. To pause it for a while, turn off its switch instead.",
    deleteConfirm: "Delete automation",
    deleted: "Automation deleted",

    // ---- ใช้กับโพสต์ไหน (ในการ์ด) ----
    scopeSelected: "Selected posts/reels: {count}",
    scopeSelectedTitle: "Only works on the posts or reels you picked",
    scopeNoneSelected: "No posts or reels picked yet",
    scopeNoneSelectedTitle: "Pick posts or reels when you edit this automation",
    scopeWaiting: "Waiting for your next post or reel",
    scopeWaitingTitle: "This automation will be linked to the next post or reel you publish",
    scopeBoundAll: "Linked to your new post/reel",
    scopeBoundAllTitle: "Works on the new post or reel it was linked to",
    scopeBoundSome: "{platforms} linked",
    scopeBoundSomeTitle: "The other platform is still waiting for your next post or reel",
    scopeAny: "All posts and reels",
    scopeAnyTitle: "Works on all posts and reels",

    // ---- เงื่อนไข (ในการ์ด) — ตามด้วยชิปคำที่ตั้งไว้ ----
    leadAnyComment: "Every comment",
    leadAnyDm: "Every message",
    leadCommentExact: "Comment is exactly",
    leadCommentContains: "Comment contains",
    leadDmExact: "Message is exactly",
    leadDmContains: "Message contains",
    moreKeywords: "+{count} more",

    // ---- ตัวอย่างข้อความ / ลำดับการตอบ / สถิติ (ในการ์ด) ----
    customerName: "Customer name",
    noMessage: "No message written yet",
    flowPublicReply: "Public reply",
    flowMessages: "Messages: {count}",
    flowButtons: "Buttons: {count}",
    statRuns: "Runs",
    statRunsValue: "{count}",
    statCtr: "Click rate",
    noButtonsTitle: "This automation has no buttons, so it has no click rate",
    noButtons: "(no buttons)",

    // ---- หน้าว่าง ----
    emptyTitle: "No automations yet",
    emptyBody: "Pick a starting template below, then change any message, button or card you like.",

    // ---- แบบเริ่มต้น (หน้าต่างสร้างกฎใหม่) ----
    chooserDescription: "Pick the closest template, then change any message, button or card you like.",
    recommended: "Recommended",
    opening: "Opening",
    templateCommentTitle: "Comment → DM with a button",
    templateCommentBody: "Reply under the comment, then send a DM with a button customers tap to get the details.",
    templateDmTitle: "Reply to messages by keyword",
    templateDmBody: "A customer messages “price” and gets a reply with a link right away.",
    templateBlankTitle: "Start from scratch",
    templateBlankBody: "Start with one empty card and build every message and button yourself.",
    flowComment: "Comment",
    flowSendDm: "Send DM",
    flowTapButton: "Tap button",
    flowLink: "Link",
    flowChat: "Message",
    flowReply: "Reply",
    flowTrigger: "Trigger",
    flowEmptyCard: "Empty card",

    // ---- หน้าแก้กฎ / ระหว่างโหลด ----
    savedToast: "Automation saved",
    loadingNew: "Preparing your new automation…",
    loadingEdit: "Opening automation…",

    // ---- แถบบนของตัวสร้างกฎ ----
    backAria: "Back to all automations",
    backTitle: "All automations",
    nameLabel: "Automation name",
    namePlaceholder: "Name it, e.g. Comment “info” → send link",
    topStats: "Runs: {runs} · Click rate: {ctr}",
    activeSwitch: "Active",
    activeShortOn: "On",
    activeShortOff: "Off",
    unsaved: "Unsaved changes",
    saved: "Saved",
    ruleMenuLabel: "Options for this automation",
    lastSavedVersion: "Last saved version",
    duplicateDirtyTitle: "Duplicate the last saved version?",
    duplicateDirtyBody: "Your unsaved changes to this automation will be lost. To keep them, save first.",
    deleteThisTitle: "Delete this automation?",
    deleteThisBody: "Its cards and stats will be gone. You can't undo this.",
    deleteRule: "Delete automation",
    saveShortcut: "Save (Ctrl+S)",

    // ---- แผงภาพรวม (ยังไม่ได้เลือกการ์ด) ----
    edgeFromTrigger: "\"When…\" card → message #{to}",
    edgeFromButton: "\"{button}\" button on message #{from} → message #{to}",
    untitledButton: "Untitled",
    selectedEdge: "Selected line",
    deleteEdge: "Remove this line",
    saveFailed: "Couldn't save",
    beforeSave: "Before you save",
    beforeSaveHint: "Tap an item to go fix that card",
    readyToSave: "All set. Ready to save.",
    resultsTitle: "Results for this automation",
    resultsSince: "Counted since it started",
    resultRuns: "Runs",
    resultRunsUnit: "total",
    resultSent: "DMs sent",
    resultSentUnit: "messages",
    resultCtr: "Click rate",
    resultCtrUnit: "of people reached",
    howTo: "How to use",
    tipTap: "{action} to edit it · Drag a card to move it",
    tipTapAction: "Tap a card",
    tipConnect: "{action} next to a button. Drop it on empty space to make the next message, or on a card to connect them",
    tipConnectAction: "Drag from the dot",
    tipPan: "{action} to move around · Ctrl + mouse wheel or pinch to zoom",
    tipPanAction: "Drag empty space",
    editTrigger: "Set up the trigger (\"When…\" card)",

    // ---- แผงเงื่อนไข (การ์ด "เมื่อ…") ----
    runsWhen: "Runs when",
    triggerComment: "Someone comments",
    triggerCommentHint: "On a post or reel",
    triggerDm: "Someone messages you",
    triggerDmHint: "Sends you a DM",
    platforms: "Platforms",
    platformsHint: "Works with your connected Facebook Page and Instagram account",
    keywordsTitle: "Keywords to watch for",
    matchLabel: "How to match",
    matchContains: "Contains",
    matchExact: "Exact match",
    matchAny: "Everything",
    matchContainsCommentHint: "Runs when a comment contains any of the keywords. For example, \"I'm interested!\" counts for \"interested\".",
    matchContainsDmHint: "Runs when a message contains any of the keywords. For example, \"I'm interested!\" counts for \"interested\".",
    matchExactHint: "Runs only when the whole text matches one of the keywords exactly.",
    matchAnyCommentHint: "Runs on every comment. No keywords needed.",
    matchAnyDmHint: "Runs on every message. No keywords needed.",
    keywordsLabel: "Keywords",
    keywordsHint: "Press Enter or type , to add a keyword. You can paste several at once.",
    keywordsPlaceholder: "e.g. interested, price, link",
    publicReplyTitle: "Public reply",
    publicReplyHint:
      "Everyone can see this reply. One version is picked at random each time, so it looks natural and not like spam. (Delete them all to skip the public reply.)",
    replyLabel: "Reply version {n}",
    replyPlaceholder: "e.g. Sent you the details by DM!",
    replyDelete: "Delete reply version {n}",
    replyAdd: "Add version",
    replyRandom: "Picks from {count} at random",
    onceTitle: "No repeat DMs",
    onceLabel: "Reply to each person once per post",
    onceHint: "If someone comments on the same post more than once, they only get a DM the first time.",
    advanced: "Advanced",
    priority: "Priority",
    priorityHint:
      "If a message matches several automations, the one with the lower number is used (1–1000). Easier: use Move up or Move down from the ⋮ button on the Automation page.",

    // ---- ใช้กับโพสต์หรือรีลไหน (แผงเงื่อนไข) ----
    postScopeTitle: "Which posts or reels?",
    postScopeSpecific: "Selected posts or reels",
    postScopeSpecificHint: "Pick from recent posts or enter IDs yourself",
    postScopeNext: "Your next post or reel",
    postScopeNextHint: "The first post or reel you publish after saving",
    postScopeAny: "All posts and reels",
    postScopeAnyHint: "Every post and reel, including future ones",
    mediaReel: "Reel",
    mediaVideo: "Video",
    postsErrorTitle: "Can't load your recent posts right now",
    postsErrorBody: "You can enter post IDs below, or try refreshing this page.",
    postsPickHint: "Tap to select (you can pick several)",
    postsSelected: "Selected: {count}",
    showLess: "Show less",
    showAll: "Show all ({count})",
    noRecentPosts: "No recent posts found. You can enter post IDs below.",
    manualIds: "Enter IDs yourself",
    manualIdsLabel: "Post or reel IDs",
    manualIdsHint: "One per line or separated by commas. Use this for older posts that aren't in the list.",
    manualIdsPlaceholder: "e.g. 1234567890_987654321",
    noCaption: "(no caption)",

    // ---- โพสต์หรือรีลถัดไป (แผงเงื่อนไข) ----
    nextIntro: "This automation will work on the first post or reel you publish after you save (Facebook and Instagram are tracked separately).",
    nextStartTitle: "Starts counting after you save",
    nextStartBody: "Posts or reels published before then won't use this automation.",
    nextRearmTitle: "Will start over when you save",
    nextRearmUndo: "Undo",
    nextRearmBodyBound: "Clears the linked post and waits for one published after that instead.",
    nextRearmBody: "Waits for a post or reel published after that.",
    nextWaiting: "Waiting for a new post",
    nextWaitingSince: "since {when}",
    nextSinceLine: "Since {when}",
    nextWaitingHint: "Go ahead and publish. It links itself when someone comments for the first time.",
    nextBound: "Linked",
    boundRelative: "Linked {when}",
    boundRelativeJoined: "Linked {when}",
    boundAbsolute: "Linked on {when}",
    openPostAria: "Open the post on {platform}",
    openPostTitle: "View post",
    rearmButton: "Start over with the next post",
    rearmHintBound: "Clears the linked post so this automation moves to the next post or reel you publish after saving.",
    rearmHintWaiting: "Restarts the clock from when you save (posts published before then won't use this automation).",
  },
});
