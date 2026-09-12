#!/usr/bin/env node
/**
 * 生成 D1 初始化令牌。
 *
 * 用法：
 *   node scripts/gen-d1-token.mjs <你的JWT_SECRET> [有效小时数]
 *
 * 例：
 *   node scripts/gen-d1-token.mjs my-long-random-secret 24
 *   → 输出一串 token，拼到域名后面访问：
 *     https://你的域名/api/d1/cshsjk/<token>
 *
 * 脚本只做本地计算，不会把密钥发给任何人。
 */

import { webcrypto } from "node:crypto";

// Workers 上有全局 crypto，Node 里要从内置模块取
const cryptoObj = globalThis.crypto ?? webcrypto;

const secret = process.argv[2];
const hours = Number(process.argv[3] ?? 24);

if (!secret) {
  console.error("用法: node scripts/gen-d1-token.mjs <JWT_SECRET> [有效小时数]");
  process.exit(1);
}
if (!Number.isFinite(hours) || hours <= 0) {
  console.error("有效小时数必须是正数");
  process.exit(1);
}

const encoder = new TextEncoder();

function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacKey(sec) {
  return cryptoObj.subtle.importKey(
    "raw",
    encoder.encode(sec),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

const header = { alg: "HS256", typ: "JWT" };
const now = Math.floor(Date.now() / 1000);
const body = {
  scope: "d1:init",
  iat: now,
  exp: now + Math.floor(hours * 3600),
};

const h = b64url(encoder.encode(JSON.stringify(header)));
const p = b64url(encoder.encode(JSON.stringify(body)));
const signingInput = `${h}.${p}`;

const sig = await cryptoObj.subtle.sign(
  "HMAC",
  await hmacKey(secret),
  encoder.encode(signingInput),
);

const token = `${signingInput}.${b64url(new Uint8Array(sig))}`;

console.log("\n令牌（有效期 %d 小时）:\n", hours);
console.log(token);
console.log("\n访问地址:\n");
console.log("https://<你的域名>/api/d1/cshsjk/" + token);
console.log("\n注意：令牌含签名信息，别随手发到公开场合。\n");
