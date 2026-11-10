import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 博客：src/content/blog/{zh,en}/<slug>.mdx 或 <slug>/index.mdx
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      draft: z.boolean().default(false),
      /** 关联作品 slug（不带语言前缀），文章会出现在该作品的开发日志里 */
      game: z.string().optional(),
    }),
});

// 作品：src/content/games/{zh,en}/<slug>/index.mdx
const games = defineCollection({
  loader: glob({ pattern: '**/index.{md,mdx}', base: './src/content/games' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      category: z.enum(['game', 'tool']).default('game'),
      /** 不填时显示作品名标题占位 */
      cover: image().optional(),
      /** 详情页背景/主视觉图（可选） */
      banner: image().optional(),
      engine: z.enum(['unity', 'godot', 'unreal', 'tabletop', 'other']),
      genres: z.array(z.string()).default([]),
      platforms: z.array(z.string()).default([]),
      role: z.string(),
      team: z.number().int().positive().optional(),
      period: z.object({ start: z.coerce.date(), end: z.coerce.date().optional() }),
      status: z.enum(['released', 'in-development', 'prototype', 'jam', 'completed']),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      /** YouTube 链接或自托管 mp4 地址 */
      trailer: z.string().optional(),
      screenshots: z.array(image()).default([]),
      links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      play: z
        .object({
          type: z.enum(['webgl', 'external', 'none']),
          /** false = 只能全屏打开（Godot 多线程导出需要跨源隔离） */
          embed: z.boolean().default(true),
          aspectRatio: z.string().default('16/9'),
          /** 默认 /play/<slug>/ */
          url: z.string().optional(),
        })
        .default({ type: 'none', embed: true, aspectRatio: '16/9' }),
    }),
});

// Steam 游戏库：由 scripts/sync-steam.mjs 生成，不要手改
const steam = defineCollection({
  loader: file('src/data/steam-library.json'),
  schema: z.object({
    id: z.string(),
    appid: z.number(),
    name: z.string(),
    cover: z.string(),
    coverFallback: z.string().optional(),
    playtimeMinutes: z.number(),
    lastPlayedAt: z.coerce.date().nullable(),
  }),
});

// 游戏库手动补充：src/content/library/<slug>.yaml
const library = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/library' }),
  schema: ({ image }) =>
    z
      .object({
        steamAppId: z.number().optional(),
        title: z.string().optional(),
        cover: image().optional(),
        platform: z.string().optional(),
        status: z.enum(['playing', 'completed', 'dropped', 'wishlist']),
        rating: z.number().min(1).max(10).optional(),
        comment: z.object({ zh: z.string(), en: z.string().optional() }).optional(),
        /** 长评文章 slug（不带语言前缀） */
        review: z.string().optional(),
        finishedAt: z.coerce.date().optional(),
        hidden: z.boolean().default(false),
      })
      .refine((d) => d.steamAppId !== undefined || (d.title && d.cover), {
        message: '非 Steam 游戏必须填写 title 和 cover',
      }),
});

export const collections = { blog, games, steam, library };
