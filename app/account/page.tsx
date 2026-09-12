import { redirect } from "next/navigation";

import { AccountClient } from "@/components/account-client";
import { getCurrentSafeUser } from "@/lib/auth";
import { hasRedisConfig } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const metadata = { title: "账户设置 · Agnes AI 免费聊天" };

export default async function AccountPage() {
  if (!hasRedisConfig()) redirect("/");
  const user = await getCurrentSafeUser();
  if (!user) {
    redirect("/login?redirect=/account");
  }
  const me = user as NonNullable<typeof user>;

  return <AccountClient user={{ id: me.id, email: me.email, role: me.role, createdAt: me.createdAt }} />;
}
