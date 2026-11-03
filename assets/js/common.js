/* =============================================================
   公共脚本：主题、日期、阅读时长、封面渲染、入场动画
   （纯原生 JS，无需构建，file:// 直接打开也能运行）
   ============================================================= */

(function () {
  "use strict";

  var THEME_KEY = "linshen-theme";
  var FONT_KEY = "linshen-font";

  var root = document.documentElement;

  /* ---------- 主题 ---------- */
  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function setTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {
        /* 隐私模式下忽略 */
      }
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var isDark = theme === "dark";
      btn.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
      btn.setAttribute("aria-pressed", String(isDark));
      btn.setAttribute("title", isDark ? "切换到浅色模式" : "切换到深色模式");
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#14110e" : "#f3ebdd");
  }

  function initTheme() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(currentTheme() === "dark" ? "light" : "dark", true);
      });
    });
    setTheme(currentTheme(), false);
  }

  /* ---------- 日期与阅读时长 ---------- */
  function parseDate(str) {
    var parts = String(str).split("-").map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDate(str) {
    var d = parseDate(str);
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  function formatShort(str) {
    var d = parseDate(str);
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
  }

  function readingTime(html) {
    var text = String(html || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, "");
    var minutes = Math.max(1, Math.round(text.length / 380));
    return minutes + " 分钟";
  }

  function plainText(html) {
    return String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ---------- 封面：有图用图，无图用 CSS + SVG 装饰 ---------- */
  var MOTIFS = [
    /* 0 · 落日与地平线 */
    '<circle cx="268" cy="118" r="54" fill="rgba(253,246,236,0.30)"/>' +
      '<circle cx="268" cy="118" r="54" fill="none" stroke="rgba(253,246,236,0.55)" stroke-width="1.5"/>' +
      '<path d="M0 196h400M0 214h400M0 232h400" stroke="rgba(253,246,236,0.28)" stroke-width="1"/>' +
      '<path d="M40 196c40-26 78-26 118 0" fill="none" stroke="rgba(253,246,236,0.5)" stroke-width="1.5"/>' +
      '<path d="M150 196c34-18 66-18 100 0" fill="none" stroke="rgba(253,246,236,0.38)" stroke-width="1.5"/>' +
      '<circle cx="88" cy="72" r="3" fill="rgba(253,246,236,0.55)"/>' +
      '<circle cx="128" cy="46" r="2" fill="rgba(253,246,236,0.4)"/>',
    /* 1 · 叶子 */
    '<path d="M200 258C200 190 200 130 196 74" fill="none" stroke="rgba(253,246,236,0.55)" stroke-width="1.6"/>' +
      '<path d="M197 96c-30-8-52-30-50-56 26 2 46 20 50 56Z" fill="rgba(253,246,236,0.22)" stroke="rgba(253,246,236,0.5)" stroke-width="1.3"/>' +
      '<path d="M198 140c30-10 50-34 46-60-26 4-44 24-46 60Z" fill="rgba(253,246,236,0.16)" stroke="rgba(253,246,236,0.45)" stroke-width="1.3"/>' +
      '<path d="M198 186c-28-10-46-32-44-56 24 4 42 22 44 56Z" fill="rgba(253,246,236,0.2)" stroke="rgba(253,246,236,0.45)" stroke-width="1.3"/>' +
      '<path d="M199 226c28-10 46-30 42-54-24 4-40 22-42 54Z" fill="rgba(253,246,236,0.14)" stroke="rgba(253,246,236,0.4)" stroke-width="1.3"/>',
    /* 2 · 书脊 */
    '<rect x="86" y="96" width="34" height="132" rx="2" fill="rgba(253,246,236,0.18)" stroke="rgba(253,246,236,0.5)" stroke-width="1.2"/>' +
      '<rect x="128" y="74" width="30" height="154" rx="2" fill="rgba(253,246,236,0.10)" stroke="rgba(253,246,236,0.42)" stroke-width="1.2"/>' +
      '<rect x="166" y="110" width="40" height="118" rx="2" fill="rgba(253,246,236,0.24)" stroke="rgba(253,246,236,0.55)" stroke-width="1.2"/>' +
      '<rect x="214" y="86" width="26" height="142" rx="2" fill="rgba(253,246,236,0.12)" stroke="rgba(253,246,236,0.4)" stroke-width="1.2"/>' +
      '<rect x="248" y="122" width="36" height="106" rx="2" fill="rgba(253,246,236,0.16)" stroke="rgba(253,246,236,0.45)" stroke-width="1.2"/>' +
      '<path d="M96 118h14M138 96h10M176 132h20M222 108h10M256 144h20" stroke="rgba(253,246,236,0.55)" stroke-width="1.6"/>' +
      '<path d="M70 228h260" stroke="rgba(253,246,236,0.45)" stroke-width="1.4"/>',
    /* 3 · 窗 */
    '<rect x="104" y="62" width="192" height="176" rx="4" fill="rgba(253,246,236,0.10)" stroke="rgba(253,246,236,0.55)" stroke-width="1.4"/>' +
      '<path d="M104 150h192M200 62v176" stroke="rgba(253,246,236,0.45)" stroke-width="1.4"/>' +
      '<path d="M120 182l60-56v96zM216 96l60 64v-64z" fill="rgba(253,246,236,0.14)"/>' +
      '<path d="M104 238h192" stroke="rgba(253,246,236,0.35)" stroke-width="6"/>',
    /* 4 · 山丘 */
    '<path d="M0 214c48-44 92-44 140 0s92 44 140 0 92-44 120 0v86H0Z" fill="rgba(253,246,236,0.14)" stroke="rgba(253,246,236,0.45)" stroke-width="1.3"/>' +
      '<path d="M0 246c54-30 96-30 150 0s96 30 150 0 70-22 100-6v60H0Z" fill="rgba(253,246,236,0.10)" stroke="rgba(253,246,236,0.32)" stroke-width="1.2"/>' +
      '<circle cx="300" cy="86" r="26" fill="rgba(253,246,236,0.22)"/>',
    /* 5 · 水波 */
    '<path d="M-20 108c40-26 80-26 120 0s80 26 120 0 80-26 120 0 80 26 120 0" fill="none" stroke="rgba(253,246,236,0.5)" stroke-width="1.5"/>' +
      '<path d="M-20 148c40-26 80-26 120 0s80 26 120 0 80-26 120 0 80 26 120 0" fill="none" stroke="rgba(253,246,236,0.35)" stroke-width="1.4"/>' +
      '<path d="M-20 188c40-26 80-26 120 0s80 26 120 0 80-26 120 0 80 26 120 0" fill="none" stroke="rgba(253,246,236,0.24)" stroke-width="1.3"/>' +
      '<circle cx="118" cy="70" r="20" fill="rgba(253,246,236,0.25)"/>'
  ];

  function coverMarkup(post, index, extraClass, eager) {
    var variant = Math.abs(index) % MOTIFS.length;
    var classes = "cover cover--v" + variant + (extraClass ? " " + extraClass : "");
    if (post && post.cover) {
      return (
        '<div class="' +
        classes +
        '"><img src="' +
        post.cover +
        '" alt="《' +
        escapeHtml(post.title) +
        '》封面"' +
        (eager ? "" : ' loading="lazy"') +
        "></div>"
      );
    }
    return (
      '<div class="' +
      classes +
      ' cover--art" aria-hidden="true">' +
      '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      MOTIFS[variant] +
      "</svg></div>"
    );
  }

  /* ---------- 小工具 ---------- */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function postUrl(post) {
    /* 用 hash 而不是查询参数：本地双击打开、部分预览器里 hash 更不容易被丢掉 */
    return "post.html#" + encodeURIComponent(post.id);
  }

  function tagUrl(tag) {
    return "index.html?tag=" + encodeURIComponent(tag);
  }

  function initFooter() {
    var top = document.querySelector("[data-to-top]");
    if (top) {
      top.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function restoreFontSize() {
    var article = document.querySelector(".article");
    if (!article) return;
    var saved = null;
    try {
      saved = localStorage.getItem(FONT_KEY);
    } catch (e) {}
    var size = saved === "s" || saved === "l" ? saved : "m";
    article.setAttribute("data-size", size);
    document.querySelectorAll("[data-font]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-font") === size));
    });
  }

  function initFontControls() {
    var article = document.querySelector(".article");
    if (!article) return;
    restoreFontSize();
    document.querySelectorAll("[data-font]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var size = btn.getAttribute("data-font");
        article.setAttribute("data-size", size);
        try {
          localStorage.setItem(FONT_KEY, size);
        } catch (e) {}
        document.querySelectorAll("[data-font]").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
      });
    });
  }

  window.BlogUI = {
    THEME_KEY: THEME_KEY,
    FONT_KEY: FONT_KEY,
    formatDate: formatDate,
    formatShort: formatShort,
    readingTime: readingTime,
    plainText: plainText,
    coverMarkup: coverMarkup,
    escapeHtml: escapeHtml,
    postUrl: postUrl,
    tagUrl: tagUrl,
    initTheme: initTheme,
    setTheme: setTheme,
    currentTheme: currentTheme,
    initFontControls: initFontControls,
    initFooter: initFooter
  };

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initFooter();
  });
})();
