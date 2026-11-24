# 骞言碎语 · qians.day

Astro 静态内容站。首页和分类页默认按年份、日期展示图文卡片。页首阅读设置可切换图文卡片与标题列表、主题和文章大纲。主题默认随系统，大纲默认完整。分类、文章、RSS 和 Sitemap 共用同一份已发布文章查询。

## 本地运行

使用 Node.js 24 和项目锁定的 pnpm 10.22.0。在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认从生产 CDN 读取图片，字体直接取自仓库。编辑尚未上传的图片时，可用 `MEDIA_BASE_URL=/ pnpm dev --force`。此时开发服务器从文章目录读取图片，浏览器使用与 R2 相同的 `/posts/<articleId>/<filename>` 路径。

## Markdown 文章

每篇文章保存为 `src/content/posts/<articleId>/index.md`。客户端在创建文章时分配一次 ID，后续编辑沿用同一目录与 ID。新客户端可生成 ULID，现有 M2 ID 继续有效。标题、分类与发布日期均可独立编辑。Slug 决定公开地址 `/posts/<slug>/`，发布后应保留。RSS 以文章 ID 标识条目。

```markdown
---
articleId: '01K00000000000000000000001'
title: '一篇新文章'
slug: 'first-note'
description: '这篇文章在列表、订阅和搜索结果中使用的摘要。'
publishedAt: '2026-11-22'
category: engineering
tags: ['Astro']
status: draft
---

在这里写正文。

## 小节标题

文章目录收录二级至六级标题，常用二、三级标题组织正文。
```

- 发布时将 `status` 改为 `published`。省略状态时默认为草稿。两个状态都接受校验，只有已发布文章生成公开页面并进入 RSS 和 Sitemap。
- GitHub 仓库及 PR 公开可读，包括草稿正文和图片。私密草稿请保存在本机。
- 分类键与中文名称维护在 [categories.json](src/lib/categories.json)。[内容 Schema](src/lib/content-model.ts) 供 Astro 与命令行校验共用。运行 `pnpm exec astro sync` 会生成 `.astro/collections/posts.schema.json`，供编辑器读取。
- ID 和 Slug 在草稿及已发布文章中全局唯一。分类与标签可省略。发布日期建议使用带引号的 `YYYY-MM-DD`。

## 媒体

先生成 WebP，再取文件内容 SHA-256 的前 12 位小写十六进制字符，命名为 `assets/<name>-<hash>.webp`。修改图片时生成新文件名。纯文字文章只需 `index.md`。

正文使用 `![说明](./assets/<name>-<hash>.webp)`，也支持 Markdown 引用式图片。封面取 Markdown 语法树中按正文顺序出现的第一张图片。代码示例、普通链接和未使用的引用定义不会成为封面。缺图、非约定路径或错误哈希会导致校验失败。

Remark 在 Astro 收集静态资源前将图片地址改写为 `https://site-cdn.qians.day/posts/<articleId>/<filename>`。正文和卡片共用这个结果。预览其他 CDN 时可在构建前设置 `MEDIA_BASE_URL`。

无图文章使用共享占位图 `media/site/card-placeholder.webp`。所有图文卡片按 5∶3 展示封面，日期、标题和摘要排列在封面下方。独占一段的 Markdown 图片可用可选 title 写图注，例如 `![画面说明](./assets/<name>-<hash>.webp "摄影署名")`。

## 字体托管与构建

霞鹜文楷 Regular v1.530 的原始发布材料保存在 `labs/typography/fonts/v1.530/`。321 个 WOFF2 合计 13,333,240 字节。版本化的 `faces.css` 使用相对 URL、原有的 `unicode-range` 和 `font-display: swap`。校验器锁定样式表和 OFL 许可的 SHA-256，逐一检查分包文件签名、内容哈希和引用完整性。[字体清单校验](scripts/font-assets.mjs)

| 场景 | 命令 | 浏览器的字体来源 |
| --- | --- | --- |
| 本地开发 | `pnpm dev` | Vite 提供仓库内的实验室字体 |
| 本地静态预览、PR 浏览器测试、Pages 分支预览 | `pnpm run build:preview` | 将同一组文件复制到预览产物的 `fonts/lxgw-wenkai/v1.530/`。运行 `pnpm preview` 会重新生成并启动这种预览 |
| 正式 Pages | `pnpm run build` | 六个页面共用 CDN 样式表，生产 `dist/` 只保存站点文件。[字体样式表](https://site-cdn.qians.day/fonts/lxgw-wenkai/v1.530/faces.css) |
| 排版实验室 | `pnpm run lab:typography` | 本机 4601 端口提供页面、4602 端口提供字体，可独立复现跨域加载 |

两种静态构建都生成 `dist/`。部署时从对应命令的全新产物上传。哈希 WOFF2 的媒体类型为 `font/woff2`，缓存为 `public, max-age=31536000, immutable`。版本化 CSS 为 `text/css`，CSS 和 OFL 均设置 `public, no-cache` 以便重新校验。

## 检查与发布

```sh
pnpm run verify:media
pnpm run check
pnpm test
pnpm run build
pnpm run preview
```

浏览器回归测试使用本机 Google Chrome 稳定版。无 Chrome 的开发机可先执行 `pnpm exec playwright-core install chrome`。测试在临时目录构造文章、构建站点并打开移动端尺寸的浏览器，结束后自动清理。

PR 的 `validate` 使用 Node.js 24 LTS 和只读仓库权限执行媒体校验、类型检查、测试与生产构建。浏览器测试使用独立预览字体，上传和 CDN 校验由生产作业执行。

正式发布在 `main` 的 `production` 环境按以下顺序执行。[部署工作流](.github/workflows/deploy.yml)

1. `verify:media` 校验文章、图片和全部字体，确认目标桶为 `website`。
2. `sync:media` 按对象键检查 WebP、共享占位图和字体。仅创建缺失对象，条件写入保护并发上传。字体样式表最后上传。重跑可从上次已成功的对象继续。
3. `verify:cdn-fonts` 带正式 Origin 从公网 CDN GET 全部 323 个对象并逐个比对内容哈希、MIME、缓存策略和 CORS 响应头。
4. 前序步骤全部成功后，Astro 构建生产站点，Wrangler 发布到 `qians-day` 的 `main`。

生产配置沿用仓库变量 `R2_BUCKET=website` 及 Actions secrets `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`。

**Cloudflare 跨域配置。** 已在 R2 → `website` → Settings → CORS Policy 核实允许 `https://qians.day`、`https://qians-day.pages.dev` 和 `http://localhost:4632` 发起 `GET` 和 `HEAD`。Pages 分支预览自带字体。以后若新增直接读取 CDN 的固定入口，将其精确 Origin 加入允许列表。若改规则后 CDN 仍返回旧响应，可刷新受影响的字体 URL 再验证。项目目前没有配置 CSP；若由边缘规则另行下发 CSP，有效的 `style-src`（或 `style-src-elem`）和 `font-src` 均需允许 `https://site-cdn.qians.day`。[本次响应头实测](docs/acceptance/font-migration/cloudflare.json) · [Cloudflare R2 CORS 文档](https://developers.cloudflare.com/r2/buckets/cors/)

## M4.1 阅读排版实验

运行 `pnpm run lab:typography`，打开 [本地随笔样稿](http://127.0.0.1:4601/essay/)。[排版规范与浏览器验收报告](docs/m4.1/README.md) 包含三类样稿、字体来源、Design Tokens、网络数据和原始截图。

## M4.2 整站视觉系统

[视觉验收记录](docs/m4.2/README.md) 包含正式首页、长文与图文样稿的真实浏览器截图、主题和断点说明。运行 `node docs/m4.2/preview.mjs` 可阅读带样稿的本地静态预览。
