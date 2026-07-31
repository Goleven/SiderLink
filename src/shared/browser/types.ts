export function isRestrictedTabUrl(url: string | undefined): boolean {
  if (!url) return true
  return /^(chrome|edge|about|devtools|chrome-extension):/i.test(url)
}

export interface StorageAreaLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface ActiveTabInfo {
  title: string
  url: string
  favIconUrl?: string
}

export interface BrowserAdapter {
  storage: StorageAreaLike
  getActiveTab(): Promise<ActiveTabInfo | null>
  openUrl(url: string, opts: { newTab: boolean }): Promise<void>
}
