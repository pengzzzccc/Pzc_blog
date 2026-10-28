/** 站点级配置 */
export const site = {
  /** 博客列表每页文章数 */
  postsPerPage: 10,
  library: {
    /** 没有手动记录的 Steam 游戏，游玩时长低于此值（分钟）不显示 */
    minPlaytimeMinutes: 120,
    /** 多少天内玩过的 Steam 游戏自动标为「在玩」 */
    playingWithinDays: 14,
  },
} as const;
