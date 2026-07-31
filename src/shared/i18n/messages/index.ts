import type { AppLocale } from '../locales'
import { DEFAULT_LOCALE } from '../locales'
import { en, type MessageSchema } from './en'
import { ja } from './ja'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'

export type { MessageSchema }
export { en, ja, zhCN, zhTW }

export const messages: Record<AppLocale, MessageSchema> = {
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

type DotPath<T, P extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: DotPath<
        T[K],
        P extends '' ? K : `${P}.${K}`
      >
    }[keyof T & string]
  : P

export type MessageKey = DotPath<MessageSchema>

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** Translate outside Vue (domain, background, tests). */
export function translate(
  locale: AppLocale,
  key: string,
  fallbackLocale: AppLocale = DEFAULT_LOCALE,
): string {
  return (
    getByPath(messages[locale], key) ??
    getByPath(messages[fallbackLocale], key) ??
    getByPath(messages.en, key) ??
    key
  )
}
