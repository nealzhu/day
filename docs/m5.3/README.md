# M5.3 阅读交互验收

基于 `main` 的 `bfa4cd1` 开发。正式构建使用 `MEDIA_BASE_URL=https://site-cdn.qians.day pnpm run build`。Ego Lite 验收使用实际静态构建产物，包括一篇有图长文、一篇无图短文和两年归档。测试文章来自临时预览项目。布局样式沿用 M4 的霞鹜文楷、明暗主题和 700 px 阅读版心。

## 实现与文件

| 文件 | 决策 |
| --- | --- |
| [段落分享入口](../../src/components/ParagraphShare.astro) · [定位规则](../../src/lib/paragraph-share.ts) | 从单段选择生成版本化 URL 片段，包含段落序号、段内偏移、所选文字以及前后最多 24 个 Unicode 字符。首选完整上下文，经编辑后可回退到至少一侧足够长且唯一的上下文。重复匹配、上下文不足或已删除内容留在当前页面。 |
| [文章列表](../../src/components/PostList.astro) · [归档位置](../../src/components/ArchivePosition.astro) | 默认使用原生 History 和 BFCache。当前历史条目保存路由、视图、文章 ID 和相对视口坐标，从文章返回且布局有变化时校正一次。切换卡片与列表仍锚定同一文章。 |
| [文章详情](../../src/pages/posts/%5Bslug%5D.astro) · [站点布局](../../src/layouts/Site.astro) | 沉浸阅读记忆本地偏好，切换时补偿正文滚动。鼠标移入标题区或键盘聚焦时显示横卷，触屏可直接点击。低于 1180 px 时在文末居中展示相邻文章和去首页。相邻文章按首页顺序确定，首末篇省去没有对应文章的方向。 |
| [目录](../../src/components/ArticleContents.astro) · [阅读设置](../../src/components/ReadingSettings.astro) | 低于 960 px 时，目录与沉浸阅读入口对齐在标题右下。目录按钮打开原生 Popover，浮层通常高 288 px，在短视口内会收缩，内容可独立纵向滚动。侧栏与浮层复用同一份目录。触屏及浮层链接至少高 44 px，宽屏鼠标环境可用迷你目录。 |
| [搜索](../../src/components/SiteSearch.astro) · [灯箱](../../src/lib/image-viewer.ts) | 沉浸模式保留 `/` 搜索入口。顶层弹窗打开时其余阅读操作让位，关闭后恢复原焦点。灯箱在开场动画还未结束时收到关闭操作，会在动画完成后关闭。 |
| [静态回归](../../tests/site.test.mjs) | 覆盖真实剪贴板写入、链接定位、归档返回、跨文章阅读偏好、触控目录及搜索和灯箱。 |

段落分享参考 Weekly 的选中文字浮层与 URL 片段机制。本站将位置作为候选提示，并始终对比全篇的竞争匹配。4–96 个字符的单段选择显示分享入口，过长、跨段或代码块选择保留原生操作。链接包含文字和定位上下文，显示后临时高亮整段。 [Weekly 段落分享](https://github.com/tw93/Weekly/blob/main/src/components/ParagraphShare.astro)

## 浏览器验收

- 桌面通过鼠标拖选中英文混排片段。静态回归使用 Chromium 剪贴板权限验证实际复制，并确认原生文本选区保留。Ego Lite 验证直接打开、刷新、段落插入后恢复、歧义及未找到时原地停留。
- 首页图文卡片和分类标题列表通过 BFCache 返回，目标卡片或标题的相对视口坐标完全复原。前进及主动打开归档遵循浏览器行为。详情中从卡片切换到列表后返回，目标文章的相对坐标由 242.38 px 恢复为 242.47 px。
- 桌面沉浸模式正文宽 700 px，刷新和跨文章导航保留偏好。桌面退出时观测段落的垂直偏差为 0.06 px。在 390 px 触屏模拟中，正文宽 350 px，退出按钮高 44 px。沉浸模式内搜索「媒体同步」获得原有文章结果。照片灯箱打开时，`/` 不会叠加搜索。
- 390 px 触屏上，目录按钮实测 44 × 44 px。滑动展开后的目录时，正文维持原位，点选章节后目录收起并高亮对应章节。三个文末链接的整体中心为 195 px。768 px 验证了键盘展开、Escape 收起和焦点恢复，1024 px 保留右侧目录，1440 px 保留全部文章侧栏和 700 px 版心。
- 首次访问正文未请求 Pagefind 或 PhotoSwipe Core。检查样本记录 0 条 Console 错误或警告、0 个失败资源请求。无近期输入的布局偏移记录中，桌面文章为 0、分类列表约 0.00054、移动样本约 0.01809。 [浏览器记录](browser.json)
- 媒体及字体校验、类型检查、38 项自动化测试与完整生产构建均通过。类型检查有两条既有输入法兼容提示。

移动端目录点击和分享浮层分别通过 Chromium 触控与原生 Selection Range 验证。桌面 Chromium 触控模拟未产生系统长按选区，实体手机上的原生选区手柄与系统菜单留待设备复核。验收范围内未发现阻塞缺陷。

## 新增 JavaScript

以合并 M5.2 的生产构建为基线，对比页面首屏内联脚本与实际引用的本地模块。gzip 是对各段脚本单独压缩后的增量，实际内联代码随 HTML 一起传输。

| 路由 | 新增 minify 字节 | 新增 gzip 字节 | 新增脚本请求 |
| --- | ---: | ---: | ---: |
| 首页和分类文章列表 | 2,070 | 1,081 | 0 |
| 有图且有目录的文章 | 7,615 | 3,381 | 1 |
| 无图且无目录的文章 | 6,782 | 3,119 | 1 |

段落分享模块在浏览器中实际 gzip 传输 2,177 B，仅文章详情页加载。PhotoSwipe 的关闭行为补丁在原动态模块中增加 152 B，gzip 后增加 35 B。

## 真实浏览器截图

- [桌面浅色 · 段落分享入口](screenshots/desktop-selection-light.png)
- [桌面深色 · 定位段落高亮](screenshots/desktop-highlight-dark.png)
- [桌面深色 · 700 px 沉浸阅读](screenshots/desktop-immersive-dark.png)
- [首页 · 返回图文卡片](screenshots/archive-return-cards.png)
- [移动浅色 · 标题区目录浮层](screenshots/mobile-outline-light.png)
- [移动浅色 · 文末翻页链接](screenshots/mobile-pagination-light.png)
- [移动深色 · 段落分享](screenshots/mobile-share-dark.png)
- [移动浅色 · 沉浸模式](screenshots/mobile-immersive-light.png)
