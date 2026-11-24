# M4.1 · 中文阅读排版验收

2026-11-23（上海时间）· qian’s day · 分支 `feat/m4-1-typography-lab`，基于已合入 M3 的 `e1d11c4`。

**本地字体与排版通过，可将本页的 Design Tokens 用于 M4.2。生产字体 CDN 验收待补。** 对正式域名候选 WOFF2 地址携带生产页面 Origin 发起只读 HEAD，返回 HTTP/2 404。生产字体响应头、边缘缓存和大陆访问性能均未获实测。见[原始响应头](headers.txt)。

## 在本机阅读

在仓库根目录运行 `pnpm run lab:typography`。该命令构建独立的 Astro 根目录并启动本机两个 HTTP 端口。文章在 4601，字体样式表和 WOFF2 在 4602。默认主题跟随系统。可用查询参数 `theme=light|dark`、`size=17|18`、`leading=1.8|1.85|1.9`、`measure=680|700|720` 重现设置。

| 样稿 | 内容与观察位置 |
| --- | --- |
| [技术文章](http://127.0.0.1:4601/tech/) | 1,585 个汉字，含英文、数字、长命令、表格、引文与两级章节标题。滑至第一段代码可检查横向滚动。 |
| [个人随笔](http://127.0.0.1:4601/essay/) | 1,645 个汉字，13 个自然段。第六段起的截图可直接比较连续阅读密度。 |
| [生活图文](http://127.0.0.1:4601/life/) | 两张不同分辨率的真实照片，各自保留宽高、替代文本及图注。 |

三篇均为专门撰写的测试稿。生活图文使用 scikit-image 0.25.2 的 CC0 摄影，咖啡由 Rachel Michetti 拍摄，猫 Chelsea 由 Stefan van der Walt 拍摄。使用 Pillow 13.0.0 转为质量 86 的 WebP，两张图均从本地加载。[照片来源及授权](https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/_fetchers.py)

## 字体交付与许可

GitHub 官方 latest release 在核查时指向 **v1.530**，标记为正式发行。上游发布于北京时间 2026-10-18。选择比例宽度的 Regular，原始文件 `LXGWWenKai-Regular.ttf` 为 **25,928,940 B**，SHA-256 为 `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`，与 release asset 摘要一致。[官方发行](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530)

字体使用 SIL Open Font License 1.1。版权属于 LXGW 及 The Klee Project Authors。随子集分发原版 OFL 和版权声明，衍生字体延续 OFL。发行版附加许可允许仅面向网页渲染的子集化与格式转换在规定条件下保留字体名。本站自托管 WOFF2，不提供衍生桌面安装包，不单独销售字体；CSS 别名为 `Day Reading`。若扩展为面向第三方的字体分发平台，应按上游对平台的说明另行确认。[随包许可证](../../labs/typography/fonts/v1.530/OFL.txt) · [v1.530 上游说明](https://github.com/lxgw/LxgwWenKai/blob/v1.530/README.md)

使用 cn-font-split npm **7.4.3** 与 **7.6.8 WASI** 内核。原生 macOS FFI 在写完文件后两次异常退出，最终交付采用正常退出并通过码点覆盖校验的 WASI 路径。仅保留分包、CSS 与 OFL，最终文件名取 WOFF2 内容 SHA-256 的前 20 个十六进制字符。[分包工具](https://github.com/KonghaYao/cn-font-split) · [分包与输入校验脚本](../../labs/typography/split-fonts.mjs)

最终交付 **321 个 WOFF2，共 13,333,240 B**（12.72 MiB）。单包 840–103,692 B，中位数 39,836 B。字体 CSS 218,815 B，OFL 5,171 B。以 FontTools 逐包比对 CSS 声明、WOFF2 cmap、文件哈希与上游 Unicode cmap，46,926 个码点完整覆盖，范围互不重叠。

## 设计规范

[可复用 Tokens 与排版 CSS](../../labs/typography/src/styles/reading.css) 和[完整字体规则](../../labs/typography/fonts/v1.530/faces.css) 即实验页运行的两份样式源。下表的正文间距以当前正文字号为单位。每次编辑可在同一组样稿中复测。

| 项目 | 桌面 | 小屏（≤600px） |
| --- | --- | --- |
| 正文与行距 | 18px / 1.85，实际 33.3px | 17px / 1.85，实际 31.45px |
| 版心 | 最大 700px，居中 | 两侧各 20px，390 / 375px 视口下实宽 350 / 335px |
| H1 / H2 / H3 | 36 / 27 / 22px | 29 / 24 / 20px |
| 字重与标题行高 | 正文与标题 400，标题行高 1.4，均衡折行 | 同桌面 |
| 段间 / 章节前 / 小节前 | 0.95 / 2.1 / 1.55 倍正文字号 | 同桌面 |
| 小标题后接正文 | 上距 0.55em | 同桌面 |
| 引用、代码、表格及插图前后接正文 | 各留正文 1.35em。引文左线 2px，左右内距 1em | 同桌面 |
| 代码 | 系统等宽，字号为正文 0.85 倍，行高 1.65，内距 1em，可横向滚动 | 同桌面 |
| 图片及图注 | 照片最大宽 100%，按原比例，不放大；图注字号 0.85em、上距 0.6em | 同桌面 |

在 390px 上从同一自然段起截屏，17px / 1.8 能展示更多后续文字，18px / 1.9 则需要更多滑动。默认 17px / 1.85 保留每行约 20 字的容量，并在相邻行之间多留一点空隙。1440px 与 1024px 的随笔首行在推荐设置下均为 37 个字符，阅读时目光无需横跨屏幕。680 与 720px 端点的对照同时调整了字号与行高，结论针对整组设置。[17px 对照](screenshots/essay-390-light-17-middle.png) · [18px 对照](screenshots/essay-390-light-18-middle.png) · [最终手机设置](screenshots/essay-390-light-default-middle.png)

| 主题 | 纸色 / 正文色 | 正文对纸色 | 次级文字 / 对比度 | 强调文字 / 对比度 | 代码文字对底色 |
| --- | --- | ---: | --- | --- | ---: |
| 浅 | #faf8f3 / #292923 | 13.78∶1 | #615e53 / 6.12∶1 | #82503c / 6.26∶1 | 12.50∶1（#f0ede5） |
| 深 | #20211e / #e8e3d7 | 12.64∶1 | #b6b3a6 / 7.70∶1 | #e2ac91 / 8.12∶1 | 10.87∶1（#2b2d28） |

对比度按 sRGB 相对亮度计算，正文、次级、强调前景以及纸色另以页面 computed style 复核。小字也超过 4.5∶1。文章设置 `lang="zh-CN"`、`line-break: strict`、`word-break: normal` 和 `font-synthesis: none`；长标识符可断行，预格式文本由代码块内滚动承接。

## 字体加载与缓存

1. 文档头加载一份 `faces.css`，跨源链接带 `crossorigin="anonymous"`。每个 face 仅声明 400、normal、`font-display: swap` 和实际码点范围，使用相对于 CSS 的 WOFF2 URL。浏览器根据当前文档字符选包，全页没有字体预加载或 `src: local()`。
2. 正文优先使用 `"Day Reading"`，回退到设备自带中文字体。代码使用 `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`。CDP 在三类样稿首段均报告 `LXGWWenKai-Regular`、`isCustomFont: true`，代码报告本机 `Menlo-Regular`。
3. WOFF2 返回 `font/woff2` 及 `public, max-age=31536000, immutable`，新文件使用新哈希键。CSS 使用 gzip、ETag、`Vary: Accept-Encoding` 与 `no-cache`，允许再次校验。
4. 本地响应显式允许页面 Origin，并设置相同的 `Timing-Allow-Origin` 以测量跨源传输。未来采用正式 CDN 时，允许来源应改为 `https://qians.day`，保留历史键、许可与 CSS。当前 M3 同步器只接收 `media/fonts/*.woff2` 的扁平目录；版本目录、CSS、许可和发布顺序需在获准发布时接入。

## ego-lite 浏览器实测

2026-11-23，macOS 26.7 / arm64，ego-browser 2.2.1，Chromium 156，Node.js 24.18.0，pnpm 10.22.0。实际浏览器打开 Astro 静态构建；本机两个 loopback origin 经 HTTP/1.1 通信。CDP 将 CSS 视口设为 1440×900、1024×768、390×844、375×812，DPR 1，小屏使用移动布局模拟。本轮设备覆盖限于该 Chromium 环境。

**矩阵共 72 项。** 每个视口 × 两种主题 × 三类文章，分别运行 17/1.8/680、18/1.9/720 和响应式推荐值。逐行取 DOM Range 检查中文行首闭标点、行末开标点；逐页测量标题行数、列宽、图像解码尺寸与代码滚动。样本文本共检查 3,988 个渲染行次（包含主题与视口复测），所列禁则字符未见违规，页面横向溢出为 0。375px 的默认技术样稿中，长标题两行，代码块宽 335px、内容宽 1169px，块内可滚动 834px，页面横坐标保持 0。早期截图中的 H2 有一字独行，启用标题均衡换行后复检。照片从 600×400 与 451×300 的原始尺寸自适应；窄屏的表格保有列对应关系。[逐项记录](matrix.json) · [复测程序](../../labs/typography/measure.mjs)

| 检查位置 | 桌面原图 | 手机原图 |
| --- | --- | --- |
| 长文首屏及连续阅读 | [1440 浅色首屏](screenshots/essay-1440-light-default-top.png) · [1024 深色中段](screenshots/essay-1024-dark-default-middle.png) | [375 深色首屏](screenshots/essay-375-dark-default-top.png) · [390 浅色中段](screenshots/essay-390-light-default-middle.png) |
| 技术标题、代码和表格 | [1440 标题](screenshots/tech-1440-light-default-top.png) · [代码与表格](screenshots/tech-1440-light-default-code.png) | [375 标题](screenshots/tech-375-dark-default-top.png) · [代码与表格](screenshots/tech-375-dark-default-code.png) |
| 生活照片与图注 | [1440 首图](screenshots/life-1440-light-default-top.png) · [第二张照片](screenshots/life-1440-light-default-photo.png) | [375 首图](screenshots/life-375-dark-default-top.png) · [第二张照片](screenshots/life-375-dark-default-photo.png) |

### 冷访、复访与字体交换

1440 和 375px 各测三篇。冷访在目标标签页绕开 HTTP 缓存；随后恢复正常缓存、访问一次预热，再通过新的文档导航测复访。慢速试验另设 CDP 延迟 100ms、下载 600,000 B/s、上传 200,000 B/s，同时绕开缓存。各条件单次采样。每个字体都有成功加载与可访问的 Resource Timing；表中传输量取 Chromium 的 `transferSize`，含其协议开销记账，压缩正文取 `encodedBodySize`。二者均为 WOFF2 小计。时间由导航起点量至最后一个字体的 `responseEnd`，涵盖整篇已排版内容使用的字体。

| 页面 | 冷访 WOFF2 请求 | 正文字节 | 冷访传输 | 复访 WOFF2 传输 | 本机冷访 ms¹ | 限速冷访 ms¹ |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 技术 | 23 | 805,560 B | 812,460 B | 0 B | 43.4 / 41.6 | 1858.3 / 1860.0 |
| 随笔 | 30 | 1,332,212 B | 1,341,212 B | 0 B | 52.6 / 50.1 | 2734.9 / 2730.3 |
| 图文 | 22 | 780,680 B | 787,280 B | 0 B | 46.9 / 43.1 | 1925.8 / 1928.3 |

¹ 时间顺序为 1440px / 375px。两档视口的按需分包数量与字节一致。字体 CSS 另有 1 次请求，冷访 gzip 正文 73,017 B、传输 73,317 B；复访 ETag 校验记为 300 B。6 次正常复访中，所有 WOFF2 的传输字节均为 0。

18 次性能导航的最大初始 CLS 为 **0.000201**，其中 375px 的 9 次为 0。限速换字前后，技术 / 随笔 / 图文在桌面的文章高度分别保持 2,867 / 2,193 / 1,328px，在 375px 上分别保持 4,085 / 3,643 / 1,134px。桌面仍记录到细小位移，因此总高度相同并不等于所有字形位置相同。

在页面脚本执行前安装 LayoutShift observer，排除近期输入，按 1 秒间隔、最长 5 秒窗口计算最大累计值；另按帧记录已加载 face 数、文章高度与首段高度。慢速条件使回退字体实际可见，从 0 个 face 到全部就绪的前后记录均已保存。CLS 覆盖本次初始渲染到字体稳定的区间。[逐字体字节、时间、换字高度和位移记录](network.json)

**生产待验。** 本地验证了浏览器端 CORS、样式表重新校验、WOFF2 强缓存和初始布局稳定性。候选正式路径目前返回 404，Cloudflare 的 HTTP/2 错误响应无法验证字体缓存。获准准备预发布或生产字体对象后，应在真实页面来源下重跑冷访和复访，并从中国大陆网络采集访问结果。长随笔首次字体传输超过 1.3 MB，建议将它作为大陆移动网络复验的首篇样稿。

## 复现与工程回归

### 生成字体

以下命令从仓库根目录执行，在临时目录生成一份新的交付包，并对照原始字体检查覆盖范围。分包器在重建时可能将少数符号分配到相邻子集中；本次重复生成的 321 个文件中有 320 个字节一致，两份产物均覆盖完整字符集。发布时应将同次生成的 CSS、子集和许可作为一组，以仓库中的哈希文件重现本次测量。常规阅读与构建直接使用已打包文件，无需安装分包工具。

```sh
font_work=$(mktemp -d)
npm install --prefix "$font_work" --ignore-scripts --no-audit --no-fund cn-font-split@7.4.3
curl -fL https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf -o "$font_work/upstream.ttf"
curl -fL https://github.com/KonghaYao/cn-font-split/releases/download/7.6.8/libffi-wasm32-wasip1.wasm -o "$font_work/node_modules/cn-font-split/dist/libffi-wasm32-wasip1.wasm"
node labs/typography/split-fonts.mjs "$font_work" "$font_work/packed"
uv run --no-project --with fonttools==4.68.0 --with brotli==1.2.1 python labs/typography/verify-fonts.py "$font_work/upstream.ttf" "$font_work/packed"
```

### 运行验证

```sh
pnpm run verify:media
pnpm run check
pnpm test
pnpm run build
pnpm run lab:typography
```

保留末条命令的服务，另开终端，在仓库根目录执行以下命令。复测数据写入新的临时目录，可与本报告的原始数据比较。一次运行包含静态页面导航、限速与缓存实验、渲染测量和截图。

```sh
ego-browser skill
m41_output=$(mktemp -d)
node --input-type=module - "$m41_output" <<'JS' | ego-browser nodejs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const script = pathToFileURL(resolve('labs/typography/measure.mjs')).href;
console.log([
  'const task = await taskSpace("M4.1 本地复验");',
  'console.log({ spaceId: task.spaceId });',
  'const { audit } = await import(' + JSON.stringify(script) + ');',
  'await audit(task,' + JSON.stringify(process.argv[2]) + ');',
].join('\n'));
JS
```

检查输出及截图后，用同一 spaceId 调用 `task.finish({ keep: [] })` 结束复验。测试不需要清空个人浏览器数据。额外的 [glyphs.json](glyphs.json) 记录了正文、表格、图注与文章标题的逐节点字形核对汇总，三页共 53 个节点，全部由自托管 Regular 绘制。

M3 媒体校验通过（2 篇文章、1 个正文媒体文件），Astro 检查 0 错误、0 警告，原有 12 项测试全部通过，正式构建生成 6 个页面以及订阅、站点地图和 robots 输出。正式 dist 中未发现实验路由、样稿照片或 WOFF2。

| 变更位置 | 用途 |
| --- | --- |
| `package.json`、仓库 README | 本地实验入口 |
| `labs/typography/src/`、`astro.config.mjs`、`public/photos/` | 独立 Astro 页面、阅读样稿、Tokens 与照片 |
| `labs/typography/fonts/v1.530/`、`split-fonts.mjs`、`verify-fonts.py` | 版本化分包、字体样式与上游许可、可复现生成 |
| `labs/typography/serve.mjs`、`measure.mjs` | 跨源字体服务、ego-lite 实测程序 |
| `docs/m4.1/` | 规范、响应头、测量明细、18 张原始浏览器 PNG |
