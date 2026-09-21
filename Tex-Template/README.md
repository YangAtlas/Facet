# Guide：中文 LaTeX 手册模板

从 `phd-survival-guide-main/new-researcher-handbook.tex` 提取主题色、Font Awesome 图标、图标列表、提示框和代码样式，整理为一个可以随文档复制的 `guide.sty`。适合研究笔记、技术手册、课程材料、项目说明和组会记录。

## 1. 从这里开始

- **`main.tex`**：日常新文档的起点，修改标题和正文即可。
- **`main.pdf`**：起步模板的排版预览。
- **`showcase.tex` / `showcase.pdf`**：组件展示与命令手册；每种组件都有实际效果。
- **`guide.sty`**：全部样式与快捷命令。
- **`build.ps1`**：Windows 编译脚本。
- **`LICENSE`**：原项目 MIT 许可与作者版权声明。

新建文档时，把 `main.tex`、`guide.sty` 和 `LICENSE` 复制到新文件夹。可以把 `main.tex` 改名为 `notes.tex`。需要脚本编译时，一并复制 `build.ps1`。文件使用 UTF-8 编码。

### Windows 一键编译

在本文件夹打开 PowerShell：

```powershell
.\build.ps1
.\build.ps1 -File showcase.tex
```

PDF 输出到源文件旁边，中间文件和日志保存在 `.build/`。脚本优先使用 PATH 中的 Tectonic、XeLaTeX，并识别本机 Codex 附带的 Tectonic 路径。也可指定编译器：

```powershell
.\build.ps1 -File notes.tex -Compiler 'C:\texlive\2026\bin\windows\xelatex.exe'
```

在其他目录调用脚本时，`-File` 按当前工作目录解析，可以传入 `.tex` 文件的绝对路径。

### 直接编译 / Overleaf

选择 **XeLaTeX**，上传 `main.tex` 与 `guide.sty`，把 `main.tex` 设为主文件。中文字体使用 TeX 发行版附带的 Fandol。

```sh
xelatex main.tex
xelatex main.tex
```

第二遍用于更新目录和交叉引用。也可以用 Tectonic，一条命令会自动完成需要的多遍编译：

```sh
tectonic main.tex
```

需要的宏包包括 `ctex`、`fontawesome5`、`tcolorbox`、`listings`、`fancyhdr`、`enumitem`、`xcolor`、`hyperref`、`bookmark`、`booktabs`、`tabularx`、`geometry`、`graphicx`、`amsmath`、`amssymb` 和 `xparse`。Tectonic 首次编译可能联网下载宏包与字体。

## 2. 最小文档

```tex
\documentclass[11pt,a4paper,fontset=fandol]{ctexart}
\usepackage{guide}
\title{我的研究笔记}
\subtitle{问题、证据与下一步行动}
\author{你的名字}
\institute{课题组 / 单位}
\date{\today}
\guideheader{研究笔记}{项目名称}

\begin{document}
\maketitle
\iconsection{book}{研究背景}
正文可以直接写中文。\important{这一句是重点。}
\begin{tipbox}[核心想法]
用一个简洁的段落说明你的思路。
\end{tipbox}
\end{document}
```

`\subtitle`、`\institute`、`\guideheader` 均可省略。长文在 `\maketitle` 后加入 `\tableofcontents` 和 `\clearpage`。

## 3. Emoji / 图标

原文用的是 **Font Awesome 5 矢量图标**。本模板把它封装为 `\emoji` 和 `\icon`，两者用法相同。

```tex
\emoji{lightbulb}
\emoji[harvardcrimson]{heart}
\icon[emeraldgreen]{check-circle}
\iconsection{flask}{实验记录}
\iconsubsection{chart-line}{结果分析}
\iconsection*{rocket}{附记}
```

方括号是可选颜色；花括号是 Font Awesome 图标名称。带星号标题不编号，也不进入目录。

| 名称 | 含义 | 名称 | 含义 |
|---|---|---|---|
| `book` | 书籍 | `lightbulb` | 想法 |
| `rocket` | 行动 | `flask` | 实验 |
| `chart-line` | 结果 | `graduation-cap` | 学术 |
| `code` | 代码 | `terminal` | 终端 |
| `brain` | 思考 | `heart` | 关怀 |
| `users` | 合作 | `calendar-check` | 日程 |
| `check-circle` | 完成 | `exclamation-triangle` | 注意 |
| `cog` | 工具 | `star` | 重点 |
| `bullseye` | 目标 | `tasks` | 任务 |

也可以直接使用原文的 `\faBook`、`\faLightbulb`、`\faRocket` 等命令。完整名称见 TeX 发行版内的 `fontawesome5` 宏包手册，可用 `texdoc fontawesome5` 打开。

## 4. 文字着色与强调

| 命令 | 效果 |
|---|---|
| `\themecolor{关键词}` | 主题色文字 |
| `\important{重点}` | 深红粗体 |
| `\success{已完成}` | 深绿色文字 |
| `\muted{补充说明}` | 灰色文字 |
| `\textcolor{royalpurple}{文字}` | 指定颜色 |
| `\highlight{短语}` | 浅黄底纹 |
| `\highlight[blue!10]{短语}` | 指定底纹 |
| `\badge{进行中}` | 小型状态标签 |
| `\badge[emeraldgreen]{已完成}` | 指定颜色的标签 |

原作颜色均保留：

| 名称 | RGB | 用途示例 |
|---|---|---|
| `darkblue` | 0, 0, 139 | 主题、标题、链接 |
| `lightgray` | 240, 240, 240 | 浅色背景 |
| `harvardcrimson` | 165, 28, 48 | 重点 |
| `emeraldgreen` | 0, 155, 119 | 建议、完成状态 |
| `royalpurple` | 102, 51, 153 | 思考 |
| `goldenyellow` | 255, 193, 37 | 星标、底纹 |

全局换色只需在导言区写：

```tex
\guidetheme{royalpurple}
% 或定义自己的主题色
\definecolor{myblue}{HTML}{234E70}
\guidetheme{myblue}
```

语义颜色保持各自含义；主题色作用于标题、默认图标、链接、`\themecolor`、默认标签和信息框。

## 5. 提示框

```tex
\begin{tipbox}[一个有用的建议]
这里可以写多段文字、公式或列表。
\end{tipbox}
```

| 环境 | 默认标题 | 颜色 |
|---|---|---|
| `infobox` | 提示 | 主题色 |
| `tipbox` | 建议 | 绿色 |
| `warningbox` | 注意 | 橙色 |
| `importantbox` | 重点 | 深红色 |
| `reflectionbox` | 思考 | 紫色 |
| `highlightbox` | 无标题 | 浅黄色 |

前五种环境的 `[标题]` 可省略。通用框允许自定义颜色、图标和标题：

```tex
\begin{guidebox}[royalpurple]{brain}{我的观察}
写下你的观察与解释。
\end{guidebox}

\begin{highlightbox}
适合需要自动换行的重点段落。
\end{highlightbox}
```

## 6. 图标列表

```tex
\begin{itemize}
  \gooditem 已完成的工作。
  \baditem 待解决的问题。
  \toolitem 使用的工具。
  \ideaitem 新的思路。
  \warningitem 需要关注的事项。
  \staritem 核心结论。
  \arrowitem 下一步行动。
\end{itemize}
```

这些命令自带 `\item`，直接在 `itemize` 中使用。普通 `itemize` 和 `enumerate` 同样适用。

## 7. 代码、表格与公式

```tex
\begin{pythoncode}[caption={示例代码}]
def square(x):
    return x * x
\end{pythoncode}

\begin{bashcode}
tectonic main.tex
\end{bashcode}

\begin{texcode}
\textbf{Hello}
\end{texcode}

\codefile{analysis.py}
\codefile[bashstyle]{run.sh}
```

代码环境的可选参数透传给 `listings`。原作的 `pythonstyle`、`bashstyle` 名称可继续用于 `lstlisting`，模板另提供 `texstyle`。

三线表和自动换行列：

```tex
\begin{tabularx}{\linewidth}{lXr}
\toprule
阶段 & 内容 & 状态 \\
\midrule
准备 & 明确目标与数据范围 & 完成 \\
分析 & 记录方法和结果 & 进行中 \\
\bottomrule
\end{tabularx}
```

图片使用 `\includegraphics[width=\linewidth]{figure.pdf}`；公式可以直接使用 `equation`、`align` 等 `amsmath` 环境。

## 8. 科研色板

原文的九组颜色序列已提取为可复用命令，颜色顺序沿用源文档：

```tex
\palette{Blues}
\palette{Viridis}
\palette{Cividis}
\palette{RdBu}
\palette{PuOr}
\palette{BrBG}
\palette{Set1}
\palette{OkabeIto}
\palette{Dark2}
```

单色样与自定义色板：

```tex
\swatch{emeraldgreen}
\hexswatch{0072B2}
\definepalette{Project}{234E70,009E73,E69F00}
\palette{Project}
```

`\palette` 用于排版色板预览；绘图配色时可直接取用 `guide.sty` 中相应的 HEX 值。

## 9. 使用边界

- 本模板面向 `ctexart` / `article` 手册类文档，会设置页边距、标题和页眉页脚。投递论文时应遵循目标期刊或会议的类文件。
- 中文示例以 XeLaTeX / Tectonic 为编译入口；统一使用 Fandol 字体。纯英文文档可用 `article` 类，并为语义框提供英文标题。
- `\emoji{...}` 接收 Font Awesome 名称；直接输入的 Unicode 彩色 emoji 需要另行配置相应字体和渲染方案。
- `\highlight` 和 `\badge` 用于短语，其内容保持在一个行内盒子中；长段落使用 `highlightbox` 或提示框。
- 代码块示例使用英文代码与注释，中文说明放在正文或 caption。中文代码注释的宽度与断行需要额外的 CJK listings 配置。
- 提示框可跨页。普通浮动体应放在框外；超宽公式、不可断开的长字符串与过宽表格仍需按正文宽度调整。
- 页眉建议使用简短文字，避免左右内容相互覆盖。

## 10. 来源与许可

原项目：[Xiaolong Luo (Aaron) / phd-survival-guide](https://github.com/AaronLuo00/phd-survival-guide)。

样式依据本地 `new-researcher-handbook.tex`：原作六色、七种图标列表、Python/Bash 样式、九组科研色板，以及标题、页眉与提示框的视觉设计。模板封装了中文排版、快捷命令、自定义主题、可跨页提示框和编译脚本。

原项目采用 MIT 许可，完整版权与许可声明保存在 `LICENSE`。分发本模板或其主要派生文件时，请一并保留该声明。Font Awesome 的字形由安装的 `fontawesome5` 宏包提供，遵循其随附许可。


## 验证结果

已用本机 Tectonic 0.17.0 编译 `main.tex`（1 页）和 `showcase.tex`（6 页），并逐页检查渲染结果。中文书签、Font Awesome 图标、代码样式、九组色板、主题换色、外部代码文件与纯英文 `article` 入口验证通过；长提示框的两页连续排版 smoke test 通过。编译日志未发现缺字、未定义命令或盒子溢出。
