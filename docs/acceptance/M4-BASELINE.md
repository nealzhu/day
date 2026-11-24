# 骞言碎语 · 2026-11-24 首轮验收快照

**结论：有条件通过，待确认问题清单后签收。** 类型检查、17 项现有测试和生产构建均通过。ego-lite 在五档视口、两种系统主题下完成 70 组页面测量，并对保存后的标题列表追加 10 组导航检查。核心阅读路径可用。图片延迟返回、桌面长归档和 768px 目录跳转各有一项 P2，另有两项 P3，未发现 P0/P1。[问题清单及复现步骤](ISSUES.md)

## 基线与证据口径

| 项目 | 本轮使用的对象 |
| --- | --- |
| 版本 | 2026-11-24（上海时间），`nealzhu/day` 本地开发分支 `feat/m4-2-visual-system`，提交 `996b6b22a9d04aac433c23bb7073dc1b43868628`。检查开始时暂存区和工作树干净。[基线](evidence/baseline.txt) |
| 正式内容 | 从该提交导出的临时副本执行生产构建，用本机 Astro preview 提供页面。两篇正式文章均属于「工程」，同日发布，一篇有图、一篇无图。浏览器按构建生成的公开 CDN 地址只读加载图片。[构建日志](evidence/build.log) · [网络记录](evidence/network-console.json) |
| 样稿 | 使用仓库的预览程序在独立临时工程构建同一套站点组件，保留两篇正式文章并加入六篇样稿。技术长文有分类、表格、代码与 H2/H3；生活图文有两张带图注的照片且无分类；长随笔无图、无分类。34 篇文章的长归档另用临时夹具。[样稿生成程序](../m4.2/preview.mjs) · [专项复现环境](evidence/复现环境.md) |
| 浏览器 | macOS 上的 ego-lite，CLI 技能指南 v2.2.1，浏览器 UA 报告 Chrome 156。截图为 DPR 1 的真实浏览器视口；手机尺寸、系统主题、Reduced Motion 和触控事件由 Chromium 模拟。原有测试另行启动本机 Chrome。[浏览器与补充测量](evidence/supplement.json) · [原有测试结果](evidence/test.log) |

**已实测**指本轮浏览器操作、运行时测量或执行的工程命令。**仅源码核查**指只确认了规则或来源。**尚未验证**的环境和指标列在末节。历史 M4 文档仅用于核对设计意图。

## M4.1 · 品牌、字体与排版

| 检查项 | 结论与证据 |
| --- | --- |
| 品牌和一致性 | **已实测，通过。** 正式首页、分类页、文章的页首统一显示「骞言碎语」，页面标题带同一品牌。截图中导航、设置、元信息、分隔线和页脚沿用同一套排版和用色。[首页浅色](screenshots/home-1440-light.png) · [分类索引深色](screenshots/categories-1440-dark.png) · [手机正式文章](screenshots/published-390-light.png) |
| 正文字体 | **已实测，通过。** 字体按需加载。对七个场景抽查页首字标或正文首段，CDP 实际绘制字体均为自托管的 `LXGWWenKai-Regular`，字标覆盖全部四个字。代码抽样为本机 `Menlo-Regular`。浏览器测到正文继承字重 400。[字形来源](evidence/rendered-fonts.json) · [代码字体](evidence/supplement.json) · [字号和字重](evidence/matrix.json) |
| 中文阅读参数 | **已实测，通过。** 桌面及 768px 为 18px／33.3px 行高，手机为 17px／31.45px。技术稿连续段距分别为 17.1px 与 16.15px，实际行首禁则属性为 `line-break: strict`。正文实宽见下方断点表。图注、标题和代码块可在独立截图核对。[读数](evidence/matrix.json) · [无图长随笔](screenshots/essay-1440-dark.png) · [图文](screenshots/life-390-light.png) |
| Design Tokens | **仅源码核查，通过。** 全站变量集中定义正文字体、等宽字体、标题层级、行高、正文宽度、段距、留白、主题颜色、焦点及动效。正文和布局组件引用这些变量。CSS 字体别名为 Day Reading，分包声明指定 normal、400、swap。字体版本和许可文件在仓库随包提供。[全站 Tokens](../../src/styles/site.css) · [正文样式](../../src/styles/prose.css) · [字体声明](../../labs/typography/fonts/v1.530/faces.css) · [OFL](../../labs/typography/fonts/v1.530/OFL.txt) |
| 系统与手动主题 | **已实测，通过。** 矩阵中每组实际主题均匹配系统。浅色纸面／文字为 `#faf8f3`／`#292923`，深色为 `#20211e`／`#e8e3d7`。设置深色后刷新并进入分类页仍为深色；系统深色时显式选浅色，进入另一篇文章后仍为浅色。[主题矩阵](evidence/matrix.json) · [设置操作](evidence/interactions.json) · [反向覆盖](evidence/light-override.json) |

## M4.2 · 首页与导航

| 检查项 | 结论与证据 |
| --- | --- |
| 分类导航与计数 | **已实测，通过。** 首页「全部」和分类页「工程」分别正确高亮。由页首进入工程分类、由页脚进入分类索引，再由索引返回工程分类均成功。混合样稿的首页列出 8 篇，索引计数与工程页的 5 篇一致。[导航与篇目记录](evidence/interactions.json) · [正式工程页](screenshots/engineering-768-dark.png) |
| 无分类文章 | **已实测，通过。** 生活图文与无图随笔出现在「全部」及详情归档，未进入工程列表，详情元信息无分类链接。草稿、有无 category 的 RSS 与 sitemap 行为另由本轮现有测试核验。[文章与分类条目](evidence/matrix.json) · [分类筛选结果](evidence/interactions.json) · [测试断言](../../tests/site.test.mjs) · [执行结果](evidence/test.log) |
| 默认卡片与无图封面 | **已实测，通过。** 正式首页首次为卡片。有图文章载入 320 × 180 的首图，无图文章载入 768 × 432 的共享 WebP，装饰图替代文本为空。两张卡片在 1440px 下的封面框同为约 378 × 227px；无图文章详情未插入该封面。[正式首页](screenshots/home-1440-light.png) · [无图详情](screenshots/published-no-image-1440-dark.png) · [图像解码尺寸与地址](evidence/matrix.json) |
| 标题列表与状态记忆 | **已实测，通过。** 设置中选「列表」后图片隐藏，标题、日期、摘要可见。刷新、跨分类及五档宽度 × 两主题的全新导航均恢复列表。禁用缓存后单独加载已保存的列表，正式和样稿首页均未收到图片响应。热缓存导航中有图片资源记录，因此只对冷读样本作此传输结论。[宽屏列表](screenshots/list-1440-dark.png) · [手机列表](screenshots/list-375-light.png) · [追加 10 组](evidence/edge-cases.json) · [正式冷读](evidence/supplement.json) |
| 交互和焦点 | **已实测，通过。** 鼠标悬停打开设置，可连续选列表和深色。标题悬停显出强调色及同色下划线。Tab 首先到「跳到正文」，Enter 后再 Tab 进入主区第一篇。键盘打开设置后 Tab 到「图文卡片」，Space 选择，Esc 关闭并将焦点还给设置按钮；焦点轮廓可见。[键盘截图](screenshots/keyboard-settings-1440-dark.png) · [交互序列](evidence/interactions.json) · [跳过导航后的焦点](evidence/edge-cases.json) |

## M4.3 · 文章详情

| 检查项 | 结论与证据 |
| --- | --- |
| 全部已发布文章、排序、当前项 | **已实测，通过。** 正式两篇、混合样稿八篇均完整列出，按发布日期降序，同日依文章 ID 升序。各被测详情页的当前链接与路径一致并有高亮。现有浏览器回归另以 32 篇已发布文章和草稿检查次序及隔离。[浏览器篇目及当前项](evidence/matrix.json) · [排序规则](../../src/lib/posts.ts) · [回归日志](evidence/test.log) |
| 左侧归档与滚动记忆 | **已实测，部分通过。** 1440px 为左栏，窄屏移至文末。在 1440 × 350 的八篇样稿中将归档滚至 150px，点击末篇后实测恢复到 150px，当前项同步更新。另在 1440 × 900、34 篇的长归档复现末项落在屏外，见 M4-02。[恢复前后值](evidence/interactions.json) · [长归档现场](screenshots/archive-clipped-1440-light.png) |
| 完整目录与高亮 | **已实测，部分通过。** 技术稿的六个 H2/H3 均映射到对应标题，点击 H3 后 URL 片段和当前章节均更新。深层样稿也收入 H4–H6。桌面目录在右侧，手机和平板改为横向吸顶栏。768px 跳转后标题上缘与吸顶栏相交，见 M4-03；作者示例与实际层级范围见 M4-05。[章节、目标及坐标](evidence/detail-probes.json) · [桌面三栏](screenshots/tech-1440-light.png) · [手机跳转](screenshots/chapter-375-light.png) |
| 迷你目录 | **已实测，部分通过。** 键盘聚焦显示章名，Enter 跳转。模拟触控第一次轻点预览，再点同一节点跳转。24 × 10px 热区对落点敏感，见 M4-04。已有回归还覆盖短末章、长目录滚至末项与焦点预览。[触控轨迹](evidence/detail-probes.json) · [键盘与热区](evidence/interactions.json) · [回归结果](evidence/test.log) |
| 正文图片与图注 | **已实测，部分通过。** 两张生活照片均解码，替代文本、图注和署名存在，宽度适应正文。只延迟图片时，加载前没有预留高度，图注和正文发生较大位移，见 M4-01。[图文深色](screenshots/life-390-dark.png) · [加载前后读数](evidence/detail-probes.json) |
| 表格与代码 | **已实测，通过。** 普通表在正文内排版。375px 的宽表容器实宽 335px，内容宽 1850px，聚焦后按右方向键可独立滚动，页面横向位移为 0。技术稿长命令可键盘聚焦并横向阅读。[短表](screenshots/table-375-light.png) · [宽表](screenshots/wide-table-375-dark.png) · [长命令焦点](screenshots/code-375-light.png) · [宽表读数](evidence/edge-cases.json) |
| 无目录／无图详情 | **已实测，通过。** 正式无图短文与无标题的长随笔均能阅读，未出现空目录或占位封面，仍有文章归档。[正式无图文章](screenshots/published-no-image-1440-dark.png) · [无分类长随笔](screenshots/essay-1440-dark.png) · [详情矩阵](evidence/matrix.json) |

## M4.4 · 视口、网络、性能与工程回归

每档均以系统浅色和深色走访正式首页、工程页、两篇正式详情，以及技术、生活、随笔三篇样稿。下表为技术稿正文实宽与导航位置。70 组均满足指定视口，整页横向溢出为 0；独立的目录、代码和表格滚动另行测量。[逐组测量](evidence/matrix.json)

| CSS 视口 | 正文 | 全部文章／完整目录 | 正式首页 | 技术长文 |
| --- | ---: | --- | --- | --- |
| 1440 × 900 | 700px | 左栏／右栏 | [浅](screenshots/home-1440-light.png) · [深](screenshots/home-1440-dark.png) | [浅](screenshots/tech-1440-light.png) · [深](screenshots/tech-1440-dark.png) |
| 1024 × 768 | 700px | 文末／右栏 | [浅](screenshots/home-1024-light.png) · [深](screenshots/home-1024-dark.png) | [浅](screenshots/tech-1024-light.png) · [深](screenshots/tech-1024-dark.png) |
| 768 × 1024 | 700px | 文末／顶部横栏 | [浅](screenshots/home-768-light.png) · [深](screenshots/home-768-dark.png) | [浅](screenshots/tech-768-light.png) · [深](screenshots/tech-768-dark.png) |
| 390 × 844 | 350px | 文末／顶部横栏 | [浅](screenshots/home-390-light.png) · [深](screenshots/home-390-dark.png) | [浅](screenshots/tech-390-light.png) · [深](screenshots/tech-390-dark.png) |
| 375 × 812 | 335px | 文末／顶部横栏 | [浅](screenshots/home-375-light.png) · [深](screenshots/home-375-dark.png) | [浅](screenshots/tech-375-light.png) · [深](screenshots/tech-375-dark.png) |

| 专项 | 本轮结果 |
| --- | --- |
| Console 与网络 | **已实测，通过。** 在 70 组导航中启用 CDP Network、Runtime、Log，记录到 1,880 条响应（185 条 200、1,695 条 304），其中字体响应 1,550 条。未记录到 Console 消息、运行时异常、请求失败或 HTTP 4xx/5xx。另行访问不存在的本地路径正确返回自定义 404，返回首页链接可用。[逐页面状态及事件](evidence/network-console.json) · [404 状态](evidence/supplement.json) · [返回首页操作](evidence/interactions.json) |
| 布局偏移 | **已实测，部分通过。** 从导航前开始监听 LayoutShift，排除近期输入，以 1 秒间隔、最长 5 秒的会话窗口求最大累计值。普通矩阵观测至字体就绪、可视图片解码及后续绘制帧，最大为 0.000200。图片单独延迟 2 秒时，390px 和 1440px 发生明显位移。不同网络条件的值分别保留。[矩阵](evidence/matrix.json) · [延迟图片实验](evidence/detail-probes.json) |
| Reduced Motion | **已实测，通过。** 375px 模拟 reduce 后，手动切回卡片时封面动画为 none，标题及设置过渡为 0s；迷你目录刻度过渡为 0s、提示动画为 none。设置、目录和键盘操作仍有效。正常动态偏好下设置图标过渡为 0.1s。[减少动态效果](evidence/interactions.json) · [正常偏好对照](evidence/light-override.json) |
| 自动检查 | **已执行，全部通过。** `pnpm run verify:media` 校验 2 篇、1 个媒体文件；`pnpm run check` 检查 38 个文件，0 错误、警告、提示；`pnpm test` 17 项通过、0 失败或跳过；`pnpm run build` 生成 6 个静态页面及 RSS、sitemap、robots 输出。各原始日志末尾均记录退出码。[媒体](evidence/media.log) · [类型](evidence/check.log) · [测试](evidence/test.log) · [构建](evidence/build.log) |

### 手机限速冷读

在 375 × 812 样稿页禁用缓存，设置 CDP 延迟 120ms、下载 600,000 B/s、上传 200,000 B/s。每页采一次；下表字节数为 Resource Timing 中 WOFF2 的 `transferSize` 总和，load 为导航起点到 load 事件结束。三次均测得 CLS 0。生活图文在恢复正常网络与缓存后的复访，字体传输合计 7,500 B，load 为 27ms。[逐请求字节、时序及缓存对照](evidence/performance.json)

| 样稿 | 请求字体分包 | 字体传输 | load |
| --- | ---: | ---: | ---: |
| 技术长文 | 25 | 884,968 B | 2,038 ms |
| 生活图文 | 25 | 897,488 B | 2,180 ms |
| 无图随笔 | 33 | 1,371,952 B | 2,851 ms |

### 尚未验证

- **设备与辅助技术**：本轮完成 ego-lite 真实渲染、键盘和模拟触控。iOS Safari、Android 实机的手指选择精度、移动浏览器地址栏伸缩、物理设备读屏体验尚未验证。
- **生产与性能**：正式 HTML 部署、生产字体缓存头、不同地区／运营商网络和真实用户的 CLS 分位数尚未验证。浏览器读取到了两张公开 CDN 图片。本地预览与受控限速读数只代表本次条件。
- **字体范围**：已对品牌和首段抽样核对实际绘制字体。本轮未逐字复核全站字形，也未重做上游字体全量码点、构建哈希和授权核验。

验收成果集中于本目录，含 39 张 PNG。[全部截图](screenshots/) · [原始记录](evidence/) · [待确认的问题清单](ISSUES.md)
