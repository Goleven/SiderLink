import type { GitProviderId } from '../../types'
import { giteeProvider } from './gitee'
import { githubProvider } from './github'
import { gitlabProvider } from './gitlab'
import type { GitSyncProvider } from './types'

const providers = new Map<GitProviderId, GitSyncProvider>()

export function registerGitProvider(provider: GitSyncProvider): void {
  providers.set(provider.id, provider)
}

export function getGitProvider(id: GitProviderId): GitSyncProvider {
  const provider = providers.get(id)
  if (!provider) throw new Error('sync.providerMissing')
  return provider
}

export function listGitProviders(): GitSyncProvider[] {
  return [...providers.values()]
}

registerGitProvider(githubProvider)
registerGitProvider(giteeProvider)
registerGitProvider(gitlabProvider)
