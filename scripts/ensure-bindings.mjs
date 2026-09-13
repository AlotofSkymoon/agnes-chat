#!/usr/bin/env node
/**
 * 自动准备 KV 与 D1 绑定 —— **不需要手填任何 ID**。
 *
 * 思路参考 cloud-mail 的部署流程：
 *   1. 环境变量里给了 ID → 直接用（尊重显式配置）
 *   2. 没给 → 列出现有命名空间/数据库，找同名的
 *   3. 同名也没有 → 创建
 *   4. 最后把 ID 写回 wrangler.jsonc
 *
 * 为什么不让用户手填 ID：那是 32 位十六进制串，复制错一位就
 * "部署成功但数据存不进去"，而且没有任何直观报错。
 * 有 API Token 的情况下这一步完全可以自动完成。
 *
 * 用法：需要 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = resolve(process.cwd(), "wrangler.jsonc");
const KV_NAME = process.env.KV_NAME?.trim() || "agnes-chat";
const D1_NAME = process.env.D1_NAME?.trim() || "agnes-chat-db";

const token = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();

async function api(pathname, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** 替换 jsonc 里某个字段的值（只动第一个匹配，保留注释） */
function setField(src, field, value) {
  const re = new RegExp(`("${field}"\\s*:\\s*")([^"]*)(")`);
  if (!re.test(src)) return src;
  return src.replace(re, `$1${value}$3`);
}

/** 找出形如 __XXX__ 的残留占位符 */
function placeholders(src) {
  return [...src.matchAll(/"(__[A-Z0-9_]+__)"/g)].map((m) => m[1]);
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.log("::warning::未找到 wrangler.jsonc，跳过绑定准备");
    return;
  }
  let src = readFileSync(CONFIG_PATH, "utf8");

  if (!token || !accountId) {
    console.log("::warning::缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID，跳过自动绑定");
    return;
  }

  /* ---------------- KV ---------------- */
  let kvId = (process.env.KV_NAMESPACE_ID ?? "").trim();
  if (!kvId) {
    const list = await api("/storage/kv/namespaces?per_page=100");
    const found = list.ok
      ? (list.body?.result ?? []).find((n) => n.title === KV_NAME)
      : null;
    if (found) {
      kvId = found.id;
      console.log(`✅ 复用已有 KV 命名空间：${KV_NAME}`);
    } else {
      const created = await api("/storage/kv/namespaces", {
        method: "POST",
        body: JSON.stringify({ title: KV_NAME }),
      });
      if (created.ok && created.body?.result?.id) {
        kvId = created.body.result.id;
        console.log(`✅ 已创建 KV 命名空间：${KV_NAME}`);
      } else {
        console.log(
          `::warning::KV 准备失败（HTTP ${created.status}）：` +
            (created.body?.errors?.[0]?.message ?? "未知错误"),
        );
      }
    }
  } else {
    console.log(`✅ 使用环境变量指定的 KV ID`);
  }
  if (kvId) src = setField(src, "id", kvId);

  /* ---------------- D1 ---------------- */
  let d1Id = (process.env.D1_DATABASE_ID ?? "").trim();
  if (!d1Id) {
    const list = await api("/d1/database?per_page=100");
    const found = list.ok
      ? (list.body?.result ?? []).find((d) => d.name === D1_NAME)
      : null;
    if (found) {
      d1Id = found.uuid;
      console.log(`✅ 复用已有 D1 数据库：${D1_NAME}`);
    } else {
      const created = await api("/d1/database", {
        method: "POST",
        body: JSON.stringify({ name: D1_NAME }),
      });
      if (created.ok && created.body?.result?.uuid) {
        d1Id = created.body.result.uuid;
        console.log(`✅ 已创建 D1 数据库：${D1_NAME}`);
      } else {
        console.log(
          `::warning::D1 准备失败（HTTP ${created.status}）：` +
            (created.body?.errors?.[0]?.message ?? "未知错误"),
        );
      }
    }
  } else {
    console.log(`✅ 使用环境变量指定的 D1 ID`);
  }
  if (d1Id) src = setField(src, "database_id", d1Id);

  writeFileSync(CONFIG_PATH, src);

  const left = placeholders(src);
  if (left.length) {
    console.log(`::warning::配置里仍有占位符未替换：${left.join(", ")}`);
  } else {
    console.log("✅ KV / D1 绑定已写入 wrangler.jsonc，无残留占位符");
  }
}

main().catch((err) => {
  console.log(`::warning::绑定准备异常（已忽略）：${err.message}`);
});
