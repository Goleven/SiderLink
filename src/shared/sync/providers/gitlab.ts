/**
 * GitLab Repository Files API adapter.
 *
 * Differs from GitHub Contents API:
 * - Path segments joined with `%2F` (single path param, not `/`)
 * - Optimistic concurrency uses `last_commit_id` (mapped to RemoteFile.sha),
 *   not blob sha
 * - Create = POST, update = PUT (same as Gitee)
 */
import { decodeBase64ToUtf8 } from '../base64'
import type { GitSyncProvider, RemoteFile } from './types'

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function projectPath(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`)
}

/** GitLab expects the file path as one URL segment with `/` → `%2F`. */
function encodeFilePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('%2F')
}

export const gitlabProvider: GitSyncProvider = {
  id: 'gitlab',

  async getDefaultBranch(auth, ref) {
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath(ref.owner, ref.repo)}`,
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
    const params = new URLSearchParams()
    if (ref.branch) params.set('ref', ref.branch)
    const qs = params.toString()
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath(ref.owner, ref.repo)}/repository/files/${encodeFilePath(ref.path)}${qs ? `?${qs}` : ''}`,
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
      blob_id?: string
      last_commit_id?: string
    }
    if (typeof data.content !== 'string') throw new Error('sync.pullFailed')
    const content =
      data.encoding === 'base64'
        ? decodeBase64ToUtf8(data.content)
        : data.content
    // Prefer last_commit_id for update concurrency; blob_id is a fallback.
    const sha = data.last_commit_id || data.blob_id || ''
    if (!sha) throw new Error('sync.pullFailed')
    return { content, sha }
  },

  async putFile(auth, ref, content, sha, message) {
    const branch = ref.branch || 'main'
    const body: Record<string, unknown> = {
      branch,
      content,
      commit_message: message,
      encoding: 'text',
    }
    // sha present → update existing file (PUT); else create (POST).
    if (sha) {
      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${projectPath(ref.owner, ref.repo)}/repository/files/${encodeFilePath(ref.path)}`,
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
      if (res.status === 400 || res.status === 409) {
        throw new Error('sync.conflict')
      }
      if (!res.ok) throw new Error('sync.pushFailed')
      return
    }

    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath(ref.owner, ref.repo)}/repository/files/${encodeFilePath(ref.path)}`,
      {
        method: 'POST',
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
    if (res.status === 400 || res.status === 409) {
      throw new Error('sync.conflict')
    }
    if (!res.ok) throw new Error('sync.pushFailed')
  },
}
