#!/usr/bin/env node
/**
 * 部署前统一准备 —— **所有配置都从 GitHub Secrets / Variables 读**。
 *
 * 思路来自 cloud-mail：把变量写进 wrangler 配置，然后一条 wrangler deploy 搞定。
 * 用户只需要在 GitHub 仓库里填一次 Secrets，之后什么都不用管。
 *
 * 做四件事：
 *   1. 查找或创建 KV 命名空间、D1 数据库、R2 桶（不用手抄 32 位 ID）
 *   2. 把它们的 ID 写进 wrangler.jsonc
 *   3. 把站点密钥写进配置（这样运行时才读得到 —— 见下方说明）
 *   4. 打印一份脱敏摘要，方便核对
 *
 * ⚠️ 关于第 3 步，为什么密钥要写进配置文件：
 *   GitHub 仓库的 Secrets **只对 Actions 生效**，部署完成后 Worker 读不到。
 *   很多人因此困惑"明明配了却说缺少 PRESET_AGNES_API_KEY"。
 *   两种解法：wrangler secret put（运行时更安全，但 CI 里非交互较麻烦），
 *   或者像 cloud-mail 一样在构建时写进配置。这里采用后者 ——
 *   因为这些值本来就已经是仓库里的 Secret，构建产物不会提交回仓库。
 *   想要更安全可以设 INJECT_SECRETS=false，改自己在 Cloudflare 后台配。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Actions 专用配置。界面部署用 wrangler.dashboard.jsonc（不含 ID，
 * 绑定在 Cloudflare 后台点）—— 两份分开，互不干扰。
 */
const CONFIG_PATH = resolve(process.cwd(), process.env.WRANGLER_CONFIG ?? "wrangler.action.jsonc");

/** 桶/库/命名空间的名字，可用同名环境变量覆盖 */
const NAME = {
  kv: process.env.KV_NAME?.trim() || "agnes-chat",
  d1: process.env.D1_NAME?.trim() || "agnes-chat-db",
  r2: process.env.R2_BUCKET_NAME?.trim() || "agnes-chat",
};

const token = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();

/** 是否把密钥写进配置（默认 true，即"只填在 GitHub"） */
const injectSecrets = (process.env.INJECT_SECRETS ?? "true").trim().toLowerCase() !== "false";

/** 需要注入到运行时的密钥 */
const SECRET_VARS = [
  "SESSION_SECRET",
  "PRESET_AGNES_API_KEY",
  "JWT_SECRET",
  "STORAGE_BACKEND",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SITE_NAME",
  "NEXT_PUBLIC_SITE_NAME",
  "NEXT_PUBLIC_REQUIRE_LOGIN",
  "NEXT_PUBLIC_ALLOW_WEB_SEARCH",
  "SERPER_API_KEY",
  "TAVILY_API_KEY",
  "BRAVE_API_KEY",
  "BOCHA_API_KEY",
  "EXA_API_KEY",
  // R2 / Cloudflare 相关：GitHub 里填的变量必须注入，否则运行时读不到
  "R2_BUCKET_NAME",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  /**
   * 代理拦截相关。
   *
   * ⚠️ 为什么这几个必须注入：拦截逻辑跑在 middleware（Edge runtime），
   * 而 Edge bundle 里的 process.env 是**构建时**内联的 ——
   * 构建环境里没有这个变量，打包出来就是 undefined，
   * 之后即使在后台配了也读不到，功能静默失效（fail-open，站点不报错但也不拦）。
   *
   * 所以既要写进运行时配置，也要让它出现在构建环境里。
   */
  "IPIP_RISK_TOKEN",
  "IP_GUARD_ENABLED",
  "IP_GUARD_RISK_THRESHOLD",
  "IP_GUARD_BLOCK_BEHAVIORS",
  "IP_GUARD_ALLOWLIST",
];

async function api(pathname, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

const setField = (src, field, value) =>
  src.replace(new RegExp(`("${field}"\\s*:\\s*")([^"]*)(")`), `$1${value}$3`);

/** 往 vars 里加一个键（已存在则替换，没有 vars 块则创建） */
function setVar(src, key, value) {
  const esc = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  // 先看 top-level vars 里有没有
  const varsBlock = src.match(/"vars"\s*:\s*\{([\s\S]*?)\n  \}/);
  if (!varsBlock) {
    return src.replace(
      /(\{\n)/,
      `$1  "vars": {\n    "${key}": "${esc}"\n  },\n`,
    );
  }
  const inner = varsBlock[1];
  if (new RegExp(`"${key}"\\s*:`).test(inner)) {
    return src.replace(
      new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`),
      `$1${esc}$3`,
    );
  }
  const added = inner.replace(/\s*$/, `${inner.trim() ? "," : ""}\n    "${key}": "${esc}"\n  `);
  return src.replace(varsBlock[0], `"vars": {${added}}`);
}

const mask = (v) =>
  !v ? "(空)" : v.length <= 8 ? "*".repeat(v.length) : `${v.slice(0, 3)}***${v.slice(-3)}(${v.length}位)`;

async function ensureKv(src) {
  let id = (process.env.KV_NAMESPACE_ID ?? "").trim();
  const how = id ? "环境变量指定" : "";
  if (!id) {
    const list = await api("/storage/kv/namespaces?per_page=100");
    const hit = list.ok ? (list.body?.result ?? []).find((n) => n.title === NAME.kv) : null;
    if (hit) {
      id = hit.id;
      console.log(`✅ 复用 KV 命名空间：${NAME.kv}`);
    } else {
      const created = await api("/storage/kv/namespaces", {
        method: "POST",
        body: JSON.stringify({ title: NAME.kv }),
      });
      if (created.ok && created.body?.result?.id) {
        id = created.body.result.id;
        console.log(`✅ 已创建 KV 命名空间：${NAME.kv}`);
      } else {
        console.log(`::warning::KV 准备失败：${created.body?.errors?.[0]?.message ?? "未知"}`);
      }
    }
  }
  return { src: id ? setField(src, "id", id) : src, id, how: how || "自动" };
}

async function ensureD1(src) {
  let id = (process.env.D1_DATABASE_ID ?? "").trim();
  const how = id ? "环境变量指定" : "";
  if (!id) {
    const list = await api("/d1/database?per_page=100");
    const hit = list.ok ? (list.body?.result ?? []).find((d) => d.name === NAME.d1) : null;
    if (hit) {
      id = hit.uuid;
      console.log(`✅ 复用 D1 数据库：${NAME.d1}`);
    } else {
      const created = await api("/d1/database", {
        method: "POST",
        body: JSON.stringify({ name: NAME.d1 }),
      });
      if (created.ok && created.body?.result?.uuid) {
        id = created.body.result.uuid;
        console.log(`✅ 已创建 D1 数据库：${NAME.d1}`);
      } else {
        console.log(`::warning::D1 准备失败：${created.body?.errors?.[0]?.message ?? "未知"}`);
      }
    }
  }
  return { src: id ? setField(src, "database_id", id) : src, id, how: how || "自动" };
}

async function ensureR2(src) {
  const list = await api("/r2/buckets");
  const names = list.ok ? (list.body?.result?.buckets ?? []).map((b) => b.name) : [];
  let available = names.includes(NAME.r2);

  if (!available) {
    const created = await api("/r2/buckets", {
      method: "POST",
      body: JSON.stringify({ name: NAME.r2 }),
    });
    available = created.ok;
    if (available) console.log(`✅ 已创建 R2 桶：${NAME.r2}`);
    else console.log(`::warning::R2 桶不可用：${created.body?.errors?.[0]?.message ?? "未知"}`);
  } else {
    console.log(`✅ 复用 R2 桶：${NAME.r2}`);
  }

  /**
   * 桶不可用时必须把 r2_buckets 整段移除 ——
   * 否则 wrangler deploy 会报 "bucket not found"，整个部署挂掉。
   * 宁可没有对象存储，也不能让部署失败。
   */
  if (!available) {
    console.log("::warning::R2 不可用，已移除 r2_buckets 配置（部署继续，上传功能降级）");
    return src.replace(/"r2_buckets"\s*:\s*\[[\s\S]*?\]\s*,?/g, "");
  }

  /**
   * 写入「binding 已就绪」的显式声明。
   *
   * Workers 运行时里 binding 对象不一定探得到（OpenNext 不挂 globalThis），
   * 但明文变量一定能读到。这里由部署脚本盖章，运行时直接采信，
   * 避免设置面板误报"未找到 R2 绑定"。
   */
  src = setVar(src, "CF_R2_BOUND", "1");
  src = setVar(src, "R2_BUCKET_NAME", NAME.r2);

  // 桶名以配置为准，同步成环境变量里指定的名字
  return setField(src, "bucket_name", NAME.r2);
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.log(`::error::未找到 ${process.env.WRANGLER_CONFIG ?? "wrangler.action.jsonc"}`);
    process.exit(1);
  }
  let src = readFileSync(CONFIG_PATH, "utf8");

  if (!token || !accountId) {
    console.log("::error::缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID");
    process.exit(1);
  }

  const kv = await ensureKv(src);
  src = kv.src;
  const d1 = await ensureD1(src);
  src = d1.src;
  src = await ensureR2(src);

  /* ---- 注入运行时变量 ---- */
  if (injectSecrets) {
    for (const key of SECRET_VARS) {
      const val = (process.env[key] ?? "").trim();
      if (val) src = setVar(src, key, val);
    }
    // 平台声明：让运行时无需猜测自己跑在哪
    src = setVar(src, "CF_PLATFORM", "cloudflare");
    console.log("✅ 站点密钥已注入配置（运行时可读）");
  } else {
    console.log("::notice::INJECT_SECRETS=false，跳过密钥注入 —— 请自行在 Cloudflare 后台配置");
  }

  writeFileSync(CONFIG_PATH, src);

  /* ---- 摘要 ---- */
  console.log("\n================ 部署前摘要 ================");
  console.log(`KV   ${NAME.kv.padEnd(16)} ${kv.id || "(失败)"}  [${kv.how}]`);
  console.log(`D1   ${NAME.d1.padEnd(16)} ${d1.id || "(失败)"}  [${d1.how}]`);
  console.log(`R2   ${NAME.r2}`);
  console.log("密钥：");
  for (const k of ["SESSION_SECRET", "PRESET_AGNES_API_KEY", "JWT_SECRET"]) {
    console.log(`  ${k.padEnd(22)} ${mask((process.env[k] ?? "").trim())}`);
  }
  console.log("==========================================\n");

  const left = [...src.matchAll(/"(__[A-Z0-9_]+__)"/g)].map((m) => m[1]);
  if (left.length) console.log(`::warning::仍有占位符未替换：${left.join(", ")}`);
}

main().catch((err) => {
  console.log(`::error::准备失败：${err.message}`);
  process.exit(1);
});
