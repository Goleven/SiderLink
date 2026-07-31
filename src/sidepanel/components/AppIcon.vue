<script setup lang="ts">
import { shallowRef, watch, type Component } from 'vue'
import {
  AlarmClock,
  Bell,
  Bike,
  BookOpen,
  Bookmark,
  Briefcase,
  Brush,
  Building2,
  Calendar,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  Clock,
  Cloud,
  Code,
  Coffee,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Dumbbell,
  Earth,
  FileText,
  Film,
  Flag,
  Flame,
  Folder,
  FolderOpen,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  Hash,
  Headphones,
  Heart,
  Home,
  Image,
  Inbox,
  Laptop,
  Leaf,
  Library,
  Lightbulb,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Monitor,
  MoreHorizontal,
  Music,
  Newspaper,
  Palette,
  Paperclip,
  PenLine,
  Pencil,
  Phone,
  Plane,
  Plus,
  Puzzle,
  Rocket,
  Search,
  Server,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Tag,
  Terminal,
  TreePine,
  Trophy,
  User,
  Users,
  Utensils,
  Video,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from '@lucide/vue'
import {
  FALLBACK_GROUP_ICON,
  isGroupIconId,
  resolveGroupIconId,
  type GroupIconId,
} from '@/shared/icons'
import { loadLucideCatalog } from '../icons/loadLucideCatalog'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 16,
    strokeWidth: 2,
  },
)

const UI_ICONS: Record<string, LucideIcon> = {
  settings: Settings,
  plus: Plus,
  'more-horizontal': MoreHorizontal,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  check: Check,
  search: Search,
  'circle-help': CircleHelp,
  earth: Earth,
}

const GROUP_ICONS: Record<GroupIconId, LucideIcon> = {
  star: Star,
  bookmark: Bookmark,
  heart: Heart,
  home: Home,
  folder: Folder,
  'folder-open': FolderOpen,
  briefcase: Briefcase,
  'building-2': Building2,
  'book-open': BookOpen,
  library: Library,
  'graduation-cap': GraduationCap,
  globe: Globe,
  'map-pin': MapPin,
  compass: Compass,
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  database: Database,
  cloud: Cloud,
  server: Server,
  wifi: Wifi,
  smartphone: Smartphone,
  monitor: Monitor,
  laptop: Laptop,
  mail: Mail,
  inbox: Inbox,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  phone: Phone,
  users: Users,
  user: User,
  music: Music,
  headphones: Headphones,
  image: Image,
  camera: Camera,
  video: Video,
  film: Film,
  'gamepad-2': Gamepad2,
  puzzle: Puzzle,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  wallet: Wallet,
  newspaper: Newspaper,
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  calendar: Calendar,
  clock: Clock,
  'alarm-clock': AlarmClock,
  bell: Bell,
  flag: Flag,
  tag: Tag,
  hash: Hash,
  link: Link,
  paperclip: Paperclip,
  search: Search,
  settings: Settings,
  wrench: Wrench,
  hammer: Hammer,
  pencil: Pencil,
  'pen-line': PenLine,
  palette: Palette,
  brush: Brush,
  lightbulb: Lightbulb,
  zap: Zap,
  flame: Flame,
  leaf: Leaf,
  'tree-pine': TreePine,
  coffee: Coffee,
  utensils: Utensils,
  plane: Plane,
  car: Car,
  bike: Bike,
  dumbbell: Dumbbell,
  trophy: Trophy,
  gift: Gift,
  rocket: Rocket,
}

function resolveSync(name: string): LucideIcon | null {
  if (UI_ICONS[name]) return UI_ICONS[name]
  if (isGroupIconId(name)) return GROUP_ICONS[name]
  const resolved = resolveGroupIconId(name)
  if (isGroupIconId(resolved)) return GROUP_ICONS[resolved]
  return null
}

const icon = shallowRef<Component>(GROUP_ICONS[FALLBACK_GROUP_ICON])
let loadToken = 0

watch(
  () => props.name,
  async (name) => {
    const token = ++loadToken
    const sync = resolveSync(name)
    if (sync) {
      icon.value = sync
      return
    }

    icon.value = GROUP_ICONS[FALLBACK_GROUP_ICON]
    const id = resolveGroupIconId(name)
    try {
      const catalog = await loadLucideCatalog()
      if (token !== loadToken) return
      icon.value = catalog.getIcon(id) ?? GROUP_ICONS[FALLBACK_GROUP_ICON]
    } catch {
      if (token !== loadToken) return
      icon.value = GROUP_ICONS[FALLBACK_GROUP_ICON]
    }
  },
  { immediate: true },
)
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
