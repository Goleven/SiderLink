/**
 * Side panel entry: Vue app + SW lifecycle messages + storage mirroring.
 *
 * Messages (see background/index.ts):
 * - notify `side-panel-opened` / `side-panel-closed` so toggle knows open state
 * - handle `close-side-panel` from SW when chrome.sidePanel.close is unavailable
 * - forward locale changes so context menus rebuild in the new language
 *
 * chrome.storage.onChanged keeps this panel in sync when the SW (context menu
 * add) or another window mutates STORAGE_KEY / SYNC_CONFIG_KEY.
 */
import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n, setAppLocale } from './i18n'
import { useFavoritesStore } from './stores/favorites'
import { isAppLocale } from '@/shared/i18n/locales'
import { STORAGE_KEY, SYNC_CONFIG_KEY } from '@/shared/storage/keys'
import { migrate } from '@/shared/storage/migrate'
import { parseSyncConfig } from '@/shared/storage/syncConfig'
import './styles/tokens.css'
import './styles/base.css'
import './styles/tour.css'

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'close-side-panel') {
    window.close()
  }
})

async function notifySidePanelLifecycle(
  type: 'side-panel-opened' | 'side-panel-closed',
) {
  try {
    const win = await chrome.windows.getCurrent()
    if (win.id == null) return
    await chrome.runtime.sendMessage({ type, windowId: win.id })
  } catch {
    /* SW may be asleep or window unavailable during teardown */
  }
}

void notifySidePanelLifecycle('side-panel-opened')

window.addEventListener('pagehide', () => {
  void notifySidePanelLifecycle('side-panel-closed')
})

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)

const store = useFavoritesStore(pinia)

watch(
  () => store.settings.locale,
  (locale) => {
    if (!isAppLocale(locale)) return
    setAppLocale(locale)
    void chrome.runtime
      .sendMessage({ type: 'locale-changed', locale })
      .catch(() => {})
  },
  { immediate: true },
)

// External writes (SW / other panels) → memory only; avoid write loops.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes[STORAGE_KEY]?.newValue != null) {
    const { root } = migrate(changes[STORAGE_KEY].newValue)
    store.applyRootLocal(root)
  }
  if (Object.prototype.hasOwnProperty.call(changes, SYNC_CONFIG_KEY)) {
    store.applySyncConfigLocal(
      parseSyncConfig(changes[SYNC_CONFIG_KEY]?.newValue),
    )
  }
})

app.mount('#app')
