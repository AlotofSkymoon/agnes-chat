# AI 免費聊天站

> **中转 API 的官方演示站** —— 站长把自己的 Key 和 Base URL 配进环境变量，
> 访客打开就能直接聊，不用自己申请 Key。当然也可以自带 Key。

由 **wcvjk8tnz8** 创作 · 上游迁移自 `AlotofSkymoon/agnes-chat`（原 Agnes AI 免费聊天）

---

## 📌 这个项目是什么？

如果你在运营一个 **API 中转服务**（或者拿到某家的额度想给别人试用），
通常需要一个"演示站"：用户打开网页就能聊天，不用去申请 Key、不用填 Base URL。

**本项目就是这个演示站**，开箱即用：

| 角色 | 体验 |
|---|---|
| **访客** | 打开 → 直接聊，零配置 |
| **想用自己的额度** | 设置里填自己的 Key / Base URL（可关掉此权限） |
| **站长** | 环境变量配一次，全站生效，密钥不下发浏览器 |

默认品牌是 **Agnes AI**（`apihub.agnes-ai.com/v1`），
改环境变量就能换成任意 OpenAI 兼容服务 —— DeepSeek、Kimi、智谱、自建 One API / New API 都行。

**功能范围**：

- 纯文本聊天 + 图片/视频识别（需 vision 模型）
- **多对话管理**：可新建、切换、删除，也能**手动重命名**（双击侧边栏条目或点铅笔图标）
- **思考模式**：支持思考的模型会先输出推理过程，再给答案（可折叠）
- **联网搜索**：输入框「联网」开关，先搜再答并在回答下方列出来源
- **🖥️ 云电脑**：浏览器里跑的迷你桌面环境（终端 / 记事本 / 计算器 / 时钟 / 关于本机），
  窗口可拖动、最小化，数据全在本地，不联网不上传
- 用户系统（注册/登录/管理员面板）+ 导航站
- 文件上传（需先配置对象存储，见下）

不做 Agent、工具调用、代码执行。

---

## ⚖️ 许可与授权（部署前必读）

| | 说明 |
|---|---|
| **源代码** | MIT 许可，可自由阅读、学习、修改、提交 PR |
| **公开部署** | ⚠️ **需先取得作者 wcvjk8tnz8 书面许可** |
| **署名** | 公开副本必须保留创作者与上游来源标注 |

源码开源 ≠ 可以随便部署。原因很简单：站点内置的中转额度由站长买单，
无门槛克隆会导致额度盗刷和品牌冒用。完整条款见 [LICENSE](./LICENSE)。

**申请授权**：在仓库提 Issue，说明用途、域名、托管平台即可。
自用性质的小规模部署通常会获批。

---

## 🚀 部署（不会代码也能做）

存储与对象存储后端会**按部署平台自动识别**：
在 Cloudflare 上走 KV + D1 + R2，在 Vercel / Netlify 上走 Upstash + B2。

| | ⭐ Cloudflare Workers（推荐） | Netlify（拖 ZIP） | Vercel（不推荐） |
|---|---|---|---|
| 数据库 | KV + D1，**自带免费额度，不用额外注册** | 需另注册 Upstash Redis | 需另注册 Upstash Redis |
| 对象存储 | R2，**零出站流量费**（图片视频外链不花钱） | 只能 Backblaze B2 | 只能 Backblaze B2 |
| 上手难度 | 中（要配三件套） | **低**（拖文件夹即可） | 低 |
| 连 Git 仓库 | 需要 | 可选（拖 zip 则无需） | 需要 |
| 费用 | 免费额度充裕 | 免费额度够用 | 免费额度较紧 |

> 想最省事：**Netlify 拖 ZIP**。
> 想长期稳定、额度大：**Cloudflare Workers**。
> Vercel 也能跑，只是要额外配 Redis，且对象存储只能用 B2。

---

### 方式一：Cloudflare Workers + GitHub Actions（需 API 令牌）

> 不想配令牌？直接看[界面部署](https://github.com/AlotofSkymoon/agnes-chat/blob/main/Cloudflare部署教程.md#方式二cloudflare-界面部署workers-builds)，更省事。

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

需要的权限（手动创建时逐条勾）：

| 层级 | 权限项 | 级别 |
|---|---|---|
| 账户 | Workers 脚本 / Workers KV 存储 / D1 / Workers R2 存储 | 编辑 |
| 用户 | **User Details** | 读取 |
| 用户 | **Memberships** | 读取 |

> ⚠️ 后两个「用户」层级权限极易漏勾，漏了会报
> `Authentication error [code: 10000]`。可用 `npx wrangler whoami` 本地验证。

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

#### 4. 推送代码

工作流已经在 `.github/workflows/deploy-cloudflare.yml`，推到 `main` 即自动触发：

1. 校验必需 Secrets（缺哪个会直接告诉你，不用等构建完）
2. 把 KV / D1 ID 填进 `wrangler.jsonc` 占位符
3. 执行 `schema.sql` 建表（幂等，已存在不会重复建）
4. 确保 R2 桶存在（未开通则跳过，不影响其余功能）
5. OpenNext 构建 + `wrangler deploy`
6. 用 `wrangler secret put` 写入密钥（**不会进仓库**）

> ⚠️ 密钥一律走 `wrangler secret put`，**不要**写进 `wrangler.jsonc`——那个文件会提交到仓库。

#### 5. 首个用户

注册第一个账号 → 自动成为管理员 → 侧边栏盾牌图标进 `/admin`。

---

### 方式二：Cloudflare 界面部署（Workers Builds，⭐ 小白推荐）

**不用创建 API 令牌** —— Cloudflare 会自动为你的账户生成凭证，
绕开方式一里最容易踩的「令牌权限不足」坑。

1. 打开仓库的 `wrangler.jsonc`，把 `__KV_ID__` / `__D1_ID__`
   两个占位符替换成**真实 ID**（不是密钥，提交到仓库无妨）
2. 建一次 D1 表（只需一次）：
   `npx wrangler d1 execute agnes-chat-db --file=./schema.sql --remote`
3. Cloudflare 后台 → **Workers 和 Pages** → **创建** → **连接到 Git**
   → 选本仓库 → 构建命令填 **`npm run cf:build`** → 保存并部署
4. 部署完成后，Worker → **设置 → 变量和机密**，添加两个加密变量：
   - `PRESET_AGNES_API_KEY` = 站点内置 Key
   - `SESSION_SECRET` = `openssl rand -base64 32` 生成的随机串
5. **重新部署一次**让密钥生效

之后每次推 `main` 都会自动重新部署。

> ⚠️ 不要同时启用方式一的自动部署和方式二，否则一次推送会部署两遍。
> 详细图解见 [Cloudflare部署教程.md](./Cloudflare部署教程.md) 的「方式二」。

---

### 方式三：Vercel（不推荐，但仍可用）

1. [Upstash](https://console.upstash.com/redis) 创建 Redis —— **注册信息、登录态都存这里**，
   复制 **REST URL** 和 **REST TOKEN**（⚠️ 一定是带 `REST` 字样的两个值）
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

### 方式四：Netlify（拖 ZIP，最省事）

和 Vercel 一样走 Node.js 运行时 + Upstash Redis，但**不用连 Git 仓库**，
把源码拖上去就行。

1. 准备 Upstash Redis（同方式三第 1 步）
2. 在 GitHub 仓库页下载源码：`Code` → `Download ZIP`，解压得到文件夹
3. 打开 https://app.netlify.com/drop ，**把整个文件夹拖进去**
4. 部署完成后：Site configuration → **Environment variables**，填：

| Key | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST TOKEN |
| `SESSION_SECRET` | 任意长随机串 |
| `PRESET_AGNES_API_KEY` | 站点内置 Key |

5. **再触发一次部署**（改环境变量后必须重新构建才生效）：
   Deploys → `Trigger deploy` → `Deploy site`

> Netlify 上不填 `R2_*` / `CLOUDFLARE_*`，不会被读取。
> 需要对象存储就用 `B2_*` 那组（Backblaze B2）。
>
> 首次部署可能会失败一次并显示「No Cache Detected」——
> 那是 Next.js 提示没配构建缓存，不影响成败，忽略即可。

> ⚠️ 拖拽部署不会随仓库更新自动同步。
> 想持续更新，改成在 Netlify 里 `Import from Git` 连仓库即可。

---

## 🎨 换成你自己的品牌（中转站必看）

默认整套品牌是 **Agnes AI**。想挂上你自己的中转服务，改环境变量即可，**不用动代码**。

### 基础品牌

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SITE_NAME` | `Agnes AI` | 站点名，出现在标题栏、侧边栏、页脚 |
| `NEXT_PUBLIC_SITE_TAGLINE` | `免费聊天` | 副标题，跟在站点名后面 |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 自动拼接 | SEO 描述 |
| `NEXT_PUBLIC_THEME` | `fuwari` | 配色：`fuwari`（清透蓝）/ `violet-rose`（紫玫瑰） |
| `NEXT_PUBLIC_AUTHOR_NAME` | `wcvjk8tnz8` | 页脚创作者署名 |
| `NEXT_PUBLIC_REPO_URL` | 本仓库 | 页脚源码链接 |
| `NEXT_PUBLIC_UPSTREAM_URL` | 上游仓库 | 页脚上游标注 |

> 两套配色访客都能在「设置 → 配色主题」里随时切换，
> `NEXT_PUBLIC_THEME` 只决定**首次打开**用哪套。

### 换成别的中转服务

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PRESET_AGNES_API_KEY` | Agnes 内置 Key | 站长提供的 Key，访客不填时用这个 |
| `UPSTREAM_BASE_URL` | `https://apihub.agnes-ai.com/v1` | 中转地址 |
| `UPSTREAM_MODEL` | `agnes-3.0-flash` | 默认模型 |
| `NEXT_PUBLIC_ALLOW_CUSTOM_KEY` | `true` | 设 `false` 锁死：访客只能用站长的 Key |
| `NEXT_PUBLIC_REQUIRE_LOGIN` | `false` | 设 `true` 则必须登录才能对话 |
| `NEXT_PUBLIC_ALLOW_WEB_SEARCH` | `true` | 设 `false` 关闭联网搜索功能 |
| `JWT_SECRET` | 无 | D1 初始化接口的签名密钥，界面部署时用它生成建表令牌 |
| `CLOUDFLARE_API_TOKEN` | 无 | 选填，配了就能自动寻找 R2 桶（`agnes-chat` / `agnes-chat-r2`） |
| `NEXT_PUBLIC_ALLOW_CUSTOM_BASE_URL` | `true` | 设 `false` 锁死 Base URL |

> 💡 只要服务兼容 OpenAI 的 `/chat/completions` 就能直接套用。
> One API / New API / VoAPI 这类自建聚合站同样支持。

### 演示站的两种玩法

**A. 站长全包（推荐）**
配好 `PRESET_AGNES_API_KEY` + `UPSTREAM_BASE_URL`，再把
`NEXT_PUBLIC_ALLOW_CUSTOM_KEY` 设成 `false`。
访客打开就能聊，看不到也改不了任何 Key 配置。

**B. 自带 Key（开放）**
用默认值即可。访客可以在设置里填自己的 Key 和 Base URL，
不填就用站长内置的。适合小圈子共享。

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

**登录信息全部存在 Upstash Redis 里**，站点自身不保存任何账号数据到文件或数据库。

| Key | 类型 | 说明 |
|---|---|---|
| `users:count` | String | 自增计数器，判断是否第一位用户（决定管理员） |
| `user:{userId}` | Hash | 账号主体：`id, email, passwordHash, role, createdAt` |
| `user:email:{email}` | String | 邮箱 → userId，登录时反查 |
| `session:{sessionId}` | String | **登录态**：sessionId → userId，TTL 7 天 |
| `user:sessions:{userId}` | Set | 该用户所有 session，便于整体踢下线 |
| `chat:{userId}:{conversationId}` | String | 云端聊天记录（需用户开启开关） |
| `chat:index:{userId}` | Set | 会话索引 |
| `ratelimit:login:{ip}` | String | 登录限流，1 分钟 10 次 |
| `ratelimit:upload:{ip}` | String | 上传限流 |

**一次登录发生了什么：**

```
1. POST /api/auth/login
2. 用 user:email:{email} 反查 userId
3. 取 user:{userId} 的 passwordHash，bcrypt.compare 校验
4. 生成 32 字节随机 sessionId
5. SET session:{sessionId} = userId，EX 604800（7 天）
6. SADD user:sessions:{userId} sessionId
7. 通过 httpOnly Cookie 把 sessionId 下发给浏览器
```

浏览器只拿到一个**无意义的随机串**，拿不到 userId、更拿不到密码哈希。
后续每个请求用 `getCurrentUser()` 读 Cookie → 查 `session:{sessionId}` → 查 `user:{userId}`。

> ⚠️ **Upstash token 绝不下发浏览器**，所有读写都在服务端 API Route 内完成。
> 免费版额度为每天 1 万条命令，个人站足够；超出需升级。

### 登录信息存放在哪（按平台）

| 部署平台 | 账号数据 | 登录态（session） |
|---|---|---|
| **Vercel** | Upstash Redis `user:{id}` | Upstash Redis `session:{sid}` |
| **Cloudflare Workers** | D1 `users` 表 | KV `session:{sid}` |
| 本地（未配置） | 无 | 无 —— 只能聊天，不能注册登录 |

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
- **Session**：32 字节随机数，只存服务端（Vercel 在 Upstash Redis、Workers 在 KV），
  Cookie `httpOnly + secure + sameSite=lax`，TTL 7 天。浏览器拿到的只是随机串。
- **登录信息去向**：邮箱 + bcrypt/PBKDF2 哈希 + 角色写在服务端存储里，
  **从不写入日志、不落盘到站点服务器、不下发给任何前端**。
  普通用户请求 `/api/admin/*` 一律 403。
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

## 🩺 部署自检：/api/health

部署完访问 `https://你的域名/api/health`，会返回一份**不含任何密钥**的诊断：

```jsonc
{
  "ok": true,
  "platform": "cloudflare",        // 或 vercel / local
  "storage": {
    "backend": "cloudflare",       // cloudflare(KV+D1) | upstash | none
    "reachable": true              // 是否真的读写成功，不只是"配置了"
  },
  "objectStorage": { "kind": "r2", "siteManaged": true },
  "problems": []                   // 有内容就按提示逐条修
}
```

常见报错对照：

| `problems` 内容 | 原因 | 怎么办 |
|---|---|---|
| 未检测到 KV / D1 binding | `wrangler.jsonc` 的 ID 没填对，或 Actions 的 `KV_NAMESPACE_ID` / `D1_DATABASE_ID` 写错 | 核对 Actions Secrets；本地 `npx wrangler kv namespace list` 复查 |
| 存储读写失败 | D1 表没建 | `npx wrangler d1 execute agnes-chat-db --file=./schema.sql --remote` |
| 未设置 PRESET_AGNES_API_KEY | 密钥没写进 Workers | `npx wrangler secret put PRESET_AGNES_API_KEY` |
| backend 是 upstash | 部署到了 Vercel 却填了 Redis | 正常，符合预期 |

> 注册第一个账号前先打一发这个接口，能省掉大半排查时间。

---

## 🔐 依赖安全说明（构建日志里的警告要不要管）

`npm install` 时你可能会看到几条黄字，逐个说明：

| 警告 | 严重吗 | 处理 |
|---|---|---|
| `@opennextjs/cloudflare@0.4.8: CVE-2025-6087 was fixed in 1.3.0` | ⚠️ 真实漏洞，但**本站不受影响** | 见下方详解 |
| `deprecated crypto-js / glob / uuid / rollup-plugin-inject` | 无害 | 是依赖的依赖废弃提示，不影响运行 |
| `allow-scripts: esbuild / sharp / workerd` | 无害 | 已加 `trustedDependencies` 声明 |

### 关于 CVE-2025-6087

这是一个 SSRF 漏洞（CVSS 7.8）：Cloudflare 适配器的 `/_next/image` 端点
可被用来代理任意远程地址，攻击者能借你的域名托管钓鱼内容。

**为什么本站不受影响：**

1. 漏洞只存在于 **Cloudflare 适配器**，Vercel 部署完全不涉及（**Cloudflare 平台侧也已自动缓解**：限制该端点只返回图片）
2. 本站**根本没有用 `next/image`**，也不加载任何外部图片（图标全是内联 SVG）
3. 已在 `next.config.mjs` 设置 `images.remotePatterns: []` + `unoptimized: true`，
   即官方推荐的白名单缓解方案

**为什么没升级到 1.3.0：**

修复版 1.3.0 起强制要求 `next >= 15.5` 与 `wrangler ^4`，
本项目停在 **Next 14.2.35**，升级会连带破坏大量代码
（Next 15 把 `cookies()` / `headers()` 改成异步 API）。
权衡之下，用配置缓解比强行升 Next 更稳妥。

> 若你之后决定迁移到 Next 15，届时应同步把
> `@opennextjs/cloudflare` 升到 `^1.3.0`、`wrangler` 升到 `^4`。

---

## 不实现的功能

Agent、工具调用、代码执行、语音 —— 聊天之外不做多余的事。
需要 Agent 功能请去 **AgentScope** 添加 Agnes API Key。

> 联网搜索是唯一例外：它只是"检索结果拼进上下文"，
> 不涉及工具调用循环，所以做进来了。

---

## 🔍 联网搜索实现说明

| 项 | 说明 |
|---|---|
| 搜索源 | **Bing RSS**（主）→ DuckDuckGo（备） |
| 需要 API Key 吗 | 不需要 |
| 结果条数 | 默认 5，最多 8 |

> ⚠️ 早期版本用 DuckDuckGo 的 HTML 端点，现在它**稳定返回 403**（反爬），
> 所以改用 Bing 的官方 RSS 输出：标准 XML、解析可靠、无需 Key。
> DuckDuckGo 保留为备用源，主源失败时自动切换。

回答下方会列出来源链接，可点击跳转。

---

## 🖼️ 图片上传与"AI 看不到"的自救

正常情况下图片会上传到对象存储，以链接形式发给模型。

但有个隐蔽的坑：**上传返回 200 不代表 AI 看得到** ——
如果存储桶没开公开读、或自定义域名没生效，那个链接是外部访问不了的，
模型在服务端拉不到图，表现为"明明配了存储，AI 还是看不见"。

所以上传后会**主动探测链接可达性**：

```
上传 → 探测 URL 能否加载
     ├─ 能   → 用链接（省体积）
     └─ 不能 → 自动转 base64 内嵌，并提示检查公开读设置
```

内嵌是一定能被模型读到的（OpenAI 的 `image_url` 原生接受 data URL，
这就是所谓的"自动解码"，不需要额外处理）。代价是请求体变大，
所以只在不超体积红线时才回退。
