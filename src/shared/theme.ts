import type { ThemeMode } from './types'

export function resolveTheme(
  mode: ThemeMode,
  system: 'light' | 'dark',
): 'light' | 'dark' {
  if (mode === 'system') return system
  return mode
}
