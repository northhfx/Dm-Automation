import { Skeleton } from "@/components/ui";

/** การ์ดจำลองบนแผนผังระหว่างโหลด */
function CardSkeleton({ className, lines = 2 }: { className: string; lines?: number }) {
  return (
    <div className={`absolute w-56 rounded-xl border border-line bg-surface p-3.5 shadow-xs sm:w-64 ${className}`}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"} />
        ))}
      </div>
      <Skeleton className="mt-3 h-8 w-full rounded-lg" />
    </div>
  );
}

/**
 * โครงหน้าแผนผังกฎระหว่างรอเซิร์ฟเวอร์ (ดึงโพสต์ล่าสุดจาก Meta อาจใช้เวลา 1–3 วินาที)
 * หน้าตาเหมือนหน้าจริง: แถบบน 64px · แผนผังลายจุด · แผงด้านขวา (จอใหญ่) / แถบล่าง 56px (มือถือ)
 */
export function BuilderSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-0 flex-1 flex-col bg-bg">
      <span className="sr-only">{label}</span>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-4">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <Skeleton className="h-6 w-40 max-w-[45%]" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="hidden h-5 w-24 md:block" />
          <Skeleton className="h-10 w-20 rounded-lg sm:w-24" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--fg-3) 32%, transparent) 1px, transparent 1.4px)",
            backgroundSize: "20px 20px",
          }}
          aria-hidden
        >
          <CardSkeleton className="top-10 left-4 sm:top-16 sm:left-12" lines={3} />
          <CardSkeleton className="top-64 left-10 sm:top-24 sm:left-[22rem]" />
        </div>
        <div className="hidden w-[360px] shrink-0 border-l border-line bg-surface lg:block xl:w-[400px]" aria-hidden>
          <div className="flex h-14 items-center gap-2.5 border-b border-line px-5">
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="space-y-4 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-surface px-4 lg:hidden" aria-hidden>
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
