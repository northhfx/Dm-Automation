/**
 * แทนค่าตัวแปรในข้อความ:
 *   {name} → ชื่อของคนที่คอมเมนต์/ทักมา (ถ้าไม่รู้ชื่อจะเป็น "คุณลูกค้า")
 *   {link} → ลิงก์ติดตามการคลิก
 * ถ้ากฎมีลิงก์แต่ข้อความไม่มี {link} ระบบจะต่อท้ายลิงก์ให้อัตโนมัติ
 */
export function renderTemplate(template: string, vars: { name?: string | null; link?: string | null }): string {
  const name = vars.name?.trim() || "คุณลูกค้า";
  let out = template.replaceAll("{name}", name);
  if (vars.link) {
    out = out.includes("{link}") ? out.replaceAll("{link}", vars.link) : `${out.trimEnd()}\n\n${vars.link}`;
  } else {
    out = out.replaceAll("{link}", "");
  }
  return out.trim();
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
