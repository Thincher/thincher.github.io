# 个人博客

> **定位：分享渠道，不是源。** 文章先在工作台写，成型后再拷到这里发布。这里只放已经可以公开的成品。

零依赖多页静态站：每篇文章就是一个 HTML 文件，浏览器直接渲染，没有前端框架、没有 CDN、没有构建步骤。

## 两个分类

| 分类 | 放什么 | 首页位置 |
|---|---|---|
| **开源项目解析** | 单个开源项目的源码/设计分析（OpenViking、Codex、the agent harness…） | `#projects` |
| **优质博客阅读** | 优质文章的阅读笔记、精华提取、方法论、流程总结 | `#essays` |

一篇文章只归一个分类，靠首页放在哪个 `<ul>` 和文章页的 `<span class="article-cat">` 区分，不做多分类。
分类之间不加子目录，`posts/` 保持平铺，避免路径越走越深。

## 目录

```
个人博客/
├── index.html      # 首页：两个分类的文章列表（加文章时手写一行 li）
├── _template.html  # 新文章模板，复制成 posts/<slug>.html 后改
├── posts/          # 文章，一篇一个 HTML 文件
└── assets/
    ├── style.css   # 全站样式（亮/暗主题、正文排版）
    └── app.js      # 主题切换、标题锚点、年份
```

## 加一篇文章

1. 复制 `_template.html` → `posts/<slug>.html`，改 `<title>`、`<h1>`、`<span class="article-cat">`（开源项目解析 / 优质博客阅读）、`<time>`、标签和 `<meta name="description">`。
2. 正文**整段粘贴进 `<div class="prose">`**：`h2/h3`、`p`、`ul/ol`、`table`、`pre><code>`、`blockquote` 都已有样式。
3. 在 `index.html` 对应分类的 `<ul class="post-list">` 里加一行（模板里有注释示例），按日期倒序放。
4. 本地预览：`python3 -m http.server 8800`，开 `http://127.0.0.1:8800/`。

## 从工作台拷贝的约定

- 拷的是**正文片段**，不是整页 HTML；不要带 `<html>/<head>/<body>` 和站内脚本。
- 工作台里的交互组件（可点的格子、拓扑图）先不要拷——这里只收文字、表格、图片。
- 图片放 `assets/img/<slug>/`，用相对路径引用：`<img src="../assets/img/<slug>/x.png" alt="...">`。
- 需要强调用 `<div class="callout">`，警示用 `<div class="callout warn">`，提示用 `<div class="callout tip">`。
- 内部内容（项目复盘、内部资料、飞书链接）**一律不进这个仓库**——仓库是公开的，Git 历史删不干净。

## 发布

推 `main` 分支，GitHub Pages 自动发布到 <https://thincher.github.io>。

```bash
git add -A && git commit -m "新增文章：标题" && git push
```

> **改样式后必须改版本号**：`index.html` / `_template.html` 里的 `style.css?v=...`，卡片页 `posts/superagent/index.html` 里的 `cards.css?v=...`，改完把版本号一起改再推——Pages 的 CSS 缓存 10 分钟，不改版本号线上会继续用旧样式。
