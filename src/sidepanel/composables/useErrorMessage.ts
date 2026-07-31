import { useI18n } from 'vue-i18n'

/** Translate domain/storage error keys; fall back to raw message. */
export function useErrorMessage() {
  const { t, te } = useI18n()
  return (err: unknown, fallbackKey: string) => {
    if (err instanceof Error && te(err.message)) {
      return t(err.message)
    }
    if (typeof err === 'string' && te(err)) {
      return t(err)
    }
    return t(fallbackKey)
  }
}
