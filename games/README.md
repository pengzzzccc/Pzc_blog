# games/

这里用于本地开发时存放作品的 Web 构建，每个作品一个目录：`games/<slug>/index.html`。

- 本目录除本文件外**不进 Git**（见 `.gitignore`）
- 本地开发时，`pnpm dev` 会把这里映射到 `/play/<slug>/`（见 `scripts/play-dev-server.mjs`）
- 线上 GitHub Pages 环境建议使用 `play.type: external` 指向 itch.io 等托管平台，或将轻量未预压缩的 Web 构建放入 `public/play/<slug>/`
