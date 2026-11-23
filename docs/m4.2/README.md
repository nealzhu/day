# M4.2 · 骞言碎语视觉验收

开发分支 `feat/m4-2-visual-system` 从 M4.1 的 `0ccb839` 建立。正式内容集有两篇已发布文章及一张 WebP。以下标明「样稿」的截图来自临时构建，它保留这两篇文章，并加入 M4.1 的技术稿、生活图文、长篇随笔以及三篇 M4.2 校样。

## 阅读界面修订

首页和分类页直接从年份、篇数和第一篇文章开始。站点字标和当前分类导航交代读者所在位置，一级标题仍可由读屏软件读取。右上角的阅读设置可选列表或图文、随系统或浅深主题，以及完整或迷你文章大纲。三项偏好均跨页面保存。列表图标取三行长短不同的行文，图文图标取图与题注的上下关系，旁边保留可读标签。[分类页](screenshots/category-1440-light.png) · [手机设置](screenshots/settings-390-light.png)

字标只保留「骞言碎语」。页首基线标出站点导航的结束位置。跨年时用浅线分组，同一年内，文本列表在发布日期变化时沿篇目列画线，同日文章靠留白分开。页脚列出当年版权、站名、作者的 GitHub 个人主页、分类索引与 RSS。

文章标题在列表、卡片和详情页均自然换行。详情页以一行小字排出日期、可选分类和标签。有标签时，用一个线描标签图标引出整组词，字号和墨色与日期一致。题名在下一行，与正文左边缘对齐。篇首末尾的一道细线标出正文阅读区的起点。摘要用于篇目列表、图文卡片、RSS 和网页元描述，进入文章后由作者的首段开篇。

完整目录跟踪 H2 至 H6，以文字颜色和下划线提示当前章节。桌面迷你大纲与「全部文章」共用顶边和吸顶位置。刻度统一为 2px 粗，右端对齐。阅读时全部等长。鼠标进入大纲、键盘聚焦节点或触屏预览章名时，整列按 H2 至 H6 从长到短排列。桌面和触屏的节点中心间距均为 10px。当前章在浅色纸上用暗朱红，在深色纸上用浅杏色。悬停或键盘聚焦可预览完整章名，点击或按 Enter 跳到该章。短表格填满正文宽度，超宽表格保留列宽，在可键盘聚焦的容器里横向浏览。表格、代码、目录和页面滚动条均采用细滑块与透明轨道。

桌面完整目录按当前位置的剩余视口高度排版。打开含 26 节的《一册旧书的身世》，在页首单独滚动目录即可看到最后一节「合上书以后」。页头滚出后，目录吸顶并随可用高度伸展。[正文停在页首、目录滚到末项的实测截图](screenshots/full-outline-end-1024-dark.png)

## 交互动效

| 交互 | 动效与取舍 |
| --- | --- |
| 迷你大纲 | 刻度在 150ms 内从固定右端伸缩，节点位置和点击区域恒定。当前章节的颜色在 100ms 内交接。章名提示首次出现时淡入，连续扫过相邻节点时就地换字。 |
| 阅读设置 | 面板从按钮下方 3px 的距离进入，150ms 显现，100ms 收起。关闭时立即释放指针交互，键盘继续使用原生弹层的焦点逻辑。 |
| 首页和分类篇目 | 指向标题或用键盘聚焦时，标题与下划线在 100ms 内显色。手动切入图文视图时，封面用 150ms 淡入。刷新恢复视图时直接显示存好的版式。 |
| 正文和主题 | 章节跳转、正文滚动和整站换色即时生效，便于直接定位和连续阅读。所有新增过渡和动画仅在系统允许动态效果时启用。 |

## 新增预览样稿

运行本页的本地预览命令后，可直接打开以下文章。样稿与两张复用的 CC0 照片仅进入临时预览工程。

| 文章 | 验证内容 |
| --- | --- |
| [一册旧书的身世](http://127.0.0.1:4632/posts/lab-depth/) | H2 至 H6 共 26 个节点，含同名章节、长标题、相邻标题和页尾短节。[桌面静置](screenshots/depth-1440-light.png) · [同一位置悬停](screenshots/depth-hover-1440-light.png) · [手机深色](screenshots/depth-390-dark.png) |
| [把一周的阅读记成一张表](http://127.0.0.1:4632/posts/lab-code/) | JSON、Python、Bash、SQL、TypeScript、HTML、CSS 与 YAML 八种代码块，含单行长代码。[手机代码](screenshots/code-375-dark.png) |
| [校一页手稿：Markdown 排印样张](http://127.0.0.1:4632/posts/lab-markdown/) | 两种标题语法、段落与换行、强调、嵌套引文与列表、代码、链接、图片、HTML、转义、字符引用与分隔线；另含表格、任务列表、删除线和脚注。[表格与代码](screenshots/markdown-1024-light.png) |

语法样张按块级和行内结构编写，扩展语法另行核对。[CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) · [GitHub Flavored Markdown](https://github.github.com/gfm/)

迷你刻度的当前色与普通色在浅色主题为 `#650E08` 和 `#B6B6B0`，在深色主题为 `#FFDAB5` 和 `#6C6F63`。两色之间的相对亮度对比度分别为 6.36∶1 与 3.90∶1。静置时统一线长 12px。查看层级时，桌面从 32px 逐级减至 12px，单栏布局从 20px 减至 8px。390px 触屏下，26 节大纲共占 260px 高度，正文实宽为 350px。

## 截图与实测

| 阅读场景 | 桌面或平板 | 手机 |
| --- | --- | --- |
| 首页篇目 | [正式内容 · 1440 浅色](screenshots/published-1440-light.png) · [含样稿 · 1440 浅色](screenshots/list-1440-light.png) | [390 浅色](screenshots/list-390-light.png) |
| 首图与默认占位图 | [1440 浅色](screenshots/cards-1440-light.png) · [1024 深色](screenshots/cards-1024-dark.png) | [375 深色](screenshots/cards-375-dark.png) |
| 技术长标题与目录 | [1440 三栏](screenshots/tech-1440-light.png) · [1024 双栏](screenshots/tech-1024-light.png) · [768 单栏](screenshots/tech-768-dark.png) | [390 首屏](screenshots/tech-390-light.png) · [375 代码与表格](screenshots/tech-375-dark.png) |
| 正式文章的日期、分类与标签 | [1440 浅色](screenshots/intro-1440-light.png) | [390 深色](screenshots/intro-390-dark.png) |
| 章节定位 | [1440 当前章节与全宽表格](screenshots/chapter-1440-light.png) · [悬停节点](screenshots/mini-1440-light.png) | [390 横向目录](screenshots/chapter-390-light.png) · [轻点预览章名](screenshots/mini-390-light.png) |
| 连续阅读与图注 | [长篇随笔 · 1440 深色](screenshots/essay-1440-dark.png) | [生活图文 · 390 深色](screenshots/life-390-dark.png) |

ego-lite 在五种宽度上分别以系统浅色、深色和减少动态效果设置打开标题列表、图文卡片及六类文章。80 组记录的整页横向溢出均为 0。375px 技术稿的长命令在 335px 正文内有 834px 的横向滚动空间。CDP 报告正文首段实际使用 LXGWWenKai-Regular，代码使用本机 Menlo-Regular。摄影沿用 M4.1 的 CC0 样图，署名随图注显示。[逐组数据](matrix.json) · [样图来源与许可](../m4.1/README.md)

| 视口宽度 | 正文实宽 | 左侧文章导航 | 含 H2 至 H6 标题时的完整目录 |
| --- | --- | --- | --- |
| 1440px | 700px | 常驻左栏 | 常驻右栏 |
| 1024px | 700px | 正文末尾 | 常驻右栏 |
| 768px | 700px | 正文末尾 | 顶部横向章节栏 |
| 390px / 375px | 350px / 335px | 正文末尾 | 顶部横向章节栏 |

390px 技术稿的六个目录项最初纵向占据约三分之一屏。改为横向章节栏后，首屏可开始阅读正文；滚动时当前章节自动移入可见范围。手机切入迷你模式后，刻度贴右侧页边排列，正文保持原宽。轻点一次预览章名，再点同一刻度跳转，点正文可关闭提示。桌面技术稿实测短表格和正文同为 700px。

## 排版与设计取舍

| 项目 | 采用值 |
| --- | --- |
| 正文 | 霞鹜文楷 Regular v1.530；桌面 18px、小屏 17px；行高 1.85 |
| 正文 H1 / H2 / H3 | 桌面 36 / 27 / 22px，小屏 29 / 24 / 20px；行高 1.4 |
| 色彩语义 | 纸 / 墨 / 次级 / 强调；浅色 `#FAF8F3 / #292923 / #615E53 / #82503C`；深色 `#20211E / #E8E3D7 / #B6B3A6 / #E2AC91` |
| 分隔与底色 | 浅色线条 / 嵌入底色 `#CFC9B9 / #F0EDE5`；深色 `#5E5E52 / #2B2D28`；1px 分隔线、3px 圆角、2px 键盘焦点轮廓 |
| 尺度 | 外框 1160px、篇目索引 1000px、正文 700px；外侧至少 20px |
| 间距 | 8 / 16 / 24 / 32px 组件间距；段间 0.95em、章节前 2.1 倍正文字号、块元素间 1.35 倍 |
| 响应式 | 600px 及以下切手机字号，960px 起显示右栏，1180px 起显示双侧栏 |

正文延用 M4.1 的字形、字号、行距、版心和配色。新增的尺度用于站点外框、年度索引、5∶3 卡片和文章导航。主题默认跟随系统，可在页首指定。篇目列表直接以年份起笔。日期相同的文章继续由原查询按文章 ID 排序。侧栏位置按标签页保存。

字体通过 Git 相对符号链接 `public/fonts` 复用实验字体目录，Astro 构建后在 `dist/fonts/v1.530/` 生成实际文件。CSS、OFL 与 321 个 WOFF2 随本地静态站同源提供，浏览器按字符加载子集。字体正式迁入 R2 留待发布流程确认。

## 代码位置

- [站点框架与导航](../../src/layouts/Site.astro)、[全局样式与 Tokens](../../src/styles/site.css)、[正文排版](../../src/styles/prose.css)
- [内容 Schema](../../src/lib/content-model.ts)、[RSS](../../src/pages/rss.xml.ts)、[分类索引](../../src/pages/categories/index.astro)、[分类页](../../src/pages/categories/%5Bcategory%5D.astro)
- [全站阅读设置](../../src/components/ReadingSettings.astro)、[章节进度与迷你模式](../../src/components/ArticleContents.astro)、[文章篇目与封面](../../src/components/PostList.astro)、[文章详情](../../src/pages/posts/%5Bslug%5D.astro)
- [Markdown 配置](../../astro.config.mjs)、[表格滚动容器](../../scripts/rehype-scroll-tables.mjs)、[图片 title 转图注](../../scripts/rehype-figure-captions.mjs)
- [Schema 测试](../../tests/content.test.mjs)、[静态输出与浏览器回归](../../tests/site.test.mjs)、[隔离工程夹具](../../tests/fixtures.mjs)

## 测试与复现

`pnpm verify:media` 校验 2 篇文章、1 个媒体文件。`pnpm check` 为 0 错误、0 警告、0 提示。`pnpm test` 通过 16 项。Chrome 回归覆盖省略分类、非法分类、草稿隔离、RSS、Sitemap、canonical、无图封面、首图去重、跨页视图和主题记忆、大纲偏好记忆、长目录在页首和吸顶时独立滚到末项、当前章节高亮、键盘预览和触屏两次轻点跳转、短表格全宽及超宽表格内部滚动和 32 篇文章的侧栏次序及滚动恢复。`pnpm build` 成功生成 6 个静态页面及 RSS、Sitemap、robots.txt。

在仓库根目录运行 `pnpm build && pnpm preview` 可看正式内容。运行 `node docs/m4.2/preview.mjs` 可在本机 4632 端口打开含六类样稿的静态构建。此命令将测试文章及其图片写入临时工程，按 Ctrl+C 清理。视觉矩阵可在现有 ego-browser TaskSpace 中运行，传入其受控 Page。

```js
const { audit } = await import('file:///你的仓库绝对路径/docs/m4.2/measure.mjs');
await audit(page);
```

## 视觉复核

design-taste-frontend 的候选中选用了 The split stage（seed 2000682799）的稳定侧栏构图。用于侧栏的是站内的年份、篇目和章节。正文继续使用 M4.1 字体与纸墨色。

此前的五篇基准内容覆盖三个发布日期。首页有一条页首基线，篇目列有两处日期分隔。1440px 下第一篇标题距视口顶部从约 326px 提前至 191px，390px 下从约 281px 提前至 195px。两次测量使用相同的文楷、样稿和列表视图。

375px 技术稿的题名自然排成两行，390px 正式文章的日期、分类和两个标签在同一行。两者的标题与正文起笔都距左侧 20px。横向目录及页边刻度的触感仍可在 iOS Safari 和 Android 实机复核。
