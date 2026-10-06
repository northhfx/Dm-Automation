/** รันครั้งเดียวตอนเปิดเซิร์ฟเวอร์: อัปเดตตารางฐานข้อมูล แล้วเริ่ม worker */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[startup] ยังไม่ได้ตั้งค่า DATABASE_URL — ข้ามการเริ่ม worker");
    return;
  }
  const { startBackground } = await import("./server/startup");
  await startBackground();
}
