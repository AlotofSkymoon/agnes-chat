# Cloudflare Workers 部署教程

> **只填 GitHub Secrets，其余全自动。**
> 不需要在 Cloudflare 后台点来点去，不需要手抄任何 ID，
> 不需要访问建表地址，不需要装 Node/Wrangler。
>
> 全程 5 分钟，只需要 4 个 Secret。

---

## 为什么用 Actions 而不是界面部署

界面部署（Workers Builds）看起来不用配令牌，实际上**手动步骤更多**：

| 步骤 | Actions | 界面部署 |
|---|---|---|
| 建 KV / D1 / R2 | 脚本自动 | 手动点后台 |
| 抄 32 位 ID 填配置 | 不用 | 要抄 3 个 |
| 建 D1 表 | 自动 | 手动访问建表地址 + 生成 JWT |
| 配站点密钥 | 自动注入 | 手动在后台加，还要重新部署一次 |
| 自动更新 | 推代码即部署 | 也是 |

界面部署唯一的优势"不用 API 令牌"其实不成立 ——
令牌只在建资源时用一次，而那正是 Actions 擅长的事。

**结论：用 Actions。**

---

## 第 1 步：创建 API 令牌

1. 打开 <https://dash.cloudflare.com/profile/api-tokens>
2. **创建令牌** → 找 **「编辑 Cloudflare Workers」** → **使用模板**
3. 账户资源选「包括 → 你的账户」，区域资源选「包括 → 所有区域」
4. **继续到摘要** → **创建令牌** → 复制（只显示一次）

> 用官方模板就行，权限都已配好。手动勾选容易漏掉
> `User Details` 和 `Memberships` 这两个**用户层级**的权限
> （漏了会报 `Authentication error [code: 10000]`）。

## 第 2 步：拿账户 ID

<https://dash.cloudflare.com> 登录后，右侧栏能看到 **账户 ID**（32 位）。

## 第 3 步：填 4 个 Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Name | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 第 1 步的令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 第 2 步的账户 ID |
| `SESSION_SECRET` | `openssl rand -base64 32` 生成的随机串 |
| `PRESET_AGNES_API_KEY` | Agnes Key，可先用默认的 `sk-d5DyJCcfW9TmkeIHnfFPgHJ2ZjxfKHCx5ip3tR14abyrgZEi` |

**就这 4 个。KV / D1 / R2 的 ID 不用填 —— 脚本会自己找、自己创建。**

<details>
<summary>可选：想自定义更多（点开）</summary>

**Secrets**（敏感值）：

| Name | 说明 |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `..._TOKEN` | 多平台数据同步（填了就统一用 Upstash） |
| `SERPER_API_KEY` | 联网搜索（serper.dev 免费 2500 次，不用信用卡） |
| `JWT_SECRET` | D1 建表接口鉴权（不配则接口直接 500，更安全） |

**Variables**（非敏感，在 Variables 标签页）：

| Name | 默认 | 说明 |
|---|---|---|
| `R2_BUCKET_NAME` | `agnes-chat` | 换桶名 |
| `SITE_NAME` | `Agnes AI` | 站点名 |
| `NEXT_PUBLIC_REQUIRE_LOGIN` | `false` | 是否必须登录才能对话 |
| `NEXT_PUBLIC_ALLOW_WEB_SEARCH` | `true` | 是否开放联网按钮 |
| `STORAGE_BACKEND` | `auto` | `auto` / `cloudflare` / `upstash` / `unified` |
| `INJECT_SECRETS` | `true` | 设为 `false` 则自己到 Cloudflare 后台配密钥 |

</details>

## 第 4 步：推送，或手动触发

推到 `main` 自动部署；也可以 **Actions** → 选工作流 → **Run workflow**。

等 3～5 分钟，看到绿色 ✅ 就完成了。

---

## 部署时自动发生的事

```
校验配置 → 查找/创建 KV、D1、R2 → 把 ID 写回 wrangler.jsonc
        → 注入站点密钥 → 建 D1 表 → 构建 → 部署
```

| 环节 | 说明 |
|---|---|
| KV 命名空间 | 找同名 `agnes-chat`，没有就创建 |
| D1 数据库 | 找同名 `agnes-chat-db`，没有就创建 |
| R2 桶 | 找同名 `agnes-chat`，没有就创建 |
| **R2 不可用** | 自动移除 `r2_buckets`，部署继续（不因缺桶失败） |
| D1 建表 | 执行 `schema.sql`，幂等，5 张表 |
| 密钥注入 | 写进配置，所以**运行时真的读得到** |

最后一点是关键。**GitHub 仓库的 Secrets 只对 Actions 生效**，
部署完成后 Worker 读不到 —— 这就是过去"明明配了却说缺少 Key"的真正原因。
现在脚本在构建阶段把它们写进配置，绕开了这个坑。

想改回自己在后台配：设变量 `INJECT_SECRETS=false`。

---

## 上线自检

打开 `https://你的域名/api/health`（地址在部署日志里）：

```jsonc
{
  "ok": true,
  "platform": "cloudflare",
  "storage": { "backend": "cloudflare", "reachable": true },
  "problems": []
}
```

- `ok: true` → 注册第一个账号，**自动成为管理员**
- `problems` 有内容 → 按提示修

---

## 常见报错

### `Authentication error [code: 10000]`

令牌权限不足。用官方「编辑 Cloudflare Workers」模板重建一个，
重点确认有这两个**用户层级**权限：

- 用户 → **User Details** → 读取
- 用户 → **Memberships** → 读取

### 压缩后超过 1 MiB

免费版 Worker 脚本上限 1 MiB。Next.js 应用容易碰线，
需升级 Workers 付费版（$5/月，上限 10 MiB）。

### 未注册 workers.dev 子域名

Cloudflare 后台 → **Workers 和 Pages** → 设置子域名，随便起一个。

### 部署后注册/登录报错

看 `/api/health` 的 `storage.reachable`。
`false` 说明 D1 表没建成 —— 检查日志里建表那一步。

---

## R2 对象存储

**桶已自动创建并绑定，直接用就行，不用配置任何密钥。**

设置 → 对象存储 会显示「✓ 已通过 Worker 绑定直连 R2」。
桶是本站自己的，Worker 通过 binding 读写，**不需要 Access Key / Secret Key**。

需要自定义域名、或想改用别的 S3 服务，见 [R2 教程](./R2对象存储配置教程.md)。

---

## 想换其他平台

| 平台 | 存储 | 说明 |
|---|---|---|
| **Cloudflare Workers** | KV + D1 + R2 | 本教程，免费额度大 |
| Vercel | Upstash + B2 | 见 [Vercel 教程](./Vercel小白部署教程.md) |
| Netlify | Upstash + B2 | 拖 ZIP 即可 |

三者运行时代码相同，站点自动检测平台选后端。

**多平台同步**：给所有平台填同一个 Upstash，数据就互通了。
验证方式：各站访问 `/api/health`，比对 `storageFingerprint` 是否一致。
