import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '../base64'
import type { GitSyncProvider, RemoteFile } from './types'

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `token ${token}`,
  }
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

export const giteeProvider: GitSyncProvider = {
  id: 'gitee',

  async getDefaultBranch(auth, ref) {
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
      { headers: authHeaders(auth.accessToken) },
    )
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    if (!res.ok) throw new Error('sync.repoAccessFailed')
    const data = (await res.json()) as { default_branch?: string }
    return data.default_branch || 'master'
  },

  async getFile(auth, ref): Promise<RemoteFile | null> {
    const params = new URLSearchParams({ access_token: auth.accessToken })
    if (ref.branch) params.set('ref', ref.branch)
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodePath(ref.path)}?${params}`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.status === 404) return null
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    if (!res.ok) throw new Error('sync.pullFailed')
    const data = (await res.json()) as
      | {
          content?: string
          encoding?: string
          sha?: string
        }
      | unknown[]

    // Gitee returns [] (HTTP 200) when the path is missing or is an empty dir,
    // instead of GitHub-style 404.
    if (Array.isArray(data)) return null

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
      access_token: auth.accessToken,
      content: encodeUtf8ToBase64(content),
      message,
    }
    if (sha) body.sha = sha
    if (ref.branch) body.branch = ref.branch

    const method = sha ? 'PUT' : 'POST'
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodePath(ref.path)}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (res.status === 401 || res.status === 403) {
      throw new Error('sync.tokenInvalid')
    }
    if (res.status === 400 || res.status === 409) {
      throw new Error('sync.conflict')
    }
    if (!res.ok) throw new Error('sync.pushFailed')
  },
}
