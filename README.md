# Pzc_blog

个人主页网站，包含四个部分：

- **个人介绍**：首页，并提供进入以下三个栏目的入口
- **作品集**：自己开发的游戏（Unity / Godot / Unreal / 桌游），支持在网页里试玩或跳转外链
- **博客**：技术文章、开发日志、游戏长评
- **游戏库**：玩过的游戏，Steam 自动同步，再手动补充状态、评分和短评

技术栈为 Astro + Tailwind CSS，内容用 Markdown/MDX 管理，支持中英双语。站点通过 GitHub Actions 自动构建并部署到 **GitHub Pages**（默认地址 `https://pengzzzccc.github.io/Pzc_blog/`，亦兼容自定义域名）。

完整的规划设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## 本地开发

需要 Node 24+，用 corepack 自动获取 `package.json` 里指定的 pnpm 版本。

```bash
corepack enable
pnpm install
pnpm dev          # http://localhost:4321
```

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发服务器；`games/<slug>/` 会映射到 `/play/<slug>/` |
| `pnpm check` | 类型与内容 schema 检查 |
| `pnpm build` | 生成静态站点到 `dist/` |
| `pnpm new:post <slug> [标题] [--dir] [--en]` | 新建文章模板 |
| `pnpm sync:steam` | 拉取 Steam 游戏库（需要 `STEAM_API_KEY`、`STEAM_ID` 环境变量） |

## 需要你填写的内容

本地 `pnpm dev` 时，空缺的地方会显示黄色的「待填写」提示，生产构建不会显示这些提示。

- `src/data/profile.ts`：一句话定位、自我介绍、经历、社交链接、简历
- `public/avatar.svg`、`public/og-default.png`：头像与默认分享图（现在是占位图）
- `src/content/blog/`、`src/content/games/`、`src/content/library/`：文章、作品、游戏库条目，格式见 [docs/DESIGN.md §6、§9](docs/DESIGN.md)
- 游戏库的 Steam 数据：配置 `STEAM_API_KEY`、`STEAM_ID` 后运行 `pnpm sync:steam`

## 部署（GitHub Pages）

1. 在 GitHub 仓库进入 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**
2. （可选）如需自动同步 Steam 游戏库，在仓库 **Settings → Secrets and variables → Actions** 中配置：
   - Secret：`STEAM_API_KEY`
   - Variable：`STEAM_ID`
3. 每次合并 PR 或推送到 `main` 分支时，`.github/workflows/deploy.yml` 会自动触发构建并更新 GitHub Pages 内容
