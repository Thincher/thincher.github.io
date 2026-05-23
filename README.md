# Thincher Blog

一个部署在 GitHub Pages 上的静态个人博客。

## 写文章

1. 在 `posts/` 目录新增 Markdown 文件。
2. 在文章顶部添加 front matter：

```md
---
title: 文章标题
date: 2026-05-23
category: 分类
tags: [标签一, 标签二]
description: 文章摘要
---
```

3. 在 `posts/index.json` 只登记 Markdown 文件路径，例如 `"posts/example.md"`。

文章标题、日期、分类、标签和摘要都以 Markdown 文件顶部的 front matter 为准，不要在索引里重复维护。

## 功能

- 分类与标签筛选
- Markdown 渲染
- Mermaid 图表渲染
- 无需构建步骤，可直接由 GitHub Pages 托管
