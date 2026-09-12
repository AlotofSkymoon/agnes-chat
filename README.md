# Agnes AI 免费聊天

极简、免费的 Agnes AI 网页聊天站。仅聊天，无 Agent 功能。

- **技术栈**：Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui + lucide-react
- **部署**：Cloudflare Workers（**推荐**）或 Vercel（不推荐）—— 代码自动识别平台
- **数据**：Cloudflare 部署用 **KV + D1**；Vercel 部署用 **Upstash Redis**
- **对象存储**：Cloudflare 用 **R2**；Vercel 用 **Backblaze B2**
- **权限**：第一个注册的用户自动成为管理员（`D1 meta` 表 / Redis `INCR` 原子判断）

---

## 🚀 部署方式（推荐 Cloudflare Workers）

### 为什么推荐 Workers、不推荐 Vercel

| | Cloudflare Workers | Vercel |
|---|---|---|
| 数据库 | KV + D1，**自带免费额度，不用额外注册** | 需另注册 Upstash Redis |
| 对象存储 | R2，**零出站流量费**（图片视频外链不花钱） | 只能 Backblaze B2，S3 兼容层不完整 |
| 费用 | 免费额度充裕 | 免费额度较紧，流量超额即计费 |
| 部署 | GitHub Actions 推送即部署 | 同样支持，但不推荐 |

> Vercel 仍能正常部署，只是要额外配 Redis，且对象存储只能用 B2。

---

### 方式一：Cloudflare Workers + GitHub Actions（推荐）

#### 1. 准备 Cloudflare 三件套

在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 创建：

```bash
# KV 命名空间（存 session、限流、缓存）
npx wrangler kv namespace create agnes-chat-kv

# D1 数据库（存用户）
npx wrangler d1 create agnes-chat-db

# R2 桶（存图片/视频，可选但推荐）
npx wrangler r2 bucket create agnes-chat
```

记下返回的 **KV Namespace ID** 和 **D1 Database ID**。

#### 2. 获取 API Token

Dashboard → 我的个人资料 → API 令牌 → 创建令牌 → 使用「编辑 Cloudflare Workers」模板。
需要有 **Workers / KV / D1 / R2 的编辑权限**。

同时记下 **账户 ID**（Dashboard 右侧栏）。

#### 3. 配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 第 2 步的 API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `KV_NAMESPACE_ID` | 第 1 步的 KV ID |
| `D1_DATABASE_ID` | 第 1 步的 D1 ID |
| `SESSION_SECRET` | `openssl rand -base64 32` 生成 |
| `PRESET_AGNES_API_KEY` | 站点内置 Key（见 `.env.example`） |
| `R2_ACCOUNT_ID` | R2 账户 ID（可选） |
| `R2_ACCESS_KEY_ID` | R2 令牌 Access Key（可选） |
| `R2_SECRET_ACCESS_KEY` | R2 令牌 Secret（可选） |
| `R2_BUCKET` | 桶名，如 `agnes-chat`（可选） |
| `R2_PUBLIC_BASE_URL` | 公开域名，如 `https://pub-xxx.r2.dev`（可选） |

#### 4. 启用自动部署（只需做一次）

工作流文件在仓库的 `workflows/deploy-cloudflare.yml`。
由于 GitHub 安全限制，它需要先放到 `.github/workflows/` 才会生效：

- **方法 A（网页端，推荐）**：仓库 → Add file → Create new file →
  路径填 `.github/workflows/deploy-cloudflare.yml` → 粘贴本文件内容 → Commit
- **方法 B（本地）**：

  ```bash
  mkdir -p .github/workflows
  cp workflows/deploy-cloudflare.yml .github/workflows/
  git add . && git commit -m "ci: enable cloudflare deploy" && git push
  ```

#### 5. 推送代码

放好工作流后，推到 `main` 分支即自动触发：

1. 把 KV / D1 ID 填进 `wrangler.jsonc` 占位符
2. 执行 `schema.sql` 建表（幂等）
3. 确保 R2 桶存在
4. OpenNext 构建 + `wrangler deploy`
6. 用 `wrangler secret put` 写入密钥（**不会进仓库**）

> ⚠️ 密钥一律走 `wrangler secret put`，**不要**写进 `wrangler.jsonc`——那个文件会提交到仓库。

#### 6. 首个用户

注册第一个账号 → 自动成为管理员 → 侧边栏盾牌图标进 `/admin`。

---

### 方式二：Vercel（不推荐，但仍可用）

1. [Upstash](https://console.upstash.com/redis) 创建 Redis，复制 **REST URL** 和 **REST TOKEN**
   （⚠️ 一定是带 `REST` 字样的两个值）
2. Vercel → Add New → Project → Import 本仓库（框架自动识别 Next.js）
3. 填环境变量：

| Key | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST TOKEN |
| `SESSION_SECRET` | 任意长随机串 |
| `PRESET_AGNES_API_KEY` | 站点内置 Key |
| `B2_REGION` / `B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY` / `B2_BUCKET` | 对象存储（可选） |

4. Deploy。Vercel 上**不要**填 `R2_*`（不会被读取）。

> 改了环境变量后必须 Redeploy 才生效。

---

## 本地运行

```bash
npm install
cp .env.example .env.local   # 本地可留空 Upstash，仍能聊天
npm run dev
```

打开 http://localhost:3000

未配置存储后端时也能直接聊天（用站点内置 Key），只是不能注册/登录。

**Workers 本地预览**：

```bash
npm run cf:build && npx wrangler dev
```

---

## 路由一览

| 路由 | 说明 |
|---|---|
| `/` | 聊天主界面（空状态海豚 + 流式对话） |
| `/login` | 登录 |
| `/register` | 注册（第一个用户 = admin） |
| `/account` | 改密码、登出、清空云端记录 |
| `/admin` | 管理员：用户列表、切角色、删用户、查看内置 Key |
| `/nav` | 导航站（20 个栏目 / 112 个免费资源） |
| `/api/chat` | 聊天代理（SSE 流式，避免 CORS） |
| `/api/auth/register` | 注册 |
| `/api/auth/login` | 登录（限流 1 分钟 10 次） |
| `/api/auth/logout` | 登出 |
| `/api/auth/password` | 改密码 |
| `/api/auth/me` | 当前用户 |
| `/api/admin/users` | 用户管理（服务端校验 admin） |
| `/api/admin/preset-key` | 内置 Key（仅 admin） |
| `/api/conversations` | 云端会话列表 / 清空 |
| `/api/upload/config` | 对象存储平台信息（脱敏） |
| `/api/upload/presign` | 预签名上传链接 |

---

## 存储层设计

业务代码统一走 `lib/storage` 抽象，**不关心底层是 Redis 还是 KV/D1**。

```
lib/storage/
├── types.ts        # Store 接口（Redis 风格子集）
├── index.ts        # 后端自动选择
├── cloudflare.ts   # KV + D1 实现
└── upstash.ts      # Upstash Redis 实现
```

选择逻辑：

1. 检测到 KV / D1 binding → **Cloudflare**（Workers 部署）
2. 否则有 Upstash 配置 → **Upstash**（Vercel / 本地）
3. 都没有 → 无存储（可聊天，不可注册登录）

### Cloudflare 数据结构

**D1 表**（见 `schema.sql`）：

| 表 | 用途 |
|---|---|
| `users` | 用户：`id, email, password_hash, role, created_at` |
| `meta` | 计数器：`users_count` 原子自增，判定首个用户 |

**KV**：`user:{id}`、`user:email:{email}`、`session:{sid}`、`chat:*`、限流键、导航数据、TLD 缓存。

### Vercel（Upstash Redis）数据结构

| Key | 说明 |
|---|---|
| `users:count` | 自增计数器 |
| `user:{userId}` | Hash：用户信息 |
| `user:email:{email}` | 邮箱 → userId |
| `session:{sessionId}` | sessionId → userId，TTL 7 天 |
| `chat:{userId}:{conversationId}` | 云端聊天记录 |
| `ratelimit:login:{ip}` | 登录限流 |

---

## 对象存储（图片 / 视频）

按平台锁定，避免选错：

- **Workers → Cloudflare R2**：零出站流量费、10GB 免费、S3 完全兼容
- **Vercel → Backblaze B2**：10GB 免费存储，但 S3 兼容层只覆盖部分操作

流程：浏览器请求 `/api/upload/presign` 拿预签名 PUT 链接（AWS SigV4，服务端签名），
然后**直传对象存储**——文件不经过站点服务器，绕开 Serverless 请求体上限。

服务端会强制校验 endpoint 域名与平台匹配，前端绕过也没用。

存储桶需要：① 允许**公开读**；② CORS 允许站点域名做 **PUT**。

---

## 安全说明

- **密码**：Node/Vercel 用 bcrypt（cost 10）；Workers 用 **PBKDF2-SHA256 210000 次**
  （Web Crypto 原生，比纯 JS bcrypt 快得多，不浪费 CPU 配额）。
  验证时按哈希前缀自动识别算法，**跨平台迁移后老密码仍能登录**。
- **Session**：32 字节随机数，Cookie `httpOnly + secure + sameSite=lax`，TTL 7 天。
- **管理员权限**：服务端 `requireAdmin()` 校验，前端隐藏按钮不算权限控制。
- **预设 API Key**：只在服务端环境变量，非管理员请求返回 403。
- **登录失败**统一提示「邮箱或密码错误」，不区分邮箱是否存在。
- **日志**不打印密码、sessionId、API Key。

---

## 字体

- **英文 / 数字**：Montserrat
- **中文**：昭源環方 Chiron GoRound TC（[OFL 授权](https://chiron-fonts.github.io/)）
- **代码**：SuperSFMonoV1（SF Mono + 苹方）

均按 `unicode-range` 分包，中文只下载需要的字形子集。

---

## 其他细节

- 离开页面时标签页标题变成「别走啊～～(´･Д･)」—— 由 `components/dynamic-title.tsx` 实现
- 侧边栏可收起，状态记在 localStorage
- 支持拖拽 / 粘贴上传文件，图片走 vision 模型识图
- 主题切换按钮为液态玻璃质感，常驻顶栏

---

## 不实现的功能

Agent、工具调用、联网搜索、代码执行、语音 —— 聊天之外不做多余的事。
需要 Agent 功能请去 **AgentScope** 添加 Agnes API Key。
