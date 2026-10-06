import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-fg-2">{description}</p>
        {children}
      </div>
    </main>
  );
}

/** แสดงเมื่อยังไม่ได้เชื่อมฐานข้อมูลบน Railway (ผู้ใช้จะเห็นหน้านี้แทนหน้า error) */
export function MissingDatabase() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 text-sm leading-7">
        <h1 className="text-xl font-semibold">อีกนิดเดียว: ยังไม่ได้เชื่อมฐานข้อมูล</h1>
        <p className="mt-2 text-fg-2">ระบบเปิดขึ้นแล้ว แต่ยังหาฐานข้อมูลไม่เจอ ทำตามนี้ใน Railway:</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>ในโปรเจกต์ กด <b>+ Create</b> (หรือ + New) → <b>Database</b> → <b>PostgreSQL</b> (ถ้ายังไม่มี)</li>
          <li>คลิกกล่องของแอป (ไม่ใช่กล่อง Postgres) → แท็บ <b>Variables</b></li>
          <li>
            กด <b>+ New Variable</b> ใส่ชื่อ <code className="rounded bg-surface-2 px-1">DATABASE_URL</code> และค่า{" "}
            <code className="rounded bg-surface-2 px-1">{"${{Postgres.DATABASE_URL}}"}</code>
          </li>
          <li>กด <b>Deploy</b> แล้วรอสักครู่ จากนั้นรีเฟรชหน้านี้</li>
        </ol>
      </div>
    </main>
  );
}
