import type { GitProviderId } from '../../types'

export interface GitRepoRef {
  owner: string
  repo: string
  branch?: string
  path: string
}

export interface RemoteFile {
  content: string
  sha: string
}

export interface GitAuth {
  accessToken: string
}

export interface GitSyncProvider {
  id: GitProviderId
  getFile(auth: GitAuth, ref: GitRepoRef): Promise<RemoteFile | null>
  putFile(
    auth: GitAuth,
    ref: GitRepoRef,
    content: string,
    sha: string | null,
    message: string,
  ): Promise<void>
  getDefaultBranch?(
    auth: GitAuth,
    ref: Pick<GitRepoRef, 'owner' | 'repo'>,
  ): Promise<string>
}
