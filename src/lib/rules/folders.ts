/*
 * โฟลเดอร์ (โปรเจกต์) ของกฎ — ใช้จัดกลุ่มในหน้ากฎอัตโนมัติเท่านั้น ไม่มีผลกับลำดับหรือการตอบ
 * ตัวกรองในหน้า /rules: ?folder=<id> = เฉพาะโฟลเดอร์นั้น, ?folder=none = กฎที่ไม่อยู่ในโฟลเดอร์ไหน, ไม่ใส่ = ทั้งหมด
 */

export const FOLDER_NAME_MAX = 60;

/** id ที่เก็บในคอลัมน์ integer ได้ (เลขที่ใหญ่กว่านี้จาก URL ที่พิมพ์เอง → ถือว่าไม่มี ไม่ให้ query พัง) */
const INT4_MAX = 2_147_483_647;

export function isFolderId(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id <= INT4_MAX;
}

export type FolderFilter = "all" | "none" | number;

export function parseFolderFilter(value: string | string[] | undefined): FolderFilter {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "none") return "none";
  const id = Number(v);
  return isFolderId(id) ? id : "all";
}

/** ลิงก์หน้ารายการกฎตามตัวกรอง */
export function folderHref(filter: FolderFilter): string {
  return filter === "all" ? "/rules" : `/rules?folder=${filter}`;
}

/** กฎนี้อยู่ในตัวกรองนี้ไหม */
export function inFolder(folderId: number | null, filter: FolderFilter): boolean {
  if (filter === "all") return true;
  if (filter === "none") return folderId === null;
  return folderId === filter;
}

/** ตัดช่องว่างซ้ำ/หัวท้าย — คืน null ถ้าว่างหรือยาวเกิน */
export function cleanFolderName(raw: unknown): string | null {
  const name = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return name && name.length <= FOLDER_NAME_MAX ? name : null;
}
