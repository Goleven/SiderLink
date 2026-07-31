import { createChromiumAdapter } from './chromium'
import type { BrowserAdapter } from './types'

export type { BrowserAdapter, ActiveTabInfo, StorageAreaLike } from './types'
export { isRestrictedTabUrl } from './types'

export function getBrowser(): BrowserAdapter {
  return createChromiumAdapter()
}
