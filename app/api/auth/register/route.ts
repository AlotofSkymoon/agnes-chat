import { NextResponse } from "next/server";

import {
  createSession,
  createUserId,
  hashPassword,
  isValidEmail,
  setSessionCookie,
  toSafeUser,
} from "@/lib/auth";
import { getRedis, getValue, hasRedisConfig,
  storageErrorMessage, KEYS } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!hasRedisConfig()) {
      return NextResponse.json(
        { error: storageErrorMessage() },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "密码长度至少 8 位" }, { status: 400 });
    }

    const redis = getRedis();

    // 1) 邮箱唯一性检查
    const existingId = await getValue<string>(KEYS.userEmail(email));
    if (existingId) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    // 2) 原子自增：返回 1 说明是第一位用户 → admin
    //    ⚠️ 必须先 INCR 再判断，不能「先查数量再写」，否则并发下会出现两个管理员
    const seq = await redis.incr(KEYS.usersCount);
    const role = seq === 1 ? "admin" : "user";

    const id = createUserId();
    const passwordHash = await hashPassword(password);
    const createdAt = new Date().toISOString();

    // 3) 写入用户数据（email 反查 + 用户 hash 一起提交）
    const pipeline = redis.pipeline();
    pipeline.hset(KEYS.user(id), {
      id,
      email,
      passwordHash,
      role,
      createdAt,
    });
    pipeline.set(KEYS.userEmail(email), id);
    await pipeline.exec();

    // 4) 创建 session + cookie
    const { sessionId, maxAge } = await createSession(id);
    await setSessionCookie(sessionId, maxAge);

    return NextResponse.json({
      user: toSafeUser({ id, email, passwordHash, role: role as "admin" | "user", createdAt }),
      isFirstUser: seq === 1,
    });
  } catch (error) {
    console.error("[register] 注册失败");
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
