import { Skeleton } from "@/components/ui";

/** โครงหน้าทั่วไปของแดชบอร์ดระหว่างรอข้อมูล (หน้าแรก, กฎทั้งหมด, ตั้งค่า, คู่มือ) */
export default function DashboardLoading() {
  return (
    <div role="status">
      <span className="sr-only">กำลังโหลด…</span>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`rounded-xl border border-line bg-surface p-4 shadow-xs ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-lg" />
            <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
