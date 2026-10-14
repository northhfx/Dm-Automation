import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "@/components/toast";
import { env } from "@/lib/env";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { themeColorTags } from "@/lib/theme";
import { getThemePref } from "@/lib/theme-server";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("common");
  return {
    title: "DM Automation",
    description: t("appDescription"),
  };
}

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
  // ภาษาก็มาจากคุกกี้เช่นกัน → <html lang> + I18nProvider (ส่งแค่ชื่อภาษา ข้อความแต่ละหมวดถูก import ในคอมโพเนนต์ที่ใช้)
  // + เขตเวลาของระบบ ให้วันที่/เวลาใน Client Component ตรงกับที่เรนเดอร์ฝั่งเซิร์ฟเวอร์ (เบราว์เซอร์อ่าน APP_TIMEZONE เองไม่ได้)
  // ทุกหน้า (รวม /login /welcome /privacy /data-deletion) ได้ธีมและภาษาจากตรงนี้
  const [theme, locale] = await Promise.all([getThemePref(), getLocale()]);
  return (
    <html lang={locale} data-theme={theme === "system" ? undefined : theme} className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <I18nProvider locale={locale} timeZone={env.timezone}>
          {children}
          {/* toast() ใช้ได้ทุกหน้า รวมถึงหน้าเข้าสู่ระบบ */}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
