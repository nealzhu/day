# M4.2 · 骞言碎语视觉验收

开发分支 `feat/m4-2-visual-system` 从 M4.1 的 `0ccb839` 建立。正式内容集有两篇已发布文章及一张 WebP。以下标明「样稿」的截图来自临时构建，它保留这两篇文章，并加入 M4.1 的技术稿、生活图文和长篇随笔。

## 截图与实测

| 阅读场景 | 桌面或平板 | 手机 |
| --- | --- | --- |
| 首页篇目 | [正式内容 · 1440 浅色](screenshots/published-1440-light.png) · [含样稿 · 1440 浅色](screenshots/list-1440-light.png) | [390 浅色](screenshots/list-390-light.png) |
| 首图与文字封面 | [1440 浅色](screenshots/cards-1440-light.png) · [1024 深色](screenshots/cards-1024-dark.png) | [375 深色](screenshots/cards-375-dark.png) |
| 技术长标题与目录 | [1440 三栏](screenshots/tech-1440-light.png) · [1024 双栏](screenshots/tech-1024-light.png) · [768 单栏](screenshots/tech-768-dark.png) | [390 首屏](screenshots/tech-390-light.png) · [375 代码与表格](screenshots/tech-375-dark.png) |
| 连续阅读与图注 | [长篇随笔 · 1440 深色](screenshots/essay-1440-dark.png) | [生活图文 · 390 深色](screenshots/life-390-dark.png) |

ego-lite 在五种宽度上分别以系统浅色、深色和减少动态效果设置打开标题列表、图文卡片及三类文章。50 组记录的整页横向溢出均为 0。375px 技术稿的长命令在 335px 正文内有 834px 的横向滚动空间。CDP 报告正文首段实际使用 LXGWWenKai-Regular，代码使用本机 Menlo-Regular。摄影沿用 M4.1 的 CC0 样图，署名随图注显示。[逐组数据](matrix.json) · [样图来源与许可](../m4.1/README.md)

| 视口宽度 | 正文实宽 | 左侧文章导航 | 有 H2/H3 时的目录 |
| --- | --- | --- | --- |
| 1440px | 700px | 左栏展开 | 右栏展开 |
| 1024px | 700px | 正文上方折叠 | 右栏展开 |
| 768px | 700px | 正文上方折叠 | 正文上方折叠 |
| 390px / 375px | 350px / 335px | 正文上方折叠 | 正文上方折叠 |

初版两处折叠入口在手机上分占两行。复看首屏后改为并排，展开任一目录时占整行，较长的篇名有足够宽度。桌面实点 H3 可定位到正文锚点，在手机的「全部文章」可从工程文章直接进入无分类随笔。

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

正文延用 M4.1 的字形、字号、行距、版心和配色。新增的尺度用于站点外框、年度索引、5∶3 卡片和文章导航。主题跟随系统；目录页单独使用最大 54px 的页标题。日期相同的文章继续由原查询按文章 ID 排序。侧栏位置按标签页保存。

字体通过 Git 相对符号链接 `public/fonts` 复用实验字体目录，Astro 构建后在 `dist/fonts/v1.530/` 生成实际文件。CSS、OFL 与 321 个 WOFF2 随本地静态站同源提供，浏览器按字符加载子集。字体正式迁入 R2 留待发布流程确认。

## 代码位置

- [站点框架与导航](../../src/layouts/Site.astro)、[全局样式与 Tokens](../../src/styles/site.css)、[正文排版](../../src/styles/prose.css)
- [内容 Schema](../../src/lib/content-model.ts)、[RSS](../../src/pages/rss.xml.ts)、[分类索引](../../src/pages/categories/index.astro)、[分类页](../../src/pages/categories/%5Bcategory%5D.astro)
- [首页视图切换](../../src/pages/index.astro)、[文章篇目与封面](../../src/components/PostList.astro)、[文章详情](../../src/pages/posts/%5Bslug%5D.astro)
- [Markdown 配置](../../astro.config.mjs)、[图片 title 转图注](../../scripts/rehype-figure-captions.mjs)
- [Schema 测试](../../tests/content.test.mjs)、[静态输出与浏览器回归](../../tests/site.test.mjs)、[隔离工程夹具](../../tests/fixtures.mjs)

## 测试与复现

`pnpm verify:media` 校验 2 篇文章、1 个媒体文件。`pnpm check` 为 0 错误、0 警告、0 提示。`pnpm test` 通过 13 项。Chrome 回归覆盖省略分类、非法分类、草稿隔离、RSS、Sitemap、canonical、无图封面、首图去重、偏好记忆、超宽表格内部滚动和 32 篇文章的侧栏次序及滚动恢复。`pnpm build` 成功生成 6 个静态页面及 RSS、Sitemap、robots.txt。

在仓库根目录运行 `pnpm build && pnpm preview` 可看正式内容。运行 `node docs/m4.2/preview.mjs` 可在本机 4632 端口打开含三类样稿的静态构建。此命令将测试文章及其图片写入临时工程，按 Ctrl+C 清理。视觉矩阵可在现有 ego-browser TaskSpace 中运行，传入其受控 Page。

```js
const { audit } = await import('file:///你的仓库绝对路径/docs/m4.2/measure.mjs');
await audit(page);
```

人工审核可重点看两处：两篇正式文章在桌面年度索引下的留白，以及 1024px 优先展开目录的阅读顺序。辅助的营销页面风格检查器对细线、图像数量、首屏焦点、动态效果及留白给出 5 个提示级别为 FAIL 的结果，对视频及短页标题给出 2 个 WARN。本站按阅读索引的需求保留文字首屏与静态细线。此次设备验收使用 Chromium 视口模拟，iOS Safari 与 Android 实机手感仍待确认。
