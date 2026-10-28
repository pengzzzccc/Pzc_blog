# Pzc_blog

个人主页网站，包含四个部分：

- **个人介绍**：首页，并提供进入以下三个栏目的入口
- **作品集**：自己开发的游戏（Unity / Godot / Unreal），支持在网页里在线试玩
- **博客**：技术文章、开发日志、游戏长评
- **游戏库**：玩过的游戏，Steam 自动同步，再手动补充状态、评分和短评

技术栈为 Astro + Tailwind CSS，内容用 Markdown/MDX 管理，支持中英双语。站点用 Docker（Caddy）打包，通过 GitHub Actions 自动部署到海外 VPS，访问统计使用自托管的 Umami。

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
| `scripts/upload-game.sh <slug> <构建目录>` | 把游戏 Web 构建上传到服务器 |

## 需要你填写的内容

仓库里没有任何个人内容，下面这些都需要你自己填写。本地 `pnpm dev` 时，空缺的地方会显示黄色的「待填写」提示，生产构建不会显示这些提示。

- `src/data/profile.ts`：一句话定位、自我介绍、经历、社交链接、简历（技能里先放了你提到的 Unity / Godot / Unreal）
- `public/avatar.svg`、`public/og-default.png`：头像与默认分享图（现在是占位图）
- `src/content/blog/`、`src/content/games/`、`src/content/library/`：文章、作品、游戏库条目，格式见 [docs/DESIGN.md §6、§9](docs/DESIGN.md)
- 游戏库的 Steam 数据：配置 `STEAM_API_KEY`、`STEAM_ID` 后运行 `pnpm sync:steam`

## 部署

1. 服务器按 [docs/DESIGN.md §12](docs/DESIGN.md) 初始化，把 `deploy/.env.example` 复制为 `/opt/pzc-blog/.env` 并填写
2. 在 GitHub 仓库设置 Secrets（`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`STEAM_API_KEY`）和 Variables（`PUBLIC_SITE_URL`、`STEAM_ID`、`DEPLOY_ENABLED=true` 等，见 §11.3）
3. push 到 `main` 即自动构建镜像并部署
