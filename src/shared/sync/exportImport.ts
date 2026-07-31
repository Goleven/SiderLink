import { migrate } from '../storage/migrate'
import type { StorageRoot } from '../types'

export function serializeRoot(root: StorageRoot): string {
  return `${JSON.stringify(root, null, 2)}\n`
}

export function parseRootJson(text: string): StorageRoot {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    throw new Error('sync.invalidJson')
  }
  const { root, backedUp } = migrate(raw)
  if (backedUp) {
    throw new Error('sync.invalidPayload')
  }
  return root
}

export function downloadRootJson(root: StorageRoot, filename?: string): void {
  const blob = new Blob([serializeRoot(root)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  a.href = url
  a.download = filename ?? `favorites-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('sync.invalidJson'))
    }
    reader.onerror = () => reject(new Error('sync.invalidJson'))
    reader.readAsText(file)
  })
}
