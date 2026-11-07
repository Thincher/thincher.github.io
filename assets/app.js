/* ============================================================
   站点脚本：主题切换 + 标题锚点 + 年份。零依赖，几十行。
   ============================================================ */

(function () {
  var root = document.documentElement;

  /* ---------- 主题 ---------- */

  function currentTheme() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? '切换到浅色' : '切换到深色');
    }
  }

  if (!root.dataset.theme) {
    applyTheme(
      localStorage.getItem('theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });

  /* ---------- 标题锚点：h2/h3 自动生成 id，hover 显示 # ---------- */

  document.querySelectorAll('.prose h2, .prose h3').forEach(function (h) {
    if (!h.id) {
      h.id = h.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    var a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-hidden', 'true');
    h.appendChild(a);
  });

  /* ---------- 年份 ---------- */

  var year = String(new Date().getFullYear());
  document.querySelectorAll('#year, .year').forEach(function (el) {
    el.textContent = year;
  });
})();
