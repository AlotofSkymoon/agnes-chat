import { getCurrentSafeUser } from "@/lib/auth";
import { hasRedisConfig } from "@/lib/redis";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 未配置 Redis 时也能聊天（只是不能注册/登录）
  const user = hasRedisConfig() ? await getCurrentSafeUser() : null;

  return (
    <ChatWorkspace
      user={user ? { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt } : null}
    />
  );
}
