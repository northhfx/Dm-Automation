/** โลโก้ของระบบ: กล่องสีหลัก + ฟองแชทมีสายฟ้า — size เป็นพิกเซล (ใช้ได้ทั้ง Server และ Client Component) */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[28%] bg-accent text-accent-fg shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="m13 7-3.2 5h4.4L11 17" />
      </svg>
    </span>
  );
}
