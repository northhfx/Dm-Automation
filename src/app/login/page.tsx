import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold">DM Automation</h1>
        <p className="mt-1 mb-6 text-sm text-fg-2">เข้าสู่ระบบด้วยรหัสผ่านที่ตั้งไว้ใน ADMIN_PASSWORD</p>
        <LoginForm />
      </div>
    </main>
  );
}
