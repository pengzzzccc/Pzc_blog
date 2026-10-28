// 各动态路由的 getStaticPaths，中英文页面共用
import { site } from '../data/site';
import type { Lang } from '../i18n/utils';
import { assertReferences, getPosts, getTags, getWorks, slugOf } from './content';

export async function postPaths(lang: Lang) {
  await assertReferences();
  return (await getPosts(lang)).map((post) => ({ params: { slug: slugOf(post) }, props: { post } }));
}

export async function blogPagePaths(lang: Lang) {
  const total = Math.ceil((await getPosts(lang)).length / site.postsPerPage);
  return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ params: { page: String(i + 2) } }));
}

export async function tagPaths(lang: Lang) {
  return [...(await getTags(lang)).keys()].map((tag) => ({ params: { tag } }));
}

export async function workPaths(lang: Lang) {
  return (await getWorks(lang)).map((work) => ({ params: { slug: slugOf(work) }, props: { work } }));
}
