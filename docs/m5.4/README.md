# M5.4 文章评论验收

基于 `origin/main` 的 `75d12ff`。GitHub 已启用 Discussions，仓库设置显示 Giscus App 已安装。Giscus 分类查询返回的仓库 ID 和 `Article Comments` 分类 ID 与提供的配置一致。 [讨论分类](https://github.com/nealzhu/day/discussions/categories/article-comments) · [Giscus 分类查询](https://giscus.app/api/discussions/categories?repo=nealzhu%2Fday)

## 实现

- [Comments.astro](../../src/components/Comments.astro) 使用官方原生脚本，继承 M4 的正文宽度、分隔线、颜色和控件样式。正常滚动进入视口下方 240 px 时启动加载。短文首屏已包含评论区时，读者可直接点击「加载评论」。沉浸阅读隐藏评论区，退出后恢复原 iframe。
- [配置](../../src/lib/comments.ts) 将永久 `articleId` 映射为 `article-${articleId}`，在 `Article Comments` 分类内严格匹配。文章的 Canonical URL 通过 `giscus:backlink` 传给 Giscus，供创建讨论时写入正文。文章改标题或 Slug 时，既有讨论继续关联同一 Article ID。既有讨论正文中的回链仍是创建当时的地址。 [Giscus 高级用法](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md)
- 网站显式或系统主题变化时，通过 `postMessage` 将浅色或深色主题地址发给当前 iframe。接收时同时验证来源和 iframe。首次评论或回应由 Giscus 按需建立讨论。
- 脚本错误、服务错误或 15 秒无就绪消息时显示重试。脚本失败后可以重新请求，已有 iframe 时重载该 iframe。正式构建也只在 `https://qians.day` 启用评论。[giscus.json](../../giscus.json) 在 GitHub 默认分支生效，来源仅允许正式站点。

## 评论区样式调整

正文结束后直接显示文章翻页和首页入口，桌面与移动端顺序一致。评论区标题为「欢迎留下你的想法」，下方依次显示表情回应、输入框与留言。保留单个表情的实际人数、留言排序和原生登录入口。留言采用细分隔，回复使用缩进。

[自定义主题](../../public/comments/theme.css)使用 M4 的色彩并沿用 Giscus 的交互。两种主题共享同一个透明底样式表。Cloudflare Pages 仅为该样式表设置 Giscus 专用 CORS 头，样式随 iframe 按需加载。 [Giscus 自定义主题说明](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md#data-theme)

Ego Lite 在 1440 px 桌面和 390 px 触屏检查了正文、翻页和评论区的顺序，以及明暗布局、总数隐藏和主题切换。移动端实际点击可到下一篇及首页，表情入口高 44 px。主题切换和沉浸阅读退出复用原 iframe。隔离构建提供截图，并在 Giscus 官方示例中复核真实控件和未登录时的表情菜单。 [测量与响应头](theme-browser.json)

[桌面浅色](screenshots/theme-desktop-light.png) · [桌面深色](screenshots/theme-desktop-dark.png) · [移动端浅色](screenshots/theme-mobile-light.png) · [移动端深色](screenshots/theme-mobile-dark.png)

## 初版 Ego Lite 浏览器记录

验收使用临时静态构建与两篇测试文章。隔离服务使用官方 `client.js` 和 `default.css`，iframe 的讨论数据及故障由本地测试服务模拟。截图来自 Ego Lite，iframe 内的登录按钮为隔离界面。真实 GitHub 讨论未写入。 [完整浏览器与网络记录](browser.json)

| 场景 | 实测 |
| --- | --- |
| 1440 × 900，有分类长文 | 首屏 0 个评论服务请求。滚到文末才初始化，评论区与正文均宽 700 px。搜索、图片灯箱和段落分享正常。 |
| 浅色切换深色，沉浸模式进入及退出 | 原 iframe 保留。主题切换与沉浸模式切换共增加 0 个评论服务请求。 |
| 390 × 844，无分类短文 | 评论区位于首屏，点击前 0 个评论服务请求。宽 350 px，无横向溢出。当前文章的 term 与长文不同，空讨论不显示 GitHub 链接。 |
| 外部服务故障 | 模拟 `client.js` 返回 503，显示重试。模拟 iframe 报错后再次重试，复用原 iframe 并恢复评论区。 |
| 修改标题和 Slug | 重建后，iframe 的 term 仍为 `article-01M54COMMENTIMAGE`，回链更新为 `/posts/browser-renamed/`。 |
| 本地生产构建 | 评论区显示占位，0 个评论服务请求。 |

长文首次加载共 3 个评论服务请求。隔离服务实测响应体大小为 `client.js` 3,596 B、`default.css` 167 B、测试 iframe HTML 1,493 B。线上 iframe 还会加载 Giscus 的实际资源和讨论数据。

[桌面浅色](screenshots/desktop-light.png) · [桌面深色](screenshots/desktop-dark.png) · [移动端恢复](screenshots/mobile-ready.png) · [移动端失败提示](screenshots/mobile-retry.png)

## 本地检查与剩余验收

- `pnpm run verify:media` 通过，覆盖 2 篇文章、1 个媒体文件及 323 个版本化字体资源。
- `pnpm run check` 通过，0 错误、0 警告，有 2 条既有 `keyCode` 弃用提示。
- `pnpm test` 通过，41 项全绿。新增评论回归覆盖首屏、Article ID、Canonical、隔离、重试、主题同步及伪造消息拒绝。
- `MEDIA_BASE_URL=https://site-cdn.qians.day pnpm run build` 通过。

待仓库所有者指定并授权专用测试文章或隔离讨论后，在获准的来源验证真实 GitHub 登录、首评建帖、回复和 Reactions。正式站点的来源配置将在仓库默认分支包含 `giscus.json` 后生效。
