# games/

这里放作品的 Web 构建，每个作品一个目录：`games/<slug>/index.html`。

- 本目录除本文件外**不进 Git**（见 `.gitignore`）
- 本地开发时，`pnpm dev` 会把这里映射到 `/play/<slug>/`（见 `scripts/play-dev-server.mjs`）
- 生产环境用 `scripts/upload-game.sh <slug> <构建目录>` 上传到服务器的 `/opt/pzc-blog/games/<slug>/`，由 Caddy 提供
