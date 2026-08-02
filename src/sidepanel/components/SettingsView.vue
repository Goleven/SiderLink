<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { animate } from 'motion'
import { BACKGROUND_PRESETS } from '@/shared/backgrounds'
import { sortGroups } from '@/shared/domain'
import { APP_LOCALES, type AppLocale } from '@/shared/i18n/locales'
import { resolveTheme } from '@/shared/theme'
import {
  downloadRootJson,
  parseRootJson,
  readFileAsText,
} from '@/shared/sync/exportImport'
import {
  MANUAL_PULL_INTERVAL,
  isManualPullInterval,
} from '@/shared/storage/syncConfig'
import {
  runForcePull,
  runForcePush,
  runSave,
  runSyncNow,
  runTest,
} from '@/shared/sync/scheduler'
import type {
  GitProviderId,
  PullIntervalMinutes,
  SyncMode,
  ThemeMode,
} from '@/shared/types'
import { getBrowser } from '@/shared/browser'
import { useFavoritesStore } from '../stores/favorites'
import { useDragReorder } from '../composables/useDragReorder'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useToast } from '../composables/useToast'
import AppIcon from './AppIcon.vue'
import AppSelect from './AppSelect.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  createGroup: []
  editGroup: [id: string]
}>()

const { t, te } = useI18n()
const store = useFavoritesStore()
const { show } = useToast()
const { reduced } = useReducedMotion()

const orderedGroups = computed(() => sortGroups(store.groups))
const { onGroupPointerDown } = useDragReorder({
  enabled: computed(() => props.open),
  onMoveBookmark: () => undefined,
  onReorderGroups: (ids) => store.reorderGroups(ids),
})

const mounted = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const openModeSegRef = ref<HTMLElement | null>(null)
const themeSegRef = ref<HTMLElement | null>(null)
const syncSegRef = ref<HTMLElement | null>(null)
const openModePillRef = ref<HTMLElement | null>(null)
const themePillRef = ref<HTMLElement | null>(null)
const syncPillRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showImportConfirm = ref(false)
const pendingImportRoot = ref<ReturnType<typeof parseRootJson> | null>(null)
const syncBusy = ref(false)
const showAdvanced = ref(false)
const patInput = ref('')
const toggleShortcutLabel = ref('')
const searchShortcutLabel = ref('')
const systemScheme = ref<'light' | 'dark'>(
  typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light',
)

const TOGGLE_COMMAND = 'toggle-side-panel'
const SEARCH_COMMAND = 'open-bookmark-search'

const resolvedTheme = computed(() =>
  resolveTheme(store.settings.themeMode, systemScheme.value),
)

const localeOptions = computed(() =>
  APP_LOCALES.map((locale) => ({
    value: locale.id,
    label: t(locale.labelKey),
  })),
)

const providerOptions = computed(() => [
  { value: 'github', label: 'GitHub' },
  { value: 'gitee', label: 'Gitee' },
  { value: 'gitlab', label: 'GitLab' },
])

const pullIntervalOptions = computed(() => [
  { value: String(MANUAL_PULL_INTERVAL), label: t('settings.syncPullManual') },
  { value: '0', label: t('settings.syncPullOnActivate') },
  { value: '15', label: t('settings.syncPull15') },
  { value: '30', label: t('settings.syncPull30') },
  { value: '60', label: t('settings.syncPull60') },
])

const isManualSync = computed(() =>
  isManualPullInterval(store.syncConfig.pullIntervalMinutes),
)

const syncModeIndex = computed(() => {
  const mode = store.syncConfig.mode
  if (mode === 'manual') return 1
  if (mode === 'git') return 2
  return 0
})

const repoInput = computed({
  get() {
    const { owner, repo } = store.syncConfig.git
    if (!owner && !repo) return ''
    return `${owner}/${repo}`
  },
  set(value: string) {
    const trimmed = value.trim()
    const slash = trimmed.indexOf('/')
    const owner = slash >= 0 ? trimmed.slice(0, slash).trim() : trimmed
    const repo = slash >= 0 ? trimmed.slice(slash + 1).trim() : ''
    void store.saveSyncConfig({
      ...store.syncConfig,
      git: { ...store.syncConfig.git, owner, repo },
    })
  },
})

const canTestOrSave = computed(() => {
  const { owner, repo, provider, accessToken } = store.syncConfig.git
  const hasToken = Boolean(patInput.value.trim() || accessToken)
  return (
    Boolean(provider) &&
    Boolean(owner.trim()) &&
    Boolean(repo.trim()) &&
    hasToken
  )
})

const PAT_HELP_URLS: Record<GitProviderId, string> = {
  github: 'https://github.com/settings/tokens',
  gitee: 'https://gitee.com/profile/personal_access_tokens',
  gitlab: 'https://gitlab.com/-/user_settings/personal_access_tokens',
}

async function openPatHelp() {
  const provider = store.syncConfig.git.provider ?? 'github'
  const url = PAT_HELP_URLS[provider]
  await getBrowser().openUrl(url, { newTab: true })
}

function labelForCommand(
  commands: chrome.commands.Command[],
  name: string,
): string {
  const cmd = commands.find((c) => c.name === name)
  const shortcut = cmd?.shortcut?.trim()
  return shortcut || t('settings.shortcutUnset')
}

async function refreshShortcut() {
  try {
    if (typeof chrome === 'undefined' || !chrome.commands?.getAll) {
      toggleShortcutLabel.value = t('settings.shortcutUnset')
      searchShortcutLabel.value = t('settings.shortcutUnset')
      return
    }
    const commands = await chrome.commands.getAll()
    toggleShortcutLabel.value = labelForCommand(commands, TOGGLE_COMMAND)
    searchShortcutLabel.value = labelForCommand(commands, SEARCH_COMMAND)
  } catch {
    toggleShortcutLabel.value = t('settings.shortcutUnset')
    searchShortcutLabel.value = t('settings.shortcutUnset')
  }
}

async function openShortcutSettings() {
  await getBrowser().openUrl('chrome://extensions/shortcuts', { newTab: true })
}

let mql: MediaQueryList | null = null
let enterCtrl: { stop: () => void } | null = null
let exitCtrl: { stop: () => void } | null = null
let segResizeObserver: ResizeObserver | null = null

function syncSystemScheme() {
  systemScheme.value = mql?.matches ? 'dark' : 'light'
}

function startSegResizeObserver() {
  stopSegResizeObserver()
  if (typeof ResizeObserver === 'undefined') return
  segResizeObserver = new ResizeObserver(() => {
    if (!mounted.value || !props.open) return
    syncPills(false)
  })
  for (const el of [
    openModeSegRef.value,
    themeSegRef.value,
    syncSegRef.value,
  ]) {
    if (el) segResizeObserver.observe(el)
  }
}

function stopSegResizeObserver() {
  segResizeObserver?.disconnect()
  segResizeObserver = null
}

onMounted(() => {
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  syncSystemScheme()
  mql.addEventListener('change', syncSystemScheme)
})

onUnmounted(() => {
  mql?.removeEventListener('change', syncSystemScheme)
  enterCtrl?.stop()
  exitCtrl?.stop()
  stopSegResizeObserver()
})

async function setTheme(mode: ThemeMode) {
  await store.patchSettings({ themeMode: mode })
}

async function setOpenInNewTab(value: boolean) {
  await store.patchSettings({ openInNewTab: value })
}

async function setBackground(id: string) {
  await store.patchSettings({ backgroundId: id })
}

async function setLocale(locale: AppLocale) {
  await store.patchSettings({ locale })
}

function formatSyncTime(ts?: number): string {
  if (!ts) return t('settings.syncNever')
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return t('settings.syncNever')
  }
}

function syncErrorText(key?: string): string {
  if (!key) return ''
  return te(key) ? t(key) : key
}

async function setSyncMode(mode: SyncMode) {
  const next = { ...store.syncConfig, mode }
  if (mode === 'git' && !next.git.provider) {
    next.git = { ...next.git, provider: 'github' }
  }
  await store.saveSyncConfig(next)
}

async function setProvider(value: string) {
  await store.saveSyncConfig({
    ...store.syncConfig,
    git: {
      ...store.syncConfig.git,
      provider: value as GitProviderId,
    },
  })
}

async function setPullInterval(value: string) {
  const n = Number(value) as PullIntervalMinutes
  await store.saveSyncConfig({
    ...store.syncConfig,
    pullIntervalMinutes: n,
  })
}

async function setFilePath(value: string) {
  await store.saveSyncConfig({
    ...store.syncConfig,
    git: {
      ...store.syncConfig.git,
      filePath: value.trim() || 'data/favorites.json',
    },
  })
}

async function setBranch(value: string) {
  await store.saveSyncConfig({
    ...store.syncConfig,
    git: { ...store.syncConfig.git, branch: value.trim() },
  })
}

function onExport() {
  if (!store.root) return
  downloadRootJson(store.root)
  show(t('sync.exported'))
}

function onImportClick() {
  fileInputRef.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await readFileAsText(file)
    pendingImportRoot.value = parseRootJson(text)
    showImportConfirm.value = true
  } catch (e) {
    const key = e instanceof Error ? e.message : 'sync.invalidJson'
    show(syncErrorText(key))
  }
}

async function confirmImport() {
  const root = pendingImportRoot.value
  showImportConfirm.value = false
  pendingImportRoot.value = null
  if (!root) return
  try {
    await store.replaceRoot(root)
    show(t('sync.imported'))
  } catch {
    show(t('storage.saveFailed'))
  }
}

function cancelImport() {
  showImportConfirm.value = false
  pendingImportRoot.value = null
}

async function onTest() {
  syncBusy.value = true
  try {
    const result = await runTest(patInput.value)
    if (result.ok) show(t('sync.testOk'))
    else show(syncErrorText(result.error))
  } finally {
    syncBusy.value = false
  }
}

async function onSave() {
  syncBusy.value = true
  try {
    const result = await runSave(patInput.value)
    if (result.ok) {
      patInput.value = ''
      show(t('sync.saved'))
    } else {
      show(syncErrorText(result.error))
    }
  } finally {
    syncBusy.value = false
  }
}

async function onSyncNow() {
  syncBusy.value = true
  try {
    const result = await runSyncNow()
    if (result.ok) show(t('sync.synced'))
    else show(syncErrorText(result.error))
  } finally {
    syncBusy.value = false
  }
}

async function onForcePull() {
  syncBusy.value = true
  try {
    const result = await runForcePull()
    if (result.ok) {
      show(
        result.action === 'pulled'
          ? t('sync.forcePulled')
          : t('sync.forcePullEmpty'),
      )
    } else {
      show(syncErrorText(result.error))
    }
  } finally {
    syncBusy.value = false
  }
}

async function onForcePush() {
  syncBusy.value = true
  try {
    const result = await runForcePush()
    if (result.ok) show(t('sync.forcePushed'))
    else show(syncErrorText(result.error))
  } finally {
    syncBusy.value = false
  }
}

function layoutPill(
  seg: HTMLElement | null,
  pill: HTMLElement | null,
  onIndex: number,
  animatePill: boolean,
) {
  if (!seg || !pill) return
  const buttons = [...seg.querySelectorAll<HTMLElement>('button.seg-btn')]
  const target = buttons[onIndex]
  if (!target) return

  const segBox = seg.getBoundingClientRect()
  const btnBox = target.getBoundingClientRect()
  const x = btnBox.left - segBox.left
  const y = btnBox.top - segBox.top
  const w = btnBox.width
  const h = btnBox.height

  if (reduced.value || !animatePill) {
    pill.style.width = `${w}px`
    pill.style.height = `${h}px`
    pill.style.transform = `translate(${x}px, ${y}px)`
    return
  }

  animate(
    pill,
    {
      width: `${w}px`,
      height: `${h}px`,
      transform: `translate(${x}px, ${y}px)`,
    },
    { type: 'spring', bounce: 0, duration: 0.32 },
  )
}

function syncOpenModePill(animatePill: boolean) {
  layoutPill(
    openModeSegRef.value,
    openModePillRef.value,
    store.settings.openInNewTab ? 1 : 0,
    animatePill,
  )
}

function syncThemePill(animatePill: boolean) {
  const themeIndex =
    store.settings.themeMode === 'light'
      ? 0
      : store.settings.themeMode === 'dark'
        ? 1
        : 2
  layoutPill(themeSegRef.value, themePillRef.value, themeIndex, animatePill)
}

function syncSyncPill(animatePill: boolean) {
  layoutPill(
    syncSegRef.value,
    syncPillRef.value,
    syncModeIndex.value,
    animatePill,
  )
}

function syncPills(animatePill: boolean) {
  syncOpenModePill(animatePill)
  syncThemePill(animatePill)
  syncSyncPill(animatePill)
}

watch(
  () => store.settings.openInNewTab,
  async () => {
    if (!mounted.value || !props.open) return
    await nextTick()
    syncOpenModePill(true)
  },
)

watch(
  () => store.settings.themeMode,
  async () => {
    if (!mounted.value || !props.open) return
    await nextTick()
    syncThemePill(true)
  },
)

watch(
  () => store.syncConfig.mode,
  async () => {
    if (!mounted.value || !props.open) return
    await nextTick()
    syncSyncPill(true)
  },
)

function settleEnterStyles(el: HTMLElement) {
  el.style.opacity = '1'
  el.style.transform = 'none'
  el.style.willChange = 'auto'
}

async function playEnter() {
  const el = panelRef.value
  if (!el) return
  enterCtrl?.stop()
  if (reduced.value) {
    settleEnterStyles(el)
    return
  }
  el.style.willChange = 'transform, opacity'
  el.style.opacity = '0'
  el.style.transform = 'translateX(18%)'
  enterCtrl = animate(
    el,
    { opacity: 1, transform: 'translateX(0%)' },
    { type: 'spring', bounce: 0, duration: 0.4 },
  )
  await enterCtrl
  settleEnterStyles(el)
}

async function playExit() {
  const el = panelRef.value
  if (!el) return
  enterCtrl?.stop()
  exitCtrl?.stop()
  if (reduced.value) {
    el.style.opacity = '0'
    el.style.transform = 'none'
    el.style.willChange = 'auto'
    return
  }
  el.style.willChange = 'transform, opacity'
  exitCtrl = animate(
    el,
    { opacity: 0, transform: 'translateX(12%)' },
    { type: 'spring', bounce: 0, duration: 0.32 },
  )
  await exitCtrl
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      mounted.value = true
      await nextTick()
      await playEnter()
      await nextTick()
      syncPills(false)
      startSegResizeObserver()
      void refreshShortcut()
    } else if (mounted.value) {
      stopSegResizeObserver()
      await playExit()
      mounted.value = false
    }
  },
)

async function onBack() {
  if (!props.open) return
  stopSegResizeObserver()
  await playExit()
  mounted.value = false
  emit('close')
}
</script>

<template>
  <div
    v-if="mounted"
    ref="panelRef"
    class="settings content-scroll"
    role="dialog"
    :aria-label="t('settings.title')"
  >
    <header class="top">
      <button
        type="button"
        class="back pressable"
        :aria-label="t('a11y.back')"
        @click="onBack"
      >
        <AppIcon name="chevron-left" :size="20" />
      </button>
      <h2>{{ t('settings.title') }}</h2>
      <span class="spacer" />
    </header>

    <section>
      <h3>{{ t('settings.openMode') }}</h3>
      <div ref="openModeSegRef" class="seg">
        <div ref="openModePillRef" class="seg-pill" aria-hidden="true" />
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: !store.settings.openInNewTab }"
          @click="setOpenInNewTab(false)"
        >
          {{ t('settings.currentTab') }}
        </button>
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.settings.openInNewTab }"
          @click="setOpenInNewTab(true)"
        >
          {{ t('settings.newTab') }}
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('settings.theme') }}</h3>
      <div ref="themeSegRef" class="seg">
        <div ref="themePillRef" class="seg-pill" aria-hidden="true" />
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.settings.themeMode === 'light' }"
          @click="setTheme('light')"
        >
          {{ t('settings.light') }}
        </button>
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.settings.themeMode === 'dark' }"
          @click="setTheme('dark')"
        >
          {{ t('settings.dark') }}
        </button>
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.settings.themeMode === 'system' }"
          @click="setTheme('system')"
        >
          {{ t('settings.system') }}
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('settings.background') }}</h3>
      <div class="swatches">
        <button
          v-for="p in BACKGROUND_PRESETS"
          :key="p.id"
          type="button"
          class="swatch pressable"
          :class="{ on: store.settings.backgroundId === p.id }"
          :title="t(p.labelKey)"
          :style="{
            background: resolvedTheme === 'dark' ? p.dark : p.light,
          }"
          @click="setBackground(p.id)"
        />
      </div>
    </section>

    <section>
      <h3>{{ t('settings.language') }}</h3>
      <AppSelect
        :model-value="store.settings.locale"
        :options="localeOptions"
        :aria-label="t('settings.language')"
        @update:model-value="setLocale($event as AppLocale)"
      />
    </section>

    <section>
      <h3>{{ t('settings.shortcut') }}</h3>
      <div class="shortcut-list">
        <div class="shortcut-row">
          <div class="shortcut-meta">
            <span class="shortcut-name">{{ t('settings.shortcutToggle') }}</span>
            <span class="shortcut-value">{{ toggleShortcutLabel }}</span>
          </div>
        </div>
        <div class="shortcut-row">
          <div class="shortcut-meta">
            <span class="shortcut-name">{{ t('settings.shortcutSearch') }}</span>
            <span class="shortcut-value">{{ searchShortcutLabel }}</span>
          </div>
        </div>
        <button
          type="button"
          class="sync-btn pressable shortcut-change"
          @click="openShortcutSettings"
        >
          {{ t('settings.shortcutChange') }}
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('settings.groups') }}</h3>
      <div class="group-list">
        <button
          v-for="g in orderedGroups"
          :key="g.id"
          type="button"
          class="group-row pressable"
          :data-settings-group-id="g.id"
          @pointerdown="onGroupPointerDown($event, g.id)"
          @click="emit('editGroup', g.id)"
        >
          <AppIcon :name="g.icon" :size="16" />
          <span class="group-name">{{ g.name }}</span>
          <AppIcon name="chevron-left" :size="14" class="chevron" />
        </button>
        <button
          type="button"
          class="group-row pressable"
          data-settings-group-create
          @click="emit('createGroup')"
        >
          <AppIcon name="plus" :size="16" />
          <span class="group-name">{{ t('group.new') }}</span>
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('settings.sync') }}</h3>
      <div ref="syncSegRef" class="seg">
        <div ref="syncPillRef" class="seg-pill" aria-hidden="true" />
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.syncConfig.mode === 'off' }"
          @click="setSyncMode('off')"
        >
          {{ t('settings.syncOff') }}
        </button>
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.syncConfig.mode === 'manual' }"
          @click="setSyncMode('manual')"
        >
          {{ t('settings.syncManual') }}
        </button>
        <button
          type="button"
          class="seg-btn pressable"
          :class="{ on: store.syncConfig.mode === 'git' }"
          @click="setSyncMode('git')"
        >
          {{ t('settings.syncGit') }}
        </button>
      </div>

      <div v-if="store.syncConfig.mode === 'manual'" class="sync-panel">
        <div class="sync-actions">
          <button type="button" class="sync-btn pressable" @click="onExport">
            {{ t('settings.syncExport') }}
          </button>
          <button type="button" class="sync-btn pressable" @click="onImportClick">
            {{ t('settings.syncImport') }}
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="application/json,.json"
          class="file-input"
          @change="onImportFile"
        />
      </div>

      <div v-else-if="store.syncConfig.mode === 'git'" class="sync-panel">
        <div class="field">
          {{ t('settings.syncProvider') }}
          <AppSelect
            :model-value="store.syncConfig.git.provider ?? 'github'"
            :options="providerOptions"
            :aria-label="t('settings.syncProvider')"
            @update:model-value="setProvider"
          />
        </div>

        <div class="field">
          {{ t('settings.syncRepo') }}
          <input
            v-model="repoInput"
            type="text"
            :placeholder="t('settings.syncRepoPlaceholder')"
            :aria-label="t('settings.syncRepo')"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div class="field">
          <div class="field-label">
            <span>{{ t('settings.syncToken') }}</span>
            <button
              type="button"
              class="field-help pressable"
              :aria-label="t('settings.syncTokenHelp')"
              @click="openPatHelp"
            >
              <AppIcon name="circle-help" :size="14" />
            </button>
          </div>
          <input
            v-model="patInput"
            type="password"
            :placeholder="t('settings.syncTokenPlaceholder')"
            :aria-label="t('settings.syncToken')"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div class="sync-actions">
          <button
            type="button"
            class="sync-btn pressable"
            :disabled="syncBusy || !canTestOrSave"
            @click="onTest"
          >
            {{ syncBusy ? t('settings.syncBusy') : t('settings.syncTest') }}
          </button>
          <button
            type="button"
            class="sync-btn primary pressable"
            :disabled="syncBusy || !canTestOrSave"
            @click="onSave"
          >
            {{ syncBusy ? t('settings.syncBusy') : t('settings.syncSave') }}
          </button>
          <button
            v-if="!isManualSync"
            type="button"
            class="sync-btn primary pressable"
            :disabled="syncBusy || !store.syncConfig.git.connected"
            @click="onSyncNow"
          >
            {{ syncBusy ? t('settings.syncBusy') : t('settings.syncNow') }}
          </button>
        </div>

        <p v-if="store.syncConfig.git.connected" class="sync-status ok">
          {{ t('settings.syncConnected') }}
        </p>

        <div class="field">
          {{ t('settings.syncPullInterval') }}
          <AppSelect
            :model-value="String(store.syncConfig.pullIntervalMinutes)"
            :options="pullIntervalOptions"
            :aria-label="t('settings.syncPullInterval')"
            @update:model-value="setPullInterval"
          />
        </div>

        <div v-if="isManualSync" class="sync-actions">
          <button
            type="button"
            class="sync-btn pressable"
            :disabled="syncBusy || !store.syncConfig.git.connected"
            @click="onForcePull"
          >
            {{ syncBusy ? t('settings.syncBusy') : t('settings.syncForcePull') }}
          </button>
          <button
            type="button"
            class="sync-btn primary pressable"
            :disabled="syncBusy || !store.syncConfig.git.connected"
            @click="onForcePush"
          >
            {{ syncBusy ? t('settings.syncBusy') : t('settings.syncForcePush') }}
          </button>
        </div>

        <button
          type="button"
          class="advanced-toggle pressable"
          @click="showAdvanced = !showAdvanced"
        >
          {{ t('settings.syncAdvanced') }}
        </button>

        <div v-if="showAdvanced" class="sync-advanced">
          <div class="field">
            {{ t('settings.syncFilePath') }}
            <input
              :value="store.syncConfig.git.filePath"
              type="text"
              :aria-label="t('settings.syncFilePath')"
              @change="setFilePath(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field">
            {{ t('settings.syncBranch') }}
            <input
              :value="store.syncConfig.git.branch"
              type="text"
              :placeholder="t('settings.syncBranchPlaceholder')"
              :aria-label="t('settings.syncBranch')"
              @change="setBranch(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <p class="sync-meta">
          {{ t('settings.syncLastPull') }}:
          {{ formatSyncTime(store.syncConfig.lastPullAt) }}
        </p>
        <p class="sync-meta">
          {{ t('settings.syncLastPush') }}:
          {{ formatSyncTime(store.syncConfig.lastPushAt) }}
        </p>
        <p v-if="store.syncConfig.lastError" class="sync-error">
          {{ syncErrorText(store.syncConfig.lastError) }}
        </p>
      </div>
    </section>

    <ConfirmDialog
      :open="showImportConfirm"
      :title="t('settings.syncImportConfirmTitle')"
      :message="t('settings.syncImportConfirmMessage')"
      :confirm-label="t('settings.syncImport')"
      :cancel-label="t('common.cancel')"
      danger
      @confirm="confirmImport"
      @cancel="cancelImport"
    />
  </div>
</template>

<style scoped>
.settings {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--app-bg);
  overflow: auto;
  padding-bottom: 24px;
  will-change: transform, opacity;
  transform-origin: right center;
}

.top {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 12px 14px;
  position: sticky;
  top: 0;
  z-index: 2;
  /* Heavier structural material: less see-through than global --header-bg */
  background: color-mix(in srgb, var(--app-bg) 88%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.top h2 {
  margin: 0;
  text-align: center;
  font-size: 17px;
  letter-spacing: -0.015em;
  font-weight: 650;
}

.back {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: var(--elevated);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 var(--hairline-bright);
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--text-primary);
}

.spacer {
  width: 36px;
}

section {
  padding: 16px 16px 0;
}

h3 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.sync-panel {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sync-actions {
  display: flex;
  gap: 8px;
}

.sync-btn {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  background: var(--row-bg);
  color: var(--text-primary);
}

.sync-btn.primary {
  background: var(--accent);
  color: #fff;
}

.sync-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shortcut-name {
  font-size: 13px;
  font-weight: 560;
  letter-spacing: -0.015em;
  color: var(--text-primary);
}

.shortcut-value {
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.shortcut-change {
  align-self: flex-start;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.field-help {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 999px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.field-help:hover {
  color: var(--accent);
}

.field input {
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--row-bg);
  color: var(--text-primary);
  font-size: 13px;
}

.file-input {
  display: none;
}

.advanced-toggle {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.sync-advanced {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sync-meta,
.sync-status,
.sync-error {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.sync-status.ok {
  color: var(--accent);
}

.sync-error {
  color: #ff3b30;
}

.seg {
  position: relative;
  display: flex;
  gap: 0;
  background: var(--seg-track);
  padding: 3px;
  border-radius: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}

.seg-pill {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  border-radius: 10px;
  background: var(--seg-pill);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 3px 10px rgba(0, 0, 0, 0.14),
    inset 0 1px 0 var(--hairline-bright);
  pointer-events: none;
  z-index: 0;
}

.seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 9px 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 560;
  color: var(--text-secondary);
}

.seg-btn.on {
  color: var(--text-primary);
  font-weight: 650;
}

/* pressable scale should not fight the sliding pill */
.seg-btn.pressable:active {
  transform: none;
  opacity: 0.72;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.swatch {
  aspect-ratio: 1;
  border-radius: 12px;
  border: 2px solid color-mix(in srgb, var(--hairline) 85%, transparent);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--hairline-bright) 55%, transparent),
    0 1px 3px rgba(0, 0, 0, 0.18);
}

.swatch.on {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent-soft),
    inset 0 1px 0 color-mix(in srgb, var(--hairline-bright) 55%, transparent),
    0 1px 3px rgba(0, 0, 0, 0.18);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: var(--row-bg);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--hairline-bright) 35%, transparent);
}

.group-row:active,
.group-row.pressable:active {
  transform: scale(0.985);
}

.group-row.dragging {
  z-index: 20;
  transition: none;
  box-shadow: var(--shadow-float);
  cursor: grabbing;
  touch-action: none;
}

.group-row.dragging:active,
.group-row.dragging.pressable:active {
  transform: none;
}

.group-name {
  flex: 1;
  min-width: 0;
}

.chevron {
  transform: rotate(180deg);
  color: var(--text-secondary);
}

@media (prefers-reduced-transparency: reduce) {
  .top {
    background: var(--app-bg);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

/* Dark: stronger material separation over tinted backgrounds */
:global([data-theme='dark']) .seg {
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

:global([data-theme='dark']) .seg-pill {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.45),
    0 4px 14px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

:global([data-theme='dark']) .seg-btn {
  color: rgba(235, 235, 245, 0.55);
}

:global([data-theme='dark']) .seg-btn.on {
  color: #ffffff;
}

:global([data-theme='dark']) .group-row,
:global([data-theme='dark']) .back {
  background: color-mix(in srgb, var(--elevated) 88%, #000 12%);
}

@media (prefers-contrast: more) {
  .seg {
    box-shadow: inset 0 0 0 1px var(--hairline);
  }

  .seg-pill {
    outline: 1px solid var(--hairline);
  }

  .group-row,
  .back {
    box-shadow: inset 0 0 0 1px var(--hairline);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings {
    will-change: auto;
  }
}
</style>
