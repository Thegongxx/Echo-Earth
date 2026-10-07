import type { Mood, PublicEcho, MoodSuggestionProvider } from "../types";
export type Theme = {
  id: string;
  title: string;
  subtitle: string;
  label: string;
  moods: Mood[];
  tags: string[];
  color: string;
  sort: "night" | "recent";
  routeTitle: string;
  rule: string;
};
export const THEMES: Theme[] = [
  {
    id: "farewell",
    title: "毕业与告别",
    subtitle: "把没说完的话，留在夏天",
    label: "致那个夏天",
    moods: ["怀念", "期待"],
    tags: ["毕业", "校园", "告别"],
    color: "#b9a1d4",
    sort: "recent",
    routeTitle: "从告别，到下一次相遇",
    rule: "匹配怀念 / 期待，或毕业 / 校园 / 告别标签；按记忆日期从新到旧排列。",
  },
  {
    id: "midnight",
    title: "深夜想念",
    subtitle: "有人在世界的另一端，想你",
    label: "夜色里的信",
    moods: ["孤独", "怀念"],
    tags: ["深夜", "想念"],
    color: "#7da6c9",
    sort: "night",
    routeTitle: "沿着夜色，听见想念",
    rule: "匹配孤独 / 怀念，或深夜 / 想念标签；优先记忆当地时间 20:00–05:59，再按记忆日期排序。",
  },
  {
    id: "restart",
    title: "重新出发",
    subtitle: "下一站，也许就会有答案",
    label: "向前一点点",
    moods: ["期待", "兴奋", "治愈"],
    tags: ["旅行", "出发"],
    color: "#9fc8aa",
    sort: "recent",
    routeTitle: "带着期待，走向下一站",
    rule: "匹配期待 / 兴奋 / 治愈，或旅行 / 出发标签；按记忆日期从新到旧排列。",
  },
  {
    id: "rain",
    title: "雨天听歌",
    subtitle: "雨落下的时候，世界轻了一点",
    label: "雨声与旋律",
    moods: ["平静", "治愈"],
    tags: ["雨天", "雨"],
    color: "#d0b08a",
    sort: "recent",
    routeTitle: "跟着雨声，慢慢走",
    rule: "匹配平静 / 治愈，或雨天 / 雨标签；按记忆日期从新到旧排列。",
  },
];
export const matchesTheme = (p: PublicEcho, t: Theme) =>
  p.moods.some((m) => t.moods.includes(m)) ||
  p.tags.some((s) => t.tags.includes(s));
const night = (p: PublicEcho) => {
  const hour = Number(p.occurredAt.slice(11, 13));
  return hour >= 20 || hour < 6 ? 1 : 0;
};
export function themeRoute(posts: PublicEcho[], theme: Theme) {
  return posts
    .filter(
      (p) =>
        p.visibility === "public" &&
        p.status === "approved" &&
        matchesTheme(p, theme),
    )
    .sort(
      (a, b) =>
        (theme.sort === "night" ? night(b) - night(a) : 0) ||
        b.occurredAt.localeCompare(a.occurredAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}
export function matchReason(p: PublicEcho, t: Theme) {
  const moods = p.moods.filter((m) => t.moods.includes(m));
  const tags = p.tags.filter((m) => t.tags.includes(m));
  return [
    moods.length ? `共同心情：${moods.join("、")}` : "",
    tags.length ? `主题标签：${tags.join("、")}` : "",
    t.sort === "night" && night(p) ? "夜间记忆优先" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export const fixedMoodSuggestions: MoodSuggestionProvider = {
  async suggest(text) {
    const rules: [RegExp, Mood][] = [
      [/想念|回忆|毕业|曾经/, "怀念"],
      [/雨|安静|慢慢/, "平静"],
      [/明天|出发|未来/, "期待"],
      [/独自|一个人|深夜/, "孤独"],
      [/快乐|笑|开心/, "开心"],
    ];
    return rules
      .filter(([r]) => r.test(text))
      .map(([, m]) => m)
      .slice(0, 3);
  },
};
