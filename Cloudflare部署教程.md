# Cloudflare Workers 部署教程（推荐）

> 用 Cloudflare 三件套：**KV + D1 + R2**，不需要 Redis，免费额度更大。
> 全程在网页上点，不用装任何东西。约 20 分钟。

**为什么推荐这个方式？**
- 不需要注册 Upstash，少一个外部服务
- 免费额度：D1 每天 500 万次读、KV 每天 10 万次读，个人站用不完
- 没有「自定义域名备案/认证」的麻烦（Workers 自带 `.workers.dev` 域名）

不想用 Cloudflare 也可以走 Vercel + Upstash，见文末对比。

---

## 先选一种部署方式

本文提供两种，**效果完全一样，选一个走到底即可**：

| | 方式一：GitHub Actions | 方式二：界面部署 ⭐ |
|---|---|---|
| 在哪操作 | GitHub 仓库 | Cloudflare 后台 |
| 要配 API 令牌吗 | **要**（最容易踩坑的一步） | **不要**（平台自己生成） |
| 适合谁 | 想要 CI/CD、熟悉 GitHub | 小白、想少折腾 |
| 章节位置 | 下面「第 1～8 步」 | [跳到方式二](#方式二cloudflare-界面部署workers-builds) |

> 💡 **如果你是第一次部署，强烈建议直接看[方式二](#方式二cloudflare-界面部署workers-builds)**。
> 它可以绕开"API 令牌权限不足"这个高频坑 —— Cloudflare 会自己生成凭证。

两种方式**共用**第 2～6 步的资源准备（账户 ID、KV、D1、SESSION_SECRET、API Key），
只有第 1 步（API 令牌）是方式一独有的。

---

# 方式一：GitHub Actions 部署

## 你需要准备的东西

一共要往 GitHub 里填 **7 个 Secrets**。先把容器建好，再回来填。

| Secret 名字 | 是什么 | 从哪来 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 操作 Cloudflare 的令牌 | 第 1 步 |
| `CLOUDFLARE_ACCOUNT_ID` | 账户 ID | 第 2 步 |
| `KV_NAMESPACE_ID` | KV 命名空间 ID | 第 3 步 |
| `D1_DATABASE_ID` | D1 数据库 ID | 第 4 步 |
| `SESSION_SECRET` | 登录会话密钥（随便编） | 第 5 步 |
| `PRESET_AGNES_API_KEY` | 站点内置 Agnes Key | 第 6 步 |
| `R2_*` 共 5 个 | 对象存储（可选） | 见 [R2 教程](./R2对象存储配置教程.md) |

---

## 第 1 步：创建 Cloudflare API 令牌（仅方式一需要）

这个令牌让 GitHub Actions 能帮你部署。
> 走方式二（界面部署）的话，**跳过这一步**，平台会自己生成凭证。
**这一步最容易出问题**——权限少勾一个，部署时就会报 `Authentication error [code: 10000]`。

### 方式 A：用官方模板（推荐）

1. 打开 <https://dash.cloudflare.com/profile/api-tokens>
2. 点 **「创建令牌」** / **Create Token**
3. 找到 **「编辑 Cloudflare Workers」** / **Edit Cloudflare Workers**，
   点右边的 **「使用模板」** / **Use template**
4. **账户资源**：选「包括 → 你的账户」
5. **区域资源**：选「包括 → 所有区域」
6. **继续到摘要** → **创建令牌**
7. **复制令牌**（只显示一次！）

### 方式 B：手动勾选（模板找不到时用）

用 **「创建自定义令牌」**，按下表逐条勾：

| 层级 | 权限项 | 级别 |
|---|---|---|
| 账户 | Workers 脚本 | 编辑 |
| 账户 | Workers KV 存储 | 编辑 |
| 账户 | D1 | 编辑 |
| 账户 | Workers R2 存储 | 编辑 |
| 用户 | **User Details** | 读取 |
| 用户 | **Memberships** | 读取 |

> ⚠️ 最后两个「用户」层级的权限**极易漏勾**。
> 漏了的表现是：账户 ID 能读到，但报
> `Unable to retrieve email... Are you missing the User->User Details->Read permission?`
> 或 `Unable to get membership roles... Memberships->Read permission?`

### 自检令牌权限

本地跑一次就能验证（不用等 Actions）：

```bash
export CLOUDFLARE_API_TOKEN=你的令牌
export CLOUDFLARE_ACCOUNT_ID=你的账户ID
npx wrangler whoami
```

- 正常 → 会列出账户名和权限
- 报 `Authentication error [code: 10000]` → 权限不足，回去补勾

---

## 第 2 步：拿到账户 ID

- 打开 <https://dash.cloudflare.com/>，登录后
- 右边中间位置（或 R2 概览页右侧）能看到 **「账户 ID」**
- 32 位字符，复制下来

---

## 第 3 步：创建 KV 命名空间

KV 用来存登录会话（session）和缓存。

1. 左边菜单：**Workers 和 Pages** → **KV**
2. 点 **「创建命名空间」** / **Create a namespace**
3. 名称填：`agnes-chat-kv`
4. 点 **「添加」**
5. 创建成功后，列表里会显示这一行，**复制它的 ID**（一串 32 位字符）

---

## 第 4 步：创建 D1 数据库

D1 是 SQLite 数据库，存用户账号。

1. 左边菜单：**Workers 和 Pages** → **D1**
2. 点 **「创建数据库」** / **Create database**
3. 名称填：**`agnes-chat-db`**（必须完全一致，部署脚本按这个名字找）
4. 位置选离你近的
5. 点 **「创建」**
6. 创建好后**点进这个数据库**，在概览页找到 **「数据库 ID」**，复制下来

> 建表不用手动做 —— GitHub Actions 会自动执行 `schema.sql`。

---

## 第 5 步：生成 SESSION_SECRET

这是给登录 Cookie 加密用的，随便编一串够长的乱码就行。

**方法**：在本机终端执行（任选一个）：

```bash
openssl rand -base64 32
```

或者用 Node：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

没有终端？也可以在这生成：<https://www.random.org/strings/>（长度 32，选所有字符集）

**复制生成的字符串。**

---

## 第 6 步：准备 Agnes API Key

填站点内置的 Agnes Key，用户不填自己的 Key 时用它。

默认值（可以直接用）：

```
sk-d5DyJCcfW9TmkeIHnfFPgHJ2ZjxfKHCx5ip3tR14abyrgZEi
```

> 这个 Key 只有管理员能在 `/admin` 看到完整值，普通用户看不到。
> 想换自己的，去 <https://platform.agnes-ai.com/> 申请。

---

## 第 7 步：填进 GitHub Secrets

1. 打开你的 GitHub 仓库（fork 出来的那个）
2. 点 **Settings**（仓库页面的右上角标签）
3. 左边菜单：**Secrets and variables** → **Actions**
4. 点 **「New repository secret」**
5. **一个一个添加**（Name 和 Secret 分两次填）：

   | Name | Secret |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | 第 1 步的令牌 |
   | `CLOUDFLARE_ACCOUNT_ID` | 第 2 步的账户 ID |
   | `KV_NAMESPACE_ID` | 第 3 步的 KV ID |
   | `D1_DATABASE_ID` | 第 4 步的 D1 ID |
   | `SESSION_SECRET` | 第 5 步生成的随机串 |
   | `PRESET_AGNES_API_KEY` | 第 6 步的 Key |

6. **如果要启用图片/视频上传**，再加这 5 个（详见 [R2 教程](./R2对象存储配置教程.md)）：

   | Name | Secret |
   |---|---|
   | `R2_ACCOUNT_ID` | 账户 ID（同第 2 步） |
   | `R2_ACCESS_KEY_ID` | R2 令牌的 Access Key |
   | `R2_SECRET_ACCESS_KEY` | R2 令牌的 Secret Key |
   | `R2_BUCKET` | `agnes-chat` |
   | `R2_PUBLIC_BASE_URL` | `https://pub-xxx.r2.dev` |

> 💡 **Name 必须一模一样**（全大写 + 下划线），填错了部署会失败。

---

## 第 8 步：触发部署

1. 确保代码已经推到 GitHub（fork 的仓库要先 **Sync fork** 同步上游）
2. 打开仓库的 **Actions** 标签
3. 左边选 **「部署到 Cloudflare Workers」**
4. 点右边 **「Run workflow」** → 再点 **「Run workflow」**
5. 等 3～5 分钟，看到绿色 ✅ 就成功了

> 工作流文件在 `.github/workflows/deploy-cloudflare.yml`，已由上游配置好，不用你自己建。

**当前默认是「手动触发」**，这样不会和方式二（界面部署）重复部署。
想改成推送 `main` 就自动部署，把工作流文件开头的两行注释去掉：

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

> ⚠️ **不要同时启用方式一自动部署和方式二**，否则一次推送会部署两遍，互相覆盖。

### 怎么找到你的网站地址？

- 部署日志里会有一行 `https://agnes-chat.xxxx.workers.dev`
- 或者 Cloudflare 后台：**Workers 和 Pages** → 点你的项目 → 看「预览 URL」

### 上线后先做一次自检

浏览器打开 `https://你的域名/api/health`，会返回一份**不含任何密钥**的诊断：

```jsonc
{
  "ok": true,
  "platform": "cloudflare",
  "storage": { "backend": "cloudflare", "reachable": true },
  "problems": []
}
```

- `ok: true` → 一切正常，去注册第一个账号（自动成为管理员）
- `problems` 有内容 → 按提示逐条修

> 常见问题里列了几个典型报错的对照表，先去那儿看一眼。

---

# 方式二：Cloudflare 界面部署（Workers Builds）

> ⭐ **推荐小白用这个。** 全程在 Cloudflare 后台点，**不用创建 API 令牌**。
>
> Cloudflare 官方文档说明：使用 Workers Builds 时，
> **平台会自动为你的账户生成 API 令牌**，你不需要自己配置凭证。
> 这意味着方式一里最容易踩的「令牌权限不足」坑，在这里根本不存在。

## 前置：两件必须手动做的事

界面部署**不会**跑 GitHub Actions 里的那些步骤，所以下面两件事要你自己做一次。

### ① 把 KV / D1 的真实 ID 填进 `wrangler.jsonc`

打开仓库里的 `wrangler.jsonc`，找到这两处占位符，**替换成真实 ID**：

```jsonc
"kv_namespaces": [
  { "binding": "KV", "id": "把这里换成你的 KV 命名空间 ID" }
],
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "agnes-chat-db",
    "database_id": "把这里换成你的 D1 数据库 ID"
  }
]
```

- KV ID 怎么拿：见[第 3 步](#第-3-步创建-kv-命名空间)
- D1 ID 怎么拿：见[第 4 步](#第-4-步创建-d1-数据库)

> 💡 这俩 ID **不是密钥**，提交到公开仓库没问题。
> 真正需要保密的是 `PRESET_AGNES_API_KEY` 和 `SESSION_SECRET`，那两个走下面的加密变量。

改完提交到 GitHub。

### ② 建一次 D1 表（只需一次）

在你自己的电脑上（或用 Cloudflare 后台的 D1 控制台）跑：

```bash
npx wrangler d1 execute agnes-chat-db --file=./schema.sql --remote
```

第一次会让你登录 Cloudflare，跟着提示点就行。
建表语句是幂等的，重复执行不会产生副作用。

> 如果不想装 Node，也可以用 Cloudflare 后台：
> **存储和数据库 → D1 → 选 agnes-chat-db → Console**，
> 把 `schema.sql` 的内容粘贴进去执行。

---

## 开始部署

### 第 1 步：创建 Worker 并连接 Git

1. 打开 <https://dash.cloudflare.com>
2. 左边菜单 **Workers 和 Pages**（旧版叫 Workers）
3. 点 **创建** / **Create**
4. 切到 **连接到 Git** / **Connect to Git** 这一页
5. 点 **连接到 GitHub**，按提示授权 Cloudflare 访问你的仓库
6. 选中 `agnes-chat` 仓库 → 点 **开始设置** / **Begin setup**

### 第 2 步：填构建配置

| 配置项 | 填什么 |
|---|---|
| Project name / 项目名称 | `agnes-chat`（随便起，会成为域名前缀） |
| Production branch / 生产分支 | `main` |
| **Build command / 构建命令** | `npm run cf:build` |
| Deploy command / 部署命令 | `npx wrangler deploy`（默认即可，不用改） |
| Root directory / 根目录 | 留空 |

> ⚠️ **构建命令必须填 `npm run cf:build`**，不能只填 `npm run build`。
> 前者 = Next.js 构建 + OpenNext 转换成 Worker 格式，缺了后者部署上去跑不起来。

> 如果 Root directory 找不到，它在 **Advanced settings / 高级设置** 折叠面板里；
> 项目在仓库根目录的话留空就行。

### 第 3 步：点保存并部署

拉到最下面点 **保存并部署** / **Save and Deploy**。

Cloudflare 会：拉代码 → 装依赖 → 跑 `npm run cf:build` → `wrangler deploy` → 给你一个 `.workers.dev` 域名。

首次大约 3～5 分钟。之后**每次推 `main` 都会自动重新部署**。

---

## 设置密钥（重要，否则聊天用不了）

构建跑通后，还要把两个密钥告诉 Worker。

### 方法 A：在后台界面加（推荐）

1. 进刚建好的 Worker → **设置** / **Settings**
2. 找 **变量和机密** / **Variables and Secrets**
3. 点 **添加** / **Add**：
   - 类型选 **机密（加密）** / **Secret**
   - 名称 `PRESET_AGNES_API_KEY`，值填你的 Agnes Key
   - 再添加 `SESSION_SECRET`，值填随机串（`openssl rand -base64 32` 生成）
4. 保存后，**需要重新部署一次**才生效（Deployments → Retry deploy）

### 方法 B：用命令行

```bash
npx wrangler secret put PRESET_AGNES_API_KEY
npx wrangler secret put SESSION_SECRET
```

按提示粘贴值即可。

> 想启用图片/视频上传的话，还要再加 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、
> `R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE_URL` 这 5 个，
> 详见 [R2 教程](./R2对象存储配置教程.md)。

---

## 方式二常见问题

### ❌ 构建日志出现 `config.default cannot be empty`

`open-next.config.ts` 的字段层级写错了。正确结构是所有 override 都在
`default.override` 里，不能直接在 `default` 顶层。上游已修好，
如果你是同步的旧版本，重新 Sync fork 即可。

### ❌ 部署后打开是空白 / 500

先访问 `https://你的域名/api/health`：

- `storage.backend` 是 `none` → `wrangler.jsonc` 的 KV / D1 ID 没填对
- `storage.reachable` 是 `false` → D1 表没建，回去执行前置 ②
- 提示缺 `PRESET_AGNES_API_KEY` → 上面的密钥没设置，或设完没重新部署

### ❌ 想改回 GitHub Actions 部署

去 Worker 的 **Settings → Build** 断开 Git 连接，
然后按方式一走即可（记得把工作流开头的 `push` 注释打开）。

---

## 常见问题

### ❌ 部署时报 Authentication error [code: 10000]

**原因**：API 令牌权限不足（不是账户 ID 错了）。

典型长这样：

```
✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/services/***) failed.
  Authentication error [code: 10000]
👋 Unable to retrieve email... Are you missing the `User->User Details->Read` permission?
🎢 Unable to get membership roles... Are you missing the `User->Memberships->Read` permission?
```

**解决**：回第 1 步重新生成令牌，确认勾了这两个**用户层级**的权限：

- 用户 → **User Details** → 读取
- 用户 → **Memberships** → 读取

生成后更新 Secret `CLOUDFLARE_API_TOKEN`，再跑一次 Actions。

本地可先用 `npx wrangler whoami` 验证，不用每次都等 Actions 跑完。

---

### ❌ Actions 报「缺少 Secret D1_DATABASE_ID」

说明第 7 步的 Name 拼错了。回去检查拼写，必须完全一致（大小写敏感）。

### ❌ 报「Couldn't find a D1 database」

D1 数据库名字必须是 **`agnes-chat-db`**，一个字都不能差。

### ❌ 部署成功但注册/登录报错

大概率是 D1 表没建成。手动执行一次：

```bash
npx wrangler d1 execute agnes-chat-db --file=./schema.sql --remote
```

### ❌ 提示「Cloudflare 部署缺少 KV 绑定」

`wrangler.jsonc` 里的占位符没被替换成功。
检查 `KV_NAMESPACE_ID` 这个 Secret 有没有填。

### ❌ 想换回 Vercel

Vercel 部署照旧可用（需要 Upstash Redis），两条路互不影响：
有 KV/D1 绑定就走 Cloudflare，否则走 Upstash。

---

## 三种方式对比

| | ⭐ 方式二：界面部署 | 方式一：GitHub Actions | Vercel |
|---|---|---|---|
| 数据库 | KV + D1 | KV + D1 | Upstash Redis |
| 需要注册外部服务 | 不需要 | 不需要 | 需要 Upstash |
| **要配 API 令牌吗** | **不需要**（平台生成） | 需要（易踩坑） | 不需要 |
| 免费额度 | 很大，个人站用不完 | 同左 | Upstash 每天 1 万命令 |
| 自定义域名 | workers.dev，可绑自己的 | 同左 | 自带 vercel.app |
| 大文件上传 | 完全没问题 | 同左 | 受 Serverless 限制（已预签名绕过） |
| 自动部署 | 推 main 即部署 | 默认手动（可改自动） | 推代码即部署 |
| 配置复杂度 | **低** | 中 | 低 |
| 适合谁 | 小白 / 想少折腾 | 需要 CI/CD 流程 | 已有 Upstash、只是想跑起来 |

> 三者的**运行时代码完全一样**，站点会自己检测所在平台并选择对应后端
> （Cloudflare 走 KV+D1+R2，Vercel 走 Upstash+B2）。
> 差别只在"谁来负责构建和上传"。

---

## 附：本地开发怎么跑？

本地用 Upstash 更简单（不用模拟 KV/D1）：

```bash
cp .env.example .env.local   # 填入 Upstash 的两个值
npm install
npm run dev
```

没有 Upstash 也能跑，只是不能注册登录 —— 聊天功能照常可用。
