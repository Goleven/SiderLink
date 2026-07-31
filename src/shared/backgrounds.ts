export interface BackgroundPreset {
  id: string
  labelKey: string
  light: string
  dark: string
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'neutral', labelKey: 'bg.neutral', light: '#F2F2F7', dark: '#1C1C1E' },
  { id: 'warm', labelKey: 'bg.warm', light: '#F5F0EB', dark: '#2C2420' },
  { id: 'cool', labelKey: 'bg.cool', light: '#EEF1F5', dark: '#1C1F24' },
  { id: 'blue', labelKey: 'bg.blue', light: '#EAF2FF', dark: '#152033' },
  { id: 'green', labelKey: 'bg.green', light: '#EAF7EF', dark: '#14241A' },
]

export function getBackgroundColor(
  backgroundId: string,
  resolved: 'light' | 'dark',
): string {
  const preset =
    BACKGROUND_PRESETS.find((p) => p.id === backgroundId) ??
    BACKGROUND_PRESETS[0]
  return resolved === 'light' ? preset.light : preset.dark
}
