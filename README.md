# Agnes AI 免费聊天

极简、免费的 Agnes AI 网页聊天站。**仅聊天，无 Agent 功能。**

- 技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui + lucide-react
- 用户系统：Upstash Redis + bcrypt 哈希 + httpOnly Cookie Session
- 第一个注册的用户自动成为管理员（`INCR users:count` 原子判断）
- 站点内置 Agnes API Key 只存在服务端，**只有管理员能在 `/admin` 查看完整值**

---

## 🚀 部署（不会代码也能做）

👉 **请看：[Vercel小白部署教程.md](./Vercel小白部署教程.md)** —— 全程点点点，10 分钟上线。

简要版 5 步：

1. **建数据库**：[console.upstash.com](https://console.upstash.com/) → Create Database（选 Regional + 近的地区，免费）→ 复制 **REST API** 区里的 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`
2. **导入项目**：[vercel.com](https://vercel.com/) → Add New → Project → Import `AlotofSkymoon/agnes-chat`（框架自动识别 Next.js，其余全部默认）
3. **填 4 个环境变量**：

   | Key | Value |
   | --- | --- |
   | `UPSTASH_REDIS_REST_URL` | 第 1 步复制的 URL |
   | `UPSTASH_REDIS_REST_TOKEN` | 第 1 步复制的 TOKEN |
   | `SESSION_SECRET` | 任意长随机串 |
   | `PRESET_AGNES_API_KEY` | 站点内置 Key（见 `.env.example`） |

4. **点 Deploy**，等 1～3 分钟出彩带就成功了
5. **注册第一个账号** → 自动成为管理员 → 右上角盾牌进 `/admin`

> ⚠️ 改了环境变量后必须 **Redeploy** 才生效。
> ⚠️ 复制的一定是带 **REST** 字样的两个值，不是 `UPSTASH_REDIS_URL`。

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

## 二、路由一览

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

## 三、Redis 数据结构

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

## 四、安全说明

- 密码：bcrypt hash（cost 10），绝不明文存储。
- Session：32 字节随机数，Cookie `httpOnly + secure + sameSite=lax`，TTL 7 天。
- 管理员权限：**服务端校验**（`requireAdmin()`），前端隐藏按钮不算权限控制。
- 预设 API Key：只在服务端环境变量，非管理员请求 `/api/admin/preset-key` 返回 403。
- 登录失败统一提示「邮箱或密码错误」，不区分邮箱是否存在。
- 日志中不打印密码、sessionId、API Key。

---

## 五、Vercel 技术备注

- 构建命令 `next build`、输出目录 `.next` 都由 Vercel 自动识别，无需配置。
- 聊天接口 `/api/chat` 为 Node.js Runtime + SSE 流式，已设置 `maxDuration = 60` 与 `X-Accel-Buffering: no`。
- 字体使用系统字体栈（Inter 优先），构建过程不访问外部网络，部署更稳。
- 所有 Redis 操作都在服务端 API Route 内完成，浏览器永远拿不到 TOKEN。
- 代码推到 GitHub 后 Vercel 会自动重新部署。

---

## 六、不实现的功能

Agent、工具调用、联网搜索、代码执行、语音 —— 聊天之外不做多余的事。
需要 Agent 功能请去 **AgentScope** 添加 Agnes API Key。

---

## 七、对象存储（图片 / 视频上传）

图片与视频不再以 base64 塞进消息，而是上传到 S3 兼容存储，只回传链接。

推荐 **Cloudflare R2**（零出站流量费 + 10GB 免费额度），也支持 MinIO、腾讯云 COS、
阿里云 OSS、AWS S3、七牛云、又拍云、火山引擎 TOS、DigitalOcean Spaces、Wasabi。
Backblaze B2 的 S3 兼容层不完整，**不推荐**。

流程：浏览器请求 `/api/upload/presign` 拿到预签名 PUT 链接（AWS SigV4，服务端签名），
然后**直传对象存储** —— 文件不经过 Vercel，绕开 Serverless 4.5MB 请求体上限。

设置位置：聊天页 → 设置 → 对象存储。需要你的存储桶满足两个条件：

1. 允许**公开读**（否则模型打不开链接）
2. CORS 允许你的站点域名做 **PUT**（否则浏览器直传被拦）

凭证只存在你的浏览器，服务端不保存，签名密钥也不落前端。
