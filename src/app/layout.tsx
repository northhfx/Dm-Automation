import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "@/components/toast";
import { themeColorTags } from "@/lib/theme";
import { getThemePref } from "@/lib/theme-server";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "DM Automation",
  description: "ระบบตอบคอมเมนต์และส่ง DM อัตโนมัติสำหรับ Facebook และ Instagram",
};

export async function generateViewport(): Promise<Viewport> {
  return {
    width: "device-width",
    initialScale: 1,
    // สีแถบเบราว์เซอร์บนมือถือ ให้กลืนกับแถบด้านบนของแอป (ตามธีมที่เลือก หรือตามเครื่องถ้าไม่ได้เลือก)
    themeColor: themeColorTags(await getThemePref()),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // ธีมมาจากคุกกี้ → ใส่ data-theme ตั้งแต่ฝั่งเซิร์ฟเวอร์ หน้าจึงไม่กะพริบตอนโหลด
  // "ตามเครื่อง" ไม่ใส่ data-theme ให้ CSS เลือกตามโหมดของเครื่องเอง (ดู globals.css)
  // ทุกหน้า (รวม /login /welcome /privacy /data-deletion) ได้ธีมจากตรงนี้
  const theme = await getThemePref();
  return (
    <html lang="th" data-theme={theme === "system" ? undefined : theme} className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        {/* toast() ใช้ได้ทุกหน้า รวมถึงหน้าเข้าสู่ระบบ */}
        <Toaster />
      </body>
    </html>
  );
}
