const state = {
  posts: [],
  query: "",
  category: "全部",
  tag: "",
};

const app = document.querySelector("#app");
const searchInput = document.querySelector("#search-input");
const categoryList = document.querySelector("#category-list");
const tagList = document.querySelector("#tag-list");
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

const themeLabels = {
  auto: "自动",
  light: "亮色",
  dark: "暗色",
};

const escapeHtml = (value = "") =>
  value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);

const formatDate = (date) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));

const slugify = (value) =>
  encodeURIComponent(String(value).trim().toLowerCase().replace(/\s+/g, "-"));

const getStoredTheme = () => localStorage.getItem("theme-mode") || "auto";

const getResolvedTheme = (mode) =>
  mode === "auto" ? (themeMedia.matches ? "dark" : "light") : mode;

const applyTheme = (mode) => {
  const resolved = getResolvedTheme(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = resolved;
  themeLabel.textContent = themeLabels[mode];
  mermaid.initialize({ startOnLoad: false, theme: resolved === "dark" ? "dark" : "neutral" });
};

const cycleTheme = () => {
  const current = getStoredTheme();
  const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
  localStorage.setItem("theme-mode", next);
  applyTheme(next);
};

const parseFrontMatter = (markdown) => {
  if (!markdown.startsWith("---")) {
    return { data: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, body: markdown };
  }

  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 4).trim();
  const data = {};

  raw.split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  });

  return { data, body };
};

const activateMermaidBlocks = () => {
  document.querySelectorAll("pre code.language-mermaid").forEach((block) => {
    const container = document.createElement("div");
    container.className = "mermaid";
    container.textContent = block.textContent;
    block.closest("pre").replaceWith(container);
  });
};

const sortPosts = (posts) =>
  [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

const renderFilters = () => {
  const categories = ["全部", ...new Set(state.posts.map((post) => post.category))];
  const tags = [...new Set(state.posts.flatMap((post) => post.tags || []))];

  categoryList.innerHTML = categories.map((category) => {
    const count = category === "全部"
      ? state.posts.length
      : state.posts.filter((post) => post.category === category).length;
    const active = state.category === category ? " active" : "";
    return `<button class="filter-button${active}" data-category="${escapeHtml(category)}">
      <span>${escapeHtml(category)}</span><span>${count}</span>
    </button>`;
  }).join("");

  tagList.innerHTML = tags.map((tag) => {
    const active = state.tag === tag ? " active" : "";
    return `<button class="tag-button${active}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
  }).join("");
};

const getFilteredPosts = () => {
  const query = state.query.trim().toLowerCase();

  return sortPosts(state.posts).filter((post) => {
    const matchesCategory = state.category === "全部" || post.category === state.category;
    const matchesTag = !state.tag || (post.tags || []).includes(state.tag);
    const haystack = [
      post.title,
      post.description,
      post.category,
      ...(post.tags || []),
    ].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesCategory && matchesTag && matchesQuery;
  });
};

const renderPostList = () => {
  const posts = getFilteredPosts();

  if (!posts.length) {
    app.innerHTML = `<div class="empty">没有找到匹配的文章。</div>`;
    return;
  }

  app.innerHTML = `<div class="post-list">
    ${posts.map((post) => `<a class="post-card" href="#/post/${slugify(post.slug)}">
      <div class="post-meta">
        <span>${formatDate(post.date)}</span>
        <span>·</span>
        <span>${escapeHtml(post.category)}</span>
      </div>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.description || "")}</p>
      <div class="post-tags">
        ${(post.tags || []).map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("")}
      </div>
    </a>`).join("")}
  </div>`;
};

const renderArchive = () => {
  const rows = sortPosts(state.posts).map((post) => `<div class="archive-row">
    <time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time>
    <a href="#/post/${slugify(post.slug)}">${escapeHtml(post.title)}</a>
    <span>${escapeHtml(post.category)}</span>
  </div>`).join("");

  app.innerHTML = `<div class="article">
    <div class="article-header">
      <a class="back-link" href="#/">返回文章</a>
      <h1>归档</h1>
      <p class="article-meta">${state.posts.length} 篇文章</p>
    </div>
    <div class="archive">${rows}</div>
  </div>`;
};

const renderArticle = async (slug) => {
  const post = state.posts.find((item) => slugify(item.slug) === slug);

  if (!post) {
    app.innerHTML = `<div class="empty">这篇文章不存在。</div>`;
    return;
  }

  const response = await fetch(post.file);
  if (!response.ok) {
    app.innerHTML = `<div class="empty">文章加载失败。</div>`;
    return;
  }

  const markdown = await response.text();
  const parsed = parseFrontMatter(markdown);
  const title = parsed.data.title || post.title;
  const date = parsed.data.date || post.date;
  const category = parsed.data.category || post.category;
  const tags = parsed.data.tags || post.tags || [];

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const html = DOMPurify.sanitize(marked.parse(parsed.body), {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
  });

  app.innerHTML = `<article class="article">
    <header class="article-header">
      <a class="back-link" href="#/">返回文章</a>
      <div class="article-meta">
        <time datetime="${escapeHtml(date)}">${formatDate(date)}</time>
        <span>·</span>
        <span>${escapeHtml(category)}</span>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <div class="post-tags">
        ${tags.map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("")}
      </div>
    </header>
    <div class="article-body">${html}</div>
  </article>`;

  activateMermaidBlocks();
  await mermaid.run({ querySelector: ".mermaid" });
};

const setActiveNav = () => {
  const route = location.hash || "#/";
  const isPost = route.startsWith("#/post/");
  document.querySelectorAll(".site-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === route || (isPost && href === "#/"));
  });
};

const route = async () => {
  setActiveNav();
  const hash = location.hash || "#/";
  const [, section, slug] = hash.split("/");

  if (section === "post" && slug) {
    await renderArticle(slug);
    return;
  }

  if (section === "archive") {
    renderArchive();
    return;
  }

  renderPostList();
};

const init = async () => {
  document.querySelector("#year").textContent = new Date().getFullYear();
  applyTheme(getStoredTheme());

  const response = await fetch("posts/index.json");
  state.posts = await response.json();
  renderFilters();
  await route();
};

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.tag = "";
  renderFilters();
  location.hash = "#/";
  renderPostList();
});

tagList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  state.tag = state.tag === button.dataset.tag ? "" : button.dataset.tag;
  renderFilters();
  location.hash = "#/";
  renderPostList();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  location.hash = "#/";
  renderPostList();
});

window.addEventListener("hashchange", route);
themeToggle.addEventListener("click", cycleTheme);
themeMedia.addEventListener("change", () => {
  if (getStoredTheme() === "auto") applyTheme("auto");
});

init().catch((error) => {
  console.error(error);
  app.innerHTML = `<div class="empty">博客初始化失败，请稍后再试。</div>`;
});
