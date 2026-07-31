import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, type AppLocale } from '@/shared/i18n/locales'
import { messages, type MessageSchema } from '@/shared/i18n/messages'

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages,
})

export function setAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
}
