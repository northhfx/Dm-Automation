import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // เทสที่ใช้ฐานข้อมูลจริงต้องรันทีละไฟล์ ไม่ให้ข้อมูลชนกัน
    fileParallelism: false,
  },
});
