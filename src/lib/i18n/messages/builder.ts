import { defineMessages } from "../core";

/**
 * ตัวสร้างกฎ (/rules/new, /rules/[id]) — src/app/(dashboard)/rules/builder/* (แผนผัง การ์ด แผงข้อความ)
 * + ข้อความ error ตอนตรวจ/บันทึกกฎ (lib/flows/validate.ts, rules/form-values.ts, rules/actions.ts, lib/rules/post-scope.ts)
 * - "กฎ" ภาษาอังกฤษเรียกว่า "Automation" (ห้ามใช้คำว่า rule)
 * - {token} = คำแทนชื่อลูกค้าในข้อความ (ส่งค่า "{name}" มา — ห้ามตั้งชื่อตัวแปรว่า name)
 * - {rule} = ชื่อกฎที่เจ้าของร้านตั้ง
 * - ตัวเลขลิมิต ({max}) ส่งมาเป็น string เพื่อไม่ให้ใส่ตัวคั่นหลักพัน (ข้อความเดิมเขียน "1000")
 */
export const builderMessages = defineMessages({
  th: {
    // ---- ชื่อการ์ด / คำที่ใช้หลายที่ ----
    /** การ์ดข้อความ: หัวแผง, aria-label ของการ์ด, ชื่อการ์ดนำหน้าปัญหาที่ต้องแก้ */
    messageCard: "ข้อความ #{n}",
    /** หัวการ์ดเงื่อนไขบนแผนผัง */
    triggerCard: "เมื่อ…",
    triggerCardAria: "การ์ด เมื่อ…",
    /** ป้ายของการ์ดที่การ์ด "เมื่อ…" เชื่อมไป */
    firstMessage: "ข้อความแรก",
    /** ชิปที่แสดงแทน {name} ในข้อความ */
    customerName: "ชื่อลูกค้า",
    /** ปุ่มที่ยังไม่ได้ตั้งชื่อ (บนการ์ดและในตัวอย่างแชท) */
    buttonNamePlaceholder: "ชื่อปุ่ม",
    untitledButton: "ไม่มีชื่อ",
    maxSteps: "ใส่ข้อความได้สูงสุด {max} ข้อความต่อกฎ",
    edit: "แก้ไข",
    duplicate: "ทำสำเนา",
    delete: "ลบ",
    deleteCard: "ลบการ์ด",
    cardActions: "จัดการการ์ด",

    // ---- หน้าหลักของตัวสร้าง (แผงด้านข้าง / แถบล่างบนมือถือ / หน้าต่างยืนยัน) ----
    panelOverview: "ภาพรวม",
    panelTrigger: "ทำงานเมื่อ…",
    /** ปุ่มเปิดแผงด้านขวาอีกครั้ง (เดสก์ท็อป) */
    panelShow: "แผงตั้งค่า",
    panelHide: "ซ่อนแผงตั้งค่า",
    panelClose: "ปิดแผงตั้งค่า",
    sheetOverview: "ภาพรวมและสิ่งที่ต้องแก้",
    /** กดบันทึกแล้วไม่ผ่าน: {count} = จำนวนจุดที่ต้องแก้ */
    sheetMustFix: "ต้องแก้อีก {count} จุดก่อนบันทึก",
    /** ยังไม่เคยกดบันทึก: {count} = จำนวนขั้นที่ยังไม่ครบ */
    sheetStepsLeft: "เหลืออีก {count} ขั้นก่อนบันทึก",
    sheetReady: "ครบแล้ว พร้อมบันทึก",
    sheetSaved: "บันทึกแล้ว",
    cardDuplicated: "ทำสำเนาการ์ดแล้ว",
    messageDeleted: "ลบข้อความ #{n} แล้ว",
    undoHint: "กด Ctrl+Z หรือปุ่มย้อนกลับเพื่อเอาคืน",
    cantSaveYet: "ยังบันทึกไม่ได้",
    saveFailed: "บันทึกไม่สำเร็จ",
    saved: "บันทึกแล้ว",
    deleteMessageTitle: "ลบข้อความ #{n}?",
    deleteMessageBody: "ปุ่มที่เชื่อมมาที่การ์ดนี้จะไม่ได้เชื่อม (ย้อนกลับได้ด้วย Ctrl+Z ก่อนบันทึก)",
    leaveTitle: "ออกโดยไม่บันทึก?",
    leaveBody: "การแก้ไขที่ยังไม่ได้บันทึกจะหายไป",
    stay: "อยู่ต่อ",
    leave: "ออกโดยไม่บันทึก",

    // ---- แผนผัง (canvas) ----
    canvasLabel: "แผนผังข้อความ — ลากพื้นที่ว่างเพื่อเลื่อน, ลากจุดที่ปุ่มเพื่อเชื่อมข้อความ",
    removeLine: "ลบเส้นนี้",
    removeLineTitle: "ลบเส้นนี้ (Delete)",
    /** ระหว่างลากเส้น: อยู่เหนือการ์ดที่เชื่อมได้ */
    dropToConnect: "ปล่อยเพื่อเชื่อมกับการ์ดนี้",
    dropHint: "ปล่อยบนการ์ดเพื่อเชื่อม · ปล่อยที่ว่างเพื่อสร้างข้อความใหม่",
    addMessage: "เพิ่มข้อความ",
    addMessageTitle: "เพิ่มการ์ดข้อความใหม่",
    undo: "ย้อนกลับ (Ctrl+Z)",
    redo: "ทำซ้ำ (Ctrl+Shift+Z)",
    zoomOut: "ซูมออก",
    zoomReset: "กลับไปขนาด 100%",
    zoomIn: "ซูมเข้า",
    fit: "พอดีจอ",
    arrange: "จัดเรียงการ์ดอัตโนมัติ",

    // ---- การ์ดบนแผนผัง (nodes) ----
    /** คำอธิบายเมื่อชี้ที่จุดต่อเส้นที่เชื่อมแล้ว / ยังไม่ได้เชื่อม */
    handleConnectedTitle: "ลากไปการ์ดอื่นเพื่อเปลี่ยน · แตะเพื่อเลือกเส้น",
    handleOpenTitle: "ลากไปวางเพื่อสร้าง/เชื่อมข้อความถัดไป · แตะเพื่อสร้างข้อความใหม่",
    scopeSelected: "โพสต์/รีลที่เลือก ({count})",
    scopeNoneSelected: "ยังไม่ได้เลือกโพสต์หรือรีล",
    scopeNext: "โพสต์หรือรีลถัดไป",
    /** กฎ "โพสต์ถัดไป" จับคู่กับโพสต์จริงแล้ว (ตามด้วยไอคอนแพลตฟอร์ม) */
    scopeBound: "ผูกแล้ว",
    /** ตามด้วยไอคอนแพลตฟอร์มที่ยังรอโพสต์ใหม่ */
    scopeWaitingFor: "รอ",
    scopeWaiting: "รอโพสต์ใหม่",
    scopeRearm: "เริ่มนับใหม่หลังบันทึก",
    scopeStart: "เริ่มนับหลังบันทึก",
    scopeAny: "ทุกโพสต์และรีล",
    /** ป้ายบนการ์ด "เมื่อ…": กดบันทึกแล้วไม่ผ่าน / ยังไม่เคยกดบันทึก */
    needsFix: "ต้องแก้ไข",
    incomplete: "ยังไม่ครบ",
    whenComment: "มีคนคอมเมนต์ใต้โพสต์",
    whenDm: "มีคนทักแชท (DM) มา",
    noPlatform: "ยังไม่ได้เลือกแพลตฟอร์ม",
    matchAny: "ทุกข้อความ (ไม่ต้องมีคำเฉพาะ)",
    /** ตามด้วยชิปคำที่ตั้งไว้ */
    matchExact: "พิมพ์ตรงทั้งข้อความว่า",
    matchContains: "มีคำว่า",
    noKeywords: "ยังไม่ได้ใส่คำ",
    /** {count} = จำนวนแบบของข้อความตอบใต้คอมเมนต์ (สุ่มใช้ทีละแบบ) */
    publicReplies: "ตอบใต้คอมเมนต์ {count} แบบ (สุ่ม)",
    noPublicReply: "ไม่ตอบใต้คอมเมนต์",
    noFirstMessage: "ยังไม่ได้เชื่อมข้อความแรก",
    /** ป้ายข้างจุดต่อเส้นของการ์ด "เมื่อ…" (ลากไปที่ข้อความแรก) */
    thenSend: "แล้วส่ง",
    thenSendHandle: "จุดต่อ แล้วส่ง — ลากไปที่ข้อความแรก",
    /** หัวการ์ดข้อความ */
    sendMessage: "ส่งข้อความ",
    emptyCardText: "ยังไม่มีข้อความ — กดเพื่อพิมพ์",
    /** ไอคอนของปุ่มแบบเปิดลิงก์ (โปรแกรมอ่านหน้าจอ) */
    opensLink: "เปิดลิงก์",
    buttonHandle: "จุดต่อของปุ่ม {button}",
    notConnected: "ยังไม่ได้เชื่อม — จะไม่ถูกส่ง",
    /** สถิติท้ายการ์ด: {count} = ตัวเลขตัวหนา */
    cardSent: "ส่ง {count} ครั้ง",
    cardCtr: "อัตราการกด {rate}",

    // ---- แผงข้อความ (message-panel) ----
    /** ชื่อลูกค้าตัวอย่างในหน้าตาแชทจำลอง */
    previewName: "มิ้นท์",
    /** ข้อความว่างในรายการเลือกข้อความปลายทาง */
    noTextSnippet: "(ยังไม่มีข้อความ)",
    /** {action} = ชื่อปุ่ม setStart */
    unreachableHint: "ยังไม่มีปุ่มไหนพามาที่ข้อความนี้ จึงจะไม่ถูกส่ง — ลากเส้นจากจุดข้างปุ่มของการ์ดอื่นมาที่การ์ดนี้ หรือกด \"{action}\"",
    noStartHint: "การ์ด \"เมื่อ…\" ยังไม่ได้เชื่อมกับข้อความไหน — กด \"{action}\" ถ้าอยากให้ส่งข้อความนี้ก่อน",
    textLabel: "ข้อความที่จะส่ง",
    nameHint: "{token} จะถูกแทนด้วยชื่อลูกค้า (นับเผื่อ {allowance} ตัวอักษร)",
    buttonsLimitHint: "ข้อความที่มีปุ่มยาวได้ {max} ตัวอักษร",
    textPlaceholder: "พิมพ์ข้อความที่จะส่งให้ลูกค้า…",
    insertName: "แทรกชื่อลูกค้า",
    previewTitle: "ตัวอย่างที่ลูกค้าเห็น",
    /** {count} = จำนวนปุ่มตอนนี้, {max} = สูงสุด */
    buttonsTitle: "ปุ่ม ({count}/{max})",
    /** {option} = ชื่อตัวเลือก typeNext */
    buttonsHint: "ปุ่ม '{option}' พาไปข้อความถัดไป — ถามก่อนแล้วให้กดปุ่ม มักได้คนกดลิงก์มากกว่าส่งลิงก์ทันที",
    noButtons: "ยังไม่มีปุ่ม",
    buttonHeading: "ปุ่มที่ {n}",
    moveUp: "เลื่อนขึ้น",
    moveDown: "เลื่อนลง",
    deleteButton: "ลบปุ่มที่ {n}",
    buttonName: "ชื่อปุ่ม",
    buttonNameExample: "เช่น ใช่ ฉันสนใจ!",
    /** ชื่อกลุ่มตัวเลือกว่ากดปุ่มแล้วทำอะไร */
    whenTapped: "กดแล้ว",
    typeNext: "ส่งข้อความต่อ",
    typeLink: "เปิดลิงก์",
    nextTarget: "ส่งข้อความไหน",
    pickMessage: "— เลือกข้อความ —",
    newMessageOption: "+ สร้างข้อความใหม่",
    linkLabel: "ลิงก์",
    linkInvalid: "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://",
    linkHint: "ระบบแปลงเป็นลิงก์ติดตามการคลิกให้อัตโนมัติ",
    maxButtons: "ใส่ได้สูงสุด {max} ปุ่ม",
    addButton: "เพิ่มปุ่ม",
    statsTitle: "สถิติของข้อความนี้",
    statsSince: "นับตั้งแต่เริ่มใช้งาน",
    /** ช่องสถิติ: ชื่อ / ตัวเลข / คำใต้ตัวเลข */
    statSent: "ส่งแล้ว",
    statSentUnit: "ครั้ง",
    statEngaged: "คนกด",
    statEngagedUnit: "จาก {count} คน",
    statCtr: "อัตราการกด",
    statCtrUnit: "จากคนที่ได้รับ",
    setStart: "ตั้งเป็นข้อความแรก",
    isStartHint: "ข้อความนี้ส่งทันทีเมื่อกฎทำงาน (การ์ด \"เมื่อ…\" เชื่อมมาที่นี่)",
    /** รูปโปรไฟล์ของร้านในแชทจำลอง (วงกลมเล็ก — สั้นที่สุด) */
    shopAvatar: "ร้าน",
    previewEmpty: "ยังไม่มีข้อความ",
    previewNote: "ตัวอย่างโดยใช้ชื่อลูกค้า \"{sample}\"",

    // ---- ช่องใส่คำแบบชิป (widgets) ----
    removeKeyword: "ลบคำ {keyword}",

    // ---- ตรวจข้อความของกฎ (validate.ts) — "{where}: {issue}" ----
    /** ชื่อการ์ดในข้อความ error จากเซิร์ฟเวอร์ (บนแผนผังใช้ messageCard) */
    stepLabel: "ข้อความที่ {n}",
    buttonLabel: "ปุ่มที่ {n}",
    buttonLabelTitled: "ปุ่มที่ {n} (\"{title}\")",
    /** {step} = stepLabel / messageCard, {button} = buttonLabel */
    inStep: "{step} {button}",
    issueAt: "{where}: {issue}",
    noSteps: "ต้องมีข้อความอย่างน้อย 1 ข้อความ",
    badStepData: "ข้อมูลข้อความไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่",
    badButtonData: "ข้อมูลปุ่มไม่ถูกต้อง ลองรีเฟรชหน้าแล้วแก้ใหม่",
    textMissing: "ยังไม่ได้ใส่ข้อความ",
    tooLong: "ยาวเกิน {max} ตัวอักษร",
    tooLongName: "ยาวเกิน {max} ตัวอักษร (โดยนับ {token} เผื่อเป็น {allowance} ตัวอักษร)",
    tooLongButtons: "ยาวเกิน {max} ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน {max} ตัวอักษร)",
    tooLongButtonsName: "ยาวเกิน {max} ตัวอักษร (ข้อความที่มีปุ่มส่งได้ไม่เกิน {max} ตัวอักษร โดยนับ {token} เผื่อเป็น {allowance} ตัวอักษร)",
    tooManyButtons: "ใส่ปุ่มได้สูงสุด {max} ปุ่ม",
    buttonNameMissing: "ยังไม่ได้ตั้งชื่อปุ่ม",
    buttonNameTooLong: "ชื่อปุ่มยาวได้ไม่เกิน {max} ตัวอักษร",
    buttonLinkInvalid: "ใส่ลิงก์ที่ขึ้นต้นด้วย https://",
    buttonNextMissing: "ยังไม่ได้เชื่อมว่ากดแล้วให้ส่งข้อความไหน (หรือเปลี่ยนเป็นปุ่มเปิดลิงก์)",

    // ---- สิ่งที่ต้องแก้ก่อนบันทึก (model.ts — แสดงในแผงภาพรวม/แผงเงื่อนไข) ----
    nameMissing: "ตั้งชื่อกฎ (ไว้ดูเองว่ากฎนี้ทำอะไร)",
    nameTooLong: "ชื่อกฎยาวเกิน 100 ตัวอักษร",
    platformsMissing: "เลือกอย่างน้อย 1 แพลตฟอร์ม (Facebook หรือ Instagram)",
    /** 'ทุกข้อความ' = ตัวเลือก "วิธีจับคำ" แบบไม่ต้องมีคำ (rules.matchAny) */
    keywordsMissing: "ใส่คำที่ให้ระบบจับอย่างน้อย 1 คำ (หรือเลือก 'ทุกข้อความ')",
    keywordTooLong: "คำที่ให้จับยาวได้ไม่เกิน 100 ตัวอักษร",
    repliesTooLong: "ข้อความตอบใต้คอมเมนต์ยาวเกิน 500 ตัวอักษร",
    postsMissing: "เลือกโพสต์หรือรีลอย่างน้อย 1 รายการ",
    /** ใส่ลิงก์โพสต์แทน ID (ทั้งในตัวสร้างและตอนบันทึก) */
    invalidPostId: "ใส่ ID ของโพสต์ ไม่ใช่ลิงก์ — เลือกจากรายการโพสต์ล่าสุดด้านบนแทนได้",
    startMissing: "ยังไม่ได้เชื่อมการ์ด \"เมื่อ…\" กับข้อความแรก — ลากเส้นจากจุด \"แล้วส่ง\" ไปที่การ์ดข้อความ",
    unreachable: "ข้อความ #{n} ยังไม่ได้เชื่อม — จะไม่ถูกส่ง",

    // ---- ตอนบันทึก (form-values.ts / actions.ts — เซิร์ฟเวอร์ตรวจซ้ำ) ----
    ruleNameMissing: "กรุณาตั้งชื่อกฎ",
    ruleNameTooLong: "ชื่อกฎยาวเกินไป",
    rulePlatformsMissing: "เลือกอย่างน้อย 1 แพลตฟอร์ม",
    postIdTooLong: "ID โพสต์ยาวเกินไป",
    replyTooLong: "ข้อความตอบคอมเมนต์ยาวเกิน 500 ตัวอักษร",
    invalidData: "ข้อมูลไม่ถูกต้อง",
    postsMissingServer: "เลือกโพสต์หรือรีลอย่างน้อย 1 รายการ (หรือเปลี่ยนเป็น 'ทุกโพสต์และรีล' / 'โพสต์หรือรีลถัดไป')",
    startMissingServer: "ยังไม่ได้เชื่อมการ์ด \"เมื่อ…\" กับข้อความแรกที่จะส่ง — ลากเส้นจากจุด \"แล้วส่ง\" ไปที่การ์ดข้อความ",
    ruleGone: "ไม่พบกฎนี้แล้ว (อาจถูกลบไป) — คัดลอกข้อความเก็บไว้ก่อน แล้วสร้างกฎใหม่",
    /** ชื่อของกฎที่ทำสำเนา */
    copyName: "{rule} (สำเนา)",
  },
  en: {
    // ---- ชื่อการ์ด / คำที่ใช้หลายที่ ----
    messageCard: "Message #{n}",
    triggerCard: "When…",
    triggerCardAria: "\"When…\" card",
    firstMessage: "First message",
    customerName: "Customer name",
    buttonNamePlaceholder: "Button name",
    untitledButton: "Untitled",
    maxSteps: "You can add up to {max} messages per automation",
    edit: "Edit",
    duplicate: "Duplicate",
    delete: "Delete",
    deleteCard: "Delete card",
    cardActions: "Card actions",

    // ---- หน้าหลักของตัวสร้าง (แผงด้านข้าง / แถบล่างบนมือถือ / หน้าต่างยืนยัน) ----
    panelOverview: "Overview",
    panelTrigger: "Runs when…",
    panelShow: "Panel",
    panelHide: "Hide panel",
    panelClose: "Close panel",
    sheetOverview: "Overview and things to fix",
    sheetMustFix: "Fix before saving: {count}",
    sheetStepsLeft: "Steps left before saving: {count}",
    sheetReady: "All set. Ready to save.",
    sheetSaved: "Saved",
    cardDuplicated: "Card duplicated",
    messageDeleted: "Message #{n} deleted",
    undoHint: "Press Ctrl+Z or Undo to bring it back",
    cantSaveYet: "Can't save yet",
    saveFailed: "Couldn't save",
    saved: "Saved",
    deleteMessageTitle: "Delete message #{n}?",
    deleteMessageBody: "Buttons that lead to this card will be disconnected. (You can undo with Ctrl+Z before you save.)",
    leaveTitle: "Leave without saving?",
    leaveBody: "Your unsaved changes will be lost.",
    stay: "Stay",
    leave: "Leave without saving",

    // ---- แผนผัง (canvas) ----
    canvasLabel: "Message map. Drag empty space to move around, or drag the dot next to a button to connect messages.",
    removeLine: "Remove this line",
    removeLineTitle: "Remove this line (Delete)",
    dropToConnect: "Let go to connect to this card",
    dropHint: "Drop on a card to connect · Drop on empty space to make a new message",
    addMessage: "Add message",
    addMessageTitle: "Add a new message card",
    undo: "Undo (Ctrl+Z)",
    redo: "Redo (Ctrl+Shift+Z)",
    zoomOut: "Zoom out",
    zoomReset: "Back to 100%",
    zoomIn: "Zoom in",
    fit: "Fit to screen",
    arrange: "Tidy up cards",

    // ---- การ์ดบนแผนผัง (nodes) ----
    handleConnectedTitle: "Drag to another card to change it · Tap to select the line",
    handleOpenTitle: "Drag to create or connect the next message · Tap to create a new message",
    scopeSelected: "Selected posts/reels ({count})",
    scopeNoneSelected: "No posts or reels picked yet",
    scopeNext: "Next post or reel",
    scopeBound: "Linked",
    scopeWaitingFor: "waiting",
    scopeWaiting: "Waiting for a new post",
    scopeRearm: "Starts over after you save",
    scopeStart: "Starts counting after you save",
    scopeAny: "All posts and reels",
    needsFix: "Needs fixing",
    incomplete: "Not finished",
    whenComment: "Someone comments on a post",
    whenDm: "Someone sends you a DM",
    noPlatform: "No platform picked yet",
    matchAny: "Everything (no keywords needed)",
    matchExact: "Text is exactly",
    matchContains: "Contains",
    noKeywords: "No keywords yet",
    publicReplies: "Public reply (picks 1 of {count})",
    noPublicReply: "No public reply",
    noFirstMessage: "No first message yet",
    thenSend: "Then send",
    thenSendHandle: "\"Then send\" dot. Drag it to the first message.",
    sendMessage: "Send message",
    emptyCardText: "No text yet. Tap to type.",
    opensLink: "Opens a link",
    buttonHandle: "Connection dot for button {button}",
    notConnected: "Not connected, so it won't be sent",
    cardSent: "Sent: {count}",
    cardCtr: "Click rate: {rate}",

    // ---- แผงข้อความ (message-panel) ----
    previewName: "Mint",
    noTextSnippet: "(no text yet)",
    unreachableHint:
      "No button leads to this message, so it won't be sent. Drag a line from the dot next to a button on another card to this card, or tap \"{action}\".",
    noStartHint: "The \"When…\" card isn't connected to any message yet. Tap \"{action}\" if you want this message sent first.",
    textLabel: "Message to send",
    nameHint: "{token} is replaced with the customer's name (counted as {allowance} characters)",
    buttonsLimitHint: "Messages with buttons can be up to {max} characters",
    textPlaceholder: "Type the message your customer will get…",
    insertName: "Insert customer name",
    previewTitle: "What your customer sees",
    buttonsTitle: "Buttons ({count}/{max})",
    buttonsHint:
      "A '{option}' button leads to the next message. Asking first and letting people tap a button often gets more link clicks than sending the link right away.",
    noButtons: "No buttons yet",
    buttonHeading: "Button {n}",
    moveUp: "Move up",
    moveDown: "Move down",
    deleteButton: "Delete button {n}",
    buttonName: "Button name",
    buttonNameExample: "e.g. Yes, I'm interested!",
    whenTapped: "When tapped",
    typeNext: "Send next message",
    typeLink: "Open link",
    nextTarget: "Which message to send",
    pickMessage: "— Pick a message —",
    newMessageOption: "+ New message",
    linkLabel: "Link",
    linkInvalid: "Links must start with https:// or http://",
    linkHint: "We turn it into a tracked link automatically, so you can count clicks",
    maxButtons: "Up to {max} buttons",
    addButton: "Add button",
    statsTitle: "Stats for this message",
    statsSince: "Counted since it started",
    statSent: "Sent",
    statSentUnit: "total",
    statEngaged: "Tapped",
    statEngagedUnit: "of {count} reached",
    statCtr: "Click rate",
    statCtrUnit: "of people reached",
    setStart: "Make it the first message",
    isStartHint: "This message is sent as soon as the automation runs (the \"When…\" card connects here).",
    shopAvatar: "Shop",
    previewEmpty: "No text yet",
    previewNote: "Preview with the customer name \"{sample}\"",

    // ---- ช่องใส่คำแบบชิป (widgets) ----
    removeKeyword: "Remove keyword {keyword}",

    // ---- ตรวจข้อความของกฎ (validate.ts) — "{where}: {issue}" ----
    stepLabel: "Message #{n}",
    buttonLabel: "button {n}",
    buttonLabelTitled: "button {n} (\"{title}\")",
    inStep: "{step}, {button}",
    issueAt: "{where}: {issue}",
    noSteps: "Add at least 1 message",
    badStepData: "Something's wrong with the message data. Refresh the page and try again.",
    badButtonData: "Something's wrong with the button data. Refresh the page and try again.",
    textMissing: "No text yet",
    tooLong: "Over {max} characters",
    tooLongName: "Over {max} characters (counting {token} as {allowance} characters)",
    tooLongButtons: "Over {max} characters (messages with buttons can have up to {max})",
    tooLongButtonsName: "Over {max} characters (messages with buttons can have up to {max}, counting {token} as {allowance} characters)",
    tooManyButtons: "You can add up to {max} buttons",
    buttonNameMissing: "Give the button a name",
    buttonNameTooLong: "Button names can be up to {max} characters",
    buttonLinkInvalid: "Add a link that starts with https://",
    buttonNextMissing: "Choose which message it sends when tapped (or make it a link button)",

    // ---- สิ่งที่ต้องแก้ก่อนบันทึก (model.ts — แสดงในแผงภาพรวม/แผงเงื่อนไข) ----
    nameMissing: "Name this automation (so you remember what it does)",
    nameTooLong: "The automation name is over 100 characters",
    platformsMissing: "Pick at least 1 platform (Facebook or Instagram)",
    keywordsMissing: "Add at least 1 keyword (or choose 'Everything')",
    keywordTooLong: "Keywords can be up to 100 characters",
    repliesTooLong: "A public reply is over 500 characters",
    postsMissing: "Pick at least 1 post or reel",
    invalidPostId: "Enter the post ID, not a link. Or pick from your recent posts above.",
    startMissing: "The \"When…\" card isn't connected to a first message yet. Drag a line from its \"Then send\" dot to a message card.",
    unreachable: "Message #{n} isn't connected, so it won't be sent",

    // ---- ตอนบันทึก (form-values.ts / actions.ts — เซิร์ฟเวอร์ตรวจซ้ำ) ----
    ruleNameMissing: "Please name this automation",
    ruleNameTooLong: "The automation name is too long",
    rulePlatformsMissing: "Pick at least 1 platform",
    postIdTooLong: "A post ID is too long",
    replyTooLong: "A public reply is over 500 characters",
    invalidData: "Something's wrong with this automation. Check it and try again.",
    postsMissingServer: "Pick at least 1 post or reel (or switch to 'All posts and reels' or 'Your next post or reel')",
    startMissingServer:
      "The \"When…\" card isn't connected to the first message to send. Drag a line from its \"Then send\" dot to a message card.",
    ruleGone: "This automation no longer exists (it may have been deleted). Copy your messages somewhere first, then create a new automation.",
    copyName: "{rule} (copy)",
  },
});
