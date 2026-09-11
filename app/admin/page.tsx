import { redirect } from "next/navigation";

import { AdminClient } from "@/components/admin-client";
import { getCurrentSafeUser } from "@/lib/auth";
import { hasRedisConfig } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理员 · Agnes AI 免费聊天" };

export default async function AdminPage() {
  if (!hasRedisConfig()) redirect("/");

  // ⚠️ 服务端权限校验：前端隐藏按钮不算权限控制
  const user = await getCurrentSafeUser();
  if (!user) redirect("/login?redirect=/admin");
  if (user.role !== "admin") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-5 text-center">
          <h1 className="text-lg font-semibold text-destructive">403 无访问权限</h1>
          <p className="mt-2 text-sm text-muted-foreground">该页面仅管理员可见。</p>
        </div>
      </main>
    );
  }

  return (
    <AdminClient
      me={{ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt }}
    />
  );
}
