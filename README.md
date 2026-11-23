# 骞言碎语 · qians.day

Astro 静态内容站。首页和分类页默认按年份、日期展示图文卡片。页首阅读设置可切换图文卡片与标题列表、主题和文章大纲。主题默认随系统，大纲默认完整。分类、文章、RSS 和 Sitemap 共用同一份已发布文章查询。

## 本地运行

使用 Node.js 24 和项目锁定的 pnpm 10.22.0。在仓库根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认使用生产 CDN，与 `pnpm build && pnpm preview` 的图片地址一致。编辑尚未上传的图片时，可用 `MEDIA_BASE_URL=/ pnpm dev --force`。此时开发服务器从文章目录读取图片，浏览器使用与 R2 相同的 `/posts/<articleId>/<filename>` 路径。

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

文章目录使用二级和三级标题。
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

## 检查与发布

```sh
pnpm run verify:media
pnpm run check
pnpm test
pnpm run build
pnpm run preview
```

浏览器回归测试使用本机 Google Chrome 稳定版。无 Chrome 的开发机可先执行 `pnpm exec playwright-core install chrome`。测试在临时目录构造文章、构建站点并打开移动端尺寸的浏览器，结束后自动清理。

PR 的 `validate` 作业执行内容校验、类型检查、测试与构建。合并到 `main` 后，生产工作流先将已发布文章的 WebP 同步到 R2，再构建并将 `dist/` 上传至 Cloudflare Pages 项目 `qians-day`。已存在的对象按键跳过，历史对象保留。字体同步继续使用 `media/fonts/*.woff2`。

生产配置沿用仓库变量 `R2_BUCKET`（当前为 `website`）及 Actions secrets `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`。PR 检查只需仓库读取权限。

## M4.1 阅读排版实验

运行 `pnpm run lab:typography`，打开 [本地随笔样稿](http://127.0.0.1:4601/essay/)。[排版规范与浏览器验收报告](docs/m4.1/README.md) 包含三类样稿、字体来源、Design Tokens、网络数据和原始截图。

## M4.2 整站视觉系统

[视觉验收记录](docs/m4.2/README.md) 包含正式首页、长文与图文样稿的真实浏览器截图、主题和断点说明。运行 `node docs/m4.2/preview.mjs` 可阅读带样稿的本地静态预览。
