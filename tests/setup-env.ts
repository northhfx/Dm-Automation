// ค่าตั้งต้นสำหรับเทส (ไม่ใช่ค่าจริง) — ฐานข้อมูลเทสกำหนดได้ผ่าน TEST_DATABASE_URL
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://dm:dm@localhost:5432/dm_automation_test";
process.env.META_APP_ID = "test-app-id";
process.env.META_APP_SECRET = "test-app-secret";
process.env.META_VERIFY_TOKEN = "test-verify-token";
process.env.ADMIN_PASSWORD = "test-password";
process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-chars";
process.env.PUBLIC_BASE_URL = "https://dm.example.com";
process.env.GRAPH_API_VERSION = "v23.0";
