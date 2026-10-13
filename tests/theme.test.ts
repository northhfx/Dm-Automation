import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTheme, THEME_COLORS, THEME_COOKIE, themeColorTags } from "@/lib/theme";

describe("parseTheme", () => {
  it("รับเฉพาะ light / dark ตรงตัว", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("ค่าอื่นหรือไม่มีคุกกี้ → ตามเครื่อง", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("blue")).toBe("system");
    expect(parseTheme("SYSTEM")).toBe("system");
    expect(parseTheme("DARK")).toBe("system");
    expect(parseTheme(" dark")).toBe("system");
  });

  it("ชื่อคุกกี้", () => {
    expect(THEME_COOKIE).toBe("theme");
  });
});

describe("themeColorTags (สีแถบเบราว์เซอร์มือถือ)", () => {
  it("บังคับธีม → แท็กเดียว ไม่มี media", () => {
    expect(themeColorTags("light")).toEqual([{ color: THEME_COLORS.light }]);
    expect(themeColorTags("dark")).toEqual([{ color: THEME_COLORS.dark }]);
  });

  it("ตามเครื่อง → สองแท็กแยกตาม prefers-color-scheme", () => {
    expect(themeColorTags("system")).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ]);
  });
});

// ---------- globals.css: บล็อกโหมดมืดสองที่ต้องตรงกันเสมอ ----------

const css = readFileSync(path.resolve(import.meta.dirname, "../src/app/globals.css"), "utf8");

/** เนื้อในวงเล็บปีกกาของ block แรกที่ตรง pattern (block ของ token ไม่มีวงเล็บปีกกาซ้อน) */
function blockBody(pattern: RegExp): string {
  const m = css.match(pattern);
  expect(m, `ไม่พบ ${pattern} ใน globals.css`).not.toBeNull();
  return m![1];
}

/** ค่าที่ประกาศใน block: { "--bg": "#0c0e12", "color-scheme": "dark", ... } */
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const decl of noComments.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim().replace(/\s+/g, " ");
  }
  return out;
}

describe("globals.css ธีม", () => {
  const light = declarations(blockBody(/^:root \{([^}]*)\}/m));
  const forcedDark = declarations(blockBody(/^:root\[data-theme="dark"\] \{([^}]*)\}/m));
  const systemDark = declarations(blockBody(/^@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/m));

  it("บล็อกมืดแบบเลือกเอง กับแบบตามเครื่อง มี token และค่าเหมือนกันทุกตัว", () => {
    expect(Object.keys(forcedDark).length).toBeGreaterThan(10);
    expect(systemDark).toEqual(forcedDark);
    expect(forcedDark["color-scheme"]).toBe("dark");
    expect(light["color-scheme"]).toBe("light");
  });

  it("ทุก token ในโหมดมืดมีค่าโหมดสว่างคู่กัน", () => {
    const missing = Object.keys(forcedDark).filter((k) => !(k in light));
    expect(missing).toEqual([]);
  });

  it("สีแถบเบราว์เซอร์ตรงกับ --surface ของแต่ละโหมด", () => {
    expect(light["--surface"]).toBe(THEME_COLORS.light);
    expect(forcedDark["--surface"]).toBe(THEME_COLORS.dark);
  });

  it("ไม่เหลือบล็อกมืดแบบเก่าที่ไม่สนใจตัวเลือก (เลือก “สว่าง” บนเครื่องโหมดมืดต้องสว่าง)", () => {
    expect(css).not.toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/);
  });
});
