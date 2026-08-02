import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Sider Link',
  description: 'Side panel link manager',
  version: '0.1.0',
  action: {
    default_title: 'Sider Link',
    default_icon: {
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '128': 'icons/icon128.png',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'windows',
    'contextMenus',
    'alarms',
    'notifications',
  ],
  host_permissions: [
    'https://github.com/*',
    'https://api.github.com/*',
    'https://gitee.com/*',
    'https://gitlab.com/*',
  ],
  commands: {
    'toggle-side-panel': {
      suggested_key: {
        default: 'Alt+Shift+L',
        mac: 'Alt+Shift+L',
      },
      description: '切换侧边栏',
    },
    'open-bookmark-search': {
      suggested_key: {
        default: 'Alt+Shift+K',
        mac: 'Alt+Shift+K',
      },
      description: '快捷搜索',
    },
  },
})
