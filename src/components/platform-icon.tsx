import type { CSSProperties } from "react";

/**
 * ไอคอน Facebook / Instagram แบบ SVG ในไฟล์ (ไอคอนแบรนด์ของ lucide เลิกใช้แล้ว)
 * - variant "brand" (ค่าเริ่มต้น): พื้นสีแบรนด์ + สัญลักษณ์สีขาว
 * - variant "mono": เส้นสีเดียวตามสีตัวอักษร (currentColor)
 * ใช้ได้ทั้งใน Server และ Client Component
 */
export function PlatformIcon({
  platform,
  size = 16,
  variant = "brand",
  className,
  title,
}: {
  platform: "facebook" | "instagram" | string;
  size?: number;
  variant?: "brand" | "mono";
  className?: string;
  /** ใส่เมื่อไอคอนอยู่เดี่ยวๆ ไม่มีข้อความกำกับ (โปรแกรมอ่านหน้าจอจะอ่านคำนี้) */
  title?: string;
}) {
  const isIg = platform === "instagram";
  const a11y = title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };

  if (variant === "mono") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...a11y}
      >
        {isIg ? <InstagramGlyph /> : <FacebookOutline />}
      </svg>
    );
  }

  const box: CSSProperties = {
    width: size,
    height: size,
    background: isIg ? "var(--brand-instagram-bg)" : "var(--brand-facebook)",
  };
  return (
    <span
      className={["inline-flex shrink-0 items-center justify-center overflow-hidden", isIg ? "rounded-[28%]" : "rounded-full", className]
        .filter(Boolean)
        .join(" ")}
      style={box}
      {...a11y}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={isIg ? 2 : 2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {isIg ? (
          <g transform="translate(12 12) scale(0.78) translate(-12 -12)">
            <InstagramGlyph dot="#fff" />
          </g>
        ) : (
          <FacebookF />
        )}
      </svg>
    </span>
  );
}

function FacebookF() {
  // ตัว f ที่ยาวลงไปชนขอบล่างแบบโลโก้จริง
  return (
    <>
      <path d="M13.2 25V11.6c0-2.1 1-3.1 3-3.1h1.3" />
      <path d="M9.6 13.6h6.6" />
    </>
  );
}

function FacebookOutline() {
  return (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M13 22v-9.4c0-1.8.9-2.7 2.6-2.7H16.8" />
      <path d="M10 14h5.6" />
    </>
  );
}

function InstagramGlyph({ dot = "currentColor" }: { dot?: string }) {
  return (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.25" cy="6.75" r="0.6" fill={dot} stroke={dot} />
    </>
  );
}
