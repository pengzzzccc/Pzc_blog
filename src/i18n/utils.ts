import { defaultLang, languages, ui, type Lang, type UiKey } from './ui';

export { defaultLang, languages, type Lang };

/** 取界面文案，支持 {n} 这类占位符 */
export function t(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  const text: string = ui[lang][key] ?? ui[defaultLang][key];
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** 为站内根相对路径加上 base 前缀（外链或已含前缀的路径保持不变） */
export function withBase(path: string): string {
  if (!path.startsWith('/') || !base) return path;
  if (path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path}`;
}

/** 去掉路径里的 base 前缀 */
export function stripBase(pathname: string): string {
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || '/';
  }
  return pathname;
}

/** 去掉路径里的 base 与语言前缀，得到与语言无关的路径 */
export function stripLang(pathname: string): string {
  const clean = stripBase(pathname);
  const stripped = clean.replace(/^\/en(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

/** 把与语言无关的路径转换成指定语言的路径（含 base 前缀） */
export function localizePath(path: string, lang: Lang): string {
  const clean = stripLang(path);
  const localized = lang === defaultLang ? clean : clean === '/' ? `/${lang}/` : `/${lang}${clean}`;
  return withBase(localized);
}

export function getLangFromUrl(url: URL): Lang {
  const clean = stripBase(url.pathname);
  return clean === '/en' || clean.startsWith('/en/') ? 'en' : 'zh';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}

export const htmlLang: Record<Lang, string> = { zh: 'zh-CN', en: 'en' };

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(htmlLang[lang], { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export function formatMonth(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(htmlLang[lang], { year: 'numeric', month: 'short' }).format(date);
}

/** 双语文本：缺英文时回落到中文 */
export type Localized = { zh: string; en?: string };
export function pick(text: Localized, lang: Lang): string {
  return (lang === 'en' && text.en) || text.zh;
}
