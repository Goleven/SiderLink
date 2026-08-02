import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setAppLocale } from '../sidepanel/i18n'
import { isAppLocale } from '@/shared/i18n/locales'
import { STORAGE_KEY } from '@/shared/storage/keys'
import { migrate } from '@/shared/storage/migrate'
import '../sidepanel/styles/tokens.css'
import '../sidepanel/styles/base.css'
import './popup.css'

/** Keep SW informed so it clears action.setPopup when this popup closes. */
const searchPort = chrome.runtime.connect({ name: 'search-popup' })
searchPort.onMessage.addListener((message) => {
  if (message?.type === 'close-search') window.close()
})

const app = createApp(App)
app.use(i18n)

async function syncLocaleFromStorage() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY)
    const { root } = migrate(data[STORAGE_KEY])
    const locale = root.settings.locale
    if (isAppLocale(locale)) setAppLocale(locale)
  } catch {
    /* keep default */
  }
}

void syncLocaleFromStorage()

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || changes[STORAGE_KEY]?.newValue == null) return
  const { root } = migrate(changes[STORAGE_KEY].newValue)
  if (isAppLocale(root.settings.locale)) setAppLocale(root.settings.locale)
})

app.mount('#app')
