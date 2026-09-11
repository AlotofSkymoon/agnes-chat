# Agnes AI 免费聊天

极简、免费的 Agnes AI 网页聊天站。**仅聊天，无 Agent 功能。**

- 技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui + lucide-react
- 用户系统：Upstash Redis + bcrypt 哈希 + httpOnly Cookie Session
- 第一个注册的用户自动成为管理员（`INCR users:count` 原子判断）
- 站点内置 Agnes API Key 只存在服务端，**只有管理员能在 `/admin` 查看完整值**

---

## 一、本地运行

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量模板并填写
cp .env.example .env.local

# 3. 启动
npm run dev
```

打开 http://localhost:3000

> 没有配置 Upstash Redis 也能直接聊天（只是不能注册/登录），此时使用站点内置 Key。

---

## 二、Upstash Redis 创建步骤

1. 打开 https://console.upstash.com/ ，注册 / 登录（可用 GitHub 登录）。
2. 点击右上角 **Create Database**。
3. 配置：
   - **Name**：任意，如 `agnes-ai-chat`
   - **Type**：`Regional`
   - **Region**：选离你用户最近的，推荐 `ap-southeast-1`（新加坡）或 `us-east-1`
   - **Eviction**：保持默认
   - 免费额度足够个人公益项目使用（10 万次命令/天）
4. 创建完成后进入数据库详情页，找到 **REST API** 区域。
5. 复制两个值，稍后填到 Vercel：
   - `UPSTASH_REDIS_REST_URL`（形如 `https://xxxx.upstash.io`）
   - `UPSTASH_REDIS_REST_TOKEN`

⚠️ 注意复制的是 **REST** 的 URL / TOKEN，不是 `UPSTASH_REDIS_URL`（那个是 TCP 连接用的）。

---

## 三、Vercel 环境变量配置步骤

1. 把代码推到 GitHub（或在 Vercel 直接导入本目录）。
2. 打开 https://vercel.com/new ，导入仓库。
3. **Framework Preset** 会自动识别为 `Next.js`，无需改动，**不要**填 Build Command。
4. 展开 **Environment Variables**，逐个添加：

| Key | 值 | 说明 |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | `https://xxxx.upstash.io` | Upstash 控制台 REST API 区域 |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxxASQ...` | Upstash REST TOKEN |
| `SESSION_SECRET` | 任意长随机串 | `openssl rand -base64 32` 生成 |
| `PRESET_AGNES_API_KEY` | `sk-...` | 站点内置 Key，只存在服务端 |

5. 三个环境（Production / Preview / Development）都勾上，点 **Add**。
6. 点 **Deploy**。

> 改了环境变量后需要 **Redeploy** 才生效。

---

## 四、Vercel 部署说明

- 构建命令：`next build`（自动），输出目录 `.next`（自动）。
- 聊天接口 `/api/chat` 是 **Edge 无关的 Node.js Runtime**，SSE 流式在 Vercel 上正常透传（已加 `X-Accel-Buffering: no`）。
- **Serverless 函数默认最长执行时间**：Hobby 计划 10s / Pro 60s。本项目是流式输出，每个 chunk 都会刷新，不会被单次超时卡死；超长回答受上游限制。
- 所有 Redis 操作都在服务端 API Route 内完成，浏览器永远拿不到 TOKEN。
- 建议部署后在 `/register` 第一个注册的账号即管理员，之后可在 `/admin` 管理用户、查看内置 Key。

---

## 五、路由一览

| 路由 | 说明 |
| --- | --- |
| `/` | 聊天主界面（空状态 + 流式对话） |
| `/login` | 登录 |
| `/register` | 注册（第一个用户 = admin） |
| `/account` | 改密码、登出、清空云端记录、云端保存开关 |
| `/admin` | 管理员：用户列表、切换角色、删除用户、查看内置 Key |
| `/api/chat` | 聊天代理（SSE 流式，避免 CORS） |
| `/api/auth/register` | 注册 |
| `/api/auth/login` | 登录（限流 1 分钟 10 次） |
| `/api/auth/logout` | 登出 |
| `/api/auth/password` | 修改密码 |
| `/api/auth/me` | 当前用户 |
| `/api/admin/users` | 用户管理（服务端校验 admin） |
| `/api/admin/preset-key` | 内置 Key（仅 admin） |
| `/api/conversations` | 云端会话列表 / 清空 |

---

## 六、Redis 数据结构

| Key | 类型 | 说明 |
| --- | --- | --- |
| `users:count` | String | 自增计数器，用于判断是否第一位用户 |
| `user:{userId}` | Hash | `{ id, email, passwordHash, role, createdAt }` |
| `user:email:{email}` | String | 邮箱 → userId |
| `session:{sessionId}` | String | sessionId → userId，TTL 7 天 |
| `user:sessions:{userId}` | Set | 该用户所有 session，便于踢下线 |
| `chat:{userId}:{conversationId}` | String | 云端聊天记录（需用户开启开关） |
| `chat:index:{userId}` | Set | 会话索引 |
| `ratelimit:login:{ip}` | String | 登录限流，1 分钟 10 次 |

---

## 七、安全说明

- 密码：bcrypt hash（cost 10），绝不明文存储。
- Session：32 字节随机数，Cookie `httpOnly + secure + sameSite=lax`，TTL 7 天。
- 管理员权限：**服务端校验**（`requireAdmin()`），前端隐藏按钮不算权限控制。
- 预设 API Key：只在服务端环境变量，非管理员请求 `/api/admin/preset-key` 返回 403。
- 登录失败统一提示「邮箱或密码错误」，不区分邮箱是否存在。
- 日志中不打印密码、sessionId、API Key。

---

## 八、不实现的功能

Agent、工具调用、联网搜索、代码执行、文件上传、语音、多模态 —— 只做纯文本聊天。
需要 Agent 功能请去 **AgentScope** 添加 Agnes API Key。
