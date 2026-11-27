# 骞言碎语 · M5.5 综合验收

**2026-11-28 · M5 工程验收通过，完整签收仍有待确认事项。** 三项 P2 已修复并复测，未发现 P0/P1，也没有已复现的缺陷阻断 M6 开发。正式访客评论加载已通过。真实 GitHub 登录与写入仍待授权，正式产物保留了基线已经公开的两篇 M2 部署冒烟文章。 [问题清单](ISSUES.md) · [性能报告](PERFORMANCE.md)

## 基线与测试环境

远端 `main` 为 `dc51f2917cb89319c45bcb0c4dbeb6b38d55e562`，初始工作区干净。`fix/m5-integration` 由该提交创建。第一父链包含 Pagefind `bcdafdc`（#4）、PhotoSwipe `bfa4cd1`（#5）、阅读交互 `75d12ff`（#6）、Giscus `dc51f29`（#7）。逐阶段交付与遗留事项均纳入核对。 [M5.1](../../m5.1/README.md) · [M5.2](../../m5.2/README.md) · [M5.3](../../m5.3/README.md) · [M5.4](../../m5.4/README.md) · [M4 最终验收](../M4-ACCEPTANCE.md)

- **生产构建。** Node 24.18.0、pnpm 10.22.0、冻结锁文件。`pnpm run build` 生成 6 页，保留生产 CDN 地址。公开正式域名供访客评论及真实网络只读检查。候选代码用本机静态产物和隔离 Giscus 路由复测。 [构建](evidence/build.log) · [生产产物](evidence/artifacts.json)
- **隔离样稿。** 运行 `node docs/m4.2/preview.mjs`，在临时目录完整构建技术长文、两张照片的无分类生活文、无图无分类随笔及两个生产样本。工程分类覆盖分类筛选，另用自动测试的多年份长归档、无分类、草稿和修改前后文章验证边界。 [预览入口](../../m4.2/preview.mjs) · [回归入口](../../../tests/site.test.mjs)
- **浏览器。** Ego Lite Chromium 156 的 60 次导航覆盖 6 路由 × 5 档视口 × 2 主题，另执行交互和故障检查。Chromium 的 IME、触控和弱网使用浏览器协议模拟。Playwright WebKit 27.2 补测桌面和 iPhone 13 视口。 [页面矩阵](evidence/matrix.json) · [WebKit](evidence/webkit.json)

## 模块与跨模块验收

| 模块 | 本轮证据与结论 |
| --- | --- |
| Pagefind | **已实测，通过。** 简中正文「媒体同步」返回主文并高亮；自动化覆盖中英混搜、摘要、标题优先、无分类、分页、过期请求、空状态与无结果。CDP 实际组合输入提交前无结果，提交后才查询；方向键、Enter、Escape 和焦点可用。修复从结果后退时遗留模态框。拦截入口模块后出现中文提示且可退出继续阅读。 [交互](evidence/interactions.json) · [故障](evidence/faults.json) · [搜索截图](screenshots/search-ime-1440-light.png) |
| PhotoSwipe | **已实测，通过。** 单图和多图、键盘切换、双击缩放、触控双指及横滑、出错提示、无 JS 原图链接。关闭后原缩略图重新获得焦点并恢复正文滚动。打开时 `/` 不叠加搜索；节制动效时仍可切换。WebKit 复测切图和 Escape。 [交互](evidence/interactions.json) · [捏合截图](screenshots/gallery-pinch-390-dark.png) · [测试](evidence/test.log) |
| 段落分享 | **已实测，通过。** 自动浏览器验证剪贴板写入、可复制范围、刷新和深链，覆盖段落插入后的重新定位，以及歧义和删除后的提示。Chromium 确认 URL 参数按文字处理，无法匹配时保留页面，打开沉浸和搜索后仍能回到段落阅读。 [交互](evidence/interactions.json) · [高亮截图](screenshots/shared-paragraph-1440-light.png) · [测试](evidence/test.log) |
| 首页与分类 | **已实测，通过。** 首页默认图文卡片、有图首图封面、无图共享封面均保留。无分类文章出现在首页和详情全部文章，工程分类仅收录有该分类的文章。Chromium 回归覆盖首页和分类返回、列表／卡片偏好、切换视图后按目标文章校正滚动；直接访问归档从页首开始。 [页面矩阵](evidence/matrix.json) · [首页截图](screenshots/home-1440-light.png) · [测试](evidence/test.log) |
| 沉浸阅读 | **已实测，通过。** 鼠标宽屏的 `I` 及按钮可切换，保留正文锚点。刷新、跨文章导航、历史返回和收窄窗口回普通阅读；浅深主题继续记忆。搜索、灯箱或设置弹出时快捷键让位，搜索退出恢复至沉浸入口。触控小视口维持普通模式。 [交互](evidence/interactions.json) · [测试](evidence/test.log) |
| 文章导航与目录 | **已实测，通过。** 宽屏侧栏涵盖全部已发布篇目及当前篇，窄屏保留文末翻页和首页。技术稿章节跳转更新 Hash 及目录当前项，关闭浮层。移动有 44 px 点击目标，内部滚动不带走正文；密集和深层目录、长归档末项可操作。 [页面矩阵](evidence/matrix.json) · [移动目录截图](screenshots/touch-outline-390-dark.png) · [测试](evidence/test.log) |
| Giscus | **已实测，访客路径通过。** 短文手动加载，隔离长文滚到评论区才加载。正式 iframe 的 term、严格匹配、分类和 Canonical 回链实测，改标题／Slug 保持 Article ID 的行为由重建回归覆盖。隔离验证系统／手动主题同步、沉浸复用 iframe、服务及超时失败、重试与焦点、来源和 iframe 校验。正式 iframe 从浅色随系统切到深色，同一 iframe 继续使用。正式脚本阻断后也可在原页重试恢复。 [正式访客](evidence/giscus-live.json) · [正式评论截图](screenshots/production-comments-light.png) · [故障](evidence/faults.json) · [重试截图](screenshots/comments-retry-375-light.png) · [测试](evidence/test.log) |

普通阅读、模态搜索、图片灯箱、临时沉浸及目录浮层均纳入交互复验。浏览器历史、选中文字 Hash、章节 Hash 和页面恢复按上表各入口观测。自动化断言搜索与灯箱不会并开，以 BFCache 和非缓存历史分别核验归档滚动。 [交互](evidence/interactions.json) · [测试](evidence/test.log)

## 五档视口

每档包含浅色和深色的首页、分类、技术长文、多图生活文、无图随笔和正式有图文章。60 组常规加载均无整页横向溢出、首屏增强资源请求、Console 错误或失败资源。 [完整矩阵](evidence/matrix.json)

| 视口 | 技术稿正文实宽 | 导航呈现 | 截图 |
| --- | ---: | --- | --- |
| 1440 × 900 | 700 px | 全部文章和目录侧栏 | [首页浅色](screenshots/home-1440-light.png) |
| 1024 × 768 | 700 px | 目录侧栏、文末翻页 | [长文深色](screenshots/lab-tech-1024-dark.png) |
| 768 × 1024 | 700 px | 标题区目录浮层、文末翻页 | [长文深色](screenshots/lab-tech-768-dark.png) |
| 390 × 844 | 350 px | 触控目录浮层、文末翻页 | [多图浅色](screenshots/lab-life-390-light.png) · [WebKit 章节](screenshots/webkit-toc-390-light.png) |
| 375 × 812 | 335 px | 触控目录浮层、文末翻页 | [长文深色](screenshots/lab-tech-375-dark.png) |

## 异常、安全及工程回归

- **已实测。** 分别拦截 Pagefind、Giscus、WebP 与字体样式表，正文仍可阅读。坏图保留占位，灯箱提示错误且可退出。拒绝读写 localStorage／sessionStorage 后，站点默认卡片，切换当页可用，重载回默认。375 px 生活文限速为 120 ms 延迟、600,000 B/s 下载，采样 load 2.14 s，首图正常解码。减少动态效果覆盖灯箱和评论加载笔刷。 [故障记录](evidence/faults.json) · [测试](evidence/test.log)
- **已实测及源码确认。** 浏览器隔离回归拒绝错来源或错 iframe 的 Giscus 消息。源码中主题消息使用固定 HTTPS 目标，接收同时核对 `origin` 和 `source`。搜索标题与元数据用 `textContent`，Pagefind 转义片段后才加 `mark`，结果链接来自同一构建生成的已发布页面索引。段落 Hash 限长度并逐字段解析，选择文字、匹配后的整段高亮和状态通知均使用原生文本 API。 [Giscus 接收端](../../../src/components/Comments.astro) · [搜索渲染](../../../src/components/SiteSearch.astro) · [段落参数](../../../src/lib/paragraph-share.ts)
- **已执行。** 媒体校验通过（2 篇、1 个正文媒体、323 个字体对象）。类型检查 0 错误、0 警告、2 条既有 IME 兼容提示；42 项测试全通过，完整生产构建及 Pagefind 索引生成成功。索引只有两篇已发布文章，测试夹具和草稿未进入正式输出。文本产物的常见令牌／私钥特征扫描零命中。 [媒体](evidence/media.log) · [类型](evidence/check.log) · [测试](evidence/test.log) · [构建](evidence/build.log) · [产物检查](evidence/artifacts.json)
- **已执行及源码确认。** R2 增量同步仿真覆盖分页、并发、补件、字体 CSS 最后发布、失败重跑及 CDN 全量／冒烟切换。正式 CDN 从公开地址只读 GET 323 个对象，全部通过字节、MIME、缓存和正式站 CORS 校验。PR 和生产工作流、媒体同步、字体发布及 CDN 脚本与 M4 后基线相同。 [CDN 校验](evidence/cdn-fonts.log) · [PR 工作流](../../../.github/workflows/pr-check.yml) · [生产工作流](../../../.github/workflows/deploy.yml)

**尚未验证。** 真实 GitHub 登录及首次建帖、评论、回复和表情待授权。Safari WebDriver session 超时，已补 WebKit；实体 Safari、手机原生选区手柄和实机读屏仍未覆盖。生产写入与该候选的正式部署未执行。M6 的启动没有已发现的工程阻断。 [遗留事项](ISSUES.md)

## Giscus 视觉补验

`pnpm run preview:comments /posts/m2-smoke-test/` 在独立 Chrome 窗口加载本地生产产物。真实 `giscus.app` iframe 按该篇文章 ID 读取公开讨论，主题 CSS 取自本地。预览观察到一条真实点赞，当时尚无公开留言。访客预览拦截登录和写入。 [预览命令](../../../README.md#用真实-giscus-预览评论)

1440 × 900 深色、768 × 1024 浅色及 390 × 844 深色实测表情贴齐输入框左边缘，输入框圆角 10 px，主按钮 999 px，触控按钮保持 44 px。隔离回归补入真实 Giscus 的冲突选择器和登录态 DOM，验证隐藏主输入框的退出入口。线上字体分包在本轮采样仍发生跨域失败，截图里的评论文字使用后备字体。 [桌面](screenshots/real-giscus-1440-dark.png) · [平板](screenshots/real-giscus-768-light.png) · [手机](screenshots/real-giscus-390-dark.png)
