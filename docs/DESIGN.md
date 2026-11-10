# Pzc_blog 规划设计文档

| 项目 | 内容 |
|---|---|
| 版本 | v0.1（草案） |
| 日期 | 2026-10-28 |
| 状态 | 规划完成，尚未开始实现 |
| 范围 | 技术栈、页面拓扑、内容排版、内容添加方式、Docker 打包与自动化部署 |

> 文中的代码片段都是**示意**，用来说明结构和关键配置。实现时以当时各依赖的稳定版本和官方文档为准。

---

## 1. 项目概述

### 1.1 目标

个人主页网站，包含四块内容：

1. **个人介绍**：就是首页。介绍里有三个入口按钮，分别通往下面三个页面
2. **作品集**：展示自己开发的游戏（Unity / Godot / Unreal），能在线试玩的直接在网页里玩
3. **博客**：技术文章、开发日志、游戏长评
4. **游戏库**：自己玩过的游戏。数据由 Steam 自动同步，再手动补充状态、评分、短评，并可链接到博客长评

首版附带**中英双语**和**访问统计**。

### 1.2 非目标（首版不做）

- 评论系统、站内搜索（列入后续，见 §14）
- 后台 CMS、在线编辑、用户系统
- 内容存数据库（数据库只给访问统计用）

### 1.3 设计原则

| 原则 | 含义 |
|---|---|
| 静态优先 | 全站 SSG 输出纯静态文件，没有应用服务器，攻击面和运维成本都最小 |
| 内容即代码 | 文章、作品、游戏库都是仓库里的 Markdown/YAML，有版本、可审查、可回滚 |
| 不绑定云厂商 | 只依赖「一台装了 Docker 的 Linux 主机」，换厂商只需迁移一个目录 |
| 一条命令部署和回滚 | push 即发布；回滚就是换一个镜像 tag |
| 大文件与站点分离 | 游戏 WebGL 构建产物不进 Git、不进镜像，单独发布 |

---

## 2. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Astro**（当前稳定大版本），SSG 输出，TypeScript | 为内容型网站而生；默认零 JS；Content Layer 自带 schema 校验；需要交互时可以局部用 Islands |
| 样式 | **Tailwind CSS v4** + `@tailwindcss/typography` | 原子化 CSS，构建后体积小；typography 插件负责正文排版；用 class 切换暗色模式 |
| 内容 | Astro Content Layer（`glob()` / `file()` loader + zod schema）、MDX、YAML | frontmatter 写错时构建直接失败；MDX 可在文章里嵌组件（如画廊、视频） |
| 代码高亮 | Shiki（Astro 内置） | 构建期高亮，不需要客户端 JS，支持亮暗双主题 |
| 国际化 | Astro 内置 i18n 路由 | `zh` 为默认语言不加前缀，`en` 在 `/en/` 下 |
| 交互 | Astro Islands（原生 `<script>` 或小型框架组件） | 只在主题切换、截图灯箱、游戏加载器、游戏库筛选这几处发 JS |
| SEO | `@astrojs/sitemap`（含 hreflang）、`@astrojs/rss`、OG/Twitter meta | 中英各一份 RSS |
| 图片 | `astro:assets` | 构建期生成 WebP/AVIF 和响应式尺寸 |
| 外部数据 | Steam Web API | 只在定时同步脚本里调用，构建时不调用 |
| 访问统计 | **Umami**（可选，支持 Umami Cloud 或自托管实例） | 开源、无 Cookie、轻量 |
| 静态托管 | **GitHub Pages** | 免费、免运维、自带全球 CDN 与 HTTPS，自动适配仓库子路径与自定义域名 |
| 工具链 | pnpm、Node 24 LTS（只用于构建）、`astro check` 类型检查 | 首版不引入 ESLint/Prettier，需要时再加 |
| CI/CD | GitHub Actions（`configure-pages` + `deploy-pages`） | 每次合并/推送到 `main` 分支或同步 Steam 数据后自动构建并发布到 GitHub Pages |

---

## 3. 系统架构

### 3.1 运行时架构

```mermaid
flowchart LR
    visitor(["访客浏览器"])
    subgraph vps["VPS · docker compose"]
        site["site 容器<br/>Caddy 2 + 内置 dist/"]
        games[("games 卷（只读）<br/>/opt/pzc-blog/games")]
        umami["umami 容器"]
        db[("umami-db<br/>PostgreSQL")]
    end
    visitor -->|"HTTPS 主域名"| site
    visitor -->|"HTTPS analytics 子域名"| site
    site -->|"/play/*"| games
    site -->|"反向代理"| umami
    umami --> db
```

- **site**：项目自己的镜像。Caddy 负责 TLS、静态文件、`/play/*` 游戏文件和 Umami 的反向代理，全站只对外暴露这一个容器
- **games 卷**：服务器目录 `/opt/pzc-blog/games/<slug>/`，以只读方式挂进 Caddy，通过同源路径 `/play/<slug>/` 访问
- **umami / umami-db**：访问统计，绑定子域名 `analytics.<域名>`

### 3.2 两条关键原则

1. **网站本体打进镜像**：HTML/CSS/JS/图片随 Git 提交版本化，镜像 tag = 提交 SHA；回滚就是换回旧 tag
2. **游戏构建产物独立发布**：Unity/Godot 的 Web 构建通常有几十到几百 MB。放进 Git 会让仓库膨胀，放进镜像会拖慢每次部署。所以用脚本单独上传到服务器卷（见 §7、§9），网站和游戏各自发布。以后流量大了可以迁到对象存储 + CDN，只需改 `play.url`

### 3.3 外部数据流（游戏库）

GitHub Actions 每天跑一次 `sync-steam`：调用 Steam Web API，生成 `src/data/steam-library.json` 并提交，再触发部署。构建过程只读这个 JSON，Steam 不可用也不影响部署。详见 §8。

---

## 4. 页面拓扑

### 4.1 站点地图

```mermaid
flowchart TD
    home["/ 首页 · 个人介绍"]
    home --> works["/games 作品集"]
    home --> blog["/blog 博客"]
    home --> library["/library 游戏库"]
    works --> workDetail["/games/[slug] 作品详情"]
    workDetail --> play["/play/[slug]/ 游戏本体"]
    blog --> post["/blog/[slug] 文章"]
    blog --> tags["/tags · /tags/[tag] 标签"]
    post -.->|"game 字段：开发日志"| workDetail
    library -.->|"review 字段：长评"| post
```

英文版在每条路由前加 `/en`，例如 `/en/games/[slug]`、`/en/library`。

### 4.2 路由表

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | 首页 = 个人介绍 | 头像、名字、一句话定位、自我介绍；**三个入口按钮卡片**（作品集、博客、游戏库，各带数量和最新一条）；技能与常用引擎；经历时间线；简历 PDF；联系方式 |
| `/games` | 作品集 | 卡片网格，可按引擎、类型、状态筛选 |
| `/games/[slug]` | 作品详情 | 封面或预告片、元信息、试玩区、截图画廊、正文、相关开发日志、下载链接 |
| `/play/[slug]/` | 游戏本体 | 不由 Astro 生成，由 Caddy 直接从 games 卷提供；可被详情页 iframe 嵌入，也可全屏打开 |
| `/blog`、`/blog/page/[n]` | 博客列表 | 时间倒序、分页（每页 10 篇） |
| `/blog/[slug]` | 文章 | 目录、阅读时长、标签、上一篇/下一篇、关联的作品或游戏库条目 |
| `/tags`、`/tags/[tag]` | 标签 | 标签云；某标签下的文章列表 |
| `/library` | 游戏库 | 统计概览、按状态筛选、按评分或最近游玩排序、封面网格 |
| `/rss.xml`、`/en/rss.xml` | RSS | 中英各一份 |
| `/sitemap-index.xml` | 站点地图 | 带 hreflang |
| `/404` | 404 | 中英双语提示 + 回首页 |

### 4.3 导航

- **顶部导航**：名字/Logo（回首页）· 作品 · 博客 · 游戏库 · 语言切换 · 主题切换
- 移动端折叠为汉堡菜单
- 当前页在导航中高亮

### 4.4 页面之间的关联

| 关联 | 实现 | 展示 |
|---|---|---|
| 文章 → 作品 | 文章 frontmatter `game: <作品 slug>` | 作品详情页底部「开发日志」列出所有关联文章；文章页顶部显示「所属作品」卡片 |
| 游戏库 → 文章 | 游戏库 YAML `review: <文章 slug>` | 游戏库卡片显示「长评 →」；文章页显示「评测对象」卡片（游戏封面、状态、评分） |
| 首页 → 三个栏目 | 首页入口卡片 | 显示作品数和精选作品、文章数和最新标题、在玩数和最近在玩的游戏 |

### 4.5 多语言规则

- `zh` 是默认语言，不加前缀；`en` 加 `/en` 前缀。`<html lang>` 分别是 `zh-CN` 和 `en`
- 同一篇内容的中英版本使用**相同 slug**，分别放在 `zh/` 和 `en/` 目录下
- 语言切换：有对应翻译就跳到翻译页，没有就回到该语言首页
- 英文列表页只显示有英文版的内容；首页、导航等界面文案中英齐全
- 游戏库条目不分语言目录，短评写成 `comment.zh` / `comment.en`，缺英文时显示中文

---

## 5. 内容排版

### 5.1 全局布局

- **结构**：Header（顶部导航）→ Main → Footer（社交链接、RSS、版权）
- **断点**：沿用 Tailwind 默认的 `sm 640` / `md 768` / `lg 1024` / `xl 1280`
- **容器**：页面最大宽度 `max-w-6xl`；正文最大宽度约 `65ch`（`prose`）
- **网格**：
  - 作品、文章卡片：1 列 → `md` 2 列 → `lg` 3 列
  - 游戏库封面：2 列 → `sm` 3 列 → `md` 4 列 → `lg` 5 列
- **暗色模式**：用 `class` 切换。`<head>` 内联一小段脚本，按 localStorage 或系统偏好提前设置 class，避免页面闪烁

### 5.2 设计令牌

在 `src/styles/global.css` 中用 Tailwind v4 的 `@theme` 定义，亮色和暗色各一套：

| 令牌 | 建议 |
|---|---|
| 颜色 | 中性色用 zinc 系；主色选一种偏「游戏感」的颜色（如 violet），只用于链接、按钮、强调 |
| 状态色 | 在玩 = 蓝、通关 = 绿、弃坑 = 灰、想玩 = 琥珀、未评 = 中性 |
| 字体 | 中文用系统字体栈：`"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`；代码用 `JetBrains Mono` 等宽字体 |
| 圆角 | 卡片 `rounded-xl`，按钮和徽章 `rounded-md` |
| 间距 | 区块之间 `py-16`（移动端 `py-10`），卡片内 `p-5` |

### 5.3 页面线框

**首页（个人介绍）**

```text
Header ─ 名字 ··········· 作品 · 博客 · 游戏库 · 中/EN · 主题
│
├─ Hero
│    [头像]  名字
│            一句话定位（例：独立游戏开发者 / Gameplay 程序）
│            2–3 段自我介绍
│
│    三个入口按钮卡片（移动端 1 列，桌面 3 列）
│    ├─ [作品集 →]  作品数 · 精选作品缩略图
│    ├─ [博客 →]    文章数 · 最新一篇标题
│    └─ [游戏库 →]  在玩数 · 最近在玩的封面
│
├─ 技能与引擎（标签：Unity / Godot / Unreal / C# / C++ / GDScript …）
├─ 经历时间线（教育、项目、Game Jam、工作）
├─ 简历 PDF 下载 · 联系方式（邮箱、GitHub、itch.io、Steam）
│
Footer ─ 社交链接 · RSS · © 年份
```

**作品详情 `/games/[slug]`**

```text
├─ 标题 · 一句话简介 · 状态徽章（已发布 / 开发中 / 原型 / Game Jam）
├─ 试玩区（16:9 或 play.aspectRatio）
│    webgl：封面 + [开始游戏] [全屏打开]，点击后才加载 iframe
│    external：预告片 + [itch.io] [Steam] [下载]
├─ 元信息栏：引擎 · 平台 · 类型 · 我的角色 · 团队规模 · 开发周期
├─ 截图画廊（点击打开灯箱）
├─ 正文（MDX：设计思路、技术要点、复盘）
├─ 开发日志（game 字段关联到本作品的文章列表）
└─ 上一个 / 下一个作品
```

**文章 `/blog/[slug]`**

```text
├─ 标题 · 发布日期（更新日期）· 阅读时长 · 标签
├─ 封面（可选）
├─ 正文 65ch  ┆  目录（lg 及以上显示在右侧，sticky）
├─ 关联卡片：所属作品（game）/ 评测对象（游戏库 review 反查）
└─ 上一篇 / 下一篇
```

**游戏库 `/library`**

```text
├─ 标题 + 一句话说明
├─ 统计：总数 · 在玩 · 通关 · 平均分 · 最后同步时间
├─ 工具栏：[全部][在玩][通关][弃坑][想玩][未评]    排序：评分 / 最近游玩
└─ 封面网格（2 / 3 / 4 / 5 列）
     卡片：竖版封面
           状态徽章 · 评分（如 8.5）
           一行短评（超长省略，悬停或展开看全文）
           [长评 →]（有 review 时）
```

### 5.4 媒体

- 图片和内容放在同一目录，通过 `astro:assets` 输出 WebP/AVIF 和多种尺寸，`loading="lazy"`
- 预告片两种方式：YouTube 用懒加载外壳（先显示缩略图，点击后才加载播放器）；自托管 mp4 放在 games 卷里
- OG 图：每篇文章或作品有封面就用封面，否则用 `public/og-default.png`

---

## 6. 内容模型与目录结构

### 6.1 目录结构

```text
Pzc_blog/
├─ .github/workflows/
│  ├─ ci.yml               # PR 检查
│  ├─ deploy.yml           # 构建镜像并部署
│  └─ sync-steam.yml       # 每日同步 Steam 游戏库
├─ deploy/
│  ├─ Caddyfile
│  ├─ docker-compose.yml
│  └─ .env.example
├─ docs/DESIGN.md
├─ public/                 # favicon、resume.pdf、og-default.png
├─ scripts/
│  ├─ new-post.mjs         # 生成文章模板
│  ├─ sync-steam.mjs       # 拉取 Steam 数据
│  └─ upload-game.sh       # 上传游戏 Web 构建
├─ src/
│  ├─ components/          # Header、Footer、EntryCard、GameCard、PostCard、
│  │                       # GamePlayer、Gallery、LibraryCard、LibraryFilter、
│  │                       # LangSwitch、ThemeToggle
│  ├─ content/
│  │  ├─ blog/{zh,en}/<slug>.mdx 或 <slug>/index.mdx
│  │  ├─ games/{zh,en}/<slug>/index.mdx（同目录放 cover、screenshots/）
│  │  └─ library/<slug>.yaml
│  ├─ content.config.ts    # 集合定义与 schema
│  ├─ data/
│  │  ├─ profile.ts        # 姓名、社交链接、技能、经历时间线
│  │  ├─ steam-library.json    # 由 sync-steam 生成，不要手改
│  │  └─ steam-sync-meta.json  # 最后同步时间，同上
│  ├─ i18n/                # zh.ts、en.ts（界面文案）、utils.ts（语言工具函数）
│  ├─ layouts/             # BaseLayout、PostLayout、GameLayout
│  ├─ lib/                 # library.ts（游戏库合并）、content.ts（按语言取内容）
│  ├─ pages/               # 中文路由；pages/en/ 下为英文路由
│  ├─ views/               # 各页面主体，接收 lang 参数，中英路由共用
│  └─ styles/global.css
├─ astro.config.mjs
├─ Dockerfile
├─ .dockerignore
├─ package.json
└─ tsconfig.json
```

`pages/` 与 `views/` 分开：`src/pages/blog/[slug].astro` 和 `src/pages/en/blog/[slug].astro` 都是几行的薄包装，只传入 `lang` 并渲染同一个 `views/PostView.astro`，避免中英页面逻辑重复。

### 6.2 集合与 schema（示意）

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod'; // Astro 7 起 z 从 astro/zod 导入

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    draft: z.boolean().default(false),
    game: z.string().optional(),          // 关联作品 slug（不带语言前缀）
  }),
});

const games = defineCollection({
  loader: glob({ pattern: '**/index.mdx', base: './src/content/games' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    summary: z.string(),
    cover: image().optional(),             // 不填时显示作品名标题占位
    engine: z.enum(['unity', 'godot', 'unreal', 'tabletop', 'other']),
    genres: z.array(z.string()).default([]),
    platforms: z.array(z.string()).default([]),
    role: z.string(),                      // 我在项目中的角色
    team: z.number().int().positive().optional(),
    period: z.object({ start: z.coerce.date(), end: z.coerce.date().optional() }),
    status: z.enum(['released', 'in-development', 'prototype', 'jam', 'completed']),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    trailer: z.string().url().optional(),
    screenshots: z.array(image()).default([]),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    play: z.object({
      type: z.enum(['webgl', 'external', 'none']),
      embed: z.boolean().default(true),    // false = 只能全屏打开（Godot 多线程）
      aspectRatio: z.string().default('16/9'),
      url: z.string().optional(),          // 默认 /play/<slug>/
    }).default({ type: 'none' }),
  }),
});

const steam = defineCollection({
  loader: file('src/data/steam-library.json'),
  schema: z.object({
    id: z.string(),                        // = String(appid)
    appid: z.number(),
    name: z.string(),
    cover: z.string().url(),
    playtimeMinutes: z.number(),
    lastPlayedAt: z.coerce.date().nullable(),
  }),
});

const library = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/library' }),
  schema: ({ image }) => z.object({
    steamAppId: z.number().optional(),
    title: z.string().optional(),          // 非 Steam 游戏必填
    cover: image().optional(),             // 非 Steam 游戏必填；Steam 游戏可覆盖
    platform: z.string().optional(),       // Switch / PS5 / PC …
    status: z.enum(['playing', 'completed', 'dropped', 'wishlist']),
    rating: z.number().min(1).max(10).optional(),
    comment: z.object({ zh: z.string(), en: z.string().optional() }).optional(),
    review: z.string().optional(),         // 长评文章 slug
    finishedAt: z.coerce.date().optional(),
    hidden: z.boolean().default(false),
  }).refine((d) => d.steamAppId || (d.title && d.cover), {
    message: '非 Steam 游戏必须填写 title 和 cover',
  }),
});

export const collections = { blog, games, steam, library };
```

**关于跨集合关联**：`game` 和 `review` 用不带语言前缀的 slug 字符串，而不是 `reference()`。因为条目 id 带语言目录（如 `zh/my-game`），用 `reference()` 会把关联绑死在某一种语言上。由 `src/lib/content.ts` 的辅助函数按当前语言解析，缺翻译时回落到中文。构建时还会校验 slug 是否存在，不存在就报错。

### 6.3 个人资料与界面文案

- `src/data/profile.ts`：姓名、头像、一句话定位（中英）、自我介绍（中英）、社交链接、技能/引擎列表、经历时间线、简历 PDF 路径
- `src/i18n/zh.ts`、`en.ts`：导航、按钮、状态名、日期格式等界面文案；`utils.ts` 提供 `t(key, lang)`、`localizePath(path, lang)`、`getAlternatePath()`

---

## 7. 作品试玩方案（按引擎）

所有 Web 构建都上传到 `games/<slug>/`，对外路径是 `/play/<slug>/`，入口文件是 `index.html`。由于和网站同源，iframe 嵌入、全屏打开、COEP 都不会遇到跨域问题。

### 7.1 Unity WebGL

- 构建设置：**Compression Format = Brotli**，**关闭 Decompression Fallback**，建议开启 **Name Files As Hashes**（方便长期缓存）
- 服务器要做的事：
  - 给 `*.br` 文件加响应头 `Content-Encoding: br`
  - 按后缀设置正确的 `Content-Type`：`.wasm.br` → `application/wasm`，`.js.br` → `application/javascript`，`.data.br` → `application/octet-stream`
  - 这些文件已经压缩过，不能再被 `encode` 压缩一次

### 7.2 Godot 4 Web

- **推荐导出单线程版本**（Godot 4.3 及以上可以关闭 Thread Support）。单线程版本不需要 SharedArrayBuffer，可以直接 iframe 嵌入
- 必须用多线程时：页面需要处于跨源隔离（crossOriginIsolated）状态，而这只在**顶层页面**同时带 COOP/COEP 时成立。所以 `/play/*` 统一加 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`，并在 frontmatter 设置 `play.embed: false`，详情页只显示「全屏打开」按钮
- 这两个响应头只加在 `/play/*` 上，不影响站点其余页面嵌入 YouTube 等第三方内容

### 7.3 Unreal

- 没有官方 Web 导出，设置 `play.type: external`
- 详情页展示预告片、截图和下载链接（GitHub Releases / itch.io / Steam）

### 7.4 Caddyfile 中的 `/play/*` 配置（示意）

```caddyfile
handle_path /play/* {
	root * /srv/games

	@br path *.br
	header @br Content-Encoding br
	@wasmBr path *.wasm.br
	header @wasmBr Content-Type application/wasm
	@jsBr path *.js.br
	header @jsBr Content-Type application/javascript
	@dataBr path *.data.br
	header @dataBr Content-Type application/octet-stream

	header Cross-Origin-Opener-Policy same-origin
	header Cross-Origin-Embedder-Policy require-corp
	header Cache-Control "public, max-age=3600"

	file_server
}
```

站点级的 `encode` 需要排除预压缩文件，例如 `@compressible not path *.br *.gz`，再写 `encode @compressible zstd gzip`。

### 7.5 GamePlayer 组件

- 初始状态只显示封面和「开始游戏」「全屏打开」按钮，**点击后才插入 iframe**，避免打开详情页就下载上百 MB
- iframe 带 `allow="fullscreen; autoplay; gamepad"`，尺寸按 `play.aspectRatio` 计算
- `play.embed: false` 时只显示「全屏打开」，在新标签页打开 `/play/<slug>/`
- 按钮带埋点：`data-umami-event="play-game"`、`data-umami-event-slug="<slug>"`
- 移动端提示「建议在桌面浏览器游玩」（WebGL 游戏在手机上普遍体验不佳）

---

## 8. 游戏库方案（Steam 同步 + 手动补充）

### 8.1 同步脚本 `scripts/sync-steam.mjs`

- 调用 `IPlayerService/GetOwnedGames/v1`，参数 `include_appinfo=1`、`include_played_free_games=1`
- 从环境变量读取 `STEAM_API_KEY` 和 `STEAM_ID`（64 位 SteamID）
- 每个游戏输出 `{ id, appid, name, cover, playtimeMinutes, lastPlayedAt }`：
  - `cover`：优先用 Steam CDN 上的竖版库封面（`library_600x900`），没有就退回横版 `header`（具体 CDN 域名以实现时为准）
  - `lastPlayedAt` 来自 `rtime_last_played`，为 0 时记为 `null`
- 按 appid 排序后写入 `src/data/steam-library.json`（数组）。排序固定，所以只有数据真的变了才会产生 diff
- 数据有变化时，同时更新 `src/data/steam-sync-meta.json` 里的 `syncedAt`（页面上显示为「最后同步时间」）。数据没变就不改这个文件，避免每天产生空提交
- **前提**：Steam 个人资料的隐私设置里，「游戏详情」要设为公开
- 安全：API Key 只存在 GitHub Secrets 里，不写进日志，也不写进 JSON

### 8.2 定时工作流 `.github/workflows/sync-steam.yml`

- 触发：每天一次 cron（例如 UTC 20:00 = 北京时间 04:00），也可以手动触发
- 流程：运行脚本 → `git diff` 判断有无变化 → 有变化就提交并推送到 main → 以 reusable workflow 的方式调用 `deploy.yml`，传入新提交的 SHA
- 为什么要显式调用部署：用 `GITHUB_TOKEN` 推送的提交**不会**触发其他工作流的 `push` 事件
- 为什么要传 SHA：被调用的工作流默认检出调用方触发时的提交，那时还没有新的 JSON
- 注意：公开仓库连续 60 天没有活动时，GitHub 会自动停用定时工作流，需要手动重新启用

### 8.3 合并规则 `src/lib/library.ts`

1. 以 Steam 数据为底，按 `steamAppId` 合并 YAML，YAML 中的字段覆盖 Steam 字段（如自定义封面）
2. 只有 YAML、没有 Steam 数据的条目（Switch、PS 等非 Steam 游戏）照样加入
3. 没有 YAML 记录的 Steam 游戏：
   - 游玩时长低于阈值（`LIBRARY_MIN_PLAYTIME_MINUTES`，默认 120 分钟）的不显示
   - 以构建时间为基准，14 天内玩过的自动标为「在玩」，其余标为「玩过·未评」（派生状态 `played`）。这是静态站点，状态只在下一次部署时刷新
4. `hidden: true` 的条目不显示
5. 输出统一结构 `LibraryEntry { slug, title, cover, platform, status, rating?, comment?, review?, playtimeMinutes?, lastPlayedAt? }`。没有 YAML 的 Steam 条目 slug 为 `steam-<appid>`

### 8.4 页面 `/library`

- **统计**：总数、在玩、通关、平均分、最后同步时间
- **筛选**：全部 / 在玩 / 通关 / 弃坑 / 想玩 / 未评
- **排序**：评分（默认）、最近游玩
- 实现方式：静态 HTML 先输出完整列表（不开 JS 也能看）；筛选和排序由一个小 Island 在客户端切换，状态写进 URL 参数（如 `?status=completed&sort=recent`），方便分享
- **卡片**：竖版封面、状态徽章、评分、一行短评；有 `review` 时显示「长评 →」，链接到对应语言的文章

---

## 9. 内容添加方式（操作手册）

所有内容都用「本地编辑 → `pnpm dev` 预览 → push 到 main → 自动部署」这一套流程。frontmatter 或 YAML 写错时，`astro check` 和 `pnpm build` 都会直接报错，CI 不会放行。

### 9.1 写博客

```bash
pnpm new:post my-first-post "我的第一篇文章"          # 加 --dir 生成目录形式，加 --en 生成英文版
```

1. 脚本生成 `src/content/blog/zh/my-first-post.mdx` 和 frontmatter 模板（slug 单独传入，因为中文标题不适合做 URL）
2. 编辑正文；需要配图时用 `--dir` 生成 `my-first-post/index.mdx`，图片放在同一目录
3. 先写 `draft: true`，`pnpm dev` 本地预览；生产构建会排除草稿
4. 写完改成 `draft: false`，commit 并 push 到 main
5. 英文版：在 `src/content/blog/en/` 下建同名文件

frontmatter 示例：

```yaml
---
title: 我的第一篇文章
description: 一句话摘要，用于列表和 SEO
pubDate: 2026-10-28
tags: [godot, devlog]
game: star-courier        # 可选：作为某个作品的开发日志
draft: false
---
```

### 9.2 加一个作品

1. 新建 `src/content/games/zh/<slug>/index.mdx`，同目录放 `cover.png` 和 `screenshots/`
2. 用引擎导出 Web 版本（设置见 §7）
3. 上传构建：

   ```bash
   scripts/upload-game.sh star-courier ./Build/WebGL
   ```

   脚本先用 rsync 通过 SSH 上传到服务器的 `games/<slug>.tmp/`，传完后再原子替换为 `games/<slug>/`，避免玩家加载到传了一半的文件。部署主机和用户从本地 `.env` 读取
4. frontmatter 写 `play.type: webgl`（Unreal 或只能下载的写 `external`）
5. commit 并 push

### 9.3 记录玩过的游戏

- **Steam 游戏**：会自动出现（时长达到阈值后）。想补充状态、评分、短评时，新建 `src/content/library/<slug>.yaml`：

  ```yaml
  steamAppId: 1145360
  status: completed
  rating: 9
  comment:
    zh: 战斗手感和叙事节奏都无可挑剔。
    en: Combat feel and pacing are flawless.
  review: hades-review      # 可选：长评文章 slug
  finishedAt: 2026-09-01
  ```

- **非 Steam 游戏**：同样建 YAML，不写 `steamAppId`，改为手填 `title`、`platform`、`cover`（图片放在 `src/content/library/` 下，例如 `covers/<slug>.jpg`）
- **想玩**：`status: wishlist`
- **隐藏某个 Steam 游戏**：建 YAML 并写 `hidden: true`
- **立刻同步**：在 GitHub Actions 页面手动运行 `sync-steam`

### 9.4 更新个人介绍

编辑 `src/data/profile.ts`；简历替换 `public/resume.pdf`。

---

## 10. Docker 打包

### 10.1 Dockerfile（示意）

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG PUBLIC_SITE_URL
ARG PUBLIC_UMAMI_SRC
ARG PUBLIC_UMAMI_WEBSITE_ID
RUN pnpm build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/site
```

`.dockerignore` 排除 `node_modules`、`dist`、`.git`、`.astro`、`*.log`、`.env*`。

### 10.2 Caddyfile 主体（示意）

```caddyfile
{$SITE_DOMAIN} {
	@compressible not path *.br *.gz
	encode @compressible zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}

	handle_path /play/* {
		# 见 §7.4
	}

	handle {
		root * /srv/site
		@hashed path /_astro/*
		header @hashed Cache-Control "public, max-age=31536000, immutable"
		@pages not path /_astro/*
		header @pages Cache-Control "no-cache"
		file_server
	}

	handle_errors 404 {
		root * /srv/site
		@en path /en /en/*
		rewrite @en /en/404/index.html
		rewrite * /404.html
		file_server
	}
}

{$ANALYTICS_DOMAIN} {
	reverse_proxy umami:3000
}
```

Astro 把根目录的 `404.astro` 输出为 `404.html`，而 `en/404.astro` 输出为 `en/404/index.html`，所以两条 rewrite 的目标不同。完整配置见 `deploy/Caddyfile`。

### 10.3 docker-compose.yml（示意）

```yaml
services:
  site:
    image: ${SITE_IMAGE:-ghcr.io/<github-user>/pzc-blog}:${IMAGE_TAG:-latest}
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"     # HTTP/3
    environment:
      SITE_DOMAIN: ${SITE_DOMAIN}
      ANALYTICS_DOMAIN: ${ANALYTICS_DOMAIN}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
      - ./games:/srv/games:ro
    depends_on:
      - umami

  umami:
    image: ghcr.io/umami-software/umami:3.4.1
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://umami:${UMAMI_DB_PASSWORD}@umami-db:5432/umami
      APP_SECRET: ${UMAMI_APP_SECRET}
    depends_on:
      - umami-db

  umami-db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: ${UMAMI_DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  caddy_data:
  caddy_config:
  pgdata:
```

- `deploy/.env.example` 列出：`SITE_DOMAIN`、`ANALYTICS_DOMAIN`、`IMAGE_TAG`、`UMAMI_DB_PASSWORD`、`UMAMI_APP_SECRET`
- 只有 `site` 暴露端口，`umami` 和 `umami-db` 只在 compose 内部网络可达
- 镜像版本全部固定，不用 `latest`（`site` 由 `IMAGE_TAG` 控制）

### 10.4 本地验证

```bash
docker build -t pzc-blog:dev --build-arg PUBLIC_SITE_URL=https://localhost .
```

```bash
SITE_IMAGE=pzc-blog IMAGE_TAG=dev SITE_DOMAIN=localhost ANALYTICS_DOMAIN=analytics.localhost docker compose -f deploy/docker-compose.yml up
```

Caddy 会为 `localhost` 签发本地证书，浏览器首次访问时需要信任。

---

## 11. 自动化部署（CI/CD）

### 11.1 流水线

```mermaid
flowchart LR
    subgraph siteFlow["网站：push 即部署"]
        push["git push main"] --> build["deploy.yml<br/>构建镜像"] --> ghcr["GHCR<br/>:sha / :latest"] --> server["VPS<br/>compose pull + up -d"] --> check["健康检查"]
    end
    subgraph steamFlow["游戏库：每日同步"]
        cron["sync-steam.yml<br/>cron / 手动"] --> steamApi["Steam Web API"] --> commitJson["提交 steam-library.json"] --> callDeploy["workflow_call"]
    end
    subgraph gameFlow["作品：独立上传"]
        export["引擎导出 Web 构建"] --> upload["upload-game.sh<br/>rsync over SSH"] --> volume["服务器 games/{slug}/"]
    end
    callDeploy --> build
```

### 11.2 工作流

**`ci.yml`**（`pull_request` 触发）

`pnpm install --frozen-lockfile` → `pnpm check` → `pnpm build`；另一个 job 只构建不推送 Docker 镜像，提前发现 Dockerfile 问题。

**`deploy.yml`**（`push` 到 main、`workflow_dispatch`、`workflow_call` 均可触发）

- 输入参数：`ref`（可选，默认 `github.sha`），供 `sync-steam` 传入新提交
- 权限：`contents: read`、`packages: write`
- 步骤：
  1. `actions/checkout`（`ref: ${{ inputs.ref || github.sha }}`）
  2. `docker/setup-buildx-action` → `docker/login-action`（用 `GITHUB_TOKEN` 登录 GHCR）
  3. `docker/build-push-action`：推送 `:<sha>` 和 `:latest`，`cache-from/cache-to: type=gha`，build-args 从 Variables 读取
  4. scp 同步 `deploy/docker-compose.yml` 到服务器 `/opt/pzc-blog/`（Caddyfile 已打进镜像，随镜像版本走）
  5. SSH 执行：把 `SITE_IMAGE` 和 `IMAGE_TAG=<sha>` 写入服务器 `.env`，然后 `docker compose pull site && docker compose up -d`
  6. `curl -fsS https://<域名>/` 健康检查，失败则工作流标红
- 使用 `concurrency: deploy` 防止两次部署同时进行
- 可选使用 GitHub Environment `production` 存放部署相关 Secrets

**`sync-steam.yml`**：见 §8.2。调用部署时需要 `secrets: inherit`，并授予 `packages: write`（被调用工作流的权限不能超过调用方）。

### 11.3 Secrets 与 Variables

| 名称 | 类型 | 用途 |
|---|---|---|
| `DEPLOY_HOST` | Secret | 服务器地址 |
| `DEPLOY_USER` | Secret | 部署用户 |
| `DEPLOY_SSH_KEY` | Secret | 部署用私钥（专用，不复用个人密钥） |
| `STEAM_API_KEY` | Secret | Steam Web API Key |
| `STEAM_ID` | Variable | 64 位 SteamID；设置后 `sync-steam` 才会运行 |
| `DEPLOY_ENABLED` | Variable | 设为 `true` 后 `deploy.yml` 才执行部署步骤（服务器准备好之前只构建镜像） |
| `DEPLOY_PATH` | Variable | 服务器部署目录，默认 `/opt/pzc-blog` |
| `PUBLIC_SITE_URL` | Variable | 站点完整 URL |
| `PUBLIC_UMAMI_SRC` | Variable | Umami 脚本地址 |
| `PUBLIC_UMAMI_WEBSITE_ID` | Variable | Umami 站点 ID |

如果仓库是私有的，GHCR 镜像默认也是私有的，服务器需要先用一个只有 `read:packages` 权限的 PAT 执行一次 `docker login ghcr.io`。仓库公开时，可以把镜像设为公开，省掉这一步。

### 11.4 回滚

```bash
cd /opt/pzc-blog && IMAGE_TAG=<旧的提交 sha> docker compose up -d site
```

也可以在 GitHub 上对旧提交手动运行 `deploy.yml`（`workflow_dispatch` 并填写 `ref`）。

---

## 12. 服务器与云厂商（不绑定厂商）

### 12.1 最低要求

- 海外 Linux VPS（建议 Ubuntu 24.04 LTS），1 vCPU、1–2 GB 内存、20 GB 以上磁盘
- 安装 Docker Engine 和 Compose v2
- 开放 22（可改端口）、80、443（含 UDP，用于 HTTP/3）
- DNS：`<域名>` 和 `analytics.<域名>` 的 A/AAAA 记录指向服务器
- 留意流量额度：游戏构建较大，被频繁试玩时流量消耗明显

### 12.2 初始化清单

1. 创建部署用户（加入 `docker` 组），配置 SSH 公钥登录，禁用密码登录
2. 防火墙只放行上述端口
3. 创建 `/opt/pzc-blog/`，放入 `docker-compose.yml`、`Caddyfile`、`.env`（由 `.env.example` 复制并填写）和 `games/`
4. 首次启动 `docker compose up -d`，确认 HTTPS 证书签发成功
5. 登录 Umami，**立即修改默认管理员密码**，创建站点并取得 Website ID，填入 GitHub Variables
6. 配置 GitHub Secrets 与 Variables，手动运行一次 `deploy.yml`

### 12.3 候选厂商

| 厂商 | 特点 |
|---|---|
| Hetzner | 性价比高，流量额度大；机房在欧洲、美国、新加坡 |
| Vultr | 机房多，有东京、新加坡、首尔等亚洲节点 |
| DigitalOcean | 文档和生态完善，有新加坡节点 |
| AWS Lightsail | 固定月费，接入 AWS 生态，有东京、新加坡节点 |

访客主要在中国大陆时，优先选东京、新加坡、首尔等亚洲机房以降低延迟。价格和配置以各厂商官网为准。

### 12.4 可选：Cloudflare

在前面套 Cloudflare 可以获得免费 CDN 和 DDoS 防护。SSL 模式要设为 **Full (strict)**；`/play/*` 下的大文件要确认符合 Cloudflare 的缓存大小限制。

### 12.5 备份

- 每天定时执行 `pg_dump` 导出 Umami 数据库，保留最近 7 份
- `games/` 用 rsync 备份到本地或另一台机器（源文件本身也应保留在本地）
- 网站内容在 Git 里，不需要额外备份

---

## 13. 访问统计

- Umami 部署在 `analytics.<域名>`，由 Caddy 反向代理
- 只在生产构建（`import.meta.env.PROD` 且配置了 `PUBLIC_UMAMI_WEBSITE_ID`）时，由 `BaseLayout` 注入：

  ```html
  <script defer src="{PUBLIC_UMAMI_SRC}" data-website-id="{PUBLIC_UMAMI_WEBSITE_ID}"></script>
  ```

- 自定义事件：
  - `play-game`：作品试玩按钮，附带 `slug`
  - `open-review`：游戏库卡片上的「长评」链接
  - `download-resume`：首页简历下载
- `/play/*` 下的游戏页面不注入统计脚本，避免和 COEP 冲突，也减少对游戏的干扰

---

## 14. 里程碑

| 里程碑 | 内容 | 完成标准 |
|---|---|---|
| M1 | 项目骨架、BaseLayout、Tailwind 主题与暗色模式、i18n 工具、首页（个人介绍 + 三个入口） | 中英首页可访问，切换语言和主题正常 |
| M2 | 博客集合、列表与分页、文章页、标签、RSS、sitemap、`new-post` 脚本 | 写一篇示例文章，推送前 `astro check` 通过 |
| M3 | 作品集合、列表与筛选、详情页、画廊、GamePlayer、`upload-game.sh` | Unity 和 Godot 示例构建都能在本地 Caddy 下嵌入试玩 |
| M4 | 游戏库：schema、`library.ts` 合并逻辑、`/library` 页面与筛选、`sync-steam` 脚本与工作流 | 用真实 Steam 数据生成页面，筛选和排序正常 |
| M5 | Dockerfile、Caddyfile、docker-compose，本地跑通 | §10.4 的命令能完整跑起站点、游戏和 Umami |
| M6 | GitHub Actions（ci / deploy）、服务器初始化、域名与 HTTPS | push 到 main 后几分钟内线上更新；回滚命令验证可用 |
| M7 | Umami 接入与事件、SEO 细节、Lighthouse 优化 | Lighthouse 四项得分 ≥ 95（不含 `/play/*`） |

后续可选：

- Pagefind 站内搜索（构建期生成索引，纯静态）
- Giscus 评论（基于 GitHub Discussions）
- 作品构建迁到对象存储 + CDN（如 Cloudflare R2），只需改 `play.url` 和上传脚本

---

## 15. 待定事项

| 事项 | 影响 |
|---|---|
| 云厂商与机房 | 只影响 §12，架构不用改 |
| 域名 | `SITE_DOMAIN`、`ANALYTICS_DOMAIN`、`PUBLIC_SITE_URL` |
| 是否套 Cloudflare | SSL 模式、缓存规则 |
| 仓库公开还是私有 | GHCR 拉取镜像是否需要 PAT；定时工作流 60 天自动停用规则 |
| 游戏库时长阈值 | `LIBRARY_MIN_PLAYTIME_MINUTES`，默认 120 分钟 |
| 主色与视觉风格 | §5.2 设计令牌，可在 M1 时用一个首页原型确定 |
