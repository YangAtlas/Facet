# Facet v0.1.0

一份内容，从研究笔记到演示分享。

Facet 是本地优先的研究写作桌面应用，支持分页编辑、科研卡片、公式、代码、图片、双栏与表格，并可将同一份内容导出为纸面 PDF、16:9 Beamer PDF 或 LaTeX 源码包。

## 下载

- Windows x64：`Facet-0.1.0-win-x64-setup.exe` 为安装版，可选择安装目录。
- Windows x64：`Facet-0.1.0-win-x64-portable.exe` 为便携版，可直接运行。
- Apple 芯片 Mac：选择文件名包含 `mac-arm64` 的 DMG 或 ZIP。
- Intel Mac：选择文件名包含 `mac-x64` 的 DMG 或 ZIP。

## 开始使用

新建文档，选择 A4 或 16:9 页面，在新段落输入 `/` 插入组件。使用 Ctrl+S（Windows）或 ⌘S（macOS）保存 `.facet` 文档；通过右上角「导出」生成交付文件。

完整操作图和使用说明见 [README](https://github.com/YangAtlas/Facet#readme)。

## 使用说明

本版本未进行 Apple Developer ID 签名、公证或 Windows 代码签名。macOS 如阻止打开，可在系统设置的「隐私与安全性」中查看「仍要打开」；Windows 如出现 SmartScreen 提示，请确认来自本仓库 Release 后选择「更多信息 → 仍要运行」。

PDF 导出使用应用内置能力；编译 LaTeX 源码包需要 XeLaTeX。便携版也会在本机保存偏好与恢复草稿。
