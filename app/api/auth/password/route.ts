import { NextResponse } from "next/server";

import {
  createSession,
  destroySession,
  hashPassword,
  readSessionIdFromCookie,
  setSessionCookie,
  verifyPassword,
  type UserRecord,
} from "@/lib/auth";
import { getRedis, getValue, hasRedisConfig,
  storageErrorMessage, hgetAll, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/password  body: { currentPassword, newPassword } */
export async function POST(request: Request) {
  try {
    if (!hasRedisConfig()) {
      return NextResponse.json({ error: storageErrorMessage() }, { status: 500 });
    }

    const redis = getRedis();
    const sessionId = await readSessionIdFromCookie();
    if (!sessionId) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const userId = await getValue<string>(KEYS.session(sessionId));
    if (!userId) return NextResponse.json({ error: "登录已失效，请重新登录" }, { status: 401 });

    const user = await hgetAll<UserRecord>(KEYS.user(userId));
    if (!user?.passwordHash) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "请填写当前密码与新密码" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "新密码长度至少 8 位" }, { status: 400 });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });

    const passwordHash = await hashPassword(newPassword);
    await redis.hset(KEYS.user(userId), { passwordHash });

    // 改密后踢掉旧 session，重新签发，提升安全性
    await destroySession(sessionId);
    const { sessionId: newSessionId, maxAge } = await createSession(userId);
    await setSessionCookie(newSessionId, maxAge);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "修改密码失败，请稍后重试" }, { status: 500 });
  }
}
