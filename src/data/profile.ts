import type { Localized } from '../i18n/utils';

/**
 * 个人资料：首页「个人介绍」的全部内容都来自这里，内容取自个人简历。
 * 留空的字段在生产环境不显示，本地开发时会显示「待填写」提示。
 * 头像替换 public/avatar.svg（或改 avatar 路径）；简历放到 public/resume.pdf 后把 resume 改成 '/resume.pdf'。
 */
export const profile = {
  name: { zh: '彭沾慈', en: 'Peng Zhanci' } as Localized,
  avatar: '/avatar.jpg',
  location: { zh: '悉尼', en: 'Sydney' } as Localized,
  /** 一句话定位 */
  tagline: {
    zh: '游戏策划（系统 / 玩法）· Gameplay 开发',
    en: 'Game Designer (Systems / Gameplay) · Gameplay Developer',
  } as Localized,
  /** 自我介绍，每项一段 */
  intro: [
    {
      zh: '擅长从核心循环出发进行玩法与系统设计，撰写逻辑自洽、条理清晰的游戏设计文档；关注规则推导、经济系统设计、关卡节奏控制、数值平衡与纸面原型推演。',
      en: 'I design gameplay and systems starting from the core loop, and write game design documents that are consistent and clearly structured. I focus on rule derivation, economy systems, level pacing, numerical balance and paper prototyping.',
    },
    {
      zh: '能用 Unity / C# 独立完成从概念到可玩 Demo 的快速原型，熟练运用有限状态机与事件驱动架构实现角色控制器和系统框架，熟悉 Git CI/CD 协作与各类 AI / Agent 开发工具。',
      en: 'With Unity / C#, I build rapid prototypes on my own, from concept to playable demo, using finite state machines and event-driven architecture for character controllers and system frameworks. I work with Git CI/CD and a range of AI / agent development tools.',
    },
  ] as Localized[],
  /** 技能与常用引擎 */
  skills: [
    { zh: 'Unity' },
    { zh: 'C#' },
    { zh: '核心玩法与系统设计', en: 'Core gameplay & systems design' },
    { zh: '经济系统与数值平衡', en: 'Economy systems & balancing' },
    { zh: '关卡节奏', en: 'Level pacing' },
    { zh: '纸面原型', en: 'Paper prototyping' },
    { zh: '有限状态机 / 事件驱动', en: 'FSM / event-driven architecture' },
    { zh: 'Git / CI/CD' },
    { zh: 'AI / Agent 工具', en: 'AI / agent tools' },
  ] as Localized[],
  /** 经历时间线，新的在前 */
  timeline: [
    {
      period: '2026.07 —',
      title: { zh: '《Bomb Slime》主策划', en: 'Lead designer, Bomb Slime' },
      desc: {
        zh: '2D 高速机动平台跳跃游戏，负责主程序与关卡设计。',
        en: 'A fast 2D platformer; also lead programmer and level designer.',
      },
    },
    {
      period: '2026.03 — 2026.06',
      title: { zh: '《Wolves of Wand Street》规则设计与游戏测试', en: 'Rules design & playtesting, Wolves of Wand Street' },
      desc: { zh: '3–4 人区域控制卡牌桌游。', en: 'An area-control card game for 3–4 players.' },
    },
    {
      period: '2023 —',
      title: {
        zh: '麦考瑞大学 · 信息技术学士（即将毕业）',
        en: 'Macquarie University · Bachelor of Information Technology (graduating soon)',
      },
      desc: {
        zh: '核心方向：游戏设计与开发、软件系统工程、计算机网络。',
        en: 'Focus: game design and development, software systems engineering, computer networks.',
      },
    },
  ] as { period: string; title: Localized; desc: Localized }[],
  resume: null as string | null,
  /** 社交链接，icon 可选 github / itch / steam / mail */
  links: [
    { label: 'GitHub', url: 'https://github.com/pengzzzccc', icon: 'github' },
    { label: 'itch.io', url: 'https://pengzzzccc.itch.io', icon: 'itch' },
    { label: 'Steam', url: 'https://steamcommunity.com/profiles/76561199160274340/', icon: 'steam' },
    { label: 'Email', url: 'mailto:pengzhanci2005@gmail.com', icon: 'mail' },
  ] as { label: string; url: string; icon: 'github' | 'itch' | 'steam' | 'mail' }[],
};
