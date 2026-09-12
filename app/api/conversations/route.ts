import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getRedis, getValue, hasRedisConfig,
  storageErrorMessage, KEYS, setMembers } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/conversations —— 列出当前用户云端会话（仅本人） */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!hasRedisConfig()) return NextResponse.json({ error: storageErrorMessage() }, { status: 500 });

  const redis = getRedis();
  const ids = await setMembers(KEYS.chatIndex(user.id));
  const items = await Promise.all(
    ids.map(async (id) => {
      const raw = await getValue<string>(KEYS.chat(user.id, id));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { updatedAt?: number; model?: string };
        return { conversationId: id, updatedAt: parsed.updatedAt ?? 0, model: parsed.model ?? "" };
      } catch {
        return null;
      }
    }),
  );

  return NextResponse.json({ conversations: items.filter(Boolean).sort((a, b) => b!.updatedAt - a!.updatedAt) });
}

/** DELETE /api/conversations —— 清空当前用户全部云端聊天记录 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!hasRedisConfig()) return NextResponse.json({ error: storageErrorMessage() }, { status: 500 });

  const redis = getRedis();
  const ids = await setMembers(KEYS.chatIndex(user.id));
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.del(KEYS.chat(user.id, id));
  pipeline.del(KEYS.chatIndex(user.id));
  await pipeline.exec();

  return NextResponse.json({ ok: true, deleted: ids.length });
}
