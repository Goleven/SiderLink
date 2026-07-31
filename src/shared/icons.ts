/** Curated Lucide icon ids for group icons (stored in Group.icon). */
export const GROUP_ICON_IDS = [
  'star',
  'bookmark',
  'heart',
  'home',
  'folder',
  'folder-open',
  'briefcase',
  'building-2',
  'book-open',
  'library',
  'graduation-cap',
  'globe',
  'map-pin',
  'compass',
  'code',
  'terminal',
  'cpu',
  'database',
  'cloud',
  'server',
  'wifi',
  'smartphone',
  'monitor',
  'laptop',
  'mail',
  'inbox',
  'message-circle',
  'messages-square',
  'phone',
  'users',
  'user',
  'music',
  'headphones',
  'image',
  'camera',
  'video',
  'film',
  'gamepad-2',
  'puzzle',
  'shopping-bag',
  'shopping-cart',
  'credit-card',
  'wallet',
  'newspaper',
  'file-text',
  'clipboard-list',
  'calendar',
  'clock',
  'alarm-clock',
  'bell',
  'flag',
  'tag',
  'hash',
  'link',
  'paperclip',
  'search',
  'settings',
  'wrench',
  'hammer',
  'pencil',
  'pen-line',
  'palette',
  'brush',
  'lightbulb',
  'zap',
  'flame',
  'leaf',
  'tree-pine',
  'coffee',
  'utensils',
  'plane',
  'car',
  'bike',
  'dumbbell',
  'trophy',
  'gift',
  'rocket',
] as const

export type GroupIconId = (typeof GROUP_ICON_IDS)[number]

export const DEFAULT_GROUP_ICON: GroupIconId = 'star'
export const FALLBACK_GROUP_ICON: GroupIconId = DEFAULT_GROUP_ICON

/** Optional Chinese / alias keywords for search. */
const ICON_KEYWORDS: Partial<Record<GroupIconId, string[]>> = {
  star: ['星星', '收藏', '常用'],
  bookmark: ['书签'],
  heart: ['心', '喜欢'],
  home: ['首页', '家'],
  folder: ['文件夹'],
  'folder-open': ['文件夹', '打开'],
  briefcase: ['工作', '公文包'],
  'building-2': ['公司', '建筑'],
  'book-open': ['书', '学习', '阅读'],
  library: ['图书馆', '资料'],
  'graduation-cap': ['学习', '毕业', '教育'],
  globe: ['网络', '全球', '网站'],
  'map-pin': ['地点', '地图'],
  compass: ['指南针', '探索'],
  code: ['代码', '开发'],
  terminal: ['终端', '命令行'],
  cpu: ['芯片', '硬件'],
  database: ['数据库'],
  cloud: ['云'],
  server: ['服务器'],
  wifi: ['无线', '网络'],
  smartphone: ['手机'],
  monitor: ['显示器', '电脑'],
  laptop: ['笔记本'],
  mail: ['邮件', '邮箱'],
  inbox: ['收件箱'],
  'message-circle': ['消息', '聊天'],
  'messages-square': ['对话', '消息'],
  phone: ['电话'],
  users: ['团队', '用户'],
  user: ['用户', '个人'],
  music: ['音乐'],
  headphones: ['耳机'],
  image: ['图片', '图像'],
  camera: ['相机', '拍照'],
  video: ['视频'],
  film: ['电影', '影片'],
  'gamepad-2': ['游戏'],
  puzzle: ['拼图'],
  'shopping-bag': ['购物', '袋子'],
  'shopping-cart': ['购物车'],
  'credit-card': ['信用卡', '支付'],
  wallet: ['钱包'],
  newspaper: ['新闻', '报纸'],
  'file-text': ['文档', '文件'],
  'clipboard-list': ['清单', '列表'],
  calendar: ['日历', '日程'],
  clock: ['时钟', '时间'],
  'alarm-clock': ['闹钟'],
  bell: ['通知', '铃铛'],
  flag: ['旗帜', '标记'],
  tag: ['标签'],
  hash: ['话题', '标签'],
  link: ['链接'],
  paperclip: ['附件'],
  search: ['搜索'],
  settings: ['设置'],
  wrench: ['工具', '扳手'],
  hammer: ['锤子', '工具'],
  pencil: ['铅笔', '编辑'],
  'pen-line': ['笔', '写作'],
  palette: ['调色板', '设计'],
  brush: ['画笔'],
  lightbulb: ['灵感', '想法'],
  zap: ['闪电', '能量'],
  flame: ['火焰', '热门'],
  leaf: ['叶子', '自然'],
  'tree-pine': ['树', '自然'],
  coffee: ['咖啡'],
  utensils: ['餐饮', '食物'],
  plane: ['飞机', '旅行'],
  car: ['汽车'],
  bike: ['自行车'],
  dumbbell: ['健身', '运动'],
  trophy: ['奖杯', '成就'],
  gift: ['礼物'],
  rocket: ['火箭', '启动'],
}

/** Map legacy emoji values from earlier builds. */
const LEGACY_EMOJI_TO_ID: Record<string, GroupIconId> = {
  '⭐': 'star',
  '📁': 'folder',
  '💼': 'briefcase',
  '📚': 'book-open',
  '🌐': 'globe',
  '❤️': 'heart',
  '🏠': 'home',
}

/** Kebab-case Lucide icon id (e.g. folder-open, grid-2x2). */
const LUCIDE_ICON_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isGroupIconId(value: string): value is GroupIconId {
  return (GROUP_ICON_IDS as readonly string[]).includes(value)
}

export function isLucideIconId(value: string): boolean {
  return LUCIDE_ICON_ID_RE.test(value)
}

/** Normalize stored group.icon to a Lucide kebab id. */
export function resolveGroupIconId(raw: string): string {
  const trimmed = raw.trim()
  if (LEGACY_EMOJI_TO_ID[trimmed]) return LEGACY_EMOJI_TO_ID[trimmed]
  if (isGroupIconId(trimmed) || isLucideIconId(trimmed)) return trimmed
  return FALLBACK_GROUP_ICON
}

/** Filter curated icons by id or Chinese/English keywords. */
export function filterGroupIconIds(query: string): GroupIconId[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...GROUP_ICON_IDS]
  return GROUP_ICON_IDS.filter((id) => {
    if (id.includes(q) || id.replace(/-/g, ' ').includes(q)) return true
    const keys = ICON_KEYWORDS[id] ?? []
    return keys.some((k) => k.toLowerCase().includes(q))
  })
}

/** Merge curated hits (incl. Chinese keywords) with full-catalog English id hits. */
export function mergeIconSearchResults(
  curatedHits: readonly string[],
  catalogHits: readonly string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of curatedHits) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of catalogHits) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
