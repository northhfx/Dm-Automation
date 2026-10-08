/**
 * แทนค่าตัวแปรในข้อความ:
 *   {name} → ชื่อของคนที่คอมเมนต์/ทักมา (ถ้าไม่รู้ชื่อจะเป็น "คุณลูกค้า")
 * ลิงก์ใส่เป็นปุ่ม "เปิดลิงก์" ในข้อความแทน ({link} แบบเก่าจะถูกลบออก)
 */
export function renderTemplate(template: string, vars: { name?: string | null }): string {
  const name = vars.name?.trim() || "คุณลูกค้า";
  return template.replaceAll("{name}", name).replaceAll("{link}", "").trim();
}

export function pickRandom<T>(items: T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
}

/** Facebook ส่งชื่อเต็มมา ใช้ชื่อแรกจะดูเป็นกันเองกว่า */
export function firstName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}
