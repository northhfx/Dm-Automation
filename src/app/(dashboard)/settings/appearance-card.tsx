import { SunMoon } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { getT } from "@/lib/i18n/server";
import { getThemePref } from "@/lib/theme-server";

/** การ์ด "การแสดงผล" ในหน้าตั้งค่า: ธีม สว่าง / มืด / ตามเครื่อง + ภาษา ไทย / English (id="appearance" สำหรับแถบหมวด) */
export async function AppearanceCard({ className }: { className?: string } = {}) {
  const [theme, t] = await Promise.all([getThemePref(), getT("appearance")]);
  return (
    <Card
      id="appearance"
      // เว้นที่ด้านบนเมื่อกระโดดมาที่หมวดนี้ (เท่ากับการ์ดอื่นในหน้าตั้งค่า)
      className={cx("scroll-mt-[calc(var(--app-topbar-h)+72px)] lg:scroll-mt-10", className)}
      icon={<SunMoon />}
      title={t("title")}
      description={t("description")}
    >
      <div className="space-y-5 sm:max-w-md">
        <section aria-labelledby="appearance-theme">
          <h3 id="appearance-theme" className="text-sm font-medium text-fg">
            {t("themeLabel")}
          </h3>
          <p className="mt-0.5 mb-2.5 text-xs leading-5 text-fg-3">{t("themeHint")}</p>
          <ThemeToggle initial={theme} variant="full" />
        </section>
        <section aria-labelledby="appearance-language">
          <h3 id="appearance-language" className="text-sm font-medium text-fg">
            {t("languageLabel")}
          </h3>
          <p className="mt-0.5 mb-2.5 text-xs leading-5 text-fg-3">{t("languageHint")}</p>
          <LanguageToggle variant="full" />
        </section>
      </div>
    </Card>
  );
}
