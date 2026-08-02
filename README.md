# Sider Link

Chromium（Chrome / Edge）**侧边栏链接管理**扩展：分组收藏、右键快捷添加、主题与多语言，并支持导入导出或通过 Git（GitHub / Gitee / GitLab）跨设备同步。

完整使用说明见 [使用教程](docs/使用教程.md)。

![侧栏主列表](docs/images/sidepanel-list.png)

## 功能概览

### 侧栏链接

- 按**分组**管理链接；默认分组可改名、不可删除
- 添加当前页 / 手动填写；编辑、删除（删除可撤销）；可维护图标（Logo）地址
- 左侧 **IndexBar**：按分组图标快速跳转；分隔线下方为搜索、设置与添加
- 侧栏内搜索：`/` 或 `⌘/Ctrl+K`，按标题与网址快速打开
- 打开方式：新标签 / 当前标签

### 右键菜单

页面右键 → **Sider Link**：

1. **切换侧栏** — 显示或隐藏侧边栏  
2. 分隔线  
3. **+ 分组名** — 将当前页快速加入对应分组（受限页如 `chrome://` 会系统通知提示）

![右键菜单](docs/images/context-menu.png)

### 设置

![设置页](docs/images/settings.png)

- **主题**：浅色 / 暗色 / 跟随系统；背景色预设  
- **语言**：简体中文 / 繁體中文 / English / 日本語  
- **快捷键**：默认 `⌥⇧L`（Mac）/ `Alt+Shift+L`（Windows），可在浏览器快捷键页修改  
- **分组**：拖拽排序、新建 / 编辑（含图标选择）

### 同步

设置 → **同步**：

| 模式 | 说明 |
| --- | --- |
| 关闭 | 仅本机 `chrome.storage.local` |
| 导入导出 | JSON 备份下载 / 上传（导入会覆盖本机数据） |
| Git | 私有仓库 + **Personal Access Token**；支持 GitHub / Gitee / GitLab |

Git 模式下：可设拉取频率为 **人工同步**（仅手动强制拉取/推送）、仅激活时，或 15 / 30 / 60 分钟；非人工模式下侧栏激活可拉取、本地变更防抖推送，并可一键 LWW 同步。冲突策略为整文件 **last-write-wins**（按 `meta.updatedAt`）。详见 [使用教程 · 同步](docs/使用教程.md#8-同步)。

> 令牌仅存本机同步配置，**不会**写入导出文件或远端 JSON。

## 环境要求

- Chrome / Edge 等支持 Manifest V3 + Side Panel 的 Chromium 浏览器  
- Node.js 与包管理器（推荐 [pnpm](https://pnpm.io)；也可用 npm）

## 开发

```bash
pnpm install   # 或 npm install
pnpm dev       # 或 npm run dev
```

开发模式下用 Vite + CRX 热更新；在浏览器中加载开发产物目录（见终端 / 插件提示，一般为 `dist`）。

## 构建与加载

```bash
pnpm test
pnpm build
```

1. 打开 Chrome/Edge → **扩展程序** → 开启**开发者模式**  
2. **加载已解压的扩展程序** → 选择本仓库的 `dist/`  
3. 点击工具栏 **Sider Link** 图标打开侧边栏；或使用快捷键 / 右键菜单「切换侧栏」

## 技术栈

- Vue 3 · Pinia · Vue I18n · Motion  
- Vite · `@crxjs/vite-plugin` · TypeScript · Vitest  

## 仓库结构（简要）

```text
src/
  background/          # Service Worker：侧栏切换、右键菜单、通知、同步闹钟
  sidepanel/           # 侧栏 UI
  shared/              # 领域逻辑、存储、i18n、Git 同步
icons/                 # 扩展图标
docs/                  # 使用教程、设计说明与截图
```

使用说明见 [`docs/使用教程.md`](docs/使用教程.md)。更细的设计说明见：

- [`docs/superpowers/specs/2026-07-24-favorites-sidepanel-design.md`](docs/superpowers/specs/2026-07-24-favorites-sidepanel-design.md)  
- [`docs/superpowers/specs/2026-07-31-git-sync-design.md`](docs/superpowers/specs/2026-07-31-git-sync-design.md)  

## AI 开发说明

本项目主要由 AI（Cursor Agent）辅助完成：需求梳理、设计文档、实现与测试均在 AI 协作下推进，人工负责方向确认与验收。

## 许可

[MIT](LICENSE) © 2026 Goleven
