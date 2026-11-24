# 骞言碎语 · M4.1–M4.4 最终工程验收

**2026-11-25 工程验收通过。** 首轮发现的三项 P2 已按原条件复验通过，作者文档已更正。现有记录中没有开放的 P0、P1 或 P2。手机迷你大纲的选章热区待人工决策，预览站标签页图标延期处理。[问题清单](ISSUES.md) · [首轮逐项报告](M4-BASELINE.md)

分支为 `feat/m4-2-visual-system`。首轮基线为 `996b6b2`，应用修复及预览构建对应 `4c7b6c7`，竖图测试样本在 `fb11ec9` 补强。正式内容为两篇工程文章；长文、生活图文、无分类随笔、长归档均在临时夹具中验收。[Pages 独立预览](https://ddeaab12.qians-day.pages.dev) · [部署环境与来源](regression/evidence/preview.json) · [夹具启动方法](evidence/复现环境.md)

## 里程碑结果

| 里程碑 | 最终结论 | 验证与证据 |
| --- | --- | --- |
| M4.1 视觉系统 | 通过 | 五档宽度、深浅主题下品牌均为「骞言碎语」。CDP 抽查七个场景的品牌或首段，实际绘制字体均为 `LXGWWenKai-Regular`。768px 及以上为 18px，390、375px 为 17px。Tokens、字体声明与许可沿用首轮源码核查。[字体与页面矩阵](regression/evidence/matrix.json) · [首轮排版参数及源码索引](M4-BASELINE.md) |
| M4.2 首页与导航 | 通过 | 正式首页与工程分类页均在五档宽度和两种主题走访。两篇有图／无图文章都可进入；卡片首图、共享封面正常显示。另有 10 组已保存列表的全新导航，均恢复列表。分类过滤、键盘操作、设置焦点与偏好记忆由浏览器自动化回归覆盖。[列表记忆及 Reduced Motion](regression/evidence/edge-cases.json) · [自动测试](regression/evidence/test.log) |
| M4.3 文章详情 | 通过；一项可选交互待决策 | 宽屏左侧归档、右侧目录，窄屏文末归档、横向目录均可用。正式文章及三类样稿均校验篇目数和当前链接。慢图占位、长归档末项、平板 H3 跳转通过专项复验。表格和代码、深层目录、滚动恢复与触控操作覆盖范围见两轮记录。迷你模式维持既有行为。[专项实测](regression/evidence/edge-cases.json) · [首轮正文与键盘证据](M4-BASELINE.md) · [P3 状态](ISSUES.md) |
| M4.4 综合回归 | 通过 | 70 组常规页面与 10 组列表导航均无整页横向溢出。70 组常规页面记录到 1,880 条 HTTP 200／304 响应、0 个请求失败、0 条 Console 或运行时错误；普通加载最大 CLS 为 0.000200。预览公网检查单列如下。[逐组网络、字节、CLS 和 Console 记录](regression/evidence/matrix.json) |

## P2 复验

| 问题与原触发条件 | 修复前 | 修复后 |
| --- | --- | --- |
| M4-01 · WebP 延迟 2 秒，禁用缓存 | 390px 图注移动 233px，CLS 0.2422；1440px 移动 400px，CLS 0.3994 | 构建产物写入固有宽高。两张图在两档视口中均于图片返回前完成占位，加载前后图注纵坐标一致，CLS 均为 0。[手机加载前](regression/screenshots/photo-before-390-light.png) · [加载后](regression/screenshots/photo-after-390-light.png) |
| M4-02 · 34 篇文章，1440 × 900，只滚动左栏 | 末项底边 985.02px，位于可视区外 | 末项底边 896.02px，可实际点击。进入末篇后当前项正确，归档保持 528px 滚动量，正文保持在页首。[左栏末项](regression/screenshots/archive-end-1440-light.png) |
| M4-03 · 768 × 1024，点击技术稿第二个目录项 | H3 标题盒被吸顶栏覆盖 8.31px | H3 顶边距目录底边 7.69px。375px 对照组间距为 7.19px，片段地址和当前章节均正确。[平板浅色](regression/screenshots/h3-768-light.png) · [手机深色](regression/screenshots/h3-375-dark.png) |

以上为 ego-lite 实测。修复前数据见[首轮异常读数](evidence/detail-probes.json)和[长归档记录](evidence/edge-cases.json)，修复后见[复验原始读数](regression/evidence/edge-cases.json)。

## 浏览器与性能

ego-lite 以 DPR 1 实测 1440 × 900、1024 × 768、768 × 1024、390 × 844、375 × 812，每档覆盖浅色和深色。每组走访正式首页、工程分类、两篇正式详情及三篇样稿。CLS 从导航前开始监听，排除近期输入，以最长 5 秒、间隔小于 1 秒的窗口求最大累计值，记录到加载、可见图片解码及字体稳定后的绘制帧。

| 375 × 812 深色，禁用缓存，120ms 延迟，下载 600,000 B/s | 字体分包 | WOFF2 传输量 | load | CLS |
| --- | ---: | ---: | ---: | ---: |
| 技术长文 | 25 | 884,968 B | 2,043 ms | 0 |
| 生活图文 | 25 | 897,488 B | 2,173 ms | 0 |
| 无图随笔 | 33 | 1,371,952 B | 2,863 ms | 0 |

每类一次受控采样，传输量取 Resource Timing 的 `transferSize`。首页和长文的五档双主题截图均已保存。[性能采样](regression/evidence/edge-cases.json) · [桌面浅色首页](regression/screenshots/home-1440-light.png) · [桌面深色长文](regression/screenshots/tech-1440-dark.png) · [手机浅色图文](regression/screenshots/life-390-light.png) · [手机深色首页](regression/screenshots/home-375-dark.png) · [全部修复后截图](regression/screenshots/)

## 工程检查与预览

| 命令 | 结果 |
| --- | --- |
| `pnpm run verify:media` | 2 篇正式文章、1 个正文媒体文件通过。[日志](regression/evidence/media.log) |
| `pnpm run check` | 检查 38 个文件，0 错误、0 警告、0 提示。[日志](regression/evidence/check.log) |
| `pnpm test` | 20 项通过、0 失败、0 跳过。新增竖图固有尺寸、长归档末项命中、平板标题完整可见三项回归。[日志](regression/evidence/test.log) |
| `pnpm run build` | 6 个静态页面及 RSS、sitemap、robots 输出构建成功。[日志](regression/evidence/build.log) |

Cloudflare Pages 将 `m4-acceptance-preview` 识别为 **Preview**。在该部署上用 ego-lite 打开首页并点击进入有图文章，两张卡片封面和正文图片均能解码。首次记录到一个字体分包 HTTP 500 和浏览器隐式请求 favicon 的 404；同一字体随后三次绕过缓存均为 200，18,412 B，SHA-256 与本地构建一致。再次加载详情页时 27 条响应均为 200，Console 无错误。favicon 记入 M4-06。[预览地址](https://ddeaab12.qians-day.pages.dev) · [首次访问](regression/evidence/preview-smoke.json) · [字体重取与刷新](regression/evidence/preview-retry.json)

**验证边界。** 本轮移动覆盖使用 Chromium 视口和媒体特性模拟。iOS Safari、Android 物理触屏、读屏体验、生产站以及真实用户的性能分位数尚未验证。生产部署工作流和 R2 同步均未触发。
