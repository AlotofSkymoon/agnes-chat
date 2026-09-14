import { NextResponse } from "next/server";

import { JwtError, SCOPE_D1_INIT, verifyJwt } from "@/lib/jwt";
import { detectPlatform } from "@/lib/platform";
import { getCloudflareEnv } from "@/lib/storage";
import { D1_SCHEMA } from "@/lib/storage/cloudflare";
import { configValue } from "@/lib/runtime-config";
import { pickBinding } from "@/lib/storage/binding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/d1/cshsjk/<token> —— 用 JWT 令牌初始化 D1 表结构。
 *
 * 为什么需要它：
 *   走「界面部署（Workers Builds）」时没有 GitHub Actions 帮你跑
 *   `wrangler d1 execute`，也没法手抄 KV / D1 的 ID。
 *   部署完访问一次这个地址，表就建好了，之后注册登录才能用。
 *
 * 安全性：
 *   令牌是用服务端 JWT_SECRET 签的 HS256 JWT，且限定了 scope=d1:init，
 *   不知道密钥的人就算拿到 URL 也进不来。没配 JWT_SECRET 时直接 500 拒绝，
 *   避免"看起来能用其实谁都能访问"的假象。
 *
 * 幂等：全部语句都是 CREATE TABLE IF NOT EXISTS，重复访问无害。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // 1) 先验令牌，再干任何事
  try {
    await verifyJwt(token, SCOPE_D1_INIT);
  } catch (err) {
    const msg = err instanceof JwtError ? err.message : "令牌校验失败";
    const noSecret = configValue("JWT_SECRET") ? false : true;
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint: noSecret
          ? "请先在 Cloudflare Worker 的环境变量里设置 JWT_SECRET（加密类型），然后重新部署，再生成令牌。"
          : "令牌无效或已过期。请重新生成：node scripts/gen-d1-token.mjs <你的JWT_SECRET>",
      },
      { status: noSecret ? 500 : 401 },
    );
  }

  // 2) 必须跑在 Cloudflare 上才有 D1
  const platform = detectPlatform();
  const env = getCloudflareEnv();
  const db = pickBinding(
      env as unknown as Record<string, unknown> | null,
      "db",
    ) as unknown as
      | {
          prepare: (sql: string) => {
            bind: (...a: unknown[]) => {
              all: () => Promise<{ results?: unknown[] }>;
              run: () => Promise<unknown>;
            };
            run: () => Promise<unknown>;
          };
        }
      | undefined;

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        platform,
        error:
          platform === "cloudflare"
            ? "没找到 D1 绑定（binding 名应为 DB）。检查 wrangler.jsonc 的 d1_databases.database_id 是否填了真实 ID，不能留 __D1_ID__ 占位符。"
            : "当前不在 Cloudflare Workers 上运行，没有 D1 可用。此接口只用于 Workers 部署。",
      },
      { status: 500 },
    );
  }

  // 3) 逐条执行建表语句
  const statements = D1_SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors: string[] = [];
  for (const sql of statements) {
    try {
      await db.prepare(sql).run();
    } catch (err) {
      errors.push(`${sql.slice(0, 40)}… → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `D1 表结构已就绪（共 ${statements.length} 条语句）`,
    tables: ["users", "meta", "conversations", "messages", "site_settings"],
    next: "现在可以注册第一个账号了，它会自动成为管理员。",
  });
}
