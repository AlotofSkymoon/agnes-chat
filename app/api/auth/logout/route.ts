import { NextResponse } from "next/server";

import { clearSessionCookie, destroySession, readSessionIdFromCookie } from "@/lib/auth";
import { hasRedisConfig } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sessionId = await readSessionIdFromCookie();
    if (sessionId && hasRedisConfig()) {
      await destroySession(sessionId);
    }
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }
}
