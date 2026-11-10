# Peng Zhanci (Pzc_blog)

Personal portfolio and blog website of **Peng Zhanci**, focused on Game Design (Systems / Gameplay) and Gameplay Development.

🌐 **Live Site (GitHub Pages)**: [https://pengzzzccc.github.io/Pzc_blog/](https://pengzzzccc.github.io/Pzc_blog/)

---

## About Me

- **Name**: Peng Zhanci (彭沾慈)
- **Role**: Game Designer (Systems / Gameplay) · Gameplay Developer
- **Location**: Sydney, Australia
- **Education**: Macquarie University · Bachelor of Information Technology (Focus: Game Design & Development, Software Systems Engineering, Computer Networks)
- **Links**:
  - GitHub: [pengzzzccc](https://github.com/pengzzzccc)
  - itch.io: [pengzzzccc.itch.io](https://pengzzzccc.itch.io)
  - Email: [pengzhanci2005@gmail.com](mailto:pengzhanci2005@gmail.com)

### Highlights
- **Design Focus**: Specializing in gameplay and system design derived from core game loops, writing consistent GDDs, rule deduction, economy systems, level pacing, numerical balance, and paper prototyping.
- **Development Skills**: Rapid prototyping from concept to playable demo using Unity / C#, finite state machines (FSM), event-driven architectures, Git CI/CD workflows, and AI / agent-assisted development tools.

---

## Features

- **About / Hero**: Personal introduction, background timeline, skills, and social links.
- **Portfolio (Works)**: Showcase of game projects with support for playable Web builds, itch.io links, and integrated devlogs.
- **Blog**: Technical articles, game dev logs, and long-form reviews with bilingual support and tag filtering.
- **Game Library**: Curated collection of played games, integrating automatic Steam sync with custom reviews and ratings.
- **Bilingual (i18n)**: Full English and Simplified Chinese support with seamless language switching.
- **Dark / Light Theme**: Clean paper-textured aesthetic with system/manual theme toggle.

---

## Tech Stack

- **Framework**: [Astro](https://astro.build/) (SSG mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + `@tailwindcss/typography`
- **Content**: Astro Content Collections (Markdown / MDX / YAML / JSON)
- **Deployment**: Automatic deployment to **GitHub Pages** via GitHub Actions on every merge / push to `main`

---

## Local Development

Requires **Node.js 24+**. Use corepack to automatically activate the matching `pnpm` version:

```bash
corepack enable
pnpm install
pnpm dev          # Runs dev server at http://localhost:4321
```

### Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts local development server (`games/<slug>/` is mapped to `/play/<slug>/`) |
| `pnpm check` | Runs Astro and TypeScript type/schema checking |
| `pnpm build` | Builds production static site to `dist/` |
| `pnpm new:post <slug> [title] [--dir] [--en]` | Generates a new post template |
| `pnpm sync:steam` | Syncs Steam library (requires `STEAM_API_KEY` and `STEAM_ID`) |

---

## Deployment to GitHub Pages

1. In the GitHub repository, navigate to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. (Optional) For automatic daily Steam sync, add `STEAM_API_KEY` (Secret) and `STEAM_ID` (Variable) in **Settings → Secrets and variables → Actions**.
4. Every push or pull request merged into `main` automatically builds and deploys to [https://pengzzzccc.github.io/Pzc_blog/](https://pengzzzccc.github.io/Pzc_blog/).
