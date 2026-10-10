import { Skeleton } from "@/components/ui";

/** โครงหน้ารายชื่อลูกค้าระหว่างรอข้อมูล */
export default function ContactsLoading() {
  return (
    <div role="status">
      <span className="sr-only">กำลังโหลดรายชื่อลูกค้า…</span>
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Skeleton className="h-10 min-w-0 flex-1 basis-72 rounded-lg" />
        <Skeleton className="h-10 w-64 rounded-lg" />
      </div>
      <div className="rounded-xl border border-line bg-surface shadow-xs">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-24 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
