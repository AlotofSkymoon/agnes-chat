import { configValue } from "@/lib/runtime-config";

/**
 * 极简 JWT（HS256）实现。
 *
 * 为什么自己写而不装 jsonwebtoken：
 *   1) 项目要跑在 Cloudflare Workers 上，只能用 Web Crypto，
 *      而 jsonwebtoken 依赖 Node 的 crypto 模块，Workers 上没有；
 *   2) 这里只需要「签发 + 校验」两个能力，不值得为此引入依赖
 *      （还要处理 polyfill，之前踩过 bcryptjs 在 Workers 上烧 CPU 的坑）。
 *
 * 用途：给 /api/d1/cshsjk/<token> 这类一次性运维接口做访问控制，
 * 避免任何人访问 URL 就能建表 / 改数据。
 */

const encoder = new TextEncoder();

/** base64url 编码（JWT 要求去掉 = + / 这三个 URL 不友好字符） */
function b64url(bytes: Uint8Array): string {
  // 用索引循环而非 for...of：后者在低 target 下需要 downlevelIteration
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface JwtPayload {
  /** 用途标记，防止一个 token 在所有接口通用 */
  scope?: string;
  /** 过期时间（秒级时间戳） */
  exp?: number;
  [k: string]: unknown;
}

export class JwtError extends Error {}

/** 读取密钥；没配置就抛错，由调用方转成友好提示 */
function requireSecret(): string {
  const s = configValue("JWT_SECRET");
  if (!s) throw new JwtError("服务端未配置 JWT_SECRET，无法校验访问令牌");
  return s;
}

/**
 * 签发一个 JWT。
 * @param payload 自定义内容（会自动带上 exp）
 * @param ttlSeconds 有效期，默认 24 小时
 */
export async function signJwt(
  payload: JwtPayload,
  ttlSeconds = 24 * 60 * 60,
): Promise<string> {
  const secret = requireSecret();

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, exp: now + ttlSeconds };

  const h = b64url(encoder.encode(JSON.stringify(header)));
  const p = b64url(encoder.encode(JSON.stringify(body)));
  const signingInput = `${h}.${p}`;

  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(signingInput),
  );

  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

/**
 * 校验 JWT。
 * @param token 待校验的 token
 * @param scope 期望的用途标记；传了就要求 payload.scope 一致
 * @throws {JwtError} 任何不合法的情况
 */
export async function verifyJwt(token: string, scope?: string): Promise<JwtPayload> {
  const secret = requireSecret();

  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("令牌格式不对（应为三段式 JWT）");
  const [h, p, s] = parts;

  const signingInput = `${h}.${p}`;
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(s),
      encoder.encode(signingInput),
    );
  } catch {
    throw new JwtError("令牌签名无法校验");
  }
  if (!ok) throw new JwtError("令牌签名无效（JWT_SECRET 不匹配？）");

  let payload: JwtPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(p))) as JwtPayload;
  } catch {
    throw new JwtError("令牌内容无法解析");
  }

  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError("令牌已过期，请重新生成");
  }
  if (scope && payload.scope !== scope) {
    throw new JwtError(`令牌用途不匹配（期望 ${scope}）`);
  }

  return payload;
}

/** D1 运维接口专用的 scope */
export const SCOPE_D1_INIT = "d1:init";
