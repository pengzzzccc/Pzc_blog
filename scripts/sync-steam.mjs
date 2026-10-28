// 从 Steam Web API 拉取拥有的游戏，写入 src/data/steam-library.json。
// 用法：STEAM_API_KEY=xxx STEAM_ID=7656119xxxxxxxxxx node scripts/sync-steam.mjs
// 前提：Steam 个人资料隐私设置里「游戏详情」为公开。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LIBRARY_FILE = 'src/data/steam-library.json';
const META_FILE = 'src/data/steam-sync-meta.json';
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

const { STEAM_API_KEY, STEAM_ID } = process.env;
if (!STEAM_API_KEY || !STEAM_ID) {
  console.error('缺少环境变量 STEAM_API_KEY 或 STEAM_ID');
  process.exit(1);
}

const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
url.search = new URLSearchParams({
  key: STEAM_API_KEY,
  steamid: STEAM_ID,
  include_appinfo: '1',
  include_played_free_games: '1',
  format: 'json',
}).toString();

const res = await fetch(url);
if (!res.ok) {
  // 不打印 URL，避免把 API Key 写进日志
  console.error(`Steam API 请求失败：HTTP ${res.status}`);
  process.exit(1);
}
const games = (await res.json())?.response?.games;
if (!Array.isArray(games)) {
  console.error('Steam API 没有返回游戏列表，请确认个人资料的「游戏详情」为公开');
  process.exit(1);
}

const library = games
  .map((g) => ({
    id: String(g.appid),
    appid: g.appid,
    name: g.name,
    cover: `${CDN}/${g.appid}/library_600x900.jpg`,
    coverFallback: `${CDN}/${g.appid}/header.jpg`,
    playtimeMinutes: g.playtime_forever ?? 0,
    lastPlayedAt: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString() : null,
  }))
  .sort((a, b) => a.appid - b.appid);

const next = `${JSON.stringify(library, null, 2)}\n`;
const prev = existsSync(LIBRARY_FILE) ? readFileSync(LIBRARY_FILE, 'utf8') : '';
if (next === prev) {
  console.log(`没有变化（${library.length} 款游戏）`);
} else {
  writeFileSync(LIBRARY_FILE, next);
  // 只有数据变化时才更新同步时间，避免每天产生空提交
  writeFileSync(META_FILE, `${JSON.stringify({ syncedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`已更新 ${library.length} 款游戏`);
}
