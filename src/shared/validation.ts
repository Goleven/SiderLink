export type NormalizeErr = { ok: false; error: string }

export function normalizeUrl(
  input: string,
): { ok: true; url: string } | NormalizeErr {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'validation.urlRequired' }
  }

  let candidate = trimmed
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { ok: false, error: 'validation.urlInvalid' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'validation.urlScheme' }
  }

  return { ok: true, url: parsed.href }
}

export function normalizeTitle(title: string, fallback: string): string {
  const trimmed = title.trim()
  return trimmed || fallback
}

export function normalizeGroupName(
  name: string,
  otherNames: string[],
): { ok: true; name: string } | NormalizeErr {
  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, error: 'validation.groupNameEmpty' }
  }
  const lower = trimmed.toLowerCase()
  if (otherNames.some((n) => n.trim().toLowerCase() === lower)) {
    return { ok: false, error: 'validation.groupNameDuplicate' }
  }
  return { ok: true, name: trimmed }
}
