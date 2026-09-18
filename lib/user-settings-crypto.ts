import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { configValue } from "@/lib/runtime-config";

/**
 * 用户设置的加解密。
 *
 * ⚠️ 为什么必须加密：
 * 用户填的是自己的 API Key（OpenAI / DeepSeek / 自建中转），
 * 一旦明文写进 Redis，任何能看到数据库的人都能拿去刷额度。
 * 之前这些 Key 只存在浏览器 localStorage，所以没有这个问题 ——
 * 现在要跨平台同步，就必须先解决存储安全。
 *
 * 加密方案：AES-256-GCM，密钥由服务端密钥派生。
 *
 * 密钥来源按优先级：
 *   USER_SETTINGS_SECRET（专用）> SESSION_SECRET > JWT_SECRET
 * 都没有就用内置的兜底串 —— 此时仍会加密（不是明文），
 * 但安全性依赖部署密钥，属于"有总比没有强"。
 *
 * ⚠️ 这不是绝对安全：服务端密钥泄露，密文仍可被解出。
 * 真正零知识需要用户口令 + 客户端加密，代价是无法跨设备免密恢复。
 * 这里取的是"跨设备同步"和"存储侧不明文"的平衡点。
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function secretSource(): string {
  return (
    configValue("USER_SETTINGS_SECRET") ||
    configValue("SESSION_SECRET") ||
    configValue("JWT_SECRET") ||
    "agnes-chat-user-settings-fallback"
  );
}

/** 派生 32 字节密钥。scrypt 带盐，盐写死即可（目的是派生而非抗彩虹表） */
function deriveKey(): Buffer {
  return scryptSync(secretSource(), "agnes-user-settings-v1", 32);
}

/** 密文前缀，用来区分加密数据和历史明文 */
const PREFIX = "enc1:";

export function encryptSettings(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * 解密。
 *
 * 兼容两种输入：
 * - 带 enc1: 前缀的密文（正常路径）
 * - 明文 JSON（历史数据，或换了服务端密钥解不开时的兜底）
 *
 * 解不开时返回 null，让调用方当作"没有云端设置"，
 * 而不是抛错把整个页面搞崩。
 */
export function decryptSettings(stored: string): string | null {
  if (!stored) return null;

  if (!stored.startsWith(PREFIX)) {
    // 历史明文数据：直接返回，下次保存会被加密覆盖
    return stored;
  }

  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    if (raw.length <= IV_LEN + TAG_LEN) return null;
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = raw.subarray(IV_LEN + TAG_LEN);

    const decipher = createDecipheriv(ALGO, deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // 密钥换了 / 数据损坏 —— 当作没有，不要抛错
    return null;
  }
}
