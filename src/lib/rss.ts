import rss from '@astrojs/rss';
import { profile } from '../data/profile';
import { localizePath, pick, t, type Lang } from '../i18n/utils';
import { getPosts, slugOf } from './content';

export async function rssResponse(lang: Lang, site: URL | undefined) {
  const posts = await getPosts(lang);
  return rss({
    title: `${pick(profile.name, lang)} · ${t(lang, 'blog.title')}`,
    description: pick(profile.tagline, lang) || pick(profile.name, lang),
    site: site ?? 'https://example.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      categories: post.data.tags,
      link: localizePath(`/blog/${slugOf(post)}/`, lang),
    })),
    customData: `<language>${lang === 'zh' ? 'zh-CN' : 'en'}</language>`,
  });
}
