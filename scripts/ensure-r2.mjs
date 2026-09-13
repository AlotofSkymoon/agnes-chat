#!/usr/bin/env node
/**
 * 确保 R2 桶存在，并自动把 binding 写进 wrangler.jsonc。
 *
 * 为什么要这个脚本：
 *
 * 1. `wrangler r2 bucket create` 在桶已存在时会报 code 10004 失败。
 *    原来的工作流用 `|| echo 跳过` 糊过去了，但**跳过之后没人保证 binding 还在**。
 *
 * 2. 更糟的是反过来的情况：桶真的不存在、又没权限创建时，
 *    wrangler.jsonc 里却留着 r2_buckets —— 那 `wrangler deploy` 会直接
 *    报 "bucket not found" 让**整个部署失败**。
 *
 * 所以正确逻辑是：
 *   桶存在   → 确保 binding 写进配置（这就是"跳过时自动 binding"）
 *   桶不存在 → 尝试创建；创建成功也写 binding
 *   彻底失败 → **从配置里移除 r2_buckets**，让部署能继续（降级为不启用对象存储）
 *
 * 用 Cloudflare REST API 而不是 wrangler 子命令，
 * 因为 API 能明确区分"已存在"和"无权限"，wrangler 只会笼统报错。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = resolve(process.cwd(), "wrangler.jsonc");
const DEFAULT_BUCKET = process.env.R2_BUCKET_NAME?.trim() || "agnes-chat";

/**
 * 变量名不统一是"识别不到"的高频原因 ——
 * 有人填 CF_API_TOKEN，有人填 R2_API_TOKEN，还有人只填了 CLOUDFLARE_TOKEN。
 * 这里按优先级依次尝试，并顺手去掉粘贴时混入的空白与引号
 * （尾部换行会让 Authorization 头变成 `Bearer xxx\n`，Cloudflare 直接 401）。
 */
const TOKEN_KEYS = ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN", "R2_API_TOKEN", "CLOUDFLARE_TOKEN", "CF_TOKEN"];
const ACCOUNT_KEYS = ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID", "R2_ACCOUNT_ID", "ACCOUNT_ID"];

function clean(v) {
  if (typeof v !== "string") return "";
  return v.trim().replace(/^["']+|["']+$/g, "").trim();
}
function pick(keys) {
  for (const k of keys) {
    const v = clean(process.env[k]);
    if (v) return { value: v, key: k };
  }
  return null;
}

const tokenSrc = pick(TOKEN_KEYS);
const accountSrc = pick(ACCOUNT_KEYS);
const token = tokenSrc?.value ?? "";
const accountId = accountSrc?.value ?? "";

if (token) {
  console.log(`::notice::已读取 API 令牌（${tokenSrc.key}，长度 ${token.length}）`);
  // Global API Key 是 37 位，不能单独用于 Bearer 鉴权 —— 提前点破，别让人对着 401 猜
  if (token.length === 37) {
    console.log(
      "::warning::令牌长度 37 位，疑似 Global API Key 而非 API Token（40 位）。" +
        "Global Key 不能单独用于 Bearer 鉴权，请改用 API 令牌。",
    );
  }
}

/** 去掉 jsonc 的注释，便于用 JSON.parse 读取（不引入额外依赖） */
function stripComments(src) {
  let out = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === "\n") { inLineComment = false; out += ch; }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i++; }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") { out += src[i + 1] ?? ""; i++; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
    out += ch;
  }
  return out;
}

/** 替换或插入 r2_buckets 段。保留原有注释块。 */
function applyBinding(src, bucketName) {
  const block = `"r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "${bucketName}"
    }
  ],`;

  // 已有该段 → 替换桶名
  // ⚠️ 尾逗号必须一起吃掉：原文本是 `],`，若只匹配到 `]` 再补 `],`
  //    会留下双逗号 `],,`，直接让 wrangler.jsonc 解析失败
  const existing = /"r2_buckets"\s*:\s*\[[\s\S]*?\]\s*,?/;
  if (existing.test(src)) {
    return src.replace(existing, block);
  }

  // 没有 → 插到 d1_databases 之后，或 kv_namespaces 之后
  const anchors = ['"d1_databases"', '"kv_namespaces"'];
  for (const anchor of anchors) {
    const idx = src.indexOf(anchor);
    if (idx === -1) continue;
    // 找到该段闭合的 ]
    const close = src.indexOf("]", src.indexOf("[", idx));
    if (close === -1) continue;

    // 该段原本可能带尾逗号 —— 先剥掉，插入时统一补，
    // 否则会出现 `],,` 双逗号导致配置解析失败
    let insertAt = close + 1;
    let tailComma = "";
    if (src[insertAt] === ",") {
      tailComma = ",";
      insertAt += 1;
    }

    // ⚠️ 逗号的位置很讲究：
    //   前一个属性（d1_databases）末尾必须有逗号，否则 R2 段接不上；
    //   而 R2 段自己的尾逗号要靠原 tailComma 补，不能自带（否则 `],,`）。
    //   所以 block 在这里用去掉尾逗号的版本。
    const blockNoComma = block.replace(/,$/, "");
    return (
      src.slice(0, close + 1) +
      "," +
      `\n\n  // R2 对象存储（由 scripts/ensure-r2.mjs 自动写入）\n  ${blockNoComma}` +
      tailComma +
      src.slice(insertAt)
    );
  }
  return src;
}

/** 移除 r2_buckets 段，避免部署时因桶不存在而整体失败 */
function removeBinding(src) {
  return src.replace(/"r2_buckets"\s*:\s*\[[\s\S]*?\],?\n?/, "");
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.log("::warning::未找到 wrangler.jsonc，跳过 R2 准备");
    return;
  }
  let src = readFileSync(CONFIG_PATH, "utf8");

  if (!token || !accountId) {
    console.log(
      `::warning::缺少 Cloudflare 凭证（已尝试 ${TOKEN_KEYS.join(" / ")} 与 ` +
        `${ACCOUNT_KEYS.join(" / ")}），跳过 R2 准备`);
    // 无法确认桶是否存在时，保守起见移除 binding —— 宁可没存储，也不能让部署失败
    writeFileSync(CONFIG_PATH, removeBinding(src));
    console.log("已移除 r2_buckets（无法确认桶是否存在，避免部署报 bucket not found）");
    return;
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;

  // 1) 列出现有桶，看目标在不在
  let exists = false;
  let available = [];
  try {
    const res = await fetch(base, { headers });
    if (res.ok) {
      const data = await res.json();
      const buckets = data?.result?.buckets ?? data?.result ?? [];
      available = buckets.map((b) => b.name).filter(Boolean);
      exists = available.includes(DEFAULT_BUCKET);
    } else {
      console.log(`::warning::列桶失败（HTTP ${res.status}），将尝试直接创建`);
    }
  } catch (err) {
    console.log(`::warning::列桶异常：${err.message}`);
  }

  // 2) 不存在就创建
  if (!exists) {
    try {
      const res = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: DEFAULT_BUCKET }),
      });
      if (res.ok) {
        exists = true;
        console.log(`✅ 已创建 R2 桶：${DEFAULT_BUCKET}`);
      } else {
        const body = await res.json().catch(() => ({}));
        const code = body?.errors?.[0]?.code;
        // 10004 = 桶已存在且属于本账户 —— 这其实是成功
        if (code === 10004) {
          exists = true;
          console.log(`✅ R2 桶已存在：${DEFAULT_BUCKET}`);
        } else {
          console.log(
            `::warning::创建 R2 桶失败（HTTP ${res.status}, code ${code ?? "?"}）：` +
              (body?.errors?.[0]?.message ?? "未知错误"),
          );
        }
      }
    } catch (err) {
      console.log(`::warning::创建 R2 桶异常：${err.message}`);
    }
  } else {
    console.log(`✅ R2 桶已存在：${DEFAULT_BUCKET}`);
  }

  // 3) 按结果决定 binding 的去留
  if (exists) {
    src = applyBinding(src, DEFAULT_BUCKET);
    writeFileSync(CONFIG_PATH, src);
    console.log(`✅ 已绑定 R2：binding "R2" → bucket "${DEFAULT_BUCKET}"`);
  } else {
    src = removeBinding(src);
    writeFileSync(CONFIG_PATH, src);
    console.log(
      `::warning::桶 ${DEFAULT_BUCKET} 不可用，已移除 r2_buckets。` +
        `账户下现有桶：${available.join(", ") || "（无）"}。` +
        `站点其余功能不受影响，对象存储暂不可用。`,
    );
  }

  // 4) 校验配置可解析
  try {
    JSON.parse(stripComments(readFileSync(CONFIG_PATH, "utf8")));
    console.log("✅ wrangler.jsonc 校验通过");
  } catch (err) {
    console.log(`::error::wrangler.jsonc 写入后无法解析：${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  // 任何意外都不应阻断部署
  console.log(`::warning::R2 准备脚本异常（已忽略）：${err.message}`);
});
