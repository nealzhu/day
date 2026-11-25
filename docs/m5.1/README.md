# M5.1 搜索验收

基线为 `main` 的 `38e9a07`（合并 R2 字体部署优化后的版本）。正式构建使用 `MEDIA_BASE_URL=https://site-cdn.qians.day pnpm run build`。浏览器通过 Astro 静态预览访问构建产物。截图使用 `pnpm run build:preview` 随产物复制的同版霞鹜文楷，桌面深色截图使用含临时无分类文章的预览。

## 实现决策

- 锁定 Pagefind 1.6.0。npm 包使用支持简体中文分词的 Extended 版本，浏览器端使用 Pagefind 的查询分词与 Worker。 [发布说明](https://github.com/Pagefind/pagefind/releases/tag/v1.6.0) · [安装说明](https://pagefind.app/docs/installation/)
- Component UI 提供 Web Components、键盘导航及模板。本站只需要一套搜索弹窗，因此使用 Pagefind JavaScript API、原生 `<dialog>` 和 Astro 客户端脚本。弹窗沿用 M4 的主题、霞鹜文楷 Regular、边框、间距、焦点及动效变量。遮罩以 3 px 高斯模糊柔化背景内容。 [Component UI](https://pagefind.app/docs/search-ui/) · [JavaScript API](https://pagefind.app/docs/api/)
- Astro 静态构建结束后从 `posts/*/index.html` 生成 `dist/pagefind/`。路由只生成已发布文章，`data-pagefind-body` 限定文章内容，目录和标签组从正文索引中剔除。日期和可选分类从文章元数据读取。Cloudflare Pages 继续部署整个 `dist`，沿用现有工作流。 [索引范围](https://pagefind.app/docs/indexing/) · [元数据](https://pagefind.app/docs/metadata/)
- 标题使用 Pagefind 默认的 H1 权重 7 和标题元数据加成，摘要权重为 2，正文段落为 1，正文小节标题保留 Pagefind 的默认权重。回归测试验证同一个词出现在另一篇正文时，标题命中的文章在前。 [权重](https://pagefind.app/docs/weighting/) · [排序](https://pagefind.app/docs/ranking/)
- 首次打开才会初始化 Pagefind。同一页面的后续打开复用初始化结果。查询防抖 150 ms，每次请求只读取 10 条结果片段，返回的片段和错误都受当前查询版本约束。

## 网络与构建体积

生产配置构建含两篇正式文章。Ego Lite 冷访问本地 Astro 静态预览，记录 Chromium 实际收到的 HTTP 响应体（按实际 gzip 或原始编码计量，不含响应头）。中间层记录 Worker 发起的请求，因此也覆盖 WASM 与索引分片。 [逐请求记录](browser.json)

| 阶段 | 新增 Pagefind 请求 | 新增响应体 |
| --- | ---: | ---: |
| 首页加载，搜索未打开 | 0 | 0 B |
| 首次打开，输入框为空 | 5 | 81,573 B（79.7 KiB） |
| 第一次查询「媒体同步」，返回一篇 | 2 | 1,727 B（1.7 KiB） |
| 同一页面再次打开 | 0 | 0 B |

首屏新增一个 Astro 内联脚本，minify 后为 3,627 B，单独 gzip 为 1,632 B，Brotli 为 1,346 B。没有新增首屏 JS 请求。完整 `dist/pagefind/` 为 149,232 B（145.7 KiB），其中 manifest、语言元数据、倒排索引和文章片段合计 2,425 B（2.4 KiB）。

## 验收结果

| 项目 | 结果 |
| --- | --- |
| 简中与中英文混合检索 | 「媒体同步」命中正文并高亮，「Cloudflare 部署」返回两篇且 URL 唯一。标题「发布链路无图」命中对应文章。 |
| 摘要、排序与分类 | 自动测试覆盖仅摘要命中和标题优先排序。Ego Lite 用「Cloudflare 归档」检出无分类文章并显示日期。 |
| 索引范围 | 草稿、排版实验页、站名和文章侧栏短语的精确查询无结果。排版实验独立构建也不产生 Pagefind 目录。 |
| 键盘与中文输入法 | 点击与 `/` 打开后聚焦，方向键选择，Enter 打开，Escape 关闭并恢复焦点。Chromium 的 IME 组合输入提交「媒体同步」后才显示结果。 |
| 状态、分页与竞争 | 验证打开前的空状态、无结果、模块请求失败、分批加载，以及较早的结果片段延迟返回时不会覆盖当前查询。 |
| 构建与回归 | 冻结锁文件安装、媒体与字体校验、类型检查、32 项自动化测试、生产构建、排版实验构建均通过。类型检查为 0 错误、0 警告。用于兼容部分浏览器组合输入的 `keyCode === 229` 有两条弃用提示。 |

## 真实浏览器截图

- [桌面浅色 · 方向键选择](screenshots/desktop-light.png)
- [桌面深色 · 中英文混合查询与无分类文章](screenshots/desktop-dark.png)
- [平板深色 · 空状态](screenshots/tablet-empty-dark.png)
- [移动浅色 · 正文高亮](screenshots/mobile-light.png)
- [移动深色 · 无结果](screenshots/mobile-dark.png)
