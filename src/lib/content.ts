import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLang, withBase, type Lang } from '../i18n/utils';

export type Post = CollectionEntry<'blog'>;
export type Work = CollectionEntry<'games'>;
export type Survey = CollectionEntry<'surveys'>;

/** 条目 id 形如 `zh/hello-world`，拆成语言和 slug */
export function splitId(id: string): { lang: Lang; slug: string } {
  const [lang, ...rest] = id.split('/');
  return { lang: lang === 'en' ? 'en' : 'zh', slug: rest.join('/') };
}

export const slugOf = (entry: { id: string }) => splitId(entry.id).slug;
export const langOf = (entry: { id: string }) => splitId(entry.id).lang;

// ---------- 博客 ----------

/** 某语言下的已发布文章，按发布时间倒序 */
export async function getPosts(lang: Lang): Promise<Post[]> {
  const posts = await getCollection(
    'blog',
    (p) => langOf(p) === lang && (import.meta.env.DEV || !p.data.draft),
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 按语言取文章，缺翻译时回落到默认语言 */
export async function findPost(slug: string, lang: Lang): Promise<Post | undefined> {
  const posts = await getCollection('blog', (p) => slugOf(p) === slug && (import.meta.env.DEV || !p.data.draft));
  return posts.find((p) => langOf(p) === lang) ?? posts.find((p) => langOf(p) === defaultLang);
}

export async function hasPost(slug: string, lang: Lang): Promise<boolean> {
  return (await getPosts(lang)).some((p) => slugOf(p) === slug);
}

export async function getTags(lang: Lang): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const post of await getPosts(lang)) {
    for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** 中文按字数、英文按词数估算阅读时长 */
export function readingMinutes(body: string | undefined, lang: Lang): number {
  const text = (body ?? '').replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '');
  const units = lang === 'zh' ? text.replace(/\s/g, '').length / 400 : text.split(/\s+/).length / 220;
  return Math.max(1, Math.round(units));
}

// ---------- 作品 ----------

export async function getWorks(lang: Lang): Promise<Work[]> {
  const works = await getCollection('games', (w) => langOf(w) === lang);
  return works.sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      a.data.order - b.data.order ||
      b.data.period.start.valueOf() - a.data.period.start.valueOf(),
  );
}

export async function findWork(slug: string, lang: Lang): Promise<Work | undefined> {
  const works = await getCollection('games', (w) => slugOf(w) === slug);
  return works.find((w) => langOf(w) === lang) ?? works.find((w) => langOf(w) === defaultLang);
}

/** 作品的开发日志：game 字段指向该作品的文章 */
export async function getDevlogs(workSlug: string, lang: Lang): Promise<Post[]> {
  return (await getPosts(lang)).filter((p) => p.data.game === workSlug);
}

export function playUrl(work: Work): string {
  return work.data.play.url ? withBase(work.data.play.url) : withBase(`/play/${slugOf(work)}/`);
}

// ---------- 调研 ----------

export async function getSurveys(): Promise<Survey[]> {
  const surveys = await getCollection('surveys');
  return surveys.sort(
    (a, b) => a.data.order - b.data.order || b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );
}

/** 构建时校验跨集合的 slug 引用，写错直接让构建失败 */
export async function assertReferences(): Promise<void> {
  const workSlugs = new Set((await getCollection('games')).map(slugOf));
  const postSlugs = new Set((await getCollection('blog')).map(slugOf));
  const errors: string[] = [];
  for (const post of await getCollection('blog')) {
    if (post.data.game && !workSlugs.has(post.data.game)) {
      errors.push(`blog/${post.id}: game "${post.data.game}" 不存在`);
    }
  }
  for (const item of await getCollection('library')) {
    if (item.data.review && !postSlugs.has(item.data.review)) {
      errors.push(`library/${item.id}: review "${item.data.review}" 不存在`);
    }
  }
  for (const survey of await getCollection('surveys')) {
    if (survey.data.relatedWork && !workSlugs.has(survey.data.relatedWork)) {
      errors.push(`surveys/${survey.id}: relatedWork "${survey.data.relatedWork}" 不存在`);
    }
  }
  if (errors.length) throw new Error(`内容引用错误：\n${errors.join('\n')}`);
}
