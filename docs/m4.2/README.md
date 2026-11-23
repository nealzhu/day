# M4.2 · 骞言碎语视觉验收

开发分支 `feat/m4-2-visual-system` 从 M4.1 的 `0ccb839` 建立。正式内容集有两篇已发布文章及一张 WebP。以下标明「样稿」的截图来自临时构建，它保留这两篇文章，并加入 M4.1 的技术稿、生活图文和长篇随笔。

## 阅读界面修订

首页和分类页共用年度索引。分类名称与篇数放在「文章目录」旁的小字位置，右上角的阅读设置切换列表或图文，也可指定随系统、浅色或深色。这两项偏好跨页面保存。列表图标取三行长短不同的行文，图文图标取图与题注的上下关系，旁边保留可读标签。[分类页](screenshots/category-1440-light.png) · [手机设置](screenshots/settings-390-light.png)

字标只保留「骞言碎语」。列表与外框的连续横线已移除，靠篇间距离和年份位置划分内容。页脚采用当年版权、站名和仓库 GitHub 链接，并保留分类索引与 RSS。

详情页用一笔短斜线标记篇首和当前导航项，标题保留均衡断行。完整目录跟踪 H2/H3，迷你模式显示正文进度，点刻度回到完整目录时会把当前章节移入视野。短表格填满正文宽度；超宽表格保留列宽，在可键盘聚焦的容器里横向浏览。表格、代码、目录和页面滚动条均采用细滑块与透明轨道。

## 截图与实测

| 阅读场景 | 桌面或平板 | 手机 |
| --- | --- | --- |
| 首页篇目 | [正式内容 · 1440 浅色](screenshots/published-1440-light.png) · [含样稿 · 1440 浅色](screenshots/list-1440-light.png) | [390 浅色](screenshots/list-390-light.png) |
| 首图与默认占位图 | [1440 浅色](screenshots/cards-1440-light.png) · [1024 深色](screenshots/cards-1024-dark.png) | [375 深色](screenshots/cards-375-dark.png) |
| 技术长标题与目录 | [1440 三栏](screenshots/tech-1440-light.png) · [1024 双栏](screenshots/tech-1024-light.png) · [768 单栏](screenshots/tech-768-dark.png) | [390 首屏](screenshots/tech-390-light.png) · [375 代码与表格](screenshots/tech-375-dark.png) |
| 章节定位 | [1440 当前章节与全宽表格](screenshots/chapter-1440-light.png) · [页边进度](screenshots/mini-1440-light.png) | [390 横向目录](screenshots/chapter-390-light.png) · [迷你刻度](screenshots/mini-390-light.png) |
| 连续阅读与图注 | [长篇随笔 · 1440 深色](screenshots/essay-1440-dark.png) | [生活图文 · 390 深色](screenshots/life-390-dark.png) |

ego-lite 在五种宽度上分别以系统浅色、深色和减少动态效果设置打开标题列表、图文卡片及三类文章。50 组记录的整页横向溢出均为 0。375px 技术稿的长命令在 335px 正文内有 834px 的横向滚动空间。CDP 报告正文首段实际使用 LXGWWenKai-Regular，代码使用本机 Menlo-Regular。摄影沿用 M4.1 的 CC0 样图，署名随图注显示。[逐组数据](matrix.json) · [样图来源与许可](../m4.1/README.md)

| 视口宽度 | 正文实宽 | 左侧文章导航 | 有 H2/H3 时的目录 |
| --- | --- | --- | --- |
| 1440px | 700px | 常驻左栏 | 常驻右栏 |
| 1024px | 700px | 正文末尾 | 常驻右栏 |
| 768px | 700px | 正文末尾 | 顶部横向章节栏 |
| 390px / 375px | 350px / 335px | 正文末尾 | 顶部横向章节栏 |

390px 技术稿的六个目录项最初纵向占据约三分之一屏。改为横向章节栏后，首屏可开始阅读正文；滚动时当前章节自动移入可见范围。在同宽手机切入迷你模式，刻度位于右侧 20px 页边，可点击恢复目录。桌面技术稿实测短表格和正文同为 700px。

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

正文延用 M4.1 的字形、字号、行距、版心和配色。新增的尺度用于站点外框、年度索引、5∶3 卡片和文章导航。主题默认跟随系统，可在页首指定。目录页使用最大 54px 的页标题。日期相同的文章继续由原查询按文章 ID 排序。侧栏位置按标签页保存。

字体通过 Git 相对符号链接 `public/fonts` 复用实验字体目录，Astro 构建后在 `dist/fonts/v1.530/` 生成实际文件。CSS、OFL 与 321 个 WOFF2 随本地静态站同源提供，浏览器按字符加载子集。字体正式迁入 R2 留待发布流程确认。

## 代码位置

- [站点框架与导航](../../src/layouts/Site.astro)、[全局样式与 Tokens](../../src/styles/site.css)、[正文排版](../../src/styles/prose.css)
- [内容 Schema](../../src/lib/content-model.ts)、[RSS](../../src/pages/rss.xml.ts)、[分类索引](../../src/pages/categories/index.astro)、[分类页](../../src/pages/categories/%5Bcategory%5D.astro)
- [全站阅读设置](../../src/components/ReadingSettings.astro)、[章节进度与迷你模式](../../src/components/ArticleContents.astro)、[文章篇目与封面](../../src/components/PostList.astro)、[文章详情](../../src/pages/posts/%5Bslug%5D.astro)
- [Markdown 配置](../../astro.config.mjs)、[表格滚动容器](../../scripts/rehype-scroll-tables.mjs)、[图片 title 转图注](../../scripts/rehype-figure-captions.mjs)
- [Schema 测试](../../tests/content.test.mjs)、[静态输出与浏览器回归](../../tests/site.test.mjs)、[隔离工程夹具](../../tests/fixtures.mjs)

## 测试与复现

`pnpm verify:media` 校验 2 篇文章、1 个媒体文件。`pnpm check` 为 0 错误、0 警告、0 提示。`pnpm test` 通过 13 项。Chrome 回归覆盖省略分类、非法分类、草稿隔离、RSS、Sitemap、canonical、无图封面、首图去重、跨页视图和主题记忆、章节高亮与迷你切换、短表格全宽及超宽表格内部滚动和 32 篇文章的侧栏次序及滚动恢复。`pnpm build` 成功生成 6 个静态页面及 RSS、Sitemap、robots.txt。

在仓库根目录运行 `pnpm build && pnpm preview` 可看正式内容。运行 `node docs/m4.2/preview.mjs` 可在本机 4632 端口打开含三类样稿的静态构建。此命令将测试文章及其图片写入临时工程，按 Ctrl+C 清理。视觉矩阵可在现有 ego-browser TaskSpace 中运行，传入其受控 Page。

```js
const { audit } = await import('file:///你的仓库绝对路径/docs/m4.2/measure.mjs');
await audit(page);
```

## 视觉复核

design-taste-frontend 的候选中选用了 The split stage（seed 2000682799）的稳定侧栏构图。用于侧栏的是站内的年份、篇目和章节。正文继续使用 M4.1 字体与纸墨色。

同一组五篇文章在 1440px 的样稿首页，检查器记录的横向分隔线从 7 处减到 0 处，页面长度约从 1.4 屏变为 1.3 屏。桌面、768px 和 390px 下的主标题均保持一行。通用展示页检查器仍报告 4 个 FAIL（图片数、首屏焦点、动效数量、文字占屏比例）和 2 个 WARN（视频与短页标题）。按本次阅读站要求保留了静态纯文本默认视图和现有内容。浏览器验证使用 Chromium；可在 iOS Safari 和 Android 实机复核横向目录的手势及 20px 页边刻度的触感。
