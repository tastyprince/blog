/* =============================================================
   文章页逻辑：读取 ?id= 渲染正文、阅读进度、字号、复制链接、上下篇
   ============================================================= */

(function () {
  "use strict";

  var BLOG = window.BLOG || { site: {}, posts: [] };
  var UI = window.BlogUI;

  var posts = (BLOG.posts || [])
    .slice()
    .sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

  var root = document.querySelector("[data-post-root]");
  var missing = document.querySelector("[data-post-missing]");
  var titleEl = document.querySelector("[data-post-title]");
  var tagsEl = document.querySelector("[data-post-tags]");
  var excerptEl = document.querySelector("[data-post-excerpt]");
  var metaEl = document.querySelector("[data-post-meta]");
  var contentEl = document.querySelector("[data-post-content]");
  var coverEl = document.querySelector("[data-post-cover]");
  var navEl = document.querySelector("[data-post-nav]");
  var progressEl = document.querySelector("[data-progress]");

  function getId() {
    var id = "";
    try {
      id = decodeURIComponent(String(window.location.hash || "").replace(/^#/, ""));
      id = id.replace(/^id=/, "");
    } catch (e) {
      id = "";
    }
    if (!id) {
      try {
        id = new URLSearchParams(window.location.search).get("id") || "";
      } catch (e) {}
    }
    return id.trim();
  }

  function siteTitle() {
    var dt = (window.DESIGN && window.DESIGN.text) || {};
    return dt.siteTitle || (BLOG.site && BLOG.site.title) || "王子猪博客";
  }

  function showMissing(withId) {
    if (root) root.hidden = true;
    if (missing) missing.hidden = false;

    var title = document.querySelector("[data-missing-title]");
    var text = document.querySelector("[data-missing-text]");
    if (title) title.textContent = withId ? "这一页还没有写" : "想读哪一篇？";
    if (text) {
      text.textContent = withId
        ? "文章可能被移动或改名了。下面是全部手记，挑一篇继续读吧。"
        : "这是文章详情页，需要先选中一篇。从下面挑一篇，或者回到首页随便逛逛。";
    }

    var list = document.querySelector("[data-missing-list]");
    if (list) {
      list.innerHTML = posts
        .map(function (p) {
          return (
            '<a href="' +
            UI.postUrl(p) +
            '"><span>' +
            UI.escapeHtml(p.title) +
            '</span><time datetime="' +
            p.date +
            '">' +
            UI.formatShort(p.date) +
            "</time></a>"
          );
        })
        .join("");
    }

    document.title = (withId ? "没有找到这篇文章" : "全部手记") + " · " + siteTitle();
  }

  function fillNav(index) {
    if (!navEl) return;
    var older = posts[index + 1];
    var newer = posts[index - 1];

    function item(post, kind) {
      if (!post) {
        return (
          '<div class="post-nav__item post-nav__item--' + kind + ' is-empty">' +
          '<span class="post-nav__label">' + (kind === "next" ? "下一篇" : "上一篇") + "</span>" +
          '<span class="post-nav__title">已经是全部了</span>' +
          "</div>"
        );
      }
      return (
        '<a class="post-nav__item post-nav__item--' + kind + '" href="' + UI.postUrl(post) + '">' +
        '<span class="post-nav__label">' + (kind === "next" ? "下一篇" : "上一篇") + "</span>" +
        '<span class="post-nav__title">' + UI.escapeHtml(post.title) + "</span>" +
        "</a>"
      );
    }

    navEl.innerHTML = item(older, "prev") + item(newer, "next");
  }

  function fillProgress() {
    if (!progressEl) return;
    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progressEl.style.setProperty("--progress", value.toFixed(4));
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update);
    update();
  }

  function initCopy() {
    var btn = document.querySelector("[data-copy]");
    var label = document.querySelector("[data-copy-label]");
    if (!btn || !label) return;

    function done() {
      btn.classList.add("is-done");
      label.textContent = "已复制";
      window.setTimeout(function () {
        btn.classList.remove("is-done");
        label.textContent = "复制链接";
      }, 2000);
    }

    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        label.textContent = "请手动复制";
      }
      document.body.removeChild(ta);
    }

    btn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(window.location.href).then(done, fallback);
      } else {
        fallback();
      }
    });
  }

  function render(post, index) {
    var site = BLOG.site || {};
    if (root) root.hidden = false;
    if (missing) missing.hidden = true;

    document.title = post.title + " · " + siteTitle();
    var desc = document.querySelector('meta[name="description"]');
    if (desc && post.excerpt) desc.setAttribute("content", post.excerpt);

    if (titleEl) titleEl.textContent = post.title;
    if (excerptEl) excerptEl.textContent = post.excerpt || "";

    if (tagsEl) {
      tagsEl.innerHTML = (post.tags || [])
        .map(function (t) {
          return '<a class="tag" href="' + UI.tagUrl(t) + '">' + UI.escapeHtml(t) + "</a>";
        })
        .join("");
    }

    if (metaEl) {
      metaEl.innerHTML =
        '<time datetime="' + post.date + '">' + UI.formatDate(post.date) + "</time>" +
        '<span class="meta__dot" aria-hidden="true"></span>' +
        "<span>阅读约 " + UI.readingTime(post.content) + "</span>";
    }

    if (coverEl) {
      if (post.cover) {
        coverEl.hidden = false;
        coverEl.innerHTML = UI.coverMarkup(post, index, "", true);
      } else {
        coverEl.hidden = true;
        coverEl.innerHTML = "";
      }
    }

    if (contentEl) contentEl.innerHTML = post.content || "";

    if (window.DesignLoader && window.DesignLoader.setPostBackground) {
      window.DesignLoader.setPostBackground(post.bg || "");
    }

    fillNav(index);
    UI.initFontControls();
    fillProgress();

    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      description: post.excerpt || "",
      author: { "@type": "Person", name: site.name || "" },
      articleSection: post.tags || []
    });
    document.head.appendChild(ld);
  }

  function init() {
    var id = getId();
    var index = -1;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      showMissing(Boolean(id));
      return;
    }
    render(posts[index], index);
    initCopy();
  }

  init();
})();
