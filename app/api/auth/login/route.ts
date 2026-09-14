import { NextResponse } from "next/server";

import {
  checkLoginRateLimit,
  createSession,
  getClientIp,
  isValidEmail,
  setSessionCookie,
  toSafeUser,
  verifyPassword,
  type UserRecord,
} from "@/lib/auth";
import { getRedis, getValue, hasRedisConfig,
  storageErrorMessage, hgetAll, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_ERROR = "邮箱或密码错误";

export async function POST(request: Request) {
  try {
    if (!hasRedisConfig()) {
      return NextResponse.json(
        { error: storageErrorMessage() },
        { status: 500 },
      );
    }

    // 简单限流：同一 IP 1 分钟最多 10 次
    const ip = getClientIp(request.headers);
    const allowed = await checkLoginRateLimit(ip, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "尝试过于频繁，请 1 分钟后再试" }, { status: 429 });
    }

    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!isValidEmail(email) || !password) {
      // 不区分“邮箱不存在”和“密码错误”，统一模糊提示
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const redis = getRedis();

    const userId = await getValue<string>(KEYS.userEmail(email));
    if (!userId) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const user = await hgetAll<UserRecord>(KEYS.user(userId));
    if (!user?.passwordHash) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const { sessionId, maxAge } = await createSession(user.id);
    await setSessionCookie(sessionId, maxAge);

    return NextResponse.json({ user: toSafeUser(user) });
  } catch (error) {
    console.error("[login] 登录失败");
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
