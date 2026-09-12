import "server-only";

import { detectPlatform } from "@/lib/platform";

/**
 * 密码哈希：双算法，按平台自动选择。
 *
 * - Node / Vercel         → bcryptjs（cost 10），业界标准
 * - Cloudflare Workers    → PBKDF2-SHA256（Web Crypto 原生）
 *
 * 为什么 Workers 上不用 bcryptjs：
 * bcryptjs 是纯 JS 实现，cost 10 需数百毫秒纯计算，会实打实消耗 Workers 的
 * CPU 配额且拖慢登录。Web Crypto 的 PBKDF2 是原生异步实现，快得多。
 *
 * 迁移兼容：验证时按 hash 前缀自动识别算法，
 * 因此 Vercel（bcrypt）迁到 Workers（PBKDF2）后，老用户密码依然能登录。
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 对 PBKDF2-HMAC-SHA256 的建议下限
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32;
const PBKDF2_PREFIX = "pbkdf2";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * 是否用 PBKDF2（按**运行时平台**判定，不按存储后端）。
 *
 * 注意：存储后端已统一为 Upstash（跨平台共用数据），
 * 但哈希算法仍要按运行环境选 —— Workers 上跑 bcryptjs 太耗 CPU 配额。
 * 两个算法写进同一个库，verifyPassword 会按 hash 前缀自动识别，
 * 所以同一份数据在 Vercel / Workers 上都能正常登录。
 */
function usePbkdf2(): boolean {
  return detectPlatform() === "cloudflare";
}

async function pbkdf2Hash(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_BYTES * 8,
  );
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt.buffer as ArrayBuffer)}$${toBase64(bits)}`;
}

async function pbkdf2Verify(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== PBKDF2_PREFIX) return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const salt = fromBase64(parts[2]);
  const expected = toBase64(fromBase64(parts[3]).buffer as ArrayBuffer);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_BYTES * 8,
  );

  // 定长比较，避免时序侧信道
  return timingSafeEqualString(toBase64(bits), expected);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 生成密码哈希 */
export async function hashPassword(password: string): Promise<string> {
  if (usePbkdf2()) return pbkdf2Hash(password);
  // 动态 import，避免 Workers 打包时把 bcryptjs 拉进来
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

/** 校验密码（自动识别 bcrypt / PBKDF2） */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith(`${PBKDF2_PREFIX}$`)) return pbkdf2Verify(password, hash);

  const bcrypt = (await import("bcryptjs")).default;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** 当前平台实际使用的算法名，便于排障 */
export function passwordAlgo(): "pbkdf2" | "bcrypt" {
  return usePbkdf2() ? "pbkdf2" : "bcrypt";
}
