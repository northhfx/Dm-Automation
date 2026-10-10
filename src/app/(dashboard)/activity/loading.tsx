import { Skeleton } from "@/components/ui";

/** โครงหน้ากิจกรรมระหว่างรอข้อมูล */
export default function ActivityLoading() {
  return (
    <div role="status">
      <span className="sr-only">กำลังโหลดกิจกรรม…</span>
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="mb-6 h-10 w-full max-w-md rounded-lg" />
      <div className="rounded-xl border border-line bg-surface shadow-xs">
        <div className="border-b border-line px-5 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 px-5 py-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-32" />
              {i % 2 === 0 && <Skeleton className="h-12 w-full max-w-2xl rounded-xl" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
