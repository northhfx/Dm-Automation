import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "@/components/toast";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "DM Automation",
  description: "ระบบตอบคอมเมนต์และส่ง DM อัตโนมัติสำหรับ Facebook และ Instagram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // สีแถบเบราว์เซอร์บนมือถือ ให้กลืนกับแถบด้านบนของแอป
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14171d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        {/* toast() ใช้ได้ทุกหน้า รวมถึงหน้าเข้าสู่ระบบ */}
        <Toaster />
      </body>
    </html>
  );
}
