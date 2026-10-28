// 生成文章模板。
// 用法：pnpm new:post <slug> [标题] [--en] [--dir]
//   --en   生成英文版（src/content/blog/en/）
//   --dir  生成 <slug>/index.mdx，方便同目录放图片
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [slug, ...titleParts] = args.filter((a) => !a.startsWith('--'));

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('用法：pnpm new:post <slug> [标题] [--en] [--dir]\nslug 只能包含小写字母、数字和连字符，例如 my-first-post');
  process.exit(1);
}

const lang = flags.has('--en') ? 'en' : 'zh';
const file = flags.has('--dir')
  ? `src/content/blog/${lang}/${slug}/index.mdx`
  : `src/content/blog/${lang}/${slug}.mdx`;

if (existsSync(file)) {
  console.error(`已存在：${file}`);
  process.exit(1);
}

const title = titleParts.join(' ') || slug;
const today = new Date().toISOString().slice(0, 10);
const template = `---
title: ${JSON.stringify(title)}
description: ""
pubDate: ${today}
tags: []
# game: <作品 slug>   # 作为某个作品的开发日志时填写
draft: true
---

在这里开始写作。
`;

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, template);
console.log(`已创建 ${file}（draft: true，写完后改成 false）`);
