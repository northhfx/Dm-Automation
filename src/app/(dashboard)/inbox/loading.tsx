import { LoadingLabel } from "@/components/localized";
import { Skeleton } from "@/components/ui";

/** โครงหน้าข้อความรอตอบระหว่างรอข้อมูล */
export default function InboxLoading() {
  return (
    <div role="status">
      <span className="sr-only">
        <LoadingLabel />
      </span>
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-72 rounded-lg sm:h-10" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
      <div className="rounded-xl border border-line bg-surface shadow-xs">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
            <Skeleton className="hidden h-8 w-36 rounded-lg sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
