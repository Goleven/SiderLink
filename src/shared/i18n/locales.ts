export type AppLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja'

export const APP_LOCALES: { id: AppLocale; labelKey: string }[] = [
  { id: 'zh-CN', labelKey: 'locale.zhCN' },
  { id: 'zh-TW', labelKey: 'locale.zhTW' },
  { id: 'en', labelKey: 'locale.en' },
  { id: 'ja', labelKey: 'locale.ja' },
]

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    value === 'zh-CN' ||
    value === 'zh-TW' ||
    value === 'en' ||
    value === 'ja'
  )
}
