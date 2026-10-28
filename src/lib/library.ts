import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import syncMeta from '../data/steam-sync-meta.json';
import type { Lang, Localized } from '../i18n/utils';
import { findPost } from './content';

export type LibraryStatus = 'playing' | 'completed' | 'dropped' | 'wishlist' | 'played';

export interface LibraryEntry {
  slug: string;
  title: string;
  /** Steam 封面是外链字符串，手动封面是本地图片 */
  cover: string | ImageMetadata;
  coverFallback?: string;
  platform: string;
  status: LibraryStatus;
  rating?: number;
  comment?: Localized;
  /** 长评文章 slug */
  review?: string;
  playtimeMinutes?: number;
  lastPlayedAt?: Date;
  finishedAt?: Date;
}

export const statusOrder: LibraryStatus[] = ['playing', 'completed', 'dropped', 'wishlist', 'played'];

const syncedAt = (syncMeta as { syncedAt: string | null }).syncedAt;
export const lastSyncedAt: Date | null = syncedAt ? new Date(syncedAt) : null;

/** Steam CDN 封面：竖版库封面，没有时退回横版 header（与 scripts/sync-steam.mjs 保持一致） */
export function steamCovers(appid: number) {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}`;
  return { cover: `${base}/library_600x900.jpg`, coverFallback: `${base}/header.jpg` };
}

/** 合并 Steam 数据与手动 YAML，规则见 docs/DESIGN.md §8.3 */
export async function getLibrary(): Promise<LibraryEntry[]> {
  const steam = await getCollection('steam');
  const manual = await getCollection('library');
  const steamById = new Map(steam.map((g) => [g.data.appid, g.data]));
  const now = Date.now();
  const playingWindow = site.library.playingWithinDays * 24 * 3600 * 1000;

  const entries: LibraryEntry[] = [];
  const claimed = new Set<number>();

  for (const item of manual) {
    const d = item.data;
    if (d.steamAppId !== undefined) claimed.add(d.steamAppId);
    if (d.hidden) continue;
    const s = d.steamAppId !== undefined ? steamById.get(d.steamAppId) : undefined;
    // 想玩但还没买的 Steam 游戏不在同步数据里，封面按 appid 拼 CDN 地址
    const cdn = d.steamAppId !== undefined ? steamCovers(d.steamAppId) : undefined;
    const title = d.title ?? s?.name;
    const cover = d.cover ?? s?.cover ?? cdn?.cover;
    if (!title || !cover) {
      throw new Error(`library/${item.id}: Steam 数据里没有 appid ${d.steamAppId}，请补充 title`);
    }
    entries.push({
      slug: item.id,
      title,
      cover,
      coverFallback: d.cover ? undefined : (s?.coverFallback ?? cdn?.coverFallback),
      platform: d.platform ?? (s ? 'Steam' : ''),
      status: d.status,
      rating: d.rating,
      comment: d.comment,
      review: d.review,
      playtimeMinutes: s?.playtimeMinutes,
      lastPlayedAt: s?.lastPlayedAt ?? undefined,
      finishedAt: d.finishedAt,
    });
  }

  for (const s of steam.map((g) => g.data)) {
    if (claimed.has(s.appid) || s.playtimeMinutes < site.library.minPlaytimeMinutes) continue;
    const recent = s.lastPlayedAt && now - s.lastPlayedAt.valueOf() <= playingWindow;
    entries.push({
      slug: `steam-${s.appid}`,
      title: s.name,
      cover: s.cover,
      coverFallback: s.coverFallback,
      platform: 'Steam',
      status: recent ? 'playing' : 'played',
      playtimeMinutes: s.playtimeMinutes,
      lastPlayedAt: s.lastPlayedAt ?? undefined,
    });
  }

  return entries.sort(byRating);
}

export function byRating(a: LibraryEntry, b: LibraryEntry): number {
  return (b.rating ?? 0) - (a.rating ?? 0) || recentTime(b) - recentTime(a) || a.title.localeCompare(b.title);
}

export function recentTime(e: LibraryEntry): number {
  return (e.lastPlayedAt ?? e.finishedAt)?.valueOf() ?? 0;
}

export function libraryStats(entries: LibraryEntry[]) {
  const rated = entries.filter((e) => e.rating !== undefined);
  return {
    total: entries.filter((e) => e.status !== 'wishlist').length,
    playing: entries.filter((e) => e.status === 'playing').length,
    completed: entries.filter((e) => e.status === 'completed').length,
    avg: rated.length ? rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length : null,
  };
}

/** 文章页反查：这篇文章是哪个游戏的长评 */
export async function findReviewedGame(postSlug: string): Promise<LibraryEntry | undefined> {
  return (await getLibrary()).find((e) => e.review === postSlug);
}

/** 长评链接：按当前语言找文章，缺翻译时链接到中文版 */
export async function reviewHref(entry: LibraryEntry, lang: Lang): Promise<string | undefined> {
  if (!entry.review) return undefined;
  const post = await findPost(entry.review, lang);
  if (!post) return undefined;
  return post.id.startsWith('en/') ? `/en/blog/${entry.review}/` : `/blog/${entry.review}/`;
}
