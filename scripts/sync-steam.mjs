// 从 Steam 同步拥有的游戏，写入 src/data/steam-library.json。
// 支持两种模式：
//   1. Web API 模式（CI 或已配置 STEAM_API_KEY）：调用官方 IPlayerService/GetOwnedGames/v1/
//   2. 本地 Steam 客户端模式（无需 API Key）：自动读取本机 Steam userdata/<accountId>/config/localconfig.vdf 中的游玩记录，并通过 Steam 商店接口补全游戏名称
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const LIBRARY_FILE = 'src/data/steam-library.json';
const META_FILE = 'src/data/steam-sync-meta.json';
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
const DEFAULT_STEAM_ID = '76561199160274340';
const STEAM_ID64_BASE = 76561197960265728n;

// 排除非游戏的工具/运行库 AppID（如 Steamworks Common Redistributables、Wallpaper Engine、Proton 等）
const EXCLUDED_APPIDS = new Set([
  228980, // Steamworks Common Redistributables
  431960, // Wallpaper Engine
  250820, // SteamVR
]);

const STEAM_API_KEY = process.env.STEAM_API_KEY?.trim();
const rawSteamId = (process.env.STEAM_ID || DEFAULT_STEAM_ID).trim();

/** 解析 VDF 文本为嵌套对象 */
function parseVdf(text) {
  const tokens = [];
  const tokenRegex = /"((?:\\.|[^"\\])*)"|([{}])/g;
  let m;
  while ((m = tokenRegex.exec(text)) !== null) {
    if (m[2]) tokens.push({ type: 'brace', value: m[2] });
    else tokens.push({ type: 'str', value: m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') });
  }
  let i = 0;
  function readObj() {
    const obj = {};
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t.type === 'brace' && t.value === '}') return obj;
      if (t.type === 'str') {
        const key = t.value;
        const next = tokens[i++];
        if (!next) break;
        if (next.type === 'brace' && next.value === '{') {
          obj[key] = readObj();
        } else if (next.type === 'str') {
          obj[key] = next.value;
        }
      }
    }
    return obj;
  }
  return readObj();
}

/** 查找本机 Steam 安装路径 */
function findLocalSteamPath() {
  const candidates = ['d:/steam', 'c:/Program Files (x86)/Steam', 'c:/Program Files/Steam', 'e:/steam'];
  try {
    const out = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match) candidates.unshift(match[1].trim());
  } catch {}
  return candidates.find((p) => existsSync(join(p, 'userdata')));
}

/** 方式 A：通过官方 Steam Web API 拉取 */
async function fetchViaApi(steamId, apiKey) {
  const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
  url.search = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    include_appinfo: '1',
    include_played_free_games: '1',
    format: 'json',
  }).toString();

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Steam API 请求失败：HTTP ${res.status}`);
  }
  const games = (await res.json())?.response?.games;
  if (!Array.isArray(games)) {
    throw new Error('Steam API 没有返回游戏列表，请确认个人资料的「游戏详情」为公开');
  }
  return games
    .filter((g) => !EXCLUDED_APPIDS.has(Number(g.appid)))
    .map((g) => ({
      appid: Number(g.appid),
      name: g.name,
      playtimeMinutes: g.playtime_forever ?? 0,
      rtimeLastPlayed: g.rtime_last_played ?? 0,
    }));
}

/** 方式 B：免 API Key，直接从本机 Steam 客户端 localconfig.vdf 读取游玩记录并向 Steam Store 查询游戏名 */
async function fetchViaLocalSteam(steamId) {
  const steamPath = findLocalSteamPath();
  if (!steamPath) {
    throw new Error('未设置 STEAM_API_KEY，且未在本机检测到 Steam 客户端目录');
  }
  const accountId = String(BigInt(steamId) - STEAM_ID64_BASE);
  const vdfPath = join(steamPath, 'userdata', accountId, 'config', 'localconfig.vdf');
  if (!existsSync(vdfPath)) {
    throw new Error(`未找到本机 Steam 配置文件：${vdfPath}`);
  }

  console.log(`正在读取本机 Steam 数据：${vdfPath}`);
  const vdf = parseVdf(readFileSync(vdfPath, 'utf8'));
  const root = vdf.UserLocalConfigStore ?? vdf.userlocalconfigstore ?? {};
  const software = root.Software ?? root.software ?? {};
  const valve = software.Valve ?? software.valve ?? {};
  const steam = valve.Steam ?? valve.steam ?? {};
  const apps = steam.apps ?? steam.Apps ?? {};

  // 读取已有缓存名称，避免重复请求
  const existingNames = new Map();
  if (existsSync(LIBRARY_FILE)) {
    try {
      for (const item of JSON.parse(readFileSync(LIBRARY_FILE, 'utf8'))) {
        if (item.appid && item.name) existingNames.set(Number(item.appid), item.name);
      }
    } catch {}
  }

  const played = [];
  for (const [appidStr, info] of Object.entries(apps)) {
    if (!/^\d+$/.test(appidStr) || typeof info !== 'object' || !info) continue;
    const appid = Number(appidStr);
    if (EXCLUDED_APPIDS.has(appid)) continue;
    const playtimeMinutes = Number(info.Playtime ?? info.playtime ?? 0);
    const rtimeLastPlayed = Number(info.LastPlayed ?? info.lastplayed ?? 0);
    if (playtimeMinutes > 0) {
      played.push({ appid, playtimeMinutes, rtimeLastPlayed });
    }
  }

  console.log(`从本机 Steam 读取到 ${played.length} 款有游玩时长的记录，正在补全游戏名称...`);
  const results = [];
  for (const item of played) {
    let name = existingNames.get(item.appid);
    let isGame = true;
    if (!name) {
      try {
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${item.appid}&l=english`);
        if (res.ok) {
          const data = await res.json();
          const entry = data?.[String(item.appid)];
          if (entry?.success && entry?.data) {
            const type = entry.data.type;
            // 只保留游戏（过滤掉 dlc / tool / demo / application / music 等）
            if (type && type !== 'game') {
              isGame = false;
            } else {
              name = entry.data.name;
            }
          }
        }
      } catch {}
    }
    if (!isGame || !name) continue;
    results.push({
      appid: item.appid,
      name,
      playtimeMinutes: item.playtimeMinutes,
      rtimeLastPlayed: item.rtimeLastPlayed,
    });
  }
  return results;
}

const rawGames = STEAM_API_KEY
  ? await fetchViaApi(rawSteamId, STEAM_API_KEY)
  : await fetchViaLocalSteam(rawSteamId);

const library = rawGames
  .map((g) => ({
    id: String(g.appid),
    appid: g.appid,
    name: g.name,
    cover: `${CDN}/${g.appid}/library_600x900.jpg`,
    coverFallback: `${CDN}/${g.appid}/header.jpg`,
    playtimeMinutes: g.playtimeMinutes,
    lastPlayedAt: g.rtimeLastPlayed ? new Date(g.rtimeLastPlayed * 1000).toISOString() : null,
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
