# 骞言碎语 · M4.1–M4.4 最终工程验收

**2026-11-25，M4.1–M4.4 合并前回归通过。** 首页默认图文卡片，现有视觉和交互方案已确认。三项 P2 均已修复。手机迷你目录触控优化排入 M5，字体首访体积优化排入 M6。正式站 CORS 已生效，字体同步及正式 CDN 的最终文件验收留给生产工作流。[问题清单](ISSUES.md) · [首轮逐项报告](M4-BASELINE.md)

分支为 `feat/m4-2-visual-system`。首轮基线为 `996b6b2`，P2 修复对应 `4c7b6c7`，竖图测试在 `fb11ec9` 补强。本次字体迁移及公开预览对应 `2afe81c`。正式内容有两篇工程文章，长文、生活图文、无分类随笔和长归档使用临时夹具。[本次 Pages 预览](https://23af06db.qians-day.pages.dev) · [夹具启动方法](evidence/复现环境.md)

## 最终字体迁移回归

| 范围 | 结果与证据 |
| --- | --- |
| 已实测 · 字体与构建 | 校验 2 篇文章、1 个正文媒体文件及 323 个字体对象。全套 321 个 WOFF2 共 13,333,240 B，原版样式表 218,815 B，OFL 为 5,171 B。生产构建 6 页全部引用 CDN，产物中字体、字体 CSS、许可副本均为 0。预览构建包含与原版逐字节一致的 323 个文件，再切回生产构建时副本清零。[媒体日志](font-migration/media.log) · [生产清单](font-migration/production-build.json) · [预览清单](font-migration/preview-build.json) |
| 已实测 · 自动化 | Astro 检查 44 个文件，0 错误、警告或提示。23 项测试通过，生产构建通过。内存模拟 R2 覆盖并发创建、CSS 最后上传与重跑零次 PUT。本机 HTTP 服务对 323 个文件执行完整发布校验，另测 404、MIME、CORS、缓存和内容损坏均能阻止验收。[类型检查](font-migration/check.log) · [测试](font-migration/test.log) · [构建](font-migration/build.log) |
| 已实测 · ego-lite | 17 组。生产 HTML 在本机仅替换 CDN 主机，跨端口加载原版字体，验证首页双视图及正式详情。另用同源样稿验证技术长文，用开发服务器验证正式详情。覆盖 1440 × 900 和 390 × 844、浅深主题，CDP 确认所选字标或正文实际绘制为 `LXGWWenKai-Regular`。0 条请求或 Console 错误，0 横向溢出，最大 CLS 0.000373（向上取整）。禁缓存下首页每组 19 包、589,033 B，技术长文每组 25 包、885,464 B，字节取 CDP 的网络传输长度。排版实验室另测跨端口加载 23 包，首段 97 个字形使用文楷。[逐组记录](font-migration/browser.json) · [实验室](font-migration/lab.json) |
| 已实测 · Cloudflare Pages Preview | 预览分支 `m4-acceptance-preview` 使用独立字体。桌面浅色首页及手机深色文章分别从预览域名加载 18、19 个分包，CDP 确认实际字形为文楷。两次各 27 条 HTTP 200，SVG 与 ICO 均为 200，0 条 Console 错误。[公网预览](https://23af06db.qians-day.pages.dev) · [公网浏览器数据](font-migration/public-preview.json) |
| 已实测 · 正式站 CORS | Wrangler 只读确认桶允许正式域名、Pages 主域名和 `http://localhost:4632`，方法 GET、HEAD。用生产校验器同款 Node 客户端带正式 Origin 请求现有 WebP，得到 200 和精确匹配的 CORS 头。字体 CSS 与抽查 WOFF2 目前为 404，发布前校验退出 1。正式首页 HEAD 未返回 CSP。[桶配置、响应头与实际失败](font-migration/cloudflare.json) |
| 仅源码核查 · 发布流程 | 生产作业限定 main 和 production 环境。图片及字体校验、R2 同步、CDN 全量校验、构建、Pages 发布顺序执行。PR 使用 Node 24、只读仓库权限和本地预览字体。仓库没有站点 CSP 声明。[生产工作流](../../.github/workflows/deploy.yml) · [PR 工作流](../../.github/workflows/pr-check.yml) |
| 尚待正式发布验证 | 首次同步后，生产工作流从公开 CDN 读取 323 个对象，逐个核对字节、MIME、缓存和正式站 CORS。正式域名端到端的字体响应与实际绘制须在发布时复核。本次未执行生产同步或正式 Pages 发布。 |

[桌面浅色卡片](font-migration/cards-1440-light.png) · [手机深色列表](font-migration/list-390-dark.png) · [桌面深色长文](font-migration/preview-tech-1440-dark.png) · [手机浅色长文](font-migration/preview-tech-390-light.png)

## 里程碑结果

| 里程碑 | 最终结论 | 验证与证据 |
| --- | --- | --- |
| M4.1 视觉系统 | 通过 | 五档宽度、深浅主题下品牌均为「骞言碎语」。CDP 抽查七个场景的品牌或首段，实际绘制字体均为 `LXGWWenKai-Regular`。768px 及以上为 18px，390、375px 为 17px。Tokens、字体声明与许可沿用首轮源码核查。[字体与页面矩阵](regression/evidence/matrix.json) · [首轮排版参数及源码索引](M4-BASELINE.md) |
| M4.2 首页与导航 | 通过 | 正式首页与工程分类页均在五档宽度和两种主题走访。两篇有图／无图文章都可进入；卡片首图、共享封面正常显示。另有 10 组已保存列表的全新导航，均恢复列表。分类过滤、键盘操作、设置焦点与偏好记忆由浏览器自动化回归覆盖。[列表记忆及 Reduced Motion](regression/evidence/edge-cases.json) · [自动测试](regression/evidence/test.log) |
| M4.3 文章详情 | 通过，迷你目录触控优化延期至 M5 | 宽屏左侧归档、右侧目录，窄屏文末归档、横向目录均可用。正式文章及三类样稿均校验篇目数和当前链接。慢图占位、长归档末项、平板 H3 跳转通过专项复验。表格和代码、深层目录、滚动恢复与触控操作覆盖范围见两轮记录。迷你模式维持既有行为。[专项实测](regression/evidence/edge-cases.json) · [首轮正文与键盘证据](M4-BASELINE.md) · [P3 状态](ISSUES.md) |
| M4.4 综合回归 | 通过 | 70 组常规页面与 10 组列表导航均无整页横向溢出。70 组常规页面记录到 1,880 条 HTTP 200／304 响应、0 个请求失败、0 条 Console 或运行时错误；普通加载最大 CLS 为 0.000200。预览公网检查单列如下。[逐组网络、字节、CLS 和 Console 记录](regression/evidence/matrix.json) |

## P2 复验

| 问题与原触发条件 | 修复前 | 修复后 |
| --- | --- | --- |
| M4-01 · WebP 延迟 2 秒，禁用缓存 | 390px 图注移动 233px，CLS 0.2422；1440px 移动 400px，CLS 0.3994 | 构建产物写入固有宽高。两张图在两档视口中均于图片返回前完成占位，加载前后图注纵坐标一致，CLS 均为 0。[手机加载前](regression/screenshots/photo-before-390-light.png) · [加载后](regression/screenshots/photo-after-390-light.png) |
| M4-02 · 34 篇文章，1440 × 900，只滚动左栏 | 末项底边 985.02px，位于可视区外 | 末项底边 896.02px，可实际点击。进入末篇后当前项正确，归档保持 528px 滚动量，正文保持在页首。[左栏末项](regression/screenshots/archive-end-1440-light.png) |
| M4-03 · 768 × 1024，点击技术稿第二个目录项 | H3 标题盒被吸顶栏覆盖 8.31px | H3 顶边距目录底边 7.69px。375px 对照组间距为 7.19px，片段地址和当前章节均正确。[平板浅色](regression/screenshots/h3-768-light.png) · [手机深色](regression/screenshots/h3-375-dark.png) |

以上为 ego-lite 实测。修复前数据见[首轮异常读数](evidence/detail-probes.json)和[长归档记录](evidence/edge-cases.json)，修复后见[复验原始读数](regression/evidence/edge-cases.json)。

## P2 修复后的五档浏览器与性能记录

ego-lite 以 DPR 1 实测 1440 × 900、1024 × 768、768 × 1024、390 × 844、375 × 812，每档覆盖浅色和深色。每组走访正式首页、工程分类、两篇正式详情及三篇样稿。CLS 从导航前开始监听，排除近期输入，以最长 5 秒、间隔小于 1 秒的窗口求最大累计值，记录到加载、可见图片解码及字体稳定后的绘制帧。

| 375 × 812 深色，禁用缓存，120ms 延迟，下载 600,000 B/s | 字体分包 | WOFF2 传输量 | load | CLS |
| --- | ---: | ---: | ---: | ---: |
| 技术长文 | 25 | 884,968 B | 2,043 ms | 0 |
| 生活图文 | 25 | 897,488 B | 2,173 ms | 0 |
| 无图随笔 | 33 | 1,371,952 B | 2,863 ms | 0 |

每类一次受控采样，传输量取 Resource Timing 的 `transferSize`。首页和长文的五档双主题截图均已保存。[性能采样](regression/evidence/edge-cases.json) · [桌面浅色首页](regression/screenshots/home-1440-light.png) · [桌面深色长文](regression/screenshots/tech-1440-dark.png) · [手机浅色图文](regression/screenshots/life-390-light.png) · [手机深色首页](regression/screenshots/home-375-dark.png) · [全部修复后截图](regression/screenshots/)

## P2 修复时的工程检查与历史预览

| 命令 | 结果 |
| --- | --- |
| `pnpm run verify:media` | 2 篇正式文章、1 个正文媒体文件通过。[日志](regression/evidence/media.log) |
| `pnpm run check` | 检查 38 个文件，0 错误、0 警告、0 提示。[日志](regression/evidence/check.log) |
| `pnpm test` | 20 项通过、0 失败、0 跳过。新增竖图固有尺寸、长归档末项命中、平板标题完整可见三项回归。[日志](regression/evidence/test.log) |
| `pnpm run build` | 6 个静态页面及 RSS、sitemap、robots 输出构建成功。[日志](regression/evidence/build.log) |

Cloudflare Pages 将 `m4-acceptance-preview` 识别为 **Preview**。在该部署上用 ego-lite 打开首页并点击进入有图文章，两张卡片封面和正文图片均能解码。首次记录到一个字体分包 HTTP 500 和浏览器隐式请求 favicon 的 404；同一字体随后三次绕过缓存均为 200，18,412 B，SHA-256 与本地构建一致。再次加载详情页时 27 条响应均为 200，Console 无错误。该部署中的 favicon 404 记入 M4-06，修复与本地验证结果见[问题清单](ISSUES.md)。[预览地址](https://ddeaab12.qians-day.pages.dev) · [首次访问](regression/evidence/preview-smoke.json) · [字体重取与刷新](regression/evidence/preview-retry.json)

**验证边界。** 本轮移动覆盖使用 Chromium 视口和媒体特性模拟。iOS Safari、Android 物理触屏、读屏体验、生产站以及真实用户的性能分位数尚未验证。生产部署工作流和 R2 同步均未触发。
