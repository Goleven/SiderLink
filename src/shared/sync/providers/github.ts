/**
 * GitHub Contents API adapter.
 * `RemoteFile.sha` is the blob sha required by PUT for updates;
 * 409 / 422 → `sync.conflict` for the engine's LWW retry path.
 */
import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '../base64'
import type { GitSyncProvider, RemoteFile } from './types'

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export const githubProvider: GitSyncProvider = {
  id: 'github',

  async getDefaultBranch(auth, ref) {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
      { headers: authHeaders(auth.accessToken) },
    )
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    if (!res.ok) throw new Error('sync.repoAccessFailed')
    const data = (await res.json()) as { default_branch?: string }
    return data.default_branch || 'main'
  },

  async getFile(auth, ref): Promise<RemoteFile | null> {
    const branch = ref.branch
      ? `?ref=${encodeURIComponent(ref.branch)}`
      : ''
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodePath(ref.path)}${branch}`,
      { headers: authHeaders(auth.accessToken) },
    )
    if (res.status === 404) return null
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    if (!res.ok) throw new Error('sync.pullFailed')
    const data = (await res.json()) as {
      content?: string
      encoding?: string
      sha?: string
    }
    if (typeof data.content !== 'string' || typeof data.sha !== 'string') {
      throw new Error('sync.pullFailed')
    }
    const content =
      data.encoding === 'base64'
        ? decodeBase64ToUtf8(data.content)
        : data.content
    return { content, sha: data.sha }
  },

  async putFile(auth, ref, content, sha, message) {
    const body: Record<string, unknown> = {
      message,
      content: encodeUtf8ToBase64(content),
    }
    if (sha) body.sha = sha
    if (ref.branch) body.branch = ref.branch

    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodePath(ref.path)}`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders(auth.accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    // 409 = sha mismatch; 422 = validation (often stale sha / missing sha).
    if (res.status === 409 || res.status === 422) {
      throw new Error('sync.conflict')
    }
    if (!res.ok) throw new Error('sync.pushFailed')
  },
}
