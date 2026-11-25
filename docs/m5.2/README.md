# M5.2 图片浏览验收

开发基线为 `main` 的 `bcdafdc`，包含 M4、R2 部署优化和 M5.1 搜索。生产构建执行 `MEDIA_BASE_URL=https://site-cdn.qians.day pnpm run build`。交互和截图使用 Ego Lite 的 Chromium 打开静态产物，其中多图测试用一篇临时文章组合横幅、竖幅、技术截图、返回 404 的原图和一张远离视口的文末图。验收样稿保留在临时构建目录。

## 实现与文件

| 文件 | 实现 |
| --- | --- |
| [Remark 媒体处理](../../scripts/remark-cdn-media.mjs) | 延用本地 WebP 探测和 R2 路径回写，将真实尺寸和正文图片标记传给 Rehype。首图保持立即加载，后续图片使用浏览器原生懒加载。 |
| [Rehype 图片链接](../../scripts/rehype-image-gallery.mjs) | 图注插件先照常运行。普通图片包进指向原图的原生链接，带作者链接的图像保留原链接，并在其后增加「查看大图」。这些图片按正文顺序进入同一篇文章的 Gallery。 |
| [文章入口](../../src/components/ImageGallery.astro) | 文章页按既有封面元数据判断是否有正文图片。只有图文文章加载轻量点击委托，首次点击才导入灯箱。原生链接提供无 JavaScript 降级。 |
| [灯箱](../../src/lib/image-viewer.ts) · [样式](../../src/styles/image-viewer.css) | 固定 PhotoSwipe 5.4.4，原生 `<dialog>` 放在浏览器顶层并隔离正文交互，PhotoSwipe Core 负责变换、手势、序号与切图。关闭时销毁实例并恢复打开灯箱的链接焦点和文档滚动坐标。 |
| [搜索快捷键](../../src/components/SiteSearch.astro) | 当顶层已有模态框时，`/` 快捷键会让位于当前交互。 |
| [静态回归](../../tests/site.test.mjs) | 覆盖正文链接语义、无 JS 降级、冷加载、键盘和双击、错误提示、动画坐标、滚动和焦点恢复及搜索相容性。 |

参考 Weekly 的图片数据组装、从缩略图定位的原生缩放过渡，以及它对缩放变换导致圆角失配的处理。本项目正文图和灯箱图实测圆角均为 0 px，PhotoSwipe 原生过渡即可对齐。关闭时，当前图片的正文缩略图若已在视口之外，使用淡出并保留原阅读位置。 [Weekly 实现](https://github.com/tw93/Weekly/blob/47d63049841f6c2a94d4cb1d53f425673f73d5ea/src/components/ClientScripts.astro) · [PhotoSwipe 过渡](https://photoswipe.com/opening-or-closing-transition/) · [5.4.4 发布版](https://github.com/dimsemenov/PhotoSwipe/releases/tag/v5.4.4)

## 性能

Ego Lite 冷启动访问独立的本地静态构建服务器，记录它实际收到的响应体。JS 使用 gzip，WebP 使用生产 R2 一样的长期不可变缓存策略。表中传输量按灯箱相关资源统计。完整数据包含请求路径和字节数。 [浏览器数据](browser.json)

| 场景 | 新增资源与传输 |
| --- | --- |
| 无图文章 | 0 个图片浏览脚本、Core 或灯箱 CSS 请求 |
| 有图文章，灯箱未打开 | 点击委托 1699 B，gzip 889 B。Core 与灯箱 CSS 均为 0 请求 |
| 首次打开灯箱 | 1 个动态模块，69985 B，gzip 20523 B（20.0 KiB）。CSS 6922 B 已计入该模块，单独 CSS 请求为 0 |
| 首次打开时已载入原图 | 单图和五图样稿均记录 0 个重复 WebP 请求 |
| 在同一页面关闭再打开 | 已加载模块和原图均复用，新增传输为 0 B |

相邻图片由 PhotoSwipe 按需准备，预取范围设为 `[0, 0]`。五图样稿首开时，文末远端图片仍无请求。 [PhotoSwipe 预取选项](https://photoswipe.com/options/#preload)

## 验收与范围

- 桌面浅色单图显示 `1 / 1`，无翻页按钮。横向照片、竖向照片和技术截图在初始比例下完整显示。桌面、平板和移动视口覆盖了浅色及深色主题。
- Chromium 动画采样中，打开起点和关闭终点均与正文缩略图坐标对齐，误差在 2 px 内。开启减少动态效果后，灯箱没有位移过渡。
- Ego Lite 验证方向键、Escape、双击放大与缩回、放大后的鼠标拖动、手机双指缩放和滑动切换。关闭后回到先前滚动位置和打开灯箱的链接。灯箱存在时，`/` 不会叠加搜索弹窗，关闭后 Pagefind 可正常检索。
- 图片请求 404 时显示中文错误提示，仍可切换或退出。自动化验证了关闭 JavaScript 后点击正文图能直接访问原图。
- 依赖冻结安装、媒体及字体校验、类型检查、34 项自动化测试和完整生产构建均通过。类型检查保留 M5.1 的两条中文输入法兼容提示。
- 实机 Safari 兼容性留作后续设备复核。本次手机手势基于 Chromium 触控模拟。验收范围内未发现阻塞缺陷。

## 真实浏览器截图

- [桌面浅色 · 单图](screenshots/desktop-single.png)
- [桌面浅色 · 横向照片](screenshots/desktop-landscape.png)
- [桌面深色 · 技术截图](screenshots/desktop-technical.png)
- [平板深色 · 竖向照片](screenshots/tablet-portrait.png)
- [移动浅色 · 双指放大](screenshots/mobile-pinch.png)
- [移动深色 · 加载失败](screenshots/mobile-error.png)
