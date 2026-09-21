# Facet

One source, many facets.

Facet 是一款本地优先的研究写作桌面应用。它把分页笔记、科研组件与演示导出放在同一个编辑空间中：正文可以按纸面 PDF 阅读，也可以按三级标题自动组织成 16:9 Beamer PDF。

## 主要功能

- A4 竖版与 16:9 横版分页编辑，支持封面、目录、页眉、页脚和主题色。
- Part、三级标题和文档大纲；每个 Part 独立成页。
- 提示框、科研卡片、公式、图片、子图、双栏、表格、待办、图标列表等组件。
- 所有组件均可通过 `/命令` 搜索并插入。
- CodeSnap 风格代码块，带语言选择、行号和语法高亮。
- 导出纸面 PDF、Beamer PDF 与 LaTeX 源码包。
- Beamer 按三级标题分帧，长内容自动生成“（续）”页面，页眉显示当前一级标题。
- `.facet` 本地文档保存与恢复，不依赖在线服务。

## 下载与安装

请前往 [Releases](https://github.com/YangAtlas/Facet/releases) 下载与电脑对应的安装包：

- Apple 芯片 Mac：`Facet-*-mac-arm64.dmg`
- Intel Mac：`Facet-*-mac-x64.dmg`

当前构建未使用 Apple Developer ID 签名。macOS 首次启动时，可在访达中右键应用并选择“打开”，再确认运行。

## 本地开发

需要 Node.js 20 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

启动桌面版：

```bash
pnpm desktop
```

运行检查：

```bash
pnpm test
pnpm test:e2e
pnpm build
```

## 打包

```bash
pnpm dist:mac
```

安装包生成在 `release/`。macOS 签名与公证需要有效的 Apple Developer ID 证书。

## 许可证

MIT
