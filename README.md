# 个人博客

> **定位：分享渠道，不是源。** 文章先在工作台写，成型后再拷到这里发布。这里只放已经可以公开的成品。

零依赖多页静态站：每篇文章就是一个 HTML 文件，浏览器直接渲染，没有前端框架、没有 CDN、没有构建步骤。

## 目录

```
个人博客/
├── index.html      # 首页：文章列表（加文章时手写一行 li）
├── _template.html  # 新文章模板，复制成 posts/<slug>.html 后改
├── posts/          # 文章，一篇一个 HTML 文件
└── assets/
    ├── style.css   # 全站样式（亮/暗主题、正文排版）
    └── app.js      # 主题切换、标题锚点、年份
```

## 加一篇文章

1. 复制 `_template.html` → `posts/<slug>.html`，改 `<title>`、`<h1>`、`<time>`、标签和 `<meta name="description">`。
2. 正文**整段粘贴进 `<div class="prose">`**：`h2/h3`、`p`、`ul/ol`、`table`、`pre><code>`、`blockquote` 都已有样式。
3. 在 `index.html` 的 `<ul class="post-list">` 里加一行（模板里有注释示例），按日期倒序放。
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
